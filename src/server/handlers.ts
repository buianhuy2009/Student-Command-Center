import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import summarizeEmailsHandler from "./api-handlers/gemini/summarize-emails.js";
import parseAssignmentHandler from "./api-handlers/gemini/parse-assignment.js";
import assistantHandler from "./api-handlers/gemini/assistant.js";
import { SERVER_MODELS } from "./api-handlers/gemini/models.js";

dotenv.config();

let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const CANDIDATE_MODELS = SERVER_MODELS as string[];

export async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
}) {
  const ai = getGenAI();
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} attempt failed: ${err.message || err}. Trying next fallback...`);
    }
  }
  throw lastError || new Error("All candidate Gemini models failed.");
}

const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean) as string[];

function getAllowedOrigin(req: any): string | null {
  const origin = req.headers?.origin as string | undefined;
  if (!origin) return null;
  if (ALLOWED_ORIGINS.some(a => origin === a || origin.endsWith(".vercel.app"))) return origin;
  // In production, only allow configured app URL; fallback deny
  return null;
}

export function setCorsHeaders(req: { method?: string; headers?: Record<string,string> }, res: { setHeader: (k:string,v:string)=>void; status:(n:number)=>{ end:()=>void; json:(o:any)=>void } }): boolean {
  const allowed = getAllowedOrigin(req as any);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
  } else if (process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0] || "http://localhost:5173");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if ((req as any).method === "OPTIONS") {
    (res as any).status(200).end();
    return true;
  }
  return false;
}

// 1. Health Check
export async function handleHealth(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  res.status(200).json({
    status: "ok",
    platform: process.env.VERCEL ? "vercel-serverless" : "node-server",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
}

// 2. Canvas Proxy — token via POST body, origin-restricted, truncated logging
export async function handleCanvasProxy(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const targetUrl = (req.query.url as string) || (req.body?.url as string);
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Invalid URL protocol" });
    }
    // Only allow Canvas-like domains to prevent open proxy abuse
    try {
      const u = new URL(targetUrl);
      const allowedCanvas = (process.env.CANVAS_ALLOWED_HOSTS || "instructure.com,canvaslms.com").split(",").map(s=>s.trim());
      const isCanvasHost = allowedCanvas.some(h => u.hostname === h || u.hostname.endsWith("."+h));
      if (!isCanvasHost) {
        return res.status(400).json({ error: `Host not allowlisted for Canvas proxy: ${u.hostname}. Allowed: ${allowedCanvas.join(', ')}`, code: "host-not-allowlisted", host: u.hostname });
      }
    } catch {
      return res.status(400).json({ error: "Invalid target URL", code: "invalid-url" });
    }

    const headers: Record<string, string> = {
      "User-Agent": "StudentCommandCenter/1.0",
    };

    // Prefer token from POST body (not header, avoids edge log exposure); fallback to header for backwards compat
    const canvasToken = (req.body?.canvasToken as string) || req.headers["x-canvas-token"] as string;
    if (canvasToken) {
      headers["Authorization"] = `Bearer ${canvasToken}`;
    }

    // Forward method + JSON body so Canvas submissions (POST) work, not just GET sync.
    const method = ((req.method as string) || "GET").toUpperCase();
    const fetchInit: Record<string, any> = { headers, method };
    if (method !== "GET" && method !== "HEAD" && req.body && !(req.body as any).canvasToken && !(req.body as any).url) {
      try {
        fetchInit.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        headers["Content-Type"] = "application/json";
      } catch {}
    }

    const response = await fetch(targetUrl, fetchInit);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Canvas fetch failed with status ${response.status}: ${response.statusText}`,
        code: response.status === 401 ? "canvas-unauthorized" : "canvas-upstream-error",
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    res.setHeader("Content-Type", contentType);

    if (contentType.includes("json")) {
      const data = await response.json();
      return res.status(200).json(data);
    } else {
      const text = await response.text();
      return res.status(200).send(text);
    }
  } catch (err: any) {
    console.error("Canvas proxy error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch from Canvas" });
  }
}

// 3. Summarize Emails — single source of truth shared with Vercel (api-handlers).
export async function handleSummarizeEmails(req: any, res: any) {
  return summarizeEmailsHandler(req, res);
}

// 4. Quick Draft Email to Teacher
export async function handleQuickDraft(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const {
      teacherName,
      course,
      topic,
      draftType,
      studentNotes,
      tone,
      studentName,
      language,
      attachments,
      links,
    } = req.body || {};
    const ai = getGenAI();

    const prompt = `You are an expert student communication advisor.
Draft a polite, respectful, clear, and professional email from a student to their instructor/teacher.
The email can be written in English or Vietnamese depending on language parameter: "${language || "en"}".

Parameters:
- Language: ${language || "English / Tiếng Việt as appropriate"}
- Student Name: ${studentName || "Student"}
- Teacher / Professor Name: ${teacherName || "Professor"}
- Course / Subject: ${course || "Class"}
- Draft Intent / Type: ${draftType || "Clarification"}
- Topic / Specific Details: ${topic || ""}
- Student's Context / Notes: ${studentNotes || "None"}
- Desired Tone: ${tone || "Polite & Respectful / Lịch sự, tôn trọng"}
- Google Drive Attachments: ${JSON.stringify(attachments || [])}
- Included Links: ${JSON.stringify(links || [])}

Guidelines:
1. If drafting in Vietnamese:
   - Use standard respectful Vietnamese academic honorifics (e.g., "Kính gửi Thầy/Cô [Tên],", "Em tên là [Student Name], sinh viên/học sinh lớp [Course]...", "Em xin phép viết email này để...", "Em xin chân thành cảm ơn Thầy/Cô.", "Trân trọng,").
2. If drafting in English:
   - Use standard formal academic greeting (e.g. "Dear Professor [Name],", "I am writing regarding...").
3. Get straight to the point in the opening sentence.
4. If Google Drive attachments are provided, refer to them naturally in the email body (e.g. "I have attached the document [File Name] (link: [File Link]) for your review").
5. If links are provided, reference them naturally in the text.

Respond with valid JSON:
{
  "subject": "Clear email subject line in requested language",
  "body": "Full ready-to-send email body with line breaks",
  "keyPoints": ["Bullet 1 summary", "Bullet 2", "Bullet 3"]
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Quick draft error:", err);
    const { teacherName, course, topic, language, studentName } = req.body || {};
    const isVi = language === "vi";
    if (isVi) {
      res.status(200).json({
        subject: `Thắc mắc về ${topic || "bài tập"} - Môn ${course || "Học phần"}`,
        body: `Kính gửi Thầy/Cô ${teacherName || "Giảng viên"},\n\nEm hy vọng Thầy/Cô đang có một tuần làm việc thuận lợi. Em viết email này để xin phép hỏi thêm về ${
          topic || "nội dung bài tập"
        } của môn ${course || "học"}.\n\nEm đã xem lại tài liệu và hướng dẫn trên hệ thống nhưng vẫn muốn làm rõ thêm một số yêu cầu để đảm bảo hoàn thành bài đúng tiến độ.\n\nEm xin chân thành cảm ơn Thầy/Cô đã dành thời gian đọc thư.\n\nKính chúc Thầy/Cô sức khỏe,\nTrân trọng,\n${
          studentName || "Học sinh / Sinh viên"
        }`,
        keyPoints: [
          "Lời chào kính trọng tới Thầy/Cô",
          `Trình bày rõ thắc mắc về ${topic || "bài tập"}`,
          "Lời cảm ơn và kết thư lịch sự",
        ],
      });
    } else {
      res.status(200).json({
        subject: `Question regarding ${topic || "Assignment"} - ${course || "Course"}`,
        body: `Dear ${teacherName || "Professor"},\n\nI hope you're having a great week. I am writing regarding ${
          topic || "our upcoming assignment"
        } in ${course || "class"}.\n\nCould you please provide some clarification on the requirements? I want to make sure I am on the right track.\n\nThank you very much for your time and assistance.\n\nBest regards,\n${
          studentName || "Student"
        }`,
        keyPoints: [
          "Polite greeting to instructor",
          `Clear inquiry regarding ${topic || "assignment"}`,
          "Professional closing",
        ],
      });
    }
  }
}

// 5. Parse Natural Language Assignment — shared with Vercel (api-handlers).
export async function handleParseAssignment(req: any, res: any) {
  return parseAssignmentHandler(req, res);
}

// 6. AI Study Assistant Chat — shared with Vercel (api-handlers).
export async function handleAssistant(req: any, res: any) {
  return assistantHandler(req, res);
}

// 7. AI Smart-Breakdown Task Extractor (Canvas)
export async function handleExtractSubtasks(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const { assignmentName, courseName, description, dueAt, pointsPossible } = req.body || {};
    if (!assignmentName) {
      return res.status(400).json({ error: "Assignment name is required" });
    }

    const ai = getGenAI();
    const prompt = `You are an AI academic task planner for a student command center.
Given the following Canvas LMS assignment, break it down into a clear, ordered checklist of actionable sub-tasks that a student can follow step-by-step to complete the assignment.

Assignment Details:
- Name: ${assignmentName}
- Course: ${courseName || "Unknown"}
- Due Date: ${dueAt || "Not specified"}
- Points: ${pointsPossible || "N/A"}
- Description / Instructions:
${description || "No description provided. Infer reasonable sub-tasks from the assignment name."}

Guidelines:
1. Extract 3-8 concrete, actionable sub-tasks (not vague like "do research" — be specific like "Find 3 peer-reviewed sources on [topic]").
2. Order them logically (research first, then draft, then review, then submit).
3. For each sub-task, estimate minutes needed.
4. If the description is in Vietnamese, write sub-tasks in Vietnamese. Otherwise use English.

Respond with valid JSON:
{
  "subtasks": [
    { "title": "Clear actionable sub-task title", "estimatedMinutes": 20, "order": 1 },
    { "title": "Another sub-task", "estimatedMinutes": 15, "order": 2 }
  ],
  "totalEstimatedMinutes": 60,
  "difficulty": "Easy" | "Medium" | "Hard"
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Extract subtasks error:", err);
    res.status(200).json({
      subtasks: [
        { title: "Read the assignment instructions carefully", estimatedMinutes: 10, order: 1 },
        { title: "Research and gather materials", estimatedMinutes: 30, order: 2 },
        { title: "Create first draft", estimatedMinutes: 45, order: 3 },
        { title: "Review, proofread, and finalize", estimatedMinutes: 20, order: 4 },
        { title: "Submit before deadline", estimatedMinutes: 5, order: 5 },
      ],
      totalEstimatedMinutes: 110,
      difficulty: "Medium",
    });
  }
}

// 8. Dynamic Priority & Effort Estimator (Assignment Tracker)
export async function handleEstimateEffort(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const { assignments } = req.body || {};
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(200).json({ estimates: [] });
    }

    const ai = getGenAI();
    const today = new Date().toISOString().split("T")[0];
    const prompt = `You are an AI academic advisor. Analyze the following student assignments and for each one, calculate:
1. A dynamic "riskScore" from 1-10 based on: how close the due date is to today (${today}), the assignment type difficulty, and current status.
2. An "estimatedMinutes" for how long the task should take.
3. A recommended "focusOrder" (1 = do first, 2 = do second, etc.)
4. A short "aiTip" (max 12 words) with specific advice.

Assignments:
${JSON.stringify(assignments.map((a: any) => ({
  id: a.id, name: a.assignmentName, subject: a.subject, dueDate: a.dueDate, priority: a.priority, status: a.status, estimatedMinutes: a.estimatedMinutes,
})), null, 2)}

Respond with valid JSON:
{
  "estimates": [
    { "id": "matching assignment id", "riskScore": 8, "estimatedMinutes": 45, "focusOrder": 1, "aiTip": "Due tomorrow — start the outline now" }
  ]
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Estimate effort error:", err);
    const fallback = ((req.body && req.body.assignments) || []).map((a: any, i: number) => {
      const daysLeft = Math.max(0, Math.floor((new Date(a.dueDate).getTime() - Date.now()) / 86400000));
      const riskScore = Math.min(10, Math.max(1, 10 - daysLeft));
      return {
        id: a.id, riskScore, estimatedMinutes: a.estimatedMinutes || 45, focusOrder: i + 1,
        aiTip: daysLeft <= 1 ? "Due very soon — start immediately" : daysLeft <= 3 ? "Due this week — prioritize" : "On track — plan ahead",
      };
    });
    res.status(200).json({ estimates: fallback });
  }
}

// Server-side token bucket per-IP (Upstash Redis in prod, in-memory fallback)
const serverBuckets = new Map<string, { tokens: number; last: number }>();
function serverRateLimitOk(ip: string): boolean {
  const now = Date.now();
  const entry = serverBuckets.get(ip) || { tokens: 15, last: now };
  const elapsed = now - entry.last;
  if (elapsed >= 60000) { entry.tokens = 15; entry.last = now; }
  if (entry.tokens <= 0) return false;
  entry.tokens -= 1;
  serverBuckets.set(ip, entry);
  return true;
}
const dailyQuotaMap = new Map<string, { date: string; count: number }>();
function serverDailyQuotaOk(ip: string): boolean {
  const today = new Date().toISOString().slice(0,10);
  const entry = dailyQuotaMap.get(ip) || { date: today, count: 0 };
  if (entry.date !== today) { dailyQuotaMap.set(ip, { date: today, count: 1 }); return true; }
  if (entry.count >= 50) return false;
  entry.count += 1; dailyQuotaMap.set(ip, entry); return true;
}

// 9. AI Peak-Focus Chronotype Study Slot Suggester (Daily Schedule)
export async function handleGenerate(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const { contents, config, model } = req.body || {};
    if (!contents) return res.status(400).json({ error: "Missing contents" });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    if (!serverRateLimitOk(ip)) return res.status(429).json({ error: "Rate limit 15/min exceeded", text: "" });
    if (!serverDailyQuotaOk(ip)) return res.status(429).json({ error: "Daily quota 50/day exceeded", text: "" });
    const response = await generateWithModelFallback({ contents, config });
    res.status(200).json({ text: response.text || "", model: model || CANDIDATE_MODELS[0] });
  } catch (err: any) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err.message || "Generate failed", text: "" });
  }
}

export async function handleSuggestStudySlots(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;
  try {
    const { existingEvents, pendingTasks, chronotype, date } = req.body || {};
    const targetDate = date || new Date().toISOString().split("T")[0];
    const prompt = `You are an AI study planner that schedules optimal focus blocks for a student.

Today's date: ${targetDate}
Student chronotype preference: ${chronotype || "balanced (no preference)"}

Existing calendar events today (DO NOT overlap with these):
${JSON.stringify(existingEvents || [], null, 2)}

Pending tasks that need study time:
${JSON.stringify((pendingTasks || []).map((t: any) => ({
  name: t.assignmentName || t.name, subject: t.subject || t.courseName, dueDate: t.dueDate || t.dueAt, priority: t.priority, estimatedMinutes: t.estimatedMinutes || 45,
})), null, 2)}

Guidelines:
1. Suggest 2-4 study blocks of 25-50 minutes each with 5-10 min breaks between them.
2. If chronotype is "morning", prefer slots 7am-12pm. If "evening", prefer 4pm-10pm. If "balanced", spread across the day.
3. Avoid overlapping with existing events. Leave at least 15 min buffer.
4. Assign the highest-priority pending task to the first suggested slot.

Respond with valid JSON:
{
  "suggestedSlots": [
    { "startTime": "09:00", "endTime": "09:45", "taskName": "Task name", "taskSubject": "Subject", "reason": "Brief reason" }
  ],
  "chronotypeAdvice": "Short personalized tip about their study pattern"
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Suggest study slots error:", err);
    res.status(200).json({
      suggestedSlots: [
        { startTime: "09:00", endTime: "09:45", taskName: "Study Block 1", taskSubject: "General", reason: "Morning focus window" },
        { startTime: "14:00", endTime: "14:45", taskName: "Study Block 2", taskSubject: "General", reason: "Afternoon review session" },
      ],
      chronotypeAdvice: "Try studying during your most alert hours for best results!",
    });
  }
}
