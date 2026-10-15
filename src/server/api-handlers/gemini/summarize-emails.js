import { GoogleGenAI } from "@google/genai";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.0-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
].filter(Boolean);

async function generateWithModelFallback(params) {
  const ai = getGenAI();
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} attempt failed: ${err.message || err}. Trying next fallback...`);
    }
  }
  throw lastError || new Error("All candidate Gemini models failed.");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { emails } = req.body || {};
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(200).json({ alerts: [] });
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    const prompt = `You are an intelligent bilingual academic email scanner for a student command center.
Analyze the following ${emails.length} emails. Note that emails may be in English or Vietnamese (tiếng Việt).
Each email carries Gmail native labelIds (SPAM, CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, CATEGORY_UPDATES, etc.) — trust them as prior.

Your tasks:
1. GMAIL-NATIVE PRIOR (do NOT use content keywords to detect spam):
   - If labelIds includes SPAM, set "isSpam": true, "category": "PROMOTION", "urgency": "INFO".
   - If labelIds includes CATEGORY_PROMOTIONS or CATEGORY_SOCIAL AND the sender is NOT academic (not classroom/canvas/moodle/.edu/teacher), set "category": "PROMOTION" (promo) or "SOCIAL" (social), "urgency": "INFO".
   - Academic senders (classroom, canvas, moodle, .edu, teacher/professor) are ALWAYS classified by content into ASSIGNMENT/EXAM/GRADE/SCHEDULE/ANNOUNCEMENT/GENERAL even when Gmail filed them under Promotions/Social.
2. FOR ACADEMIC / SCHOOL / INSTRUCTOR EMAILS ONLY:
   - Only emails genuinely from schools, teachers, professors, or academic LMS platforms (Canvas, Classroom, Blackboard) about coursework may be categorized into: "ASSIGNMENT", "EXAM", "GRADE", "SCHEDULE", "ANNOUNCEMENT", "SOCIAL", or "GENERAL".
   - Extract actionable deadlines, quizzes, test dates, homework, lab reports, or office hours.
   - Set urgency: "HIGH" for imminent school deadlines (<48h) or critical exam dates; "MEDIUM" for standard assignments/requests; "LOW" for general school info; "INFO" for promo/social.
3. LANGUAGE HANDLING:
   - Identify the language ("vi" for Vietnamese, "en" for English).
   - Write "oneLineSummary" concisely (under 14 words) in the SAME language as the email.
   - If an assignment is detected, extract title and course name cleanly.
4. DEADLINE HONESTY (highest priority, overrides all):
   - Reference date: ${todayISO} (Asia/Ho_Chi_Minh). Output dueDate ONLY as YYYY-MM-DD when the email contains an explicit date or an unambiguous relative date resolvable against the reference.
   - Accepted VI/EN forms: 18/9, 18-09, 18.09, 18/09/2026, "hạn 18/9", "nộp trước 18/9", "thứ 6 tuần này" (= upcoming Friday from reference), "ngày mai", "tomorrow", "Sept 18", "September 18th".
   - If vague ("cuối tuần này", "this weekend", "sớm", "soon", "upcoming") OR no date at all → dueDate:"", dateSource:"missing", confidence<=0.4, quote:"" or the vague phrase verbatim.
   - NEVER guess Saturday/Sunday/Monday, NEVER add +2/+3 days, NEVER copy the email-received date.
   - ALWAYS return confidence (0-1: 1.0 explicit full date, 0.7-0.9 unambiguous relative, <=0.4 missing/vague), dateSource (explicit|inferred-relative|missing), quote (exact ≤25-word substring that justifies subject+date, "" if none).

Emails to scan:
${JSON.stringify(emails, null, 2)}

Respond with valid JSON matching this schema:
{
  "alerts": [
    {
      "id": "matching email id",
      "sender": "clean sender name or role",
      "subject": "email subject",
      "oneLineSummary": "concise 1-line alert under 14 words with specific dates and action items",
      "urgency": "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "category": "ASSIGNMENT" | "EXAM" | "GRADE" | "SCHEDULE" | "ANNOUNCEMENT" | "SPAM" | "PROMOTION" | "GENERAL",
      "categoryLabel": "human-friendly label like 'Bài tập / Assignment' or 'Khuyến mãi / Promotion'",
      "isSpam": boolean,
      "spamReason": "reason if spam/promo or empty string",
      "language": "vi" | "en" | "other",
      "detectedAssignment": {
        "isAssignment": boolean,
        "name": "concise assignment name",
        "subject": "detected course/subject like Toán, Vật lý, AP Physics, Literature, etc.",
        "dueDate": "YYYY-MM-DD or empty string",
        "confidence": 0.9,
        "dateSource": "explicit|inferred-relative|missing",
        "quote": "exact <=25-word substring that justifies subject+date, empty string if none",
        "priority": "High" | "Med" | "Low"
      }
    }
  ]
}
Return only JSON, no markdown formatting.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);
    const ACADEMIC_SENDER_RE = /classroom|canvas|moodle|blackboard|\.edu|school|teacher|professor|instructor|phòng đào tạo|giáo viên/i;

    if (parsed.alerts && Array.isArray(parsed.alerts)) {
      parsed.alerts = parsed.alerts.map((alert) => {
        const raw = emails.find((e) => e.id === alert.id);
        const labels = raw?.labelIds || [];
        const senderText = `${raw?.senderEmail || ''} ${raw?.sender || ''}`;
        const isAcademicSender = ACADEMIC_SENDER_RE.test(senderText);
        // Trust Gmail native labels; never content keywords. Academic senders in
        // promo/social keep their AI content label.
        if (labels.includes('SPAM')) {
          alert.isSpam = true;
          alert.category = 'PROMOTION';
          alert.categoryLabel = alert.language === 'vi' ? 'Khuyến mãi / Thư rác' : 'Promotion / Spam';
          alert.urgency = 'INFO';
          alert.spamReason = alert.spamReason || 'Sorted by Gmail';
          if (alert.detectedAssignment) alert.detectedAssignment.isAssignment = false;
        } else if (!isAcademicSender && labels.includes('CATEGORY_PROMOTIONS')) {
          alert.isSpam = true;
          alert.category = 'PROMOTION';
          alert.categoryLabel = alert.language === 'vi' ? 'Khuyến mãi / Thư rác' : 'Promotion / Spam';
          alert.urgency = 'INFO';
          alert.spamReason = alert.spamReason || 'Sorted by Gmail';
          if (alert.detectedAssignment) alert.detectedAssignment.isAssignment = false;
        } else if (!isAcademicSender && labels.includes('CATEGORY_SOCIAL')) {
          alert.isSpam = false;
          alert.category = 'SOCIAL';
          alert.categoryLabel = 'Social';
          alert.urgency = 'INFO';
          if (alert.detectedAssignment) alert.detectedAssignment.isAssignment = false;
        }
        alert.gmailLabels = labels;
        return alert;
      });
    }
    // Post-guard: defense in depth — never let a guessed/malformed date through.
    // Div B: clamp confidence, force missing provenance when no date, strip non-ISO dates.
    if (parsed.alerts && Array.isArray(parsed.alerts)) {
      for (const a of parsed.alerts) {
        const d = (a.detectedAssignment = a.detectedAssignment || { isAssignment: false, name: '', subject: 'General', dueDate: '', priority: 'Med', confidence: 0, dateSource: 'missing', quote: '' });
        d.confidence = Math.min(1, Math.max(0, Number(d.confidence ?? (d.dueDate ? 0.7 : 0))));
        if (!d.dueDate) { d.dateSource = 'missing'; d.confidence = Math.min(d.confidence, 0.4); }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate || '')) d.dueDate = '';
      }
    }
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Email summarization error:", err);
    // Label-based fallback — no content keywords.
    const ACADEMIC_FALLBACK_RE = /classroom|canvas|moodle|blackboard|\.edu|school|teacher|professor|instructor|phòng đào tạo|giáo viên/i;
    const fallbackAlerts = ((req.body && req.body.emails) || []).map((e) => {
      const labels = e.labelIds || [];
      const isAcademic = ACADEMIC_FALLBACK_RE.test(`${e.senderEmail || ''} ${e.sender || ''}`);
      const fullText = `${e.subject || ''} ${e.snippet || ''} ${e.sender || ''}`;
      const isVietnamese =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
          fullText
        );
      let category = 'GENERAL';
      let isSpam = false;
      let urgency = 'LOW';
      let categoryLabel = isVietnamese ? 'Thông báo chung' : 'General Update';
      if (labels.includes('SPAM') || (!isAcademic && labels.includes('CATEGORY_PROMOTIONS'))) {
        category = 'PROMOTION';
        isSpam = true;
        urgency = 'INFO';
        categoryLabel = isVietnamese ? 'Khuyến mãi / Thư rác' : 'Promotion / Spam';
      } else if (!isAcademic && labels.includes('CATEGORY_SOCIAL')) {
        category = 'SOCIAL';
        urgency = 'INFO';
        categoryLabel = 'Social';
      }

      return {
        id: e.id,
        sender: e.sender || "Instructor",
        subject: e.subject || "Email Notification",
        oneLineSummary: `${(e.snippet || e.subject || "").slice(0, 75)}...`,
        urgency,
        category,
        categoryLabel,
        isSpam,
        spamReason: isSpam ? 'Sorted by Gmail' : '',
        language: isVietnamese ? "vi" : "en",
        gmailLabels: labels,
        detectedAssignment: {
          isAssignment: false,
          name: e.subject || "New Assignment",
          subject: isVietnamese ? "Môn học" : "General",
          dueDate: "",
          dateSource: "missing",
          confidence: 0,
          quote: "",
          priority: "Med",
        },
      };
    });
    res.status(200).json({ alerts: fallbackAlerts });
  }
}

// Div B (AI Deadline Trust V2) — pure helpers exported for vitest. Additive only.
export function normalizeDetectedAssignment(d) {
  const out = d || { isAssignment: false, name: '', subject: 'General', dueDate: '', priority: 'Med', confidence: 0, dateSource: 'missing', quote: '' };
  out.confidence = Math.min(1, Math.max(0, Number(out.confidence ?? (out.dueDate ? 0.7 : 0))));
  if (!out.dueDate) { out.dateSource = 'missing'; out.confidence = Math.min(out.confidence, 0.4); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.dueDate || '')) out.dueDate = '';
  return out;
}

export function normalizeAlerts(alerts) {
  for (const a of alerts || []) {
    a.detectedAssignment = normalizeDetectedAssignment(a.detectedAssignment);
  }
  return alerts;
}
