import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

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

    const { response } = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = parseJsonLoose(response?.text);
    if (!parsed || typeof parsed !== "object" || (!parsed.subject && !parsed.body)) {
      throw new Error("Invalid quick draft payload from AI");
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Quick draft error:", err);
    return sendAiFailure(res, "Quick draft failed", err);
  }
}
