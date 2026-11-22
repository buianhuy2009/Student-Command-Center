# HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY STUDENTOS (v2.21.0)

Tài liệu này hướng dẫn cài đặt, cấu hình biến môi trường, chạy thử nghiệm trên máy cá nhân và triển khai bản production lên Vercel cho ứng dụng **StudentOS**.

---

## 1. Yêu cầu hệ thống

* **Node.js:** phiên bản `>= 20.x` (khuyến nghị LTS 20 hoặc 22)
* **npm:** phiên bản `>= 10.x`
* **Git:** để đồng bộ mã nguồn
* **Tài khoản dịch vụ (tùy chọn theo tính năng dùng):**
  * Google Cloud Project (Firebase Auth + Gmail/Calendar/Drive/Sheets/Classroom OAuth Client ID)
  * Gemini API Key (Google AI Studio)
  * Groq API Key (tùy chọn cho chế độ **Fast** của AI Coach và fallback)
  * Resend API Key (tùy chọn nếu bật gửi email tự động từ server cho Báo cáo hằng ngày)

---

## 2. Cài đặt dự án từ mã nguồn

```bash
git clone https://github.com/buianhuy2009/Sutdent-Command-Center.git StudentOS
cd StudentOS
npm install
```

---

## 3. Cấu hình biến môi trường (`.env`)

Sao chép tệp mẫu `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Các biến chính trong `.env` (tham chiếu theo `.env.example`):

| Biến môi trường | Phạm vi | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Server-only | Khóa Google Gemini API dùng cho các route `/api/gemini/*` (bao gồm chế độ **Teacher** và **Professor**). |
| `GROQ_API_KEY` | Server-only | Khóa Groq API dùng cho chế độ **Fast** của AI Coach và lớp fallback dự phòng. |
| `VITE_GOOGLE_CLIENT_ID` | Client + Server | Google OAuth 2.0 Web Client ID (cho phép đăng nhập và cấp quyền Workspace). |
| `GOOGLE_CLIENT_SECRET` | Server-only | Client Secret dùng cho endpoint `/api/auth/google/exchange` và `/api/auth/google/refresh`. **Không** thêm tiền tố `VITE_`. |
| `CANVAS_ALLOWED_HOSTS` | Server-only | Danh sách tên miền Canvas LMS hợp lệ cho proxy `/api/canvas/proxy` (mặc định `instructure.com,canvaslms.com`). |
| `APP_URL`, `VITE_APP_URL` | Server / Client | URL công khai của ứng dụng (ví dụ `https://sutdent-command-center.vercel.app`). |
| `VITE_FIREBASE_*` | Client | Bộ khóa cấu hình Firebase project (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`). |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Server-only (Tùy chọn) | Dùng để máy chủ gửi trực tiếp **Báo cáo email hằng ngày (GMT+7)** tại `/api/reports/daily`. Nếu không đặt, ứng dụng tự động chuyển sang Gmail token của người dùng hoặc chế độ xem trước/`mailto:`. |

> **Lưu ý bảo mật:** Tuyệt đối không đưa `GEMINI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_CLIENT_SECRET` hoặc `RESEND_API_KEY` lên Git hoặc gắn tiền tố `VITE_`. Học sinh cũng có thể nhập khóa BYOK cá nhân trực tiếp trong *Cài đặt → Mô hình AI* (chỉ lưu trong trình duyệt).

---

## 4. Chạy ứng dụng trên máy cá nhân (Development)

Khởi chạy máy chủ Express kèm Vite middleware tại cổng mặc định `3000`:

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.  
Nếu dùng Google OAuth trên máy cục bộ, hãy đảm bảo `http://localhost:3000` nằm trong danh sách **Authorized JavaScript origins** của OAuth 2.0 Client ID trên Google Cloud Console.

---

## 5. Kiểm thử và Đóng gói Production

### Chạy bộ kiểm thử tự động (Vitest)
```bash
npm test
```

### Kiểm tra kiểu TypeScript (`tsc --noEmit`)
```bash
npm run lint
```

### Biên dịch bản Production (Frontend Vite + Backend Server)
```bash
npm run build
```

Lệnh này tạo thư mục `dist/` (PWA + bundle tĩnh) và `dist/server.cjs` (máy chủ Node/Express). Để chạy thử bản đóng gói cục bộ:

```bash
npm start
```

---

## 6. Triển khai lên Vercel

* Ứng dụng sử dụng **một** điểm vào Serverless Function duy nhất tại `api/index.js`, chuyển tiếp toàn bộ route `/api/*` qua bộ định tuyến `src/server/api-handlers/router.js` theo cấu hình `vercel.json` (tối ưu cho giới hạn 12 functions của gói Vercel Hobby).
* Khai báo các biến server (`GEMINI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_CLIENT_SECRET`, `CANVAS_ALLOWED_HOSTS`, tùy chọn `RESEND_API_KEY`) trong **Vercel Project Settings → Environment Variables**, sau đó đẩy mã lên nhánh `main` để Vercel tự động build và deploy.
