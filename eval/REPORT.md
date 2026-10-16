# StudentOS AI test report

Test set: [`emails.json`](emails.json) (30 recreated school emails, fictional people, formats copied from real Google Classroom, Canvas, teacher, school and EdTech emails — see [`SOURCES.md`](SOURCES.md)), [`schedule-commands.json`](schedule-commands.json) (10 Vietnamese reschedule sentences on [`base-plan.json`](base-plan.json)) and [`tutor-prompts.json`](tutor-prompts.json) (10 tutor requests). Runner: [`eval_ai.ts`](../scripts/eval_ai.ts). Raw results: [`results/`](results/).

**Before** = the pipeline as shipped up to v2.16.0 (live server). **After** = v2.17.0/v2.18.0: full email body + send date, new prompt, server-side checks, review box, Vietnamese reschedule commands, hint-only tutor. Both use the same live Gemini model chain. AI output varies a little between runs.

## 1. School emails → assignment + due date

"Live before" = what the deployed v2.16.0 site did on 16 Oct 2026 (its model chain was retired, so every email hit the offline fallback). "Old pipeline" = the v2.16.0 prompt, 200-character snippet and Gmail-label rules, run on a working model — the fair comparison.

| Metric | Live before | Old pipeline | After |
|---|---|---|---|
| Cases fully right | 4/30 (13%) | – | – |
| Category right | 4/30 (13%) | – | – |
| Due date exactly right (assignment emails) | 0/21 (0%) | – | – |
| Real assignments missed or hidden | 21 | – | – |
| Teacher/school emails hidden as ads/social | 2 | – | – |
| Invented a date when the email had none | 0 | – | – |

Per case (After run; last column = whole case right in the old pipeline). ✅ right, ❌ wrong, – not applicable. "Review" = sent to "AI chưa đọc được – bạn xem giúp nhé" instead of being hidden.

| Case | Email | Expected | AI got | Not hidden | Category | Is task | Due date | Subject | Priority | After | Old |
|---|---|---|---|---|---|---|---|---|---|---|---|
| e01 | Bài tập mới: "Bài 2 - Phản ứng hoá học: Phiếu bài tập số 1" | ASSIGNMENT · 2026-09-18 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e02 | New assignment: "Bonus: Challenge problems Chapter 2 (option | ASSIGNMENT · 2026-09-24 · Low | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e03 | Thông báo mới: "Các em chú ý: cô gia hạn bài viết Kể lại một | ASSIGNMENT · 2026-09-28 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e04 | Thông báo mới: "Good morning 7A3! Tuần này mình học Unit 3:  | ASSIGNMENT · 2026-10-08 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e05 | Sắp đến hạn: "Phiếu học tập Bài 2 - Cách mạng công nghiệp" | ASSIGNMENT · 2026-10-07 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e06 | New assignment: "Scratch project: Maze game" | ASSIGNMENT · 2026-10-16 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e07 | Assignment Created - Essay: A Place I Love, English 8 (Bilin | ASSIGNMENT · 2026-10-02 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e08 | Ngày Đến Hạn của Bài Tập Đã Thay Đổi: Báo cáo thực hành số 2 | ASSIGNMENT · 2026-10-09 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e09 | [Toán 8A1] Bài tập về nhà tuần 2 | ASSIGNMENT · 2026-09-18 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e10 | Bài viết số 1 - Ngữ văn 9A2 | ASSIGNMENT · 2026-09-25 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e11 | 6A1 - English homework | ASSIGNMENT · 2026-09-24 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e12 | Thông tin lớp 7A5 tuần 5 | ASSIGNMENT · 2026-10-06 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e13 | Re: [Công nghệ 8A1] Bài tập nhóm: Bản vẽ chi tiết | ASSIGNMENT · 2026-10-12 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e14 | [Tin học 9A1] 2 bài tập cần làm | ASSIGNMENT · 2026-10-14 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e15 | GDCD 8A2 - Chuẩn bị cho bài Lập kế hoạch chi tiêu | ASSIGNMENT · no date · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e16 | THÔNG BÁO Lịch kiểm tra giữa học kỳ I năm học 2026-2027 | EXAM · 2026-10-26 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e17 | Giấy mời họp phụ huynh học sinh đầu năm học 2026-2027 - Lớp  | SCHEDULE | GENERAL | ✅ | ❌ | ✅ | – | – | – | ❌ | ❌ |
| e18 | THÔNG BÁO (KHẨN) V/v cho học sinh nghỉ học để phòng, tránh b | SCHEDULE | GENERAL | ✅ | ❌ | ✅ | – | – | – | ❌ | ❌ |
| e19 | [Azota] Bài tập mới: Ôn tập Chương I - Phương trình và hệ ha | ASSIGNMENT · 2026-10-08 · Med | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| e20 | [OLM] Em được giao bài mới: Luyện tập - Dấu hiệu chia hết ch | ASSIGNMENT · 2026-10-16 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e21 | [vnEdu] Thông báo kết quả học tập - HS Trần Minh Khoa - Lớp  | GRADE | GENERAL | ✅ | ❌ | ✅ | – | – | – | ❌ | ❌ |
| e22 | 🔥 [Toán 9A1] Đề luyện tập số 4 + TẶNG file tổng hợp công th | ASSIGNMENT · 2026-10-18 · Med | PROMOTION (skipped) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e23 | Nhóm lớp 8A3 - Bài tập Ngữ văn tuần 6 | ASSIGNMENT · 2026-10-13 · Med | SOCIAL (skipped) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| e24 | 2K12 CHÚ Ý! Lộ trình luyện thi vào 10 Toán - Văn - Anh chính | PROMOTION | PROMOTION (skipped) | – | ✅ | ✅ | – | – | – | ✅ | ✅ |
| e25 | Bài test IELTS miễn phí cho học sinh THCS - Nhận học bổng 30 | PROMOTION | GENERAL | – | ❌ | ✅ | – | – | – | ❌ | ❌ |
| e26 | 🎒 10.10 Siêu Sale Tựu Trường / Balo, vở, máy tính Casio giả | PROMOTION | PROMOTION (skipped) | – | ✅ | ✅ | – | – | – | ✅ | ✅ |
| e27 | Lê Gia Bảo đã đăng trong 8A1 Forever 💙 | SOCIAL | SOCIAL (skipped) | – | ✅ | ✅ | – | – | – | ✅ | ✅ |
| e28 | 🎓 CHÚC MỪNG! Em đã được chọn nhận HỌC BỔNG 100% du học hè S | PROMOTION | PROMOTION (skipped) | – | ✅ | ✅ | – | – | – | ✅ | ✅ |
| e29 | Sports Day - Friday, October 23 / Important information for  | ANNOUNCEMENT | GENERAL | ✅ | ❌ | ✅ | – | – | – | ❌ | ❌ |
| e30 | Reminder: 15-minute quiz Unit 4 - thứ Năm này | EXAM · 2026-10-15 · High | GENERAL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 2. Vietnamese reschedule commands

Before: 0/10 (0%) · After: 9/10 (90%). A case passes only if the asked change happened, nothing else moved, locked sessions stayed put and nothing overlaps.

Honesty note: in the first run of the offline keyword parser, s02 ("bỏ lịch tối thứ 5" deleted one session instead of freeing Thursday evening) and s03 ("trước bài kiểm tra thứ 6" put the review on Friday itself) failed; both rules were fixed in src/services/planCommands.ts and the table shows the run after the fix. "After" runs without a working AI fall back to that parser.

| Case | Command | After | Before | Why it failed |
|---|---|---|---|---|
| s01 | Dời buổi Toán tối thứ 3 sang sáng thứ 7 nhé | ✅ | ❌ |  |
| s02 | Tuần này em bận tối thứ 5, bỏ lịch tối thứ 5 giúp em nhé | ✅ | ❌ |  |
| s03 | Thêm 1 buổi ôn KHTN trước bài kiểm tra thứ 6 | ✅ | ❌ |  |
| s04 | Bớt học buổi tối đi, em muốn ngủ trước 22h | ✅ | ❌ |  |
| s05 | Đổi buổi Văn thứ 2 với buổi Anh thứ 3 cho nhau nhé | ✅ | ❌ |  |
| s06 | Bỏ buổi học thêm Toán thứ 4 đi, em muốn ở nhà ôn Văn | ✅ | ❌ |  |
| s07 | Em muốn học nhiều hơn môn em yếu | ❌ | ❌ | reply neither asks nor names the weak subject |
| s08 | Chủ nhật em muốn nghỉ hoàn toàn | ✅ | ❌ |  |
| s09 | Mỗi buổi học tối đa 45 phút thôi | ✅ | ❌ |  |
| s10 | doi toan sang thu 7 | ✅ | ❌ |  |
