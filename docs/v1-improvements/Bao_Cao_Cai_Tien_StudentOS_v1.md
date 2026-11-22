# BÁO CÁO CẢI TIẾN SẢN PHẨM STUDENTOS — PHIÊN BẢN 1 (v2.21.0)

**Sản phẩm:** StudentOS (Student Command Center)  
**Địa chỉ triển khai:** `https://sutdent-command-center.vercel.app`  
**Kho mã nguồn:** `buianhuy2009/Sutdent-Command-Center` (nhánh `main`)  
**Ngày hoàn thiện:** 22/11/2026

---

## 1. Tóm tắt điều hành (Executive Summary)

Bám sát **"Đề cải tiến · Phiên bản 1"**, nhóm phát triển đã giữ nguyên thế mạnh cốt lõi của StudentOS — kết nối bài tập/hạn nộp từ Gmail, Google Classroom, Canvas LMS và Google Sheets cùng cơ chế lọc từ khóa trước khi gọi AI và fallback dự phòng khi AI lỗi — đồng thời giải quyết triệt để 14 vấn đề về **độ tin cậy AI**, **quyền kiểm soát của học sinh**, **sự bình tĩnh và tập trung trong giao diện**, **tính đáp ứng đa kích thước cửa sổ**, và **tài liệu minh bạch**.

Tất cả các thay đổi đều được kiểm thử tự động bằng Vitest, kiểm tra kiểu TypeScript (`tsc --noEmit`) và đóng gói production (`vite build && esbuild server.ts`).

---

## 2. Bảng đối chiếu Yêu cầu cải tiến → Giải pháp → Minh chứng

| Hạng mục | Vấn đề trước cải tiến | Giải pháp đã triển khai | Tệp mã nguồn chính |
|---|---|---|---|
| **1. Kiểm soát sai sót khi trích xuất bài tập** | AI có thể đọc nhầm hạn tương đối hoặc bỏ sót ngày nộp; thiếu nút dẫn chứng minh bạch. | Modal xác nhận môn, hạn nộp và mức ưu tiên trước khi lưu; gắn nhãn `unconfirmed` cho hạn AI đoán; hộp **"AI chưa xử lý được"** cho thư nghi ngờ/lỗi; link mở trực tiếp thư gốc; **kèm Demo mẫu lỗi** (1 thư trích sai ngày + 1 thư thiếu ngày). | `src/components/GmailRadarTab.tsx`, `src/services/gemini/` |
| **2. Giữ quyền kiểm soát lịch học** | AI xếp lại lịch dễ ghi đè kế hoạch có sẵn của học sinh. | Ưu tiên tab **Kế hoạch tuần** lên đầu luồng chính; hiển thị đối chiếu **Trước → Sau** rõ ràng trước khi áp dụng; nút **Khóa/Mở khóa** buổi học; lịch sử **Hoàn tác / Khôi phục**; **Demo tuần học mẫu** cho phép thử khóa và hoàn tác trực tiếp. | `src/components/DailyRadarTab.tsx`, `src/components/workspaces/AIPlannerWorkspace.tsx` |
| **3. Sửa lỗi đăng nhập Google Classroom** | Học sinh bị chặn hoàn toàn với lỗi *Thiếu quyền bắt buộc (`classroom.coursework.me.readonly`)* khi không tick đủ mọi ô phụ. | Bổ sung tương đương scope và phân tầng quyền tối thiểu (`classroom.courses.readonly`) trong `googleAuth.ts`; khi chỉ có quyền đọc lớp học, Classroom vẫn tải danh sách khóa học và hiển thị biểu ngữ xin bổ sung quyền bài tập. | `src/services/googleAuth.ts`, `src/services/googleClassroom.ts`, `src/components/GoogleClassroomPanel.tsx` |
| **4. Tự động đồng bộ bài tập Canvas vào Assignments & Due** | Bài tập mới từ Canvas chưa tự vào danh sách việc cần làm; bài đã hoàn thành trên Canvas vẫn tồn tại. | Hàm `reconcileCanvasAssignmentsWithTracker` tự thêm bài chưa xong mới từ Canvas, cập nhật hạn nộp khi thay đổi, tự xóa bài đã hoàn thành khỏi Assignments & Due và giữ nguyên bài thủ công/Gmail/Classroom. | `src/services/canvas.ts`, `src/components/CanvasSyncTab.tsx`, `src/App.tsx` |
| **5. Google Drive: thêm tệp từ thiết bị & liên kết ngoài** | Chỉ hiện *Student Master Assignment Tracker*, chưa cho đính kèm tệp học tập bên ngoài. | Bổ sung tải tệp từ thiết bị (lên Drive hoặc lưu cục bộ IndexedDB khi offline), dán liên kết Google Drive (Docs/Sheets/Slides/PDF), tạo Google Doc mới và phân loại huy hiệu nguồn tệp. | `src/components/GoogleDriveTab.tsx`, `src/services/googleWorkspace.ts`, `src/types.ts` |
| **6. Sửa Gmail Radar đọc cache cũ & UI gây xao nhãng** | Đọc nhầm cache `localStorage` thay vì Gmail thực; thiếu báo tiến độ khi kéo thư; giao diện thừa nút. | Đồng bộ trực tiếp từ Gmail API với chỉ báo tiến độ 2 bước (`1/2 Tải thư` → `2/2 Phân tích AI`), hiển thị rõ nguồn dữ liệu thực hay bản lưu tạm, thu gọn bộ lọc và menu `•••`. | `src/App.tsx`, `src/components/GmailRadarTab.tsx` |
| **7. AI Coach 3 chế độ (Teacher / Professor / Fast)** | Chỉ có 1 luồng phản hồi chung, chưa phân tách nhu cầu giải thích nhanh hay chuyên sâu. | Bổ sung bộ chọn 3 chế độ: **Teacher** (mặc định, qua **Gemini**), **Professor** (phân tích sâu hơn, qua **Gemini**), và **Fast** (phản hồi tức thì qua **Groq**). Giao diện chỉ công khai tên nền tảng Gemini/Groq theo đúng quy tắc bảo mật hiển thị. | `src/server/api-handlers/gemini/assistant.js`, `models.js`, `src/components/StudyAssistantChat.tsx` |
| **8. Đơn giản hóa Academic Dashboard** | Trang mở đầu quá dày đặc chữ, thẻ quá hạn gây áp lực ngay khi đăng nhập. | Thiết kế trang chủ **Calm Mode** mặc định: lời chào nhẹ nhàng, mục tiêu trong ngày, chọn trạng thái học tập, câu trích dẫn tĩnh tâm và 3 lối vào chính (Trạm tập trung, Kế hoạch tuần, AI Coach), không phô thẻ đe dọa quá hạn; giữ nút chuyển về chế độ Cổ điển. | `src/components/DashboardHome.tsx`, `src/services/layoutMode.ts` |
| **9. Khắc phục Responsive đa kích thước cửa sổ** | Khi không mở toàn màn hình hoặc chia đôi cửa sổ, thanh tiêu đề ghi chú Markdown bị đè lên nút và các cột bị kẹt. | Sửa dứt điểm bố cục 2 hàng trong `DocumentHubWorkspace`, dùng `h-dvh`, tự động thu gọn Sidebar ở độ rộng trung bình `768px–1180px`, thay lưới `lg:grid-cols-12` sang `xl:grid-cols-12` và chiều cao linh hoạt trên tất cả workspace. | `src/layouts/Shell.tsx`, `src/App.tsx`, `src/components/workspaces/DocumentHubWorkspace.tsx`, `ArxivWorkspace.tsx`, `OpenLibraryWorkspace.tsx`, `PomodoroWorkspace.tsx`, `FlashcardStudioTab.tsx` |
| **10. Báo cáo Email hằng ngày theo giờ GMT+7** | Học sinh chưa có lựa chọn nhận tổng kết bài tập và lịch học qua email mỗi ngày. | Bổ sung cấu hình đăng ký (opt-in) trong **Cài đặt → Chung**: nhập email, chọn khung giờ `00:00–23:00 (GMT+7)`, chọn nội dung, xem trước nội dung và nút **Gửi thử ngay** qua `/api/reports/daily` (hỗ trợ Resend, Gmail API, hoặc preview + `mailto:`). | `src/services/dailyReport.ts`, `src/components/DailyReportSettings.tsx`, `src/server/api-handlers/reports/daily.js` |
| **11. App Store toàn màn hình & dịu mắt** | Cửa sổ App Store nhỏ ở giữa màn hình, gắn sao đánh giá giả, nền trắng gắt và viền cam đậm gây mỏi mắt. | Mở App Store toàn màn hình, loại bỏ hoàn toàn biểu tượng sao và điểm đánh giá giả, thay nền/viền dịu mắt theo biến CSS bề mặt (`--border-hairline`) với lưới 2–3 cột thoáng đãng. | `src/components/AppStoreModal.tsx` |
| **12. Bổ sung nút Đăng xuất (Sign Out)** | Học sinh khó tìm nút đăng xuất khỏi tài khoản Google/Firebase. | Đặt nút **Đăng xuất / Đăng nhập** trực tiếp ở chân Sidebar và thẻ **Phiên tài khoản** nổi bật ngay đầu trang Cài đặt. | `src/components/Sidebar.tsx`, `src/components/AccountSettingsModal.tsx` |
| **13 & 14. Loại bỏ thanh trên rối mắt, Cài đặt toàn màn hình & chế độ Cổ điển** | Thanh trên chứa Tìm kiếm, Ngôn ngữ, Công cụ Google, AI Coach và chuông thông báo gây chật chội; Cài đặt là hộp thoại nhỏ. | Ẩn thanh trên và **bỏ hẳn chuông thông báo** ở chế độ Calm; đưa Tìm kiếm (`⌘K`) và AI Coach vào Sidebar; đưa Ngôn ngữ và Công cụ Google vào Cài đặt **toàn màn hình**; cho phép chuyển qua lại giữa **Dịu mắt (Calm)** và **Cổ điển (Classic)**. | `src/components/Navbar.tsx`, `src/components/Sidebar.tsx`, `src/components/AccountSettingsModal.tsx`, `src/layouts/Shell.tsx` |

---

## 3. Hướng dẫn minh chứng nhanh (Demo Checklist cho Ban Giám Khảo)

1. **Minh chứng trích xuất lỗi Gmail (Yêu cầu 1 & 6):** Mở **Hộp thư trường học (School inbox)** → bấm nút **Demo lỗi trích xuất AI** ở thanh đầu → chọn hai thư mẫu (*sai ngày tương đối* và *thiếu hạn nộp*) để xem nhãn `unconfirmed`, sửa lại hạn nộp đúng hoặc bấm **Mở trong Gmail** đối chiếu thư gốc.
2. **Minh chứng kiểm soát lịch học (Yêu cầu 2):** Mở **Kế hoạch tuần (Weekly plan)** → nếu lịch tuần trống bấm **Thử tuần học mẫu** → khóa một buổi học bất kỳ → chạy gợi ý AI → xem bảng đối chiếu **Trước → Sau** giữ nguyên buổi đã khóa → bấm **Hoàn tác** để khôi phục.
3. **Minh chứng 3 chế độ AI Coach (Yêu cầu 7):** Mở **AI Study Coach** ở Sidebar → chuyển giữa **Teacher (Gemini)**, **Professor (Gemini)** và **Fast (Groq)** ngay trên thanh đầu khung chat.
4. **Minh chứng Giao diện Calm vs Cổ điển & App Store / Settings toàn màn hình (Yêu cầu 8, 11–14):** Quan sát trang chủ dịu mắt không thanh trên/chuông thông báo → mở **Cài đặt** toàn màn hình hoặc **Cửa hàng công cụ** toàn màn hình không sao đánh giá giả → bật chế độ **Cổ điển** trong *Cài đặt → Giao diện* nếu muốn so sánh bản cũ.
5. **Minh chứng Responsive (Yêu cầu 9):** Thu nhỏ cửa sổ trình duyệt xuống nửa màn hình (~900px) trong mục **Ghi chú Markdown & Toán**: tiêu đề, từ khóa môn học và cụm nút *Cornell / In / Sao chép / Xuất .md* tự xuống hàng ngay ngắn, không còn đè chữ.

---

## 4. Kết quả kiểm định chất lượng trước khi phát hành

* **Kiểm thử tự động (Vitest):** chạy toàn bộ `npm test` — bao gồm bộ kiểm thử đơn vị cho Google Auth Classroom scopes, đối soát Canvas, đối soát Gmail Radar, công cụ lịch AIPlanner, định tuyến 3 chế độ AI Coach trên server và bộ lập lịch báo cáo email GMT+7.
* **Kiểm tra kiểu tĩnh:** `npm run lint` (`tsc --noEmit`) không lỗi biên dịch.
* **Đóng gói Production:** `npm run build` (`vite build && esbuild server.ts`) thành công với mã thoát `0`.
