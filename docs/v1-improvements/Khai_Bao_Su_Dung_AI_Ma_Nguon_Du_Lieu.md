# KHAI BÁO SỬ DỤNG AI, MÃ NGUỒN VÀ DỮ LIỆU BÊN NGOÀI — STUDENTOS (v2.21.0)

Tài liệu này công bố minh bạch toàn bộ mô hình trí tuệ nhân tạo, thư viện mã nguồn mở, dịch vụ API bên ngoài và nguyên tắc xử lý dữ liệu học sinh trong **StudentOS**.

---

## 1. Khai báo sử dụng Trí tuệ nhân tạo (AI)

### A. AI tích hợp bên trong sản phẩm (Runtime Features)

| Tính năng | Nhà cung cấp & Vai trò | Cơ chế kiểm soát & Dự phòng (Fallback) |
|---|---|---|
| **AI Study Coach — Chế độ Teacher (Mặc định)** & **Professor** | **Google Gemini API** (SDK chính thức `@google/genai` chạy qua proxy server `/api/gemini/assistant` hoặc khóa BYOK). | Có chỉ dẫn sư phạm (*tutor policy*: gợi ý từng bước, không giải hộ trực tiếp bài tập về nhà); có chuỗi fallback giữa các model Gemini khả dụng khi gặp lỗi/giới hạn tải. |
| **AI Study Coach — Chế độ Fast** | **Groq API** (`llama-3.3-70b-versatile` → fallback `llama-3.1-8b-instant`). | Định tuyến riêng khi học sinh chọn **Fast**; hiển thị rõ trên giao diện rằng **Fast** định tuyến tới **Groq**. |
| **Phân tích email & trích xuất bài tập (Gmail Radar)** | Tiền xử lý lọc từ khóa/người gửi học thuật cục bộ → gọi **Gemini API** (`/api/gemini/summarize-emails`, `/api/gemini/parse-assignment`) kèm fallback rule-based khi AI lỗi. | **Human-in-the-loop:** mọi hạn nộp AI trích xuất đều gắn nhãn chưa xác nhận cho tới khi học sinh kiểm tra, sửa môn/ngày/ưu tiên và tự bấm lưu; email AI không đọc được đưa vào hàng đợi riêng để học sinh tự xem thư gốc. |
| **Lập lịch học tập (AI Planner), Tách việc phụ, Flashcards & Góp ý bài luận** | **Gemini API** qua `/api/gemini/suggest-study-slots`, `extract-subtasks`, `estimate-effort`, `generate`. | Học sinh xem bảng **Trước → Sau**, khóa cứng lịch đã chốt và hoàn tác bất kỳ lúc nào; AI chỉ đề xuất, không tự ý ghi đè vĩnh viễn. |

### B. AI hỗ trợ trong quá trình phát triển & cải tiến (Development Assistance)
Trong quá trình phát triển phiên bản v2.21.0, tác giả có sử dụng công cụ lập trình có sự hỗ trợ của AI để phân tích lỗi, tái cấu trúc mã nguồn, viết kiểm thử đơn vị (Vitest) và biên soạn tài liệu kỹ thuật. Toàn bộ kiến trúc, quyết định thiết kế sản phẩm, chạy thử nghiệm và kiểm chứng kết quả (`npm test`, `npm run lint`, `npm run build`) đều được thực hiện và xác minh trực tiếp trên mã nguồn thực tế.

---

## 2. Khai báo mã nguồn & thư viện bên ngoài (Open-Source Dependencies)

Dựa theo `package.json` của dự án:

* **Nền tảng giao diện & Build:** `react`, `react-dom` (v19), `vite`, `vite-plugin-pwa`, `tailwindcss`, `typescript`, `esbuild`.
* **Biểu tượng, Markdown, Toán & Sơ đồ học tập:** `lucide-react`, `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `katex`, `mermaid`, `dompurify` (làm sạch HTML chống XSS), `@excalidraw/excalidraw`.
* **Quản lý trạng thái, Kéo-thả & Lưu trữ cục bộ:** `zustand`, `dexie` (IndexedDB), `@dnd-kit/core`, `@dnd-kit/sortable`.
* **Backend & Tích hợp SDK:** `express`, `firebase`, `@google/genai`, `canvas-confetti`, `web-vitals`.
* **Kiểm thử tự động:** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

---

## 3. Khai báo API & Dữ liệu bên ngoài

| Nguồn bên ngoài | Mục đích sử dụng | Quyền truy cập & Phạm vi |
|---|---|---|
| **Google OAuth 2.0 & Workspace APIs** (Gmail, Google Calendar, Google Drive, Google Sheets, Google Classroom) | Đồng bộ email học tập, lịch học, bảng theo dõi bài tập, kho tài liệu và danh sách lớp học/bài tập Classroom. | Cấp quyền theo từng tính năng (incremental scopes, ví dụ `gmail.readonly`, `calendar`, `drive.file`, `spreadsheets`, `classroom.courses.readonly`). |
| **Canvas LMS REST API** | Lấy danh sách bài tập/hạn nộp từ trường học thông qua proxy kiểm tra danh sách trắng (`CANVAS_ALLOWED_HOSTS` chống SSRF). | Học sinh tự cấu hình tên miền Canvas và Personal Access Token; bài hoàn thành tự đồng bộ xóa khỏi tracker. |
| **arXiv API & Open Library API** | Tìm kiếm bài báo khoa học và sách tham khảo miễn phí trong workspace Nghiên cứu. | API công khai chỉ đọc; liên kết trực tiếp về nguồn gốc arXiv / Open Library. |
| **Nhúng công cụ STEM công khai** (Desmos, GeoGebra, PhET Simulations) | Đồ thị tương tác và thí nghiệm mô phỏng toán/lý/hóa (được khai báo rõ trong `frame-src` của `vercel.json`). | Chỉ tải theo nhu cầu khi học sinh mở workspace tương ứng. |
| **NASA APOD API (Tùy chọn)** | Ảnh thiên văn tạo không gian thư giãn trong Cài đặt Giao diện (tắt mặc định nếu không bật). | Sử dụng qua `publicApis.ts` với khóa tùy chọn `VITE_NASA_API_KEY` hoặc `DEMO_KEY`. |
| **Resend API / Gmail Send API (Tùy chọn)** | Gửi **Báo cáo email hằng ngày (GMT+7)** theo cấu hình tự nguyện của học sinh. | Chỉ chạy khi học sinh bật opt-in trong Cài đặt. |

---

## 4. Nguyên tắc bảo mật & Dữ liệu học sinh

1. **Ưu tiên lưu trữ phía thiết bị (Local-first):** Ghi chú, lịch sử trò chuyện AI Coach, bộ thẻ Flashcard, cài đặt giao diện và cấu hình báo cáo hằng ngày được lưu trong `localStorage` / IndexedDB (Dexie) trên trình duyệt của người dùng (và đồng bộ Firebase theo tài khoản nếu đăng nhập).
2. **Proxy máy chủ không lưu trữ nội dung email/bài tập:** Các endpoint `/api/gemini/*`, `/api/canvas/proxy`, `/api/reports/daily` chỉ chuyển tiếp xử lý theo yêu cầu thời gian thực, áp dụng giới hạn tần suất (rate limiting) và kiểm tra danh sách trắng tên miền (`CANVAS_ALLOWED_HOSTS`) để ngăn chặn SSRF.
3. **Không có dữ liệu giả lập ẩn:** Mọi chế độ minh họa (như *Demo lỗi trích xuất Gmail* hoặc *Tuần học mẫu AI Planner*) đều được gắn nhãn rõ ràng là dữ liệu mẫu cho mục đích kiểm chứng và cho phép thoát/khôi phục chỉ bằng một thao tác.
