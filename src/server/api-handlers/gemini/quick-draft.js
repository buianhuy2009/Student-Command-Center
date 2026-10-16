import { GoogleGenAI } from "@google/genai";
import { SERVER_MODELS } from "./models.js";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const CANDIDATE_MODELS = SERVER_MODELS;

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

    const response = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);
    res.status(200).json(parsed);
  } catch (err) {
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
