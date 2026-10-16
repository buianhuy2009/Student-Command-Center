# Kế hoạch thử nghiệm StudentOS (2–3 tuần)

Theo góp ý của giám khảo vòng loại: "thử nghiệm 2–3 tuần với một nhóm bạn xem số lần quên hạn nộp có giảm không". Liên quan: [`PHAN_HOI_GIAM_KHAO.md`](PHAN_HOI_GIAM_KHAO.md), cách đếm số liệu trong app: [`pilotStats.ts`](../src/utils/pilotStats.ts).

## Câu hỏi cần trả lời

1. Học sinh THCS dùng StudentOS có quên hạn nộp ít hơn không?
2. AI tìm bài tập và hạn nộp đúng bao nhiêu phần trăm, tính theo chính học sinh xác nhận / sửa / bác bỏ?
3. Mục "AI chưa đọc được – bạn xem giúp nhé" có giữ lại được bài tập thật mà AI hoặc Gmail đã bỏ qua không?

## Người tham gia

- 8–15 học sinh lớp 6–9, ưu tiên trường có dùng Google Classroom hoặc thầy cô gửi bài qua Gmail.
- Mỗi em có phiếu đồng ý của phụ huynh (mẫu bên dưới). Em nào cũng có thể dừng bất cứ lúc nào.
- Mỗi em có một mã ẩn danh (ứng dụng tự tạo, ví dụ `K7Q2XA`); bảng tổng hợp chỉ dùng mã này.

## Lịch trình

| Tuần | Việc | Số liệu |
|---|---|---|
| Tuần 0 (trước khi dùng) | Mỗi em ghi lại các bài tập có hạn trong 2 tuần vừa qua và số bài nộp muộn/quên (có thể đối chiếu sổ của giáo viên chủ nhiệm nếu được phép). | Số lần quên hạn / tuần (mốc so sánh) |
| Tuần 1 | Cài đặt: đăng nhập, kết nối Classroom, bật "Quét Gmail" nếu muốn; nhóm hướng dẫn 15 phút. Dùng hằng ngày. | Số liệu trong app + phiếu hỏi cuối tuần |
| Tuần 2 | Dùng hằng ngày, thử đổi lịch bằng tiếng Việt. | Như tuần 1 |
| Tuần 3 (nếu kéo dài) | Dùng tiếp, phỏng vấn ngắn 5 phút với 3–4 em. | Như tuần 1 + phỏng vấn |
| Kết thúc | Mỗi em bấm "Tải số liệu thử nghiệm" trên trang chủ và gửi file cho nhóm. | File `studentos-pilot-<mã>.json` |

## Số liệu ứng dụng tự đếm (ẩn danh)

Chỉ là số đếm theo tuần, không có tên bài, tên môn, tên thầy cô hay nội dung thư:

- `missed_deadlines`: số bài đã qua hạn mà chưa đánh dấu xong (mỗi bài đếm một lần, theo tuần của hạn nộp).
- `ai_confirmed` / `ai_edited` / `ai_later` / `ai_rejected` / `ai_no_date`: học sinh lưu đúng như AI hiểu / sửa rồi lưu / lưu để xem sau / bác bỏ ("không phải bài tập") / lưu khi AI không đọc được ngày.
- `review_dismissed`, `review_force_read`, `teacher_marked`: thao tác trong mục "Cần bạn xem".
- `due_confirmed`: số lần học sinh xác nhận một hạn "chưa xác nhận".

Độ chính xác của AI theo học sinh ≈ `ai_confirmed / (ai_confirmed + ai_edited + ai_rejected)`.

## Phiếu hỏi cuối tuần (3 câu, Google Form)

1. Tuần này em có quên hoặc nộp muộn bài nào không? Bao nhiêu bài?
2. Có lần nào AI hiểu sai hạn nộp hoặc bỏ sót bài tập không? Kể ngắn.
3. Em có muốn tiếp tục dùng StudentOS tuần sau không? Vì sao?

## Phân tích

- So sánh số lần quên hạn / tuần của từng em giữa tuần 0 và các tuần dùng app; báo cáo cả trung bình và từng em (theo mã), vì nhóm nhỏ.
- Nói rõ giới hạn: nhóm nhỏ, không có nhóm đối chứng, học sinh tự nguyện nên có thể chăm hơn bình thường, tuần 0 dựa vào trí nhớ.
- Ghi lại mọi lỗi AI các em kể lại, và thêm thư đó (đã che tên) vào bộ kiểm tra [`emails.json`](../eval/emails.json) cho lần sau.

## Lưu ý kỹ thuật

- Khi ứng dụng Google còn ở chế độ "Testing", phải thêm email của từng em vào danh sách Test users (tối đa 100), và Google bắt đăng nhập lại sau 7 ngày. Nhắc các em đăng nhập lại đầu mỗi tuần, hoặc chuyển ứng dụng sang "In production" trước khi bắt đầu.
- Trước buổi đầu, mở `https://sutdent-command-center.vercel.app/api/health?probe=1` để chắc chắn AI đang hoạt động (`"ai":{"ok":true}`).

## Phiếu đồng ý của phụ huynh (mẫu)

> **PHIẾU ĐỒNG Ý CHO CON THAM GIA THỬ NGHIỆM ỨNG DỤNG STUDENTOS**
>
> Tôi là: ……………………………… phụ huynh của em: ……………………………… lớp: ……… trường: ………………………………
>
> Tôi đã được giải thích và đồng ý cho con tham gia thử nghiệm ứng dụng học tập StudentOS trong 2–3 tuần (từ ngày ……/……/…… đến ngày ……/……/……).
>
> Tôi hiểu rằng:
> - StudentOS giúp con gom bài tập và hạn nộp từ Google Classroom và (nếu con bật) Gmail, rồi gợi ý lịch học trong tuần. Mọi bài tập AI tìm thấy đều chờ con xác nhận trước khi lưu.
> - Ứng dụng chỉ xin quyền đọc lớp học, bài tập và thông báo trên Classroom, đọc và thêm sự kiện lịch, các file do ứng dụng tạo, và (chỉ khi con bật) đọc Gmail. Ứng dụng không gửi, không xoá thư, không xem điểm, không xem danh sách bạn cùng lớp.
> - Để tìm bài tập, một phần nội dung thư/thông báo (tối đa 1.500 ký tự, đã bỏ phần trích dẫn và chữ ký) được gửi tới dịch vụ AI Google Gemini (hoặc Groq nếu Gemini lỗi). Dữ liệu không bị bán và không dùng cho quảng cáo.
> - Gia sư AI chỉ gợi ý từng bước, không làm bài hộ.
> - Nhóm thử nghiệm chỉ nhận các con số đếm ẩn danh (ví dụ số bài quên hạn mỗi tuần), không nhận tên bài, nội dung thư hay điểm số của con.
> - Con có thể dừng bất cứ lúc nào. Có thể thu hồi quyền tại https://myaccount.google.com/permissions và xoá toàn bộ dữ liệu trong ứng dụng (Cài đặt → Quyền riêng tư → Xoá toàn bộ dữ liệu).
>
> Liên hệ nhóm StudentOS: ……………………………… (điện thoại / email)
>
> Ngày ……/……/……  Chữ ký phụ huynh: ………………………  Chữ ký học sinh: ………………………
