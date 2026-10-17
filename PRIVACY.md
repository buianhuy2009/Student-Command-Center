# Privacy Policy for StudentOS (Student Command Center)

**Last Updated & Effective Date:** October 17, 2026  
**Application URL:** [https://sutdent-command-center.vercel.app](https://sutdent-command-center.vercel.app)  
**Public Policy URL:** [https://sutdent-command-center.vercel.app/privacy](https://sutdent-command-center.vercel.app/privacy)  
**Lead Developer & Contact:** Bui An Huy (`buianhuy2009@gmail.com`)  
**Repository:** [https://github.com/buianhuy2009/Sutdent-Command-Center](https://github.com/buianhuy2009/Sutdent-Command-Center)

---

## 1. Core Privacy Pledge

StudentOS is an open-source academic operating hub built specifically for middle school, high school, and university students. Our architecture is guided by the principle of **privacy by design**:
- **Zero data selling:** We never sell, rent, or trade your personal or academic information.
- **Zero behavioral advertising:** We serve no third-party advertisements and do not track you across other websites.
- **No AI model training:** Your email text, announcements, and school tasks are **never** used to train generalized artificial intelligence or machine learning foundation models.
- **Human-in-the-loop control:** The AI never automatically saves tasks or modifies your schedule without your explicit confirmation.
- **Local-first control:** Your study timetables, cached assignments, and settings reside in your device's browser memory.

---

## 2. Google OAuth 2.0 User Data & Scopes

StudentOS accesses Google Workspace services solely to aggregate your academic deadlines and timetable into a single dashboard. We practice **strict least-privilege access**, requesting only 6 essential scopes:

| Google Scope | Type | Purpose & Usage | Sent to AI? |
|---|---|---|---|
| `https://www.googleapis.com/auth/classroom.courses.readonly` | Non-sensitive | Reads course names to categorize tasks by subject. Does not access class rosters or student grades. | **No** |
| `https://www.googleapis.com/auth/classroom.coursework.me.readonly` | Non-sensitive | Reads assignment titles, descriptions, and teacher-set due dates. | **No** (structured dates are processed directly) |
| `https://www.googleapis.com/auth/classroom.announcements.readonly` | Non-sensitive | Reads teacher announcements to detect homework and rescheduled deadlines mentioned in announcement text. | **Yes** (announcement text sent to Gemini/Groq to parse dates) |
| `https://www.googleapis.com/auth/calendar.events` | Non-sensitive | Reads your schedule to prevent study session clashes and creates study blocks when you tap "Add to Calendar". Never alters or deletes your personal events. | **No** |
| `https://www.googleapis.com/auth/drive.file` | Non-sensitive | Strictly limited to files created by StudentOS (such as your Master Assignment Tracker Google Sheet) or files you select via Google Picker. Cannot view any other files in your Google Drive. | **No** |
| `https://www.googleapis.com/auth/gmail.readonly` | **Sensitive / Restricted** | **OPTIONAL:** Only requested if you explicitly turn on "Scan Gmail". Reads email sender, subject, date, and cleaned body snippet to detect homework. Never sends, modifies, or deletes emails. | **Yes** (sender, subject, and max 1,500 chars of cleaned body sent to Gemini/Groq) |

---

## 3. Google API Services User Data Policy Compliance ("Limited Use")

> **StudentOS's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.**

1. **Specific Feature Provision:** Google user data is used exclusively to deliver student-facing organizational features (deadline discovery, calendar conflict resolution, and spreadsheet syncing).
2. **Prohibition on Model Training:** Information received from Google APIs (including email and Classroom announcements) will **not** be used to train, retrain, or improve generalized machine learning or artificial intelligence models.
3. **No Advertising Transfers:** Google user data will not be transferred to third parties for personalized, retargeted, or interest-based advertising.
4. **No Human Review:** Human operators are prohibited from reading your email or school communications, except:
   - When you grant express permission to diagnose a specific technical error;
   - For security investigations (e.g., investigating abuse or system compromise);
   - In compliance with applicable law; or
   - Where the data is aggregated and anonymized for internal technical metrics.

---

## 4. Artificial Intelligence & Third-Party Processing

StudentOS utilizes Large Language Models (LLMs) to help students extract deadlines from Vietnamese and English school communications:

- **Primary AI Engine:** Google Gemini API (`gemini-flash-latest`) hosted via StudentOS serverless proxy.
- **Fallback AI Engine:** Groq API (Meta Llama 3.3) for fault tolerance if Google Gemini is temporarily unreachable.
- **Data Transmitted to AI Endpoints:**
  - **Gmail Scanner:** Sender email and name, subject line, timestamp, and up to 1,500 characters of cleaned body text (headers, quoted historical replies, and email signatures are stripped before transmission). Promotional and social category emails are ignored by default.
  - **Classroom Announcements:** Course title and announcement body text.
  - **Natural Language Rescheduler:** User-typed commands (e.g., *"Move Math on Tuesday evening to Saturday morning"*) and current timetable slots.
  - **AI Study Tutor:** Student questions submitted to the tutor panel.
- **Data NEVER Transmitted to AI:** Account passwords, Canvas API keys, school grade records, contact rosters, or personal files.
- **Human-in-the-Loop Safeguard:** All AI detections are presented in an **AI Confirm Card** with the original quote. Nothing is added to your master tracker or calendar without your explicit approval.
- **Socratic Tutor Policy:** The AI tutor provides hints, questions, and conceptual explanations; it is explicitly forbidden from solving full homework problems or authoring complete essays.

---

## 5. Canvas LMS & External Integrations

- If your institution uses Canvas LMS, you may optionally provide a personal access token or iCal feed URL.
- The Canvas API token is stored **solely in local device storage** (`localStorage`) and is never sent to our backend database.
- It communicates directly between your client browser and your school's Canvas domain to fetch assignments and due dates.

---

## 6. Data Storage, Architecture & Security

- **Client-Side / Local-First:** Assignment cache, timetables, and user preferences are saved in browser storage (IndexedDB via Dexie and `localStorage`).
- **Firebase Authentication & Firestore:** When you sign in, Firebase Authentication secures your session. Encrypted Google OAuth refresh tokens are stored in Cloud Firestore under strict per-user security rules (`request.auth.uid == userId`). No other user can access your credentials.
- **Transport Security:** All communications between your browser, the StudentOS backend proxy, Google APIs, and AI endpoints use TLS 1.3 / HTTPS encryption.

---

## 7. Child & Student Privacy (COPPA, FERPA, Decree 13/2023/NĐ-CP)

StudentOS is designed to support students (ages 11–18+):
- We do not solicit personal behavioral profiles from minors.
- We support educational privacy standards under FERPA and Vietnam's Cybersecurity Law / Decree 13/2023/NĐ-CP on Personal Data Protection.
- **Parental Rights:** Parents and legal guardians may review, download, or request the immediate deletion of their child's records by contacting `buianhuy2009@gmail.com`.

---

## 8. User Rights & Data Deletion ("Delete All My Data")

You retain full authority over your data at all times:
1. **One-Click Total Wipe:** You can tap **"Delete all my data"** inside the application's Privacy dialog. This immediately purges all browser storage, clears IndexedDB, deletes your Firestore OAuth credentials, and signs you out.
2. **Revoke Google Access:** You can revoke StudentOS's access to your Google account at any time at:  
   [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions)
3. **Data Portability:** Your master assignment table is synced to your personal Google Sheet in Google Drive, allowing you to access and export your data at any time.

---

## 9. Sandboxed STEM & Creative Workspaces

Embedded learning tools (Desmos, GeoGebra, PhET Simulations, WolframAlpha, Excalidraw, Canva) run in strictly sandboxed `<iframe>` elements. Access to camera, microphone, geolocation, and payment APIs is blocked via `Permissions-Policy` headers.

---

## 10. Contact Information

For inquiries, support, or privacy requests, please contact:
- **Developer:** Bui An Huy
- **Email:** [buianhuy2009@gmail.com](mailto:buianhuy2009@gmail.com)
- **Website:** [https://sutdent-command-center.vercel.app](https://sutdent-command-center.vercel.app)
- **Location:** Ho Chi Minh City, Vietnam
