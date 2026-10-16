# StudentOS — Đã làm gì với từng góp ý của giám khảo

Tài liệu cho vòng khu vực (hackathon 16–17/10/2026). Kết quả tự kiểm tra AI: [`eval/REPORT.md`](../eval/REPORT.md). Kế hoạch thử nghiệm: [`PILOT_PLAN.md`](PILOT_PLAN.md). Nhật ký thay đổi: [`ChangelogModal.tsx`](../src/components/ChangelogModal.tsx) (bản 2.17.0 → 2.18.x).

## 1. "AI có thể đọc sai hạn nộp… nên hiện ô xác nhận trước khi lưu"

| Góp ý | Đã làm | Xem ở đâu trong app | Bằng chứng |
|---|---|---|---|
| Ô xác nhận "AI hiểu là: môn Hoá – hạn 18/9 – ưu tiên cao. Đúng chưa?" | Mọi kết quả AI (thư Gmail, thông báo Classroom, câu gõ nhanh) đều mở một thẻ xác nhận đúng câu đó, kèm câu gốc AI đã đọc ("AI đọc thấy: …"), sửa được ngay trên thẻ. Không có gì được lưu trước khi học sinh bấm. | Gmail → chọn thư → "Kiểm tra & lưu bài tập"; Bài tập → ô thêm nhanh | [`AiConfirmCard.tsx`](../src/components/AiConfirmCard.tsx), [`AiConfirmCard.test.tsx`](../src/components/AiConfirmCard.test.tsx) |
| Hạn chưa xác nhận phải được đánh dấu rõ | Nút "Lưu, xem lại sau" giữ hạn ở trạng thái "Hạn chưa xác nhận" — hiện ở mọi dạng xem của bảng bài tập (bấm để xác nhận) và là khối viền đứt trong lịch học. Trạng thái này đi theo cả Google Sheet. | Bài tập; Lịch học tuần | [`DueTrustBadge.tsx`](../src/components/DueTrustBadge.tsx), [`trust.ts`](../src/utils/trust.ts) |
| Có nút mở lại thư gốc | "Mở thư gốc" trên thẻ xác nhận, trong hộp thư và trên bài đã lưu ("Nguồn"); thông báo Classroom có "Mở bài gốc". | Gmail; Bài tập | [`GmailRadarTab.tsx`](../src/components/GmailRadarTab.tsx) |
| Báo cho học sinh khi AI không đọc được ngày, thay vì tự đặt hạn cuối tuần | Đã xoá cả 4 chỗ tự đặt hạn (+2/+3 ngày ở máy chủ, ô thêm nhanh, chế độ offline, và "cuối tuần" trong lịch học). Không có ngày → "AI không đọc được ngày nộp — bạn chọn giúp nhé"; lịch học liệt kê riêng "Chưa có hạn nộp — AI không tự đặt hạn". | Thẻ xác nhận; Lịch học tuần | [`summarize-emails.js`](../src/server/api-handlers/gemini/summarize-emails.js), [`parse-assignment.js`](../src/server/api-handlers/gemini/parse-assignment.js), [`AIPlannerWorkspace.tsx`](../src/components/workspaces/AIPlannerWorkspace.tsx) |

Lỗi gốc chúng em tìm ra khi tự kiểm tra: AI trước đây chỉ được đọc 200 ký tự xem trước của Gmail (không có nội dung thư) và ngày gửi bị đổi sang chuỗi theo ngôn ngữ máy, nên không thể tính đúng "thứ 6 tuần này". Nay AI đọc nội dung thư (đã cắt phần trích dẫn thư cũ và chữ ký, tối đa 1.500 ký tự) và đúng thời điểm gửi. Câu lệnh mới dạy AI thứ trong tuần tiếng Việt, ngày dạng ngày/tháng, và lấy hạn MỚI khi thầy cô dời hạn. Máy chủ còn kiểm tra lại kết quả AI: thư của thầy cô không bao giờ bị xếp vào quảng cáo, thư AI bỏ sót trở thành mục cần xem.

## 2. "Những thư AI đã ẩn hoặc chưa xử lý được vẫn nên giữ ở một mục"

Tab "🔎 Cần bạn xem" và dải báo "AI chưa đọc được – bạn xem giúp nhé" gom: thư Gmail xếp vào Quảng cáo/Mạng xã hội (AI không đọc để tiết kiệm lượt — những thư có chữ như "bài tập", "kiểm tra" được đưa lên đầu), thư AI không chắc chắn, thư AI lỗi hoặc hết lượt, thư AI bỏ sót. Mỗi thư có: "Đây là bài tập", "Cho AI đọc thư này", "Đây là thầy cô" (từ đó thư từ địa chỉ này luôn được AI đọc và không bao giờ bị xếp vào quảng cáo — giải quyết đúng trường hợp thầy cô dùng Gmail cá nhân), "Không phải bài tập". Thông báo trên Google Classroom cũng được AI đọc như thư.

Xem: Gmail → "Cần bạn xem". Mã: [`GmailRadarTab.tsx`](../src/components/GmailRadarTab.tsx), [`gemini.ts`](../src/services/gemini.ts), [`googleClassroom.ts`](../src/services/googleClassroom.ts). Kiểm thử: [`GmailRadarTab.test.tsx`](../src/components/GmailRadarTab.test.tsx), [`trust.test.ts`](../src/utils/trust.test.ts).

## 3. "AI xếp lại lịch cả tuần mà không lưu bản cũ"

- Trước khi đổi bất cứ gì, AI hiện "AI muốn đổi N buổi" (dời, thêm, bỏ từng buổi), học sinh chọn "Áp dụng" hoặc "Giữ lịch cũ".
- "Lịch sử lịch học" giữ 15 bản gần nhất, "Quay lại bản này" và nút "↶ Hoàn tác".
- Mỗi buổi có "Khoá"; tự sửa giờ hoặc ngày sẽ tự khoá buổi đó. Buổi đã khoá được kiểm tra lại bằng mã sau mỗi câu trả lời của AI, nên AI không thể dời dù có cố.
- Đổi lịch bằng tiếng Việt: "Dời Toán tối thứ 3 sang sáng thứ 7", "Tuần này em bận tối thứ 5", "Mỗi buổi tối đa 45 phút" — có dấu hay không dấu đều hiểu; khi AI lỗi vẫn có bộ hiểu từ khoá dự phòng.

Xem: Lịch học tuần. Mã: [`planCommands.ts`](../src/services/planCommands.ts), [`AIPlannerWorkspace.tsx`](../src/components/workspaces/AIPlannerWorkspace.tsx). Kiểm thử: [`planCommands.test.ts`](../src/services/planCommands.test.ts) (21 ca), [`AIPlannerWorkspace.test.tsx`](../src/components/workspaces/AIPlannerWorkspace.test.tsx).

## 4. "Tự kiểm tra AI bằng 20–30 thư trường thật và khoảng 10 câu đổi lịch"

- 30 thư mô phỏng lại đúng định dạng thật (Google Classroom tiếng Việt và tiếng Anh, Canvas, thư giáo viên chủ nhiệm/bộ môn, thông báo nhà trường, Azota, OLM, vnEdu, thư quảng cáo luyện thi…), tên người và trường đều là giả: [`emails.json`](../eval/emails.json), nguồn định dạng: [`SOURCES.md`](../eval/SOURCES.md).
- 10 câu đổi lịch tiếng Việt trên một lịch mẫu có buổi bị khoá: [`schedule-commands.json`](../eval/schedule-commands.json), [`base-plan.json`](../eval/base-plan.json).
- 10 yêu cầu gửi gia sư AI (6 câu "làm hộ", 4 câu hỏi thật): [`tutor-prompts.json`](../eval/tutor-prompts.json).
- Chạy: `npx tsx scripts/eval_ai.ts email after` (và `schedule`, `tutor`), kết quả đúng/sai từng ca trong [`REPORT.md`](../eval/REPORT.md). Trình chạy: [`eval_ai.ts`](../scripts/eval_ai.ts).

Phát hiện quan trọng khi tự kiểm tra (16/10/2026): toàn bộ AI trên bản đang chạy đã ngừng hoạt động vì Google ngừng các mô hình mà ứng dụng gọi — mọi thư đều rơi vào chế độ dự phòng mà giao diện không báo. Bản 2.17.1 chuyển sang `gemini-flash-latest` và thêm trang kiểm tra `/api/health?probe=1`.

## 5. "Chọn một luồng chính… tập trung vào học sinh THCS"

Trang chủ mở bằng "Luồng chính của bạn": ① Nguồn (Gmail, Classroom, Canvas) → ② Cần bạn xác nhận → ③ Bài tập & hạn nộp → ④ Lịch học tuần. Thanh bên luôn giữ luồng này trên cùng; các công cụ khác nằm trong "Công cụ khác (thêm khi cần)". Canvas vẫn thuộc luồng chính nhưng ẩn được bằng một chạm nếu trường không dùng. Giao diện mới viết tiếng Việt trước, câu ngắn cho học sinh 11–15 tuổi.

Mã: [`MainFlowCard.tsx`](../src/components/MainFlowCard.tsx), [`Sidebar.tsx`](../src/components/Sidebar.tsx).

## 6. "Chỉ xin những quyền thật sự cần, giải thích rõ… gia sư AI chỉ gợi ý"

- Quyền Google giảm từ 13 xuống 6; quyền "hạn chế" từ 3 xuống 1 (chỉ Gmail đọc, và chỉ khi học sinh bật "Quét Gmail"). Đã bỏ: `calendar.readonly`, `spreadsheets`, `documents` (thay bằng `drive.file`: chỉ file do app tạo), danh bạ lớp `classroom.rosters.readonly`, `classroom.student-submissions.me.readonly`, `drive.readonly`, `gmail.compose` ("Soạn thư cho thầy cô" nay mở cửa sổ soạn thư của chính Gmail). Mã: [`firebase.ts`](../src/services/firebase.ts).
- Công cụ nhúng (Desmos, GeoGebra, Canva…) không còn được dùng camera, micro, vị trí, thanh toán. File chỉ được chia sẻ công khai sau khi học sinh đồng ý; tab Drive chia sẻ đúng email thầy cô.
- Trang "Quyền riêng tư" tiếng Việt cho học sinh và phụ huynh: quyền nào để làm gì, dữ liệu nào gửi cho AI nào (Gemini; Groq khi Gemini lỗi), lưu ở đâu, cách thu hồi quyền. Mã: [`PrivacyModal.tsx`](../src/components/PrivacyModal.tsx).
- Gia sư AI chỉ gợi ý từng bước, không đưa lời giải để chép, nhận ra cả câu "giai het giup em de em chep" không dấu. Mã: [`tutorPolicy.js`](../src/server/api-handlers/gemini/tutorPolicy.js).

## 7. "Thử nghiệm 2–3 tuần… xem số lần quên hạn nộp có giảm không"

Kế hoạch, phiếu đồng ý của phụ huynh và câu hỏi hằng tuần: [`PILOT_PLAN.md`](PILOT_PLAN.md). Ứng dụng tự đếm (ẩn danh, trên máy) số hạn bị lỡ mỗi tuần, số lần học sinh xác nhận / sửa / bác bỏ kết quả AI, và có nút "Tải số liệu thử nghiệm" trên trang chủ. Mã: [`pilotStats.ts`](../src/utils/pilotStats.ts).
