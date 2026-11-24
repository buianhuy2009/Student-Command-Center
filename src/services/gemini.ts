// Gemini service split — new modular imports available at ./gemini/client, ./gemini/prompts, ./gemini/rateLimiter, ./gemini/providers
// This monolith kept for compat; new code should import from modular files. Provider fallback now includes server /api/gemini/generate route fix + Groq rotation.
import {
  EmailAlert,
  EmailMessage,
  QuickDraftRequest,
  QuickDraftResponse,
  Assignment,
  CanvasAssignment,
  CalendarEvent,
  SyllabusParsedResult,
  AssignmentSubTask,
  DesmosEquation,
  StemChatTurn,
  MermaidDiagramResult,
  FlashcardItem,
  VivaTurn,
  RubricPreCheckResult,
  AgentAction,
  MathDebugResult,
  ThreeTierFeynmanResult,
  DeployedSemesterResult,
} from '../types';
import { ACADEMIC_SENDER_RE, gmailLink, isTeacherSender } from '../utils/trust';
import { cleanEmailForAI } from '../utils/emailText';
import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  GEMINI_SAFETY_MODELS,
  CLIENT_COACH_MODE_MODELS,
  VISION_CHEAPEST_MODELS,
  maskApiKey,
  getGeminiKeyMeta,
  setGeminiKeyExpiry,
  getGroqKeyMeta,
  setGroqKeyExpiry,
  getExpiryStatus,
  getClientGeminiApiKey,
  setClientGeminiApiKey,
  getClientGroqApiKey,
  setClientGroqApiKey,
  callGroqDirect,
  DAILY_QUOTA_LIMIT,
  checkDailyQuota,
  getGeminiQuotaStatus,
  type ApiKeyMeta,
} from './gemini/providers';
import { rateLimiter, canMakeGeminiRequest, GeminiRateLimiter } from './gemini/rateLimiter';
import {
  testGeminiApiKeyDetailed,
  testGroqApiKeyDetailed,
  testGeminiApiKey,
  callGemini,
  repairJsonString,
} from './gemini/client';
import { t } from './i18n';

export {
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  GEMINI_SAFETY_MODELS,
  CLIENT_COACH_MODE_MODELS,
  VISION_CHEAPEST_MODELS,
  maskApiKey,
  getGeminiKeyMeta,
  setGeminiKeyExpiry,
  getGroqKeyMeta,
  setGroqKeyExpiry,
  getExpiryStatus,
  getClientGeminiApiKey,
  setClientGeminiApiKey,
  getClientGroqApiKey,
  setClientGroqApiKey,
  callGroqDirect,
  DAILY_QUOTA_LIMIT,
  checkDailyQuota,
  getGeminiQuotaStatus,
  rateLimiter,
  canMakeGeminiRequest,
  GeminiRateLimiter,
  testGeminiApiKeyDetailed,
  testGroqApiKeyDetailed,
  testGeminiApiKey,
  callGemini,
  repairJsonString,
  type ApiKeyMeta,
};

// Vault PIN encryption via Web Crypto (AES-GCM) — use encryptApiKey/decryptApiKey before storing
export async function encryptApiKey(plaintext: string, pin: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin.padEnd(16,'0').slice(0,16)), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('scc-vault-salt'), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const b64 = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return btoa(String.fromCharCode(...bytes));
  };
  return b64(iv) + ':' + b64(ct);
}
export async function decryptApiKey(ciphertext: string, pin: string): Promise<string> {
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const [ivB64, ctB64] = ciphertext.split(':');
  const b64dec = (s:string) => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
  const iv = b64dec(ivB64); const ct = b64dec(ctB64);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin.padEnd(16,'0').slice(0,16)), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('scc-vault-salt'), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
}

async function postGeminiJsonEndpoint<T>(url: string, body: unknown, label: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const contentType = res.headers?.get?.('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(t('gem_err_non_json', { label, status: res.status, contentType: contentType || 'unknown' }));
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || t('gem_err_endpoint', { label, status: res.status, statusText: res.statusText || 'Failed' }));
  }
  return data as T;
}

async function callGeminiJson<T>(prompt: string, label: string): Promise<T> {
  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  try {
    return repairJsonString<T>(raw);
  } catch (err) {
    throw new Error(t('gem_err_json_parse', { label, msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// 1. AUTONOMOUS ACTION DISPATCHER (AGENT TOOL CALLING)
// -------------------------------------------------------------

export async function runAutonomousAgent(
  studentPrompt: string,
  appContext?: {
    activeWorkspace?: string;
    assignmentsCount?: number;
    upcomingDeadlines?: string[];
  }
): Promise<{ reply: string; actions: AgentAction[] }> {
  const systemPrompt = `You are the Autonomous Operating System Agent for StudentOS.
You are equipped with structured tools to directly manipulate the student's workspace state:

Available Actions you can output in "actions":
1. "setWorkspaceLayout": { "leftPane": "canvas"|"notes-markdown"|"desmos-graphing"|"excalidraw"|"pomodoro"|"flashcards", "rightPane": "...", "ratio": "50/50"|"60/40"|"70/30" }
2. "injectDesmosEquation": { "expressions": ["y = 2x + 1", "y = x^2"], "title": "Optional description" }
3. "createCalendarMilestones": { "events": [{ "title": "Midterm Prep", "date": "YYYY-MM-DD", "type": "Exam", "weight": 20 }] }
4. "createSRSDeck": { "deckTitle": "Topic", "subject": "Class", "cards": [{ "front": "Term", "back": "Definition", "tags": ["Tag"] }] }
5. "generateMermaidDiagram": { "code": "graph TD\\n  A --> B", "title": "System Diagram" }

Student Request:
"${studentPrompt}"

Student App Context:
${JSON.stringify(appContext || {}, null, 2)}

Respond with strict JSON:
{
  "reply": "Friendly concise explanation of what you configured for the student (max 2 sentences)",
  "actions": [
    {
      "type": "setWorkspaceLayout" | "injectDesmosEquation" | "createCalendarMilestones" | "createSRSDeck" | "generateMermaidDiagram",
      "payload": { ... }
    }
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: studentPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  try {
    const parsed = repairJsonString<{ reply: string; actions: AgentAction[] }>(raw);
    if (!parsed || typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      throw new Error(t('gem_err_agent_missing'));
    }
    return {
      reply: parsed.reply,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch (err) {
    throw new Error(t('gem_err_agent_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// 2. MULTIMODAL PHOTO-TO-LATEX DEBUGGER
// -------------------------------------------------------------

export async function debugHandwrittenMath(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<MathDebugResult> {
  const prompt = `You are a Principal STEM Professor and Math Debugger.
Analyze this image of handwritten mathematical scratch work or problem derivations.
Steps:
1. Extract the derivation line-by-line into clean LaTeX strings.
2. Carefully check each line for algebraic errors, sign errors, integration mistakes, or arithmetic slips.
3. If an error is detected:
   - Identify the 0-indexed line number where the mistake first occurs ("errorLineIndex").
   - Describe the error ("errorDescription").
   - Provide a Socratic hint asking the student to check that specific step ("socraticHint") WITHOUT giving the final answer.
4. If no error is found, set "hasError": false.

Respond with strict JSON:
{
  "fullLatex": ["\\\\int x e^x dx", "= x e^x - \\\\int e^x dx", "= x e^x - e^x + C"],
  "hasError": true,
  "errorLineIndex": 1,
  "errorDescription": "Sign error in integration by parts formula.",
  "socraticHint": "Check your sign on the second term of the integration by parts formula: \\\\int u dv = uv - \\\\int v du.",
  "solutionDerivationGuidance": ["Step 1: Check u and v assignments", "Step 2: Re-evaluate the integral"]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ],
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<MathDebugResult>(raw);
    if (!parsed || !Array.isArray(parsed.fullLatex)) {
      throw new Error(t('gem_err_math_missing'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_math_debugger', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// 3. 1-CLICK "DEPLOY SEMESTER" SYLLABUS PIPELINE
// -------------------------------------------------------------

export async function deploySemesterFromSyllabus(
  syllabus: SyllabusParsedResult
): Promise<DeployedSemesterResult> {
  const prompt = `You are an Academic Operations Orchestrator.
Take this parsed syllabus and generate:
1. Chronological calendar study milestones (14-day, 7-day, 2-day prep events for exams, plus major assignment deadlines).
2. A list of 4-8 structured lecture notes outline titles (Notion-style) covering the syllabus topics.
3. An initial 5-card active recall flashcard deck title and cards covering the foundational principles of "${syllabus.courseName}".

Parsed Syllabus Data:
${JSON.stringify(syllabus, null, 2)}

Respond with strict JSON:
{
  "createdEvents": [
    { "title": "14-Day Exam Prep: Midterm", "date": "YYYY-MM-DD", "type": "Exam Prep" },
    { "title": "7-Day Sprint: Midterm", "date": "YYYY-MM-DD", "type": "Study Sprint" }
  ],
  "createdNotes": [
    { "title": "Lecture 1: Course Foundations & Overview", "subject": "${syllabus.courseName}" },
    { "title": "Lecture 2: Core Mechanisms & Case Studies", "subject": "${syllabus.courseName}" }
  ],
  "createdDeckTitle": "${syllabus.courseName} - Core Foundations",
  "createdCards": [
    { "front": "Core concept question", "back": "Authoritative definition" }
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const data = repairJsonString<any>(raw);
    const createdEvents = Array.isArray(data?.createdEvents) ? data.createdEvents : [];
    const createdNotes = Array.isArray(data?.createdNotes) ? data.createdNotes : [];
    const createdCards = Array.isArray(data?.createdCards) ? data.createdCards : [];
    if (createdEvents.length === 0 && createdNotes.length === 0 && createdCards.length === 0) {
      throw new Error(t('gem_err_deploy_empty'));
    }

    return {
      milestonesCount: createdEvents.length,
      lectureNotesCount: createdNotes.length,
      flashcardDecksCount: createdCards.length > 0 ? 1 : 0,
      createdEvents,
      createdNotes,
      createdDeckTitle: data.createdDeckTitle || `${syllabus.courseName} Deck`,
    };
  } catch (err) {
    throw new Error(t('gem_err_deploy', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// 4. 3-TIER FEYNMAN EXPLAINER
// -------------------------------------------------------------

export async function feynmanExplainThreeTiers(
  conceptOrText: string
): Promise<ThreeTierFeynmanResult> {
  const prompt = `Apply the Feynman Technique to explain this academic concept across 3 distinct rigor tiers.
Concept / Excerpt:
"${conceptOrText}"

Respond with strict JSON:
{
  "concept": "Name of concept",
  "corePrinciple": "One sentence summary",
  "tier1_eli5": "Explain Like I'm 5: Simple words, no jargon, vivid relatable imagery",
  "tier2_highschool": "High-School Level: Intuitive physics/math foundation with clear causation",
  "tier3_undergrad": "Undergraduate Level: Rigorous academic explanation with technical nuance and governing equations/theorems",
  "analogy": "Memorable real-world everyday metaphor"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<ThreeTierFeynmanResult>(raw);
    if (!parsed || !parsed.tier1_eli5 || !parsed.tier3_undergrad) {
      throw new Error(t('gem_err_feynman_incomplete'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_feynman_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// WORKSPACE 1: Multimodal Syllabus & Task Deconstructor
// -------------------------------------------------------------

export async function parseSyllabusMultimodal(params: {
  textContent?: string;
  fileBase64?: string;
  mimeType?: string;
}): Promise<SyllabusParsedResult> {
  const parts: any[] = [];

  if (params.fileBase64 && params.mimeType) {
    parts.push({
      inlineData: {
        data: params.fileBase64,
        mimeType: params.mimeType,
      },
    });
  }

  const promptText = `You are a Principal Academic Scheduler. Analyze this syllabus document/text.
Extract:
1. Course Name and Instructor Name.
2. Major Exams (Midterms, Finals, Unit Tests) with exact or estimated dates (format YYYY-MM-DD), weight percentage, and topics covered.
3. Automatically calculate the 14-day, 7-day, and 2-day prep timeline for each exam (calculate dates based on the exam date).
4. Major assignments and homework projects with due dates and weight percent.
5. Confidence 0-1 for overall parse (1 = dates explicitly stated, 0.5 = inferred, <0.3 = ambiguous).

Provided text (if any):
${params.textContent || 'None (refer to uploaded document)'}

Respond with strict JSON:
{
  "courseName": "string",
  "instructor": "string",
  "confidence": 0.85,
  "exams": [
    {
      "examName": "Midterm Exam",
      "course": "string",
      "examDate": "YYYY-MM-DD",
      "weightPercent": 25,
      "topics": ["Topic 1", "Topic 2"],
      "confidence": 0.9,
      "timeline": {
        "prep14Days": "YYYY-MM-DD",
        "sprint7Days": "YYYY-MM-DD",
        "finalReview2Days": "YYYY-MM-DD"
      }
    }
  ],
  "keyAssignments": [
    { "title": "string", "dueDate": "YYYY-MM-DD", "weightPercent": 15, "confidence": 0.85 }
  ]
}
Return only JSON.`;

  parts.push({ text: promptText });

  const rawJson = await callGemini({
    contents: parts,
    config: {
      responseMimeType: 'application/json',
      systemInstruction: 'You extract academic syllabi into precise structured JSON milestones.',
    },
  });

  return repairJsonString<SyllabusParsedResult>(rawJson);
}

export async function deconstructAssignment(params: {
  title: string;
  description?: string;
  course?: string;
  dueAt?: string;
}): Promise<AssignmentSubTask[]> {
  const prompt = `You are an AI Academic Coach. Deconstruct the following assignment into exactly 4 concrete, actionable sub-tasks with realistic estimated minutes.
Assignment: "${params.title}"
Course: "${params.course || 'General'}"
Due Date: "${params.dueAt || 'Upcoming'}"
Instructions / Description:
${params.description || 'No detailed rubric provided. Break down typical steps for this assignment.'}

Respond with valid JSON array:
[
  {
    "id": "task-1",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 25,
    "isCompleted": false
  },
  {
    "id": "task-2",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 45,
    "isCompleted": false
  },
  {
    "id": "task-3",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 40,
    "isCompleted": false
  },
  {
    "id": "task-4",
    "title": "Final review and submission check",
    "description": "Concrete instruction",
    "estimatedMinutes": 15,
    "isCompleted": false
  }
]
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<AssignmentSubTask[]>(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(t('gem_err_no_subtasks'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_deconstruct', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// WORKSPACE 2: STEM & Interactive Calculation Lab
// -------------------------------------------------------------

export async function injectDesmosGraph(prompt: string): Promise<DesmosEquation[]> {
  const systemPrompt = `You are a Principal Computational Mathematician.
The user wants to plot mathematical curves or systems on a Desmos Graphing Calculator.
Given the user's natural language request (e.g. "Dampened sine wave", "Projectile motion with velocity 20", "Normal distribution"), generate 1 to 5 LaTeX equation strings compatible with Desmos.
Example output format:
[
  { "id": "eq1", "latex": "y = e^{-0.2x} \\\\sin(4x)", "color": "#2d70b3", "label": "Damped Sine Wave" },
  { "id": "eq2", "latex": "y = e^{-0.2x}", "color": "#c74440", "label": "Upper Envelope" },
  { "id": "eq3", "latex": "y = -e^{-0.2x}", "color": "#c74440", "label": "Lower Envelope" }
]
Use valid Desmos LaTeX (e.g. y = x^2, \\\\sin(x), \\\\cos(x), \\\\sqrt{x}). Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  try {
    const parsed = repairJsonString<DesmosEquation[]>(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(t('gem_err_no_desmos'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_desmos_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

export async function socraticStemSpar(params: {
  problemText: string;
  imageBase64?: string;
  history: StemChatTurn[];
  studentMessage: string;
}): Promise<string> {
  const parts: any[] = [];

  if (params.imageBase64) {
    parts.push({
      inlineData: {
        data: params.imageBase64,
        mimeType: 'image/jpeg',
      },
    });
  }

  const chatHistoryText = params.history
    .map((h) => `${h.role === 'user' ? 'Student' : 'Socratic Tutor'}: ${h.text}`)
    .join('\n');

  parts.push({
    text: `Problem under investigation:
"${params.problemText}"

Conversation History:
${chatHistoryText}

Student's latest response:
"${params.studentMessage}"

Strict Socratic Guidelines:
1. NEVER give the direct formula calculation or final numerical answer.
2. Ask one targeted guiding question to prompt the student to notice the next physical principle or algebraic step.
3. If the student made an algebraic or conceptual mistake, gently highlight the discrepancy without saying "you are wrong".
4. Keep the response concise (2-4 sentences max) to encourage back-and-forth dialogue.`,
  });

  return await callGemini({
    contents: parts,
    config: {
      systemInstruction: 'You are a rigorous, encouraging Socratic STEM tutor who helps students discover solutions through inquiry.',
    },
  });
}

export async function scribbleToLatex(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ latex: string; explanation: string }> {
  const prompt = `Look at this image of handwritten mathematical scratch work or derivations.
Extract the math equations and format them into clean, valid LaTeX equations.
Provide:
1. "latex": The formatted LaTeX string (using standard delimiters or display math).
2. "explanation": Brief 1-2 sentence description of what equation or derivation this represents.

Respond with valid JSON:
{
  "latex": "\\\\int_{0}^{\\\\infty} e^{-x^2} dx = \\\\frac{\\\\sqrt{\\\\pi}}{2}",
  "explanation": "Gaussian integral evaluated over positive real numbers."
}
Return only JSON.`;

  const raw = await callGemini({
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ],
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<{ latex: string; explanation: string }>(raw);
    if (!parsed || typeof parsed.latex !== 'string' || !parsed.latex.trim()) {
      throw new Error(t('gem_err_missing_latex'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_latex_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// WORKSPACE 3: Creation & Visual Thinking Studio
// -------------------------------------------------------------

export async function generateMermaidDiagram(
  topic: string,
  diagramType: 'mindmap' | 'flowchart' | 'sequence' = 'mindmap'
): Promise<MermaidDiagramResult> {
  const prompt = `You are a Systems Architect.
Create a valid Mermaid.js diagram for the following topic or notes:
"${topic}"

Diagram type desired: ${diagramType}

Guidelines:
1. Ensure the syntax is 100% valid Mermaid.js.
2. For mindmaps, use:
mindmap
  root((Central Topic))
    Branch1
      Detail1
      Detail2
    Branch2
      Detail3
3. For flowcharts, use:
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
4. Do NOT wrap in markdown backticks in the json field. Provide raw string.

Respond with valid JSON:
{
  "title": "Short title",
  "code": "raw mermaid code without backticks",
  "description": "Brief description of the concept architecture"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<MermaidDiagramResult>(raw);
    if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
      throw new Error(t('gem_err_missing_diagram'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_diagram_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// WORKSPACE 4: Active Recall & Focus Vault
// -------------------------------------------------------------

export async function synthesizeFlashcards(
  sourceText: string,
  cardCount: number = 8
): Promise<FlashcardItem[]> {
  const prompt = `Extract exactly ${cardCount} high-yield flashcards from this study material.
Focus on core definitions, key theorems, conceptual contrasts, and critical formulas that appear on exams.
Source text:
${sourceText}

Respond with valid JSON array:
[
  {
    "id": "card-1",
    "front": "Clear question or term (support LaTeX with $..$ if math)",
    "back": "Concise, authoritative definition or explanation",
    "category": "Subject Area",
    "mastered": false
  }
]
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<FlashcardItem[]>(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(t('gem_err_no_flashcards'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_flashcards', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

export async function vivaSimulatorTurn(params: {
  subject: string;
  history: VivaTurn[];
  studentAnswer: string;
}): Promise<{ score: number; feedback: string; missingPoints: string[]; nextQuestion: string }> {
  const lastTurn = params.history[params.history.length - 1];
  const prompt = `You are a University Professor conducting an Oral Defense / Viva Exam in "${params.subject}".
The student was asked:
"${lastTurn ? lastTurn.question : `Explain the foundational principles of ${params.subject}`}"

The student answered:
"${params.studentAnswer}"

Evaluate their answer:
1. Score from 0 to 100 on conceptual understanding and accuracy.
2. Constructive feedback (2 sentences).
3. 1-3 critical technical points or nuances they missed.
4. Next progressive question (raising the rigor slightly or probing deeper).

Respond with valid JSON:
{
  "score": 85,
  "feedback": "Concise assessment of what was good and what was weak.",
  "missingPoints": ["Point 1 omitted", "Point 2 omitted"],
  "nextQuestion": "The next progressive follow-up question for the oral defense"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<{ score: number; feedback: string; missingPoints: string[]; nextQuestion: string }>(raw);
    if (!parsed || typeof parsed.score !== 'number' || typeof parsed.nextQuestion !== 'string') {
      throw new Error(t('gem_err_viva_invalid'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_viva', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// WORKSPACE 5: Dynamic Document & Research Hub
// -------------------------------------------------------------

export async function socraticRubricPreCheck(params: {
  draftText: string;
  rubricText: string;
}): Promise<RubricPreCheckResult> {
  const prompt = `You are an Academic Essay Examiner.
Analyze this student draft against the provided grading rubric.

Assignment Rubric:
${params.rubricText}

Student Draft:
${params.draftText}

Evaluate:
1. Overall score out of 100.
2. Overall feedback summary.
3. Criterion-by-criterion breakdown with points earned, feedback, and concrete suggestions.
4. Top 3 actionable structural revisions the student should make before final submission.

Respond with valid JSON:
{
  "overallScore": 88,
  "overallFeedback": "Summary assessment",
  "criteria": [
    {
      "criterion": "Thesis & Argument",
      "pointsEarned": 18,
      "maxPoints": 20,
      "feedback": "Specific feedback",
      "suggestion": "How to strengthen"
    }
  ],
  "actionableRevisions": [
    "Revision 1",
    "Revision 2"
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<RubricPreCheckResult>(raw);
    if (!parsed || typeof parsed.overallScore !== 'number' || !Array.isArray(parsed.criteria)) {
      throw new Error(t('gem_err_rubric_invalid'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_rubric', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

export async function feynmanSimplify(denseText: string): Promise<{
  simplified: string;
  analogy: string;
  coreIdea: string;
}> {
  const prompt = `Apply the Feynman Technique to simplify this dense academic concept or paragraph.
Original dense text:
"${denseText}"

Provide:
1. "coreIdea": One crisp sentence capturing the essence.
2. "simplified": Plain English explanation without academic jargon (Explain Like I'm 12).
3. "analogy": A relatable everyday metaphor or real-world comparison.

Respond with valid JSON:
{
  "coreIdea": "Single sentence essence",
  "simplified": "ELI12 explanation",
  "analogy": "Everyday metaphor"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const parsed = repairJsonString<{ simplified: string; analogy: string; coreIdea: string }>(raw);
    if (!parsed || !parsed.simplified || !parsed.coreIdea) {
      throw new Error(t('gem_err_simplify_incomplete'));
    }
    return parsed;
  } catch (err) {
    throw new Error(t('gem_err_simplify_failed', { msg: err instanceof Error ? err.message : String(err) }));
  }
}

// -------------------------------------------------------------
// Existing Helper Endpoints & Legacy Support
// -------------------------------------------------------------

function alertRawEmailId(alert: EmailAlert): string {
  if (alert.rawEmail?.id) return String(alert.rawEmail.id);
  const id = String(alert.id || '');
  return id.startsWith('alert-') ? id.slice('alert-'.length) : id;
}

/**
 * Split fetched emails into already-scanned alerts (aiStatus === 'ok') and
 * emails that still need AI scanning (brand new, previously failed, or previously skipped).
 */
export function partitionEmailsForAIScan(
  emails: EmailMessage[],
  existingAlerts: EmailAlert[],
): { emailsToScan: EmailMessage[]; reusableByEmailId: Map<string, EmailAlert> } {
  const existingByEmailId = new Map<string, EmailAlert>();
  for (const alert of existingAlerts || []) {
    if (!alert) continue;
    const rawId = alertRawEmailId(alert);
    if (rawId) existingByEmailId.set(rawId, alert);
  }
  const reusableByEmailId = new Map<string, EmailAlert>();
  const emailsToScan: EmailMessage[] = [];
  for (const email of emails) {
    const prev = existingByEmailId.get(String(email.id));
    if (prev && prev.aiStatus === 'ok') {
      reusableByEmailId.set(String(email.id), { ...prev, rawEmail: email, gmailLabels: email.labelIds || prev.gmailLabels });
    } else {
      emailsToScan.push(email);
    }
  }
  return { emailsToScan, reusableByEmailId };
}

/** Merge newly scanned alerts with preserved already-scanned alerts in inbox order. */
export function mergeScannedEmailAlerts(
  emails: EmailMessage[],
  reusableByEmailId: Map<string, EmailAlert>,
  scannedAlerts: EmailAlert[],
): EmailAlert[] {
  const scannedByEmailId = new Map<string, EmailAlert>();
  for (const alert of scannedAlerts || []) {
    if (!alert) continue;
    const rawId = alertRawEmailId(alert);
    if (rawId) scannedByEmailId.set(rawId, alert);
  }
  return emails
    .map((e) => scannedByEmailId.get(String(e.id)) ?? reusableByEmailId.get(String(e.id)))
    .filter((a): a is EmailAlert => Boolean(a));
}

export async function summarizeEmailsWithGemini(
  emails: EmailMessage[],
  opts: {
    forceAI?: boolean;
    origin?: 'gmail' | 'classroom';
    onProgress?: (p: { completed: number; total: number; percent: number }) => void;
    signal?: AbortSignal;
  } = {},
): Promise<EmailAlert[]> {
  // Scan all emails regardless of Gmail Spam / Promotions / Social labels so nothing important is skipped.
  const origin = opts.origin || 'gmail';
  const isAcademicSender = (e: EmailMessage) =>
    isTeacherSender(e.senderEmail) || ACADEMIC_SENDER_RE.test(`${e.senderEmail || ''} ${e.sender || ''}`);
  const linkOf = (e: EmailMessage) => (origin === 'gmail' ? gmailLink(e.id) : (e as any).sourceUrl);
  const failed = (e: EmailMessage, reason: string): EmailAlert => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    oneLineSummary: `${(e.snippet || e.subject || '').slice(0, 90)}…`,
    urgency: 'LOW' as const,
    category: 'GENERAL' as const,
    categoryLabel: t('gem_cat_unread'),
    isSpam: false,
    gmailLabels: e.labelIds || [],
    rawEmail: e,
    aiStatus: 'failed',
    needsReview: true,
    reviewReason: reason,
    origin,
    sourceUrl: linkOf(e),
  });

  const aiEmails = emails;
  if (aiEmails.length === 0) return [];
  // Data minimisation: quoted replies + signatures cut, body capped at AI_BODY_LIMIT chars.
  const payload = aiEmails.map((e) => ({
    id: e.id,
    sender: e.sender,
    senderEmail: e.senderEmail,
    subject: e.subject,
    date: e.date,
    dateISO: e.dateISO,
    snippet: (e.snippet || '').slice(0, 300),
    body: cleanEmailForAI(e.body || e.snippet || ''),
    labelIds: e.labelIds || [],
    knownTeacher: isTeacherSender(e.senderEmail),
  }));

  opts.onProgress?.({ completed: 0, total: aiEmails.length, percent: 15 });

  let aiAlerts: EmailAlert[] | null = null;
  try {
    const SERVER_BATCH_SIZE = 10;
    const collectedRawAlerts: any[] = [];
    let anyServerSuccess = false;

    if (payload.length <= SERVER_BATCH_SIZE) {
      const data = await postGeminiJsonEndpoint<{ alerts?: any[]; model?: string | null; error?: string }>(
        '/api/gemini/summarize-emails',
        { emails: payload, today: new Date().toISOString() },
        'Summarize API'
      );
      if (
        Array.isArray(data?.alerts) &&
        data.alerts.length > 0 &&
        data.error !== 'ai_unavailable' &&
        data.alerts.some((a: any) => a?.aiStatus !== 'failed')
      ) {
        anyServerSuccess = true;
        collectedRawAlerts.push(...data.alerts);
      }
      opts.onProgress?.({ completed: aiEmails.length, total: aiEmails.length, percent: 100 });
    } else {
      for (let i = 0; i < payload.length; i += SERVER_BATCH_SIZE) {
        if (opts.signal?.aborted) {
          throw new Error('ABORTED');
        }
        const slice = payload.slice(i, i + SERVER_BATCH_SIZE);
        const data = await postGeminiJsonEndpoint<{ alerts?: any[]; model?: string | null; error?: string }>(
          '/api/gemini/summarize-emails',
          { emails: slice, today: new Date().toISOString() },
          'Summarize API'
        );
        if (
          Array.isArray(data?.alerts) &&
          data.alerts.length > 0 &&
          data.error !== 'ai_unavailable' &&
          data.alerts.some((a: any) => a?.aiStatus !== 'failed')
        ) {
          anyServerSuccess = true;
          collectedRawAlerts.push(...data.alerts);
        }
        const doneCount = Math.min(payload.length, i + slice.length);
        opts.onProgress?.({
          completed: doneCount,
          total: payload.length,
          percent: Math.round(15 + (doneCount / payload.length) * 85),
        });
      }
    }

    if (anyServerSuccess) {
      const byId = new Map<string, any>(collectedRawAlerts.map((a: any) => [String(a.id), a]));
      aiAlerts = aiEmails.map((src) => {
        const alert = byId.get(String(src.id));
        if (!alert) return failed(src, 'ai_omitted');
        return { ...alert, gmailLabels: src.labelIds || [], rawEmail: src, origin, sourceUrl: linkOf(src) } as EmailAlert;
      });
    }
  } catch (error: any) {
    if (error?.message === 'ABORTED' || opts.signal?.aborted) {
      throw error;
    }
    console.warn('Summarize emails API failed, checking client AI fallback:', error);
  }

  // Client-side BYOK fallback when server /api/gemini/summarize-emails is unavailable or unconfigured.
  if (!aiAlerts && (getClientGeminiApiKey() || getClientGroqApiKey())) {
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const runDirectBatch = async (chunkPayload: typeof payload) => {
        const prompt = `Read these school emails for a student and return JSON classifying each email.
Today: ${todayIso}. Resolve relative dates from each email's dateISO/date. Never invent a dueDate (use "" if unclear).
Teachers/schools/LMS senders are NEVER PROMOTION or SPAM.
Emails:
${JSON.stringify(chunkPayload)}

Return ONLY JSON:
{"alerts":[{"id":"same id","sender":"clean sender name","subject":"email subject","oneLineSummary":"under 16 words in email language","urgency":"HIGH|MEDIUM|LOW|INFO","category":"ASSIGNMENT|EXAM|GRADE|SCHEDULE|ANNOUNCEMENT|SPAM|PROMOTION|SOCIAL|GENERAL","categoryLabel":"short label","isSpam":false,"spamReason":"","language":"vi|en|other","confidence":0.9,"detectedAssignment":{"isAssignment":true,"name":"short task name","subject":"subject","dueDate":"YYYY-MM-DD or empty","dueConfidence":"explicit|relative|none","dueEvidence":"exact quote or empty","priority":"High|Med|Low"}}]}`;
        const rawText = getClientGeminiApiKey()
          ? await callGemini({
              candidateModels: [GEMINI_FALLBACK_MODEL, GEMINI_DEFAULT_MODEL, 'gemma-4-31b-it', 'gemma-4-26b-a4b-it'],
              contents: prompt,
              config: { responseMimeType: 'application/json', temperature: 0.1 },
            })
          : await callGroqDirect(prompt, true);
        const parsed = repairJsonString<{ alerts?: any[] }>(rawText);
        return Array.isArray(parsed?.alerts) ? parsed.alerts : [];
      };

      const directList: any[] = [];
      const CHUNK_SIZE = 10;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        if (opts.signal?.aborted) break;
        try {
          directList.push(...(await runDirectBatch(payload.slice(i, i + CHUNK_SIZE))));
        } catch (chunkErr) {
          console.warn('Client email batch failed:', chunkErr);
        }
        const doneCount = Math.min(payload.length, i + CHUNK_SIZE);
        opts.onProgress?.({
          completed: doneCount,
          total: payload.length,
          percent: Math.round(15 + (doneCount / payload.length) * 85),
        });
      }
      if (directList.length > 0) {
        const byId = new Map<string, any>(directList.filter((a) => a?.id).map((a: any) => [String(a.id), a]));
        aiAlerts = aiEmails.map((src) => {
          const alert = byId.get(String(src.id));
          if (!alert) return failed(src, 'ai_omitted');
          const academic = isAcademicSender(src);
          const labels = src.labelIds || [];
          const cat = alert.category === 'PROMOTION' || alert.category === 'SPAM' ? (academic ? 'GENERAL' : alert.category) : alert.category || 'GENERAL';
          const det = alert.detectedAssignment;
          if (det && !/^\d{4}-\d{2}-\d{2}$/.test(String(det.dueDate || ''))) {
            det.dueDate = '';
            det.dueConfidence = 'none';
          }
          return {
            ...alert,
            category: cat,
            isSpam: academic ? false : Boolean(alert.isSpam),
            aiStatus: 'ok' as const,
            gmailLabels: labels,
            rawEmail: src,
            origin,
            sourceUrl: linkOf(src),
          } as EmailAlert;
        });
      }
    } catch (directErr) {
      console.error('Client email summarization fallback failed:', directErr);
    }
  }

  if (!aiAlerts) {
    aiAlerts = aiEmails.map((e) => failed(e, 'ai_failed'));
  }
  const byId = new Map<string, EmailAlert>();
  aiAlerts.forEach((a) => byId.set(a.id, a));
  // Preserve original inbox order; every fetched email stays visible somewhere.
  return emails.map((e) => byId.get(e.id)).filter((a): a is EmailAlert => Boolean(a));
}

export async function generateQuickDraft(request: QuickDraftRequest): Promise<QuickDraftResponse> {
  return await postGeminiJsonEndpoint<QuickDraftResponse>('/api/gemini/quick-draft', request, 'Quick draft API');
}

export async function parseNaturalLanguageAssignment(text: string): Promise<Partial<Assignment>> {
  return await postGeminiJsonEndpoint<Partial<Assignment>>('/api/gemini/parse-assignment', { text }, 'Parse assignment API');
}

export type AiCoachMode = 'quick' | 'balanced' | 'reasoning' | 'apex';
export type LegacyAiCoachMode = AiCoachMode | 'fast' | 'teacher' | 'professor';

export function normalizeAiCoachMode(raw?: string | null): AiCoachMode {
  switch (raw) {
    case 'quick':
    case 'fast':
      return 'quick';
    case 'balanced':
    case 'teacher':
      return 'balanced';
    case 'reasoning':
    case 'professor':
    case 'deep':
      return 'reasoning';
    case 'apex':
    case 'deepest':
      return 'apex';
    default:
      return 'balanced';
  }
}

export async function sendStudyAssistantMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context?: any,
  rawMode: LegacyAiCoachMode = 'balanced'
): Promise<string> {
  const mode = normalizeAiCoachMode(rawMode);
  try {
    const data = await postGeminiJsonEndpoint<{ reply?: string; model?: string; provider?: string }>(
      '/api/gemini/assistant',
      { messages, context, mode },
      'Study assistant API'
    );
    if (!data?.reply || !String(data.reply).trim()) {
      throw new Error(t('gem_err_assistant_empty'));
    }
    return String(data.reply);
  } catch (err) {
    const historyText = messages.map((m) => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.content}`).join('\n');
    const prompt = `Student context:\n${JSON.stringify(context || {}).slice(0, 6000)}\n\nConversation:\n${historyText}`;
    if (mode === 'quick' && getClientGeminiApiKey()) {
      try {
        const reply = await callGemini({
          candidateModels: [...CLIENT_COACH_MODE_MODELS.quick],
          contents: prompt,
          config: {
            systemInstruction: 'You are Student Command Coach. Be concise, accurate, and give step-by-step hints without doing homework directly.',
          },
        });
        if (reply.trim()) return reply.trim();
      } catch {}
    }
    if (mode === 'quick' && getClientGroqApiKey()) {
      const reply = await callGroqDirect(prompt, false);
      if (reply.trim()) return reply.trim();
    }
    if (getClientGeminiApiKey() || getClientGroqApiKey()) {
      const candidateModels = [...(CLIENT_COACH_MODE_MODELS[mode] || CLIENT_COACH_MODE_MODELS.balanced)];
      const reply = await callGemini({
        candidateModels,
        contents: prompt,
        config: {
          systemInstruction: 'You are Student Command Coach. Be concise, accurate, and give step-by-step hints without doing homework directly.',
        },
      });
      if (reply.trim()) return reply.trim();
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export type NoteScanMode = 'markdown' | 'verbatim' | 'summary';

export interface NoteScanResult {
  title: string;
  subject: string;
  text: string;
  keyTerms: string[];
  model?: string;
}

export async function extractTextFromNoteImage(params: {
  imageBase64: string;
  mimeType: string;
  formatMode?: NoteScanMode;
}): Promise<NoteScanResult> {
  const formatMode = params.formatMode || 'markdown';
  try {
    const data = await postGeminiJsonEndpoint<NoteScanResult>(
      '/api/gemini/extract-notes',
      {
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        formatMode,
      },
      'Note scanner API'
    );
    if (!data?.text || !String(data.text).trim()) {
      throw new Error(t('scanner_err_empty'));
    }
    return {
      title: String(data.title || '').trim() || t('scanner_default_title'),
      subject: String(data.subject || '').trim() || t('dochub_subject_general'),
      text: String(data.text),
      keyTerms: Array.isArray(data.keyTerms) ? data.keyTerms.map(String) : [],
      model: data.model,
    };
  } catch (err) {
    if (!getClientGeminiApiKey()) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    const modePrompt =
      formatMode === 'verbatim'
        ? 'Transcribe every visible word, line, heading, and formula verbatim in clean plain text or markdown without summarizing.'
        : formatMode === 'summary'
          ? 'Transcribe the key points from this note image into a structured study outline with headings, bullet points, definitions, and formulas.'
          : 'Transcribe all handwritten or printed notes in this image into clean, well-structured Markdown. Preserve headings, lists, and convert any math formulas into KaTeX delimiters ($...$ inline, $$...$$ display).';
    const raw = await callGemini({
      candidateModels: [...VISION_CHEAPEST_MODELS],
      skipGroqFallback: true,
      contents: [
        { inlineData: { data: params.imageBase64, mimeType: params.mimeType } },
        {
          text: `${modePrompt}
Respond with strict JSON:
{
  "title": "Short descriptive title for these notes",
  "subject": "Detected school subject or General",
  "text": "The full extracted note content",
  "keyTerms": ["term 1", "term 2"]
}`,
        },
      ],
      config: { responseMimeType: 'application/json' },
    });
    try {
      const parsed = repairJsonString<NoteScanResult>(raw);
      if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
        return {
          title: String(parsed.title || '').trim() || t('scanner_default_title'),
          subject: String(parsed.subject || '').trim() || t('dochub_subject_general'),
          text: parsed.text.trim(),
          keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.map(String) : [],
        };
      }
    } catch {}
    const fallbackText = raw.trim();
    if (!fallbackText) throw new Error(t('scanner_err_empty'));
    return {
      title: t('scanner_default_title'),
      subject: t('dochub_subject_general'),
      text: fallbackText,
      keyTerms: [],
    };
  }
}

export interface EffortEstimate {
  id: string;
  riskScore: number;
  estimatedMinutes: number;
  focusOrder: number;
  aiTip: string;
}

export interface SubtaskResult {
  subtasks: { title: string; estimatedMinutes: number; order: number }[];
  totalEstimatedMinutes: number;
  difficulty: string;
}

export interface StudySlotSuggestion {
  startTime: string;
  endTime: string;
  taskName: string;
  taskSubject: string;
  reason: string;
}

export interface StudySlotResult {
  suggestedSlots: StudySlotSuggestion[];
  chronotypeAdvice: string;
}

export async function extractSubtasksFromCanvas(assignment: CanvasAssignment): Promise<SubtaskResult> {
  return await postGeminiJsonEndpoint<SubtaskResult>(
    '/api/gemini/extract-subtasks',
    {
      assignmentName: assignment.name,
      courseName: assignment.courseName,
      description: assignment.description,
      dueAt: assignment.dueAt,
      pointsPossible: assignment.pointsPossible,
    },
    'Extract subtasks API'
  );
}

export async function estimateAssignmentEffort(assignments: Assignment[]): Promise<EffortEstimate[]> {
  const notDone = assignments.filter((a) => a.status !== 'Done');
  if (notDone.length === 0) return [];

  const data = await postGeminiJsonEndpoint<{ estimates?: EffortEstimate[] }>(
    '/api/gemini/estimate-effort',
    { assignments: notDone },
    'Estimate effort API'
  );
  return Array.isArray(data.estimates) ? data.estimates : [];
}

export async function suggestStudySlots(
  existingEvents: CalendarEvent[],
  pendingTasks: Assignment[],
  chronotype?: string,
  date?: string
): Promise<StudySlotResult> {
  return await postGeminiJsonEndpoint<StudySlotResult>(
    '/api/gemini/suggest-study-slots',
    { existingEvents, pendingTasks, chronotype, date },
    'Suggest study slots API'
  );
}

// -------------------------------------------------------------
// 1. AI Interactive Quiz Generator
// -------------------------------------------------------------
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

export async function generateInteractiveQuiz(topicOrNotes: string): Promise<QuizQuestion[]> {
  const prompt = `You are an expert university examiner and professor.
Based on the following lecture notes or study topic:
"${topicOrNotes.slice(0, 5000)}"

Generate exactly 5 high-yield multiple-choice practice quiz questions to test deep understanding.
Write any math with KaTeX delimiters: inline $...$, display $$...$$ (one block per line, never two on one line).
Return a JSON array of questions with this exact format:
[
  {
    "id": "q1",
    "question": "What is ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Option A is correct because...",
    "topic": "Key Sub-topic"
  }
]
Output ONLY valid raw JSON.`;

  const parsed = await callGeminiJson<QuizQuestion[]>(prompt, 'Interactive quiz generation');
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(t('gem_err_quiz_empty'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 2. AI Daily Study Planner
// -------------------------------------------------------------
export interface DailyStudyPlanResult {
  blocks: {
    time: string;
    task: string;
    strategy: string;
    durationMinutes: number;
  }[];
  summary: string;
  motivationTip: string;
}

export async function generateDailyStudyPlan(params: {
  tasks: string[];
  energy: 'low' | 'medium' | 'high';
  hoursAvailable: number;
}): Promise<DailyStudyPlanResult> {
  const prompt = `You are a master academic cognitive coach.
A student has ${params.hoursAvailable} available study hours today.
Their current energy level is: ${params.energy.toUpperCase()}.
Their pending assignment tasks are:
${params.tasks.map((t) => `- ${t}`).join('\n')}

Design an optimal time-blocked Pomodoro daily study plan for today.
Factor in cognitive load: if energy is high, tackle hard analytical tasks first. If energy is low, start with active recall or low-friction review.
Return ONLY raw JSON in this structure:
{
  "blocks": [
    {
      "time": "09:00 - 09:50",
      "task": "Task Name & Focus Goal",
      "strategy": "Active Recall / Deep Work / Problem Set",
      "durationMinutes": 50
    }
  ],
  "summary": "1-sentence strategic summary of today's study blueprint",
  "motivationTip": "Brief high-impact psychological tip"
}`;

  const parsed = await callGeminiJson<DailyStudyPlanResult>(prompt, 'Daily study plan generation');
  if (!parsed || !Array.isArray(parsed.blocks)) {
    throw new Error(t('gem_err_daily_plan_invalid'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 3. Google Scholar & Zotero Academic Citation Generator
// -------------------------------------------------------------
export interface AcademicCitationResult {
  title: string;
  authors: string;
  year: string;
  apa: string;
  mla: string;
  chicago: string;
  bibtex: string;
  inText: string;
}

export async function generateCitations(queryOrTitle: string): Promise<AcademicCitationResult> {
  const prompt = `You are an expert academic librarian and reference formatting engine.
Generate accurate academic bibliographic citations for this source, research topic, or book:
"${queryOrTitle}"

Return ONLY a raw JSON object with:
{
  "title": "Exact Title of Book / Article",
  "authors": "Author Name(s)",
  "year": "Publication Year",
  "apa": "Complete APA 7th Edition citation string",
  "mla": "Complete MLA 9th Edition citation string",
  "chicago": "Complete Chicago 17th Edition citation string",
  "bibtex": "@article{key,\\n  author = {...},\\n  title = {...}\\n}",
  "inText": "(Author, Year)"
}`;

  const parsed = await callGeminiJson<AcademicCitationResult>(prompt, 'Academic citation generation');
  if (!parsed || (!parsed.apa && !parsed.mla && !parsed.bibtex)) {
    throw new Error(t('gem_err_citations_incomplete'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 4. AI Grade & Final Exam Goal Predictor
// -------------------------------------------------------------
export interface GradePredictionResult {
  requiredFinalScore: number;
  isPossible: boolean;
  status: 'Guaranteed' | 'Achievable' | 'Challenging' | 'High Risk';
  feedback: string;
}

export function calculateGradePrediction(params: {
  currentGrade: number; // e.g. 84 (out of 100)
  desiredGrade: number; // e.g. 90 (out of 100)
  finalExamWeight: number; // e.g. 30 (percent)
}): GradePredictionResult {
  const { currentGrade, desiredGrade, finalExamWeight } = params;
  const currentWeight = 100 - finalExamWeight;

  // Formula: Desired = (Current * (100 - FinalWeight) + FinalScore * FinalWeight) / 100
  // FinalScore = (Desired * 100 - Current * CurrentWeight) / FinalWeight
  const requiredFinalScore = Math.round(((desiredGrade * 100 - currentGrade * currentWeight) / finalExamWeight) * 10) / 10;

  let status: 'Guaranteed' | 'Achievable' | 'Challenging' | 'High Risk' = 'Achievable';
  let feedback = '';

  if (requiredFinalScore <= 0) {
    status = 'Guaranteed';
    feedback = `You have mathematically already locked in your desired grade! Even with 0% on the final, your score is secured.`;
  } else if (requiredFinalScore <= 75) {
    status = 'Achievable';
    feedback = `Very reachable target. A standard revision schedule will easily achieve this.`;
  } else if (requiredFinalScore <= 90) {
    status = 'Challenging';
    feedback = `Achievable with focused effort. Plan at least 3 deep Pomodoro review sessions.`;
  } else if (requiredFinalScore <= 100) {
    status = 'High Risk';
    feedback = `High score needed on the final exam. Prioritize high-weight topics and active recall.`;
  } else {
    status = 'High Risk';
    feedback = `Mathematically requires extra credit or curving as ${requiredFinalScore}% exceeds 100%.`;
  }

  return {
    requiredFinalScore,
    isPossible: requiredFinalScore <= 100,
    status,
    feedback,
  };
}

// -------------------------------------------------------------
// 5. Syllabus PDF & Course Parser
// -------------------------------------------------------------
export interface ParsedSyllabusData {
  courseTitle: string;
  instructor: string;
  email: string;
  officeHours: string;
  gradingBreakdown: { item: string; weightPercent: number }[];
  deadlines: { title: string; dueDate: string; type: string; points?: number }[];
}

export async function parseSyllabusContent(syllabusText: string): Promise<ParsedSyllabusData> {
  const prompt = `You are an academic course coordinator.
Extract the key course structure from this syllabus text:
"${syllabusText.slice(0, 7000)}"

Return ONLY valid JSON matching this exact structure:
{
  "courseTitle": "Course Name / Code",
  "instructor": "Instructor Name",
  "email": "instructor@university.edu",
  "officeHours": "Mon/Wed 2-4pm",
  "gradingBreakdown": [
    { "item": "Midterm Exam", "weightPercent": 25 },
    { "item": "Final Exam", "weightPercent": 35 },
    { "item": "Homework Problem Sets", "weightPercent": 20 },
    { "item": "Laboratory Reports", "weightPercent": 20 }
  ],
  "deadlines": [
    { "title": "Homework 1", "dueDate": "2026-09-15", "type": "Homework", "points": 100 },
    { "title": "Midterm Exam", "dueDate": "2026-10-20", "type": "Exam", "points": 100 }
  ]
}`;

  const parsed = await callGeminiJson<ParsedSyllabusData>(prompt, 'Syllabus parser');
  if (!parsed || typeof parsed.courseTitle !== 'string') {
    throw new Error(t('gem_err_syllabus_incomplete'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 6. AI "Why Is This Hard?" Cognitive Deconstruction
// -------------------------------------------------------------
export interface WhyIsThisHardResult {
  cognitiveBottlenecks: string[];
  coreDifficultyReason: string;
  recommendedStepByStepPlan: string[];
  prerequisiteConcepts: string[];
  estimatedPomodoros: number;
}

export async function explainWhyIsThisHard(params: {
  title: string;
  courseName?: string;
  description?: string;
}): Promise<WhyIsThisHardResult> {
  const prompt = `You are an elite cognitive learning specialist and academic tutor.
Analyze this academic assignment:
- Title: "${params.title}"
- Course: "${params.courseName || 'General Academic'}"
- Description / Prompt: "${params.description ? params.description.slice(0, 3000) : 'Standard coursework'}"

Deconstruct why students find this specific type of assignment difficult, what conceptual traps exist, and provide a clear step-by-step approach.

Return ONLY valid JSON matching this exact structure:
{
  "coreDifficultyReason": "2-3 concise sentences explaining the exact cognitive challenge (e.g., synthesis of disparate theorems, ambiguous requirements, or high working memory load).",
  "cognitiveBottlenecks": [
    "Common student pitfall 1",
    "Common student pitfall 2",
    "Common student pitfall 3"
  ],
  "recommendedStepByStepPlan": [
    "Phase 1: Scope & gather definitions",
    "Phase 2: Outline or draft initial derivation",
    "Phase 3: Verify edge cases & polish"
  ],
  "prerequisiteConcepts": [
    "Fundamental Concept 1",
    "Fundamental Concept 2"
  ],
  "estimatedPomodoros": 3
}`;

  const parsed = await callGeminiJson<WhyIsThisHardResult>(prompt, 'Cognitive difficulty deconstruction');
  if (!parsed || !parsed.coreDifficultyReason || !Array.isArray(parsed.cognitiveBottlenecks)) {
    throw new Error(t('gem_err_deconstruct_incomplete'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 7. AI Essay Proofreader & Thesis Strength Analyzer
// -------------------------------------------------------------
export interface EssayAnalysisResult {
  thesisEvaluation: {
    thesisText: string;
    strengthRating: 'Strong' | 'Moderate' | 'Weak' | 'Missing';
    critique: string;
    suggestedRefinement: string;
  };
  structuralFlow: {
    overallCoherence: string;
    transitionWeaknesses: string[];
  };
  evidenceAndLogic: {
    unsupportedClaims: string[];
    logicalPraise: string[];
  };
  actionableNextSteps: string[];
}

export async function analyzeEssayDraft(params: {
  essayDraft: string;
  rubricOrPrompt?: string;
}): Promise<EssayAnalysisResult> {
  const prompt = `You are an expert university writing fellow.
Analyze the following essay draft:
"${params.essayDraft.slice(0, 8000)}"

Assignment Prompt / Context: "${params.rubricOrPrompt ? params.rubricOrPrompt.slice(0, 2000) : 'General academic essay'}"

Evaluate thesis clarity, evidence-to-claim support, and structural coherence.

Return ONLY valid JSON:
{
  "thesisEvaluation": {
    "thesisText": "Identified thesis sentence or main claim",
    "strengthRating": "Strong",
    "critique": "Specific evaluation of why the claim is arguable/weak",
    "suggestedRefinement": "An improved, more precise thesis statement"
  },
  "structuralFlow": {
    "overallCoherence": "Brief evaluation of argument progression",
    "transitionWeaknesses": [
      "Paragraph 2 to 3 abrupt leap without topic transition"
    ]
  },
  "evidenceAndLogic": {
    "unsupportedClaims": [
      "Claim about X lacks citation or concrete data"
    ],
    "logicalPraise": [
      "Well-constructed rebuttal in paragraph 4"
    ]
  },
  "actionableNextSteps": [
    "Step 1 to revise",
    "Step 2 to revise",
    "Step 3 to revise"
  ]
}`;

  const parsed = await callGeminiJson<EssayAnalysisResult>(prompt, 'Essay draft analysis');
  if (!parsed || !parsed.thesisEvaluation) {
    throw new Error(t('gem_err_essay_incomplete'));
  }
  return parsed;
}

// -------------------------------------------------------------
// 8. Socratic Tutor Dialogue Engine
// -------------------------------------------------------------
export interface SocraticTurn {
  role: 'user' | 'model';
  content: string;
}

export async function socraticTutorStep(params: {
  topic: string;
  history: SocraticTurn[];
  userMessage: string;
}): Promise<string> {
  const historyText = params.history
    .map((turn) => `${turn.role === 'user' ? 'Student' : 'Socratic Tutor'}: ${turn.content}`)
    .join('\n');

  const prompt = `You are a world-class Socratic Tutor.
Topic: "${params.topic}"

Rules:
1. NEVER just dump the final answer or full derivation.
2. Ask one clear, probing, diagnostic question that leads the student to discover the principle themselves.
3. If the student answers correctly, validate with enthusiasm and ask the next step or edge case question.
4. If the student is confused or wrong, gently identify where their mental model broke down and offer a simpler analogy or intermediate question.
5. Keep your response under 100 words. Be encouraging and rigorous.

Conversation History:
${historyText}
Student: ${params.userMessage}
Socratic Tutor:`;

  const raw = await callGemini({ contents: prompt });
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(t('gem_err_tutor_empty'));
  }
  return trimmed;
}

