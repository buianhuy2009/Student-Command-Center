import { useEffect, useState } from 'react';
import { WS_TABS_STRINGS } from './i18n-tabs';
import { WS1_STRINGS } from './i18n-ws1';
import { WS2_STRINGS } from './i18n-ws2';
import { WS3_STRINGS } from './i18n-ws3';

export type Lang = 'en' | 'vi';

// Full-chrome dictionary. Every user-visible UI string goes through t() so VI and
// EN can never mix. Technical proper nouns (API, PWA, GPA, BibTeX, Zotero, arXiv,
// MLA, APA, Kanban, URL, CSV…) stay identical in both languages — standard
// localization practice, not untranslated text. Model-generated content and user
// data (email bodies, AI answers, draft templates, file names) stay in their
// source language by design — translating them would rewrite the user's data.
type Dict = Record<string, { en: string; vi: string }>;
const BASE_STRINGS: Dict = {
  // ——— Common actions ———
  dashboard: { en: 'Dashboard', vi: 'Bảng điều khiển' },
  assignments: { en: 'Assignments', vi: 'Bài tập' },
  due_today: { en: 'Due today', vi: 'Hạn hôm nay' },
  overdue: { en: 'Overdue', vi: 'Quá hạn' },
  upcoming: { en: 'Upcoming', vi: 'Sắp tới' },
  inbox_zero: { en: 'Inbox zero — enjoy it', vi: 'Hộp thư trống — tuyệt vời' },
  connect_google: { en: 'Connect Google', vi: 'Kết nối Google' },
  search_placeholder: { en: 'Search assignments, emails, files, notes…', vi: 'Tìm bài tập, email, tệp, ghi chú…' },
  exam: { en: 'Exam', vi: 'Kỳ thi' },
  grade: { en: 'Grade', vi: 'Điểm' },
  schedule: { en: 'Schedule', vi: 'Lịch học' },
  all_caught_up: { en: 'All caught up — nice work', vi: 'Xong hết rồi — giỏi lắm' },
  focus: { en: 'Focus', vi: 'Tập trung' },
  settings: { en: 'Settings', vi: 'Cài đặt' },
  getting_started: { en: 'Getting started', vi: 'Bắt đầu' },
  dismiss_today: { en: 'Dismiss for today', vi: 'Ẩn hôm nay' },
  nasa_title: { en: 'NASA Image of the Day', vi: 'Ảnh NASA hôm nay' },
  train_model: { en: 'Train My Model Lab', vi: 'Lab luyện mô hình' },
  few_shot_lab: { en: 'Few-Shot Calibration Lab', vi: 'Lab hiệu chỉnh few-shot' },
  dossier: { en: 'Competition Dossier — Division A', vi: 'Hồ sơ thi — Bảng A' },
  prompt_log: { en: 'Prompt Log', vi: 'Nhật ký câu lệnh' },
  verify: { en: 'Verify', vi: 'Kiểm chứng' },
  evidence_snapshot: { en: 'Evidence Snapshot', vi: 'Chụp minh chứng' },
  save: { en: 'Save', vi: 'Lưu' },
  cancel: { en: 'Cancel', vi: 'Hủy' },
  close: { en: 'Close', vi: 'Đóng' },
  retry: { en: 'Try again', vi: 'Thử lại' },
  sync_now: { en: 'Sync Now', vi: 'Đồng bộ ngay' },
  syncing: { en: 'Syncing…', vi: 'Đang đồng bộ…' },
  search: { en: 'Search', vi: 'Tìm kiếm' },
  search_or_jump: { en: 'Search or jump…', vi: 'Tìm kiếm hoặc chuyển…' },
  new_task: { en: 'New Task', vi: 'Việc mới' },
  add: { en: 'Add', vi: 'Thêm' },
  expand: { en: 'Expand', vi: 'Mở rộng' },
  all: { en: 'All', vi: 'Tất cả' },
  unfinished: { en: 'Unfinished', vi: 'Chưa xong' },
  finished: { en: 'Finished', vi: 'Đã xong' },
  done: { en: 'Done', vi: 'Xong' },
  high_priority: { en: 'High Priority', vi: 'Ưu tiên cao' },
  master_tracker: { en: 'Master Tracker', vi: 'Theo dõi tổng' },
  search_tracker: { en: 'Search tracker…', vi: 'Tìm trong danh sách…' },
  smart_add: { en: 'Smart Add', vi: 'Thêm nhanh' },
  smart_add_placeholder: { en: "Type anything e.g. 'Read AP Bio Ch 14 due Friday high priority'…", vi: "Gõ tự nhiên, ví dụ 'Đọc Sinh Ch 14 hạn thứ Sáu ưu tiên cao'…" },
  sync_sheet: { en: 'Sync Sheet', vi: 'Đồng bộ Sheet' },
  open_sheet: { en: 'Sheet', vi: 'Sheet' },
  export_csv: { en: 'Export CSV', vi: 'Xuất CSV' },
  filter_tasks: { en: 'Filter tasks…', vi: 'Lọc bài tập…' },
  all_courses: { en: 'All Courses', vi: 'Mọi môn' },
  grade_predictor: { en: 'Grade Predictor — What-if Final', vi: 'Dự đoán điểm — Giả định thi cuối kỳ' },
  canvas_sync_failed: { en: "Couldn't sync Canvas", vi: 'Không đồng bộ được Canvas' },
  canvas_kept_below: { en: 'Your previously loaded assignments are kept below.', vi: 'Các bài đã tải trước đó vẫn ở bên dưới.' },
  canvas_empty_title: { en: 'Nothing synced yet — check the message above.', vi: 'Chưa đồng bộ gì — xem thông báo ở trên.' },
  canvas_empty_hint: { en: 'If you expect coursework here, re-copy your Calendar Feed link or regenerate your API token, save, and press Try again.', vi: 'Nếu bạn có bài tập, hãy sao chép lại link Calendar Feed hoặc tạo lại API token, lưu rồi nhấn Thử lại.' },
  canvas_not_connected: { en: 'Canvas LMS not yet connected', vi: 'Chưa kết nối Canvas LMS' },
  canvas_not_connected_hint: { en: 'Click the settings icon above to paste your Canvas URL + API token, or a calendar feed URL.', vi: 'Nhấn biểu tượng cài đặt ở trên để dán URL Canvas + API token, hoặc link calendar feed.' },
  canvas_settings_title: { en: 'Canvas LMS Connection Parameters', vi: 'Thông số kết nối Canvas LMS' },
  guided_tour_title: { en: 'Guided tour — 6 stops around the real app', vi: 'Tour hướng dẫn — 6 điểm trong app thật' },
  guided_tour_sub: { en: 'Replay the sidebar → search → sync walkthrough anytime.', vi: 'Xem lại hướng dẫn sidebar → tìm kiếm → đồng bộ bất cứ lúc nào.' },
  launch_tour: { en: 'Launch Tour', vi: 'Bắt đầu tour' },
  changelog_title: { en: 'Release Notes & Changelog', vi: 'Ghi chú phát hành & Nhật ký' },
  changelog_sub: { en: 'View the full update history from Version 1.0 to the current release.', vi: 'Xem toàn bộ lịch sử cập nhật từ Phiên bản 1.0 đến nay.' },
  view_changelog: { en: 'View Changelog', vi: 'Xem nhật ký' },
  help_updates_title: { en: 'Help & updates', vi: 'Trợ giúp & cập nhật' },
  help_updates_sub: { en: 'Tour the real app or read what changed — in one place.', vi: 'Xem tour app thật hoặc đọc thay đổi — tại một chỗ.' },
  avatar_title: { en: 'Profile Avatar & Badge', vi: 'Ảnh đại diện & Huy hiệu' },
  avatar_sub: { en: 'Customize the avatar shown in the Navbar and academic reports.', vi: 'Tùy chỉnh ảnh hiển thị trên thanh điều hướng và báo cáo học tập.' },
  avatar_scholar: { en: 'Scholar', vi: 'Học giả' },
  avatar_researcher: { en: 'Researcher', vi: 'Nhà nghiên cứu' },
  avatar_cybernetic: { en: 'Cybernetic', vi: 'Điều khiển học' },
  avatar_polymath: { en: 'Polymath', vi: 'Đa tài' },
  semester_reset_title: { en: 'Start Fresh (Semester Reset)', vi: 'Bắt đầu mới (Reset học kỳ)' },
  semester_reset_sub: { en: 'Clear completed assignments, streak records, and notes for a new academic term.', vi: 'Xóa bài đã xong, chuỗi streak và ghi chú cho học kỳ mới.' },
  semester_reset_btn: { en: 'Semester Reset', vi: 'Reset học kỳ' },
  clear_cache_title: { en: 'Clear Local Cache', vi: 'Xóa bộ nhớ đệm' },
  clear_cache_sub: { en: 'Clear cached emails, completed cards, and temporary drafts.', vi: 'Xóa email đệm, thẻ đã xong và bản nháp tạm.' },
  clear_cache_btn: { en: 'Clear Cache', vi: 'Xóa đệm' },
  bg_refresh_title: { en: 'Background Workspace Refresh', vi: 'Làm mới nền' },
  bg_refresh_sub: { en: 'Periodically sync Canvas assignments and Google Calendar events.', vi: 'Định kỳ đồng bộ bài Canvas và sự kiện Google Calendar.' },
  language_title: { en: 'Language / Ngôn ngữ', vi: 'Ngôn ngữ / Language' },
  language_sub: { en: 'Switch the whole app between English and Vietnamese. Saved on this device.', vi: 'Chuyển toàn bộ app giữa tiếng Anh và tiếng Việt. Lưu trên thiết bị này.' },
  execution_session: { en: 'Execution & Session', vi: 'Thực thi & Phiên' },
  // ——— Landing ———
  landing_badge: { en: 'The Next-Gen Academic Operating System for Students', vi: 'Hệ điều hành học tập thế hệ mới cho học sinh' },
  landing_h1_a: { en: 'Conquer your semester with a', vi: 'Chinh phục học kỳ với' },
  landing_h1_b: { en: 'unified student hub', vi: 'trung tâm học tập hợp nhất' },
  landing_sub: { en: 'Canvas LMS, Google Calendar & Gmail in one dashboard — with Gemini AI study coaching.', vi: 'Canvas LMS, Google Calendar & Gmail trong một bảng điều khiển — cùng AI Gemini đồng hành học tập.' },
  landing_signup: { en: 'Sign Up Free with Google', vi: 'Đăng ký miễn phí với Google' },
  landing_explore: { en: 'Explore Live Demo Mode', vi: 'Khám phá bản Demo' },
  landing_signin: { en: 'Sign In', vi: 'Đăng nhập' },
  landing_connecting: { en: 'Connecting…', vi: 'Đang kết nối…' },
  landing_need_sync: { en: 'Need Calendar & Drive sync at login?', vi: 'Cần đồng bộ Calendar & Drive khi đăng nhập?' },
  landing_workspace_signin: { en: 'Sign in with Google Workspace', vi: 'Đăng nhập với Google Workspace' },
  landing_free_oss: { en: '100% Free & Open Source', vi: '100% Miễn phí & Mã nguồn mở' },
  landing_offline: { en: 'Local-First & Offline Ready', vi: 'Ưu tiên cục bộ & Dùng offline' },
  landing_ai_coach: { en: 'Gemini Flash AI Coach', vi: 'AI Coach Gemini Flash' },
  landing_nav_features: { en: 'Features', vi: 'Tính năng' },
  landing_nav_how: { en: 'How it works', vi: 'Cách hoạt động' },
  landing_nav_faq: { en: 'FAQ', vi: 'Hỏi đáp' },
  landing_nav_privacy: { en: 'Privacy', vi: 'Riêng tư' },
  landing_strip_title: { en: 'Canvas + Google + AI study coach in one place', vi: 'Canvas + Google + AI học tập trong một nơi' },
  landing_card_canvas_t: { en: 'Canvas LMS Live Sync', vi: 'Đồng bộ trực tiếp Canvas LMS' },
  landing_card_canvas_d: { en: 'Unfinished & Finished views, one-click quiz redirects.', vi: 'Xem Chưa xong & Đã xong, mở quiz bằng một chạm.' },
  landing_card_gmail_t: { en: 'Gmail Scanner + Workspace', vi: 'Quét Gmail + Workspace' },
  landing_card_gmail_d: { en: 'Teacher alerts sorted, spam filtered — EN/VI support.', vi: 'Lọc mail thầy cô, chặn spam — hỗ trợ Anh/Việt.' },
  landing_card_offline_t: { en: 'Offline-first PWA', vi: 'PWA ưu tiên offline' },
  landing_card_offline_d: { en: 'Dexie + Workbox — works offline, syncs on reconnect.', vi: 'Dexie + Workbox — dùng offline, tự đồng bộ khi có mạng.' },
  landing_why_title: { en: 'Why students keep it open', vi: 'Vì sao học sinh luôn mở app' },
  landing_why_oss_t: { en: 'Open Source', vi: 'Mã nguồn mở' },
  landing_why_oss_d: { en: '100% free & local-first. Your data stays in your browser + Google account.', vi: '100% miễn phí, ưu tiên cục bộ. Dữ liệu ở trình duyệt + tài khoản Google của bạn.' },
  landing_why_offline_t: { en: 'Offline-First', vi: 'Ưu tiên offline' },
  landing_why_offline_d: { en: 'Works offline via IndexedDB + Workbox. Queues sync when back online.', vi: 'Dùng offline qua IndexedDB + Workbox. Tự xếp hàng đồng bộ khi có mạng.' },
  landing_why_ai_t: { en: 'AI Study Coach', vi: 'AI đồng hành học tập' },
  landing_why_ai_d: { en: 'AI knows your real due dates & calendar. Plans finals week with focus blocks.', vi: 'AI biết hạn nộp & lịch thật của bạn. Lên kế hoạch tuần thi với các khung tập trung.' },
  landing_features_title: { en: 'Everything you need to excel in your classes', vi: 'Mọi thứ bạn cần để học giỏi' },
  landing_features_sub: { en: 'Designed for high school and university students balancing coursework, exams, and projects.', vi: 'Thiết kế cho học sinh, sinh viên cân bằng bài tập, kỳ thi và đồ án.' },
  landing_how_title: { en: 'From sign-in to study plan in three steps', vi: 'Từ đăng nhập đến kế hoạch học chỉ ba bước' },
  landing_how_1t: { en: '1. Connect Google', vi: '1. Kết nối Google' },
  landing_how_1d: { en: 'Sign in with Google. Calendar, Gmail, Drive and Sheets sync to your dashboard.', vi: 'Đăng nhập Google. Calendar, Gmail, Drive và Sheets đồng bộ về bảng điều khiển.' },
  landing_how_2t: { en: '2. Connect Canvas', vi: '2. Kết nối Canvas' },
  landing_how_2d: { en: 'Paste your school Canvas URL + API token, or a Calendar Feed URL. Tokens stay in this browser.', vi: 'Dán URL Canvas của trường + API token, hoặc link Calendar Feed. Token chỉ nằm trong trình duyệt này.' },
  landing_how_3t: { en: '3. Track & focus', vi: '3. Theo dõi & tập trung' },
  landing_how_3d: { en: 'Master Tracker, Daily Schedule and AI Coach plan your day — offline-ready with PWA.', vi: 'Theo dõi tổng, Lịch ngày và AI Coach lên kế hoạch — dùng offline với PWA.' },
  landing_compare_title: { en: 'Why StudentOS vs Notion • Canvas • Motion?', vi: 'Vì sao chọn StudentOS thay vì Notion • Canvas • Motion?' },
  landing_faq_title: { en: 'FAQ', vi: 'Hỏi đáp' },
  landing_faq_1q: { en: 'Does it store my Canvas password?', vi: 'App có lưu mật khẩu Canvas không?' },
  landing_faq_1a: { en: 'No. Uses calendar feed URL + API token stored locally only, never sent except to Canvas via proxy.', vi: 'Không. Chỉ dùng link feed + API token lưu cục bộ, không gửi đi nơi khác ngoài Canvas qua proxy.' },
  landing_faq_2q: { en: 'What scopes does Google require?', vi: 'Google yêu cầu những quyền nào?' },
  landing_faq_2a: { en: 'calendar.readonly, gmail.readonly, drive.readonly, spreadsheets, classroom.courses.readonly etc. Tokens in IndexedDB, revoke anytime.', vi: 'calendar.readonly, gmail.readonly, drive.readonly, spreadsheets, classroom.courses.readonly… Token nằm trong IndexedDB, thu hồi bất cứ lúc nào.' },
  landing_faq_3q: { en: 'Is it offline?', vi: 'Có dùng offline không?' },
  landing_faq_3a: { en: 'Yes — PWA + Dexie. Queues assignments and retries on reconnect.', vi: 'Có — PWA + Dexie. Tự xếp hàng bài tập và thử lại khi có mạng.' },
  landing_privacy_title: { en: 'Privacy — Why we request Google scopes', vi: 'Riêng tư — Vì sao app xin quyền Google' },
  landing_cta_title: { en: 'Ready to take control of your classes?', vi: 'Sẵn sàng làm chủ lớp học của bạn?' },
  landing_cta_sub: { en: 'Join students staying ahead on Canvas, organizing Google Workspace, and boosting study productivity.', vi: 'Cùng các bạn vượt lên trên Canvas, gọn gàng Google Workspace và học hiệu quả hơn.' },
  landing_cta_btn: { en: 'Get Started Free with Google', vi: 'Bắt đầu miễn phí với Google' },
  landing_watch: { en: 'Watch 60s Demo', vi: 'Xem Demo 60s' },
  landing_pricing_t: { en: 'Free & Open Source — MIT Licensed', vi: 'Miễn phí & Mã nguồn mở — Giấy phép MIT' },
  landing_pricing_d: { en: 'No paywall. Self-host on Vercel. Your data stays in your browser + Google account.', vi: 'Không trả phí. Tự triển khai trên Vercel. Dữ liệu ở trình duyệt + tài khoản Google của bạn.' },
  demo_video_missing: { en: 'Demo video not yet recorded', vi: 'Video demo chưa được quay' },
  // ——— Shared workspace chrome (reused by every workspace file) ———
  loading: { en: 'Loading…', vi: 'Đang tải…' },
  saving: { en: 'Saving…', vi: 'Đang lưu…' },
  deleting: { en: 'Deleting…', vi: 'Đang xóa…' },
  delete: { en: 'Delete', vi: 'Xóa' },
  edit: { en: 'Edit', vi: 'Sửa' },
  back: { en: 'Back', vi: 'Quay lại' },
  open: { en: 'Open', vi: 'Mở' },
  download: { en: 'Download', vi: 'Tải xuống' },
  copy: { en: 'Copy', vi: 'Sao chép' },
  copied: { en: 'Copied', vi: 'Đã sao chép' },
  clear: { en: 'Clear', vi: 'Xóa' },
  confirm: { en: 'Confirm', vi: 'Xác nhận' },
  apply: { en: 'Apply', vi: 'Áp dụng' },
  reset: { en: 'Reset', vi: 'Đặt lại' },
  view: { en: 'View', vi: 'Xem' },
  create: { en: 'Create', vi: 'Tạo' },
  update: { en: 'Update', vi: 'Cập nhật' },
  remove: { en: 'Remove', vi: 'Gỡ' },
  send: { en: 'Send', vi: 'Gửi' },
  preview: { en: 'Preview', vi: 'Xem trước' },
  print: { en: 'Print', vi: 'In' },
  export: { en: 'Export', vi: 'Xuất' },
  import: { en: 'Import', vi: 'Nhập' },
  enable: { en: 'Enable', vi: 'Bật' },
  disable: { en: 'Disable', vi: 'Tắt' },
  refresh: { en: 'Refresh', vi: 'Làm mới' },
  details: { en: 'Details', vi: 'Chi tiết' },
  overview: { en: 'Overview', vi: 'Tổng quan' },
  instructions: { en: 'Instructions', vi: 'Hướng dẫn' },
  next: { en: 'Next', vi: 'Tiếp' },
  previous: { en: 'Previous', vi: 'Trước' },
  got_it: { en: 'Got it', vi: 'Đã hiểu' },
  learn_more: { en: 'Learn more', vi: 'Tìm hiểu thêm' },
  start: { en: 'Start', vi: 'Bắt đầu' },
  pause: { en: 'Pause', vi: 'Tạm dừng' },
  stop: { en: 'Stop', vi: 'Dừng' },
  resume: { en: 'Resume', vi: 'Tiếp tục' },
  finish: { en: 'Finish', vi: 'Hoàn thành' },
  today: { en: 'Today', vi: 'Hôm nay' },
  tomorrow: { en: 'Tomorrow', vi: 'Ngày mai' },
  yesterday: { en: 'Yesterday', vi: 'Hôm qua' },
  minutes: { en: 'minutes', vi: 'phút' },
  score: { en: 'Score', vi: 'Điểm' },
  streak: { en: 'Streak', vi: 'Chuỗi' },
  question: { en: 'Question', vi: 'Câu hỏi' },
  answer: { en: 'Answer', vi: 'Trả lời' },
  correct: { en: 'Correct', vi: 'Đúng' },
  incorrect: { en: 'Incorrect', vi: 'Sai' },
  no_results: { en: 'No results found', vi: 'Không tìm thấy gì' },
  try_different_search: { en: 'Try a different search', vi: 'Thử tìm kiếm khác' },
  error_generic: { en: 'Something went wrong — please retry.', vi: 'Có lỗi xảy ra — hãy thử lại.' },
  show_more: { en: 'Show more', vi: 'Xem thêm' },
  show_less: { en: 'Show less', vi: 'Thu gọn' },
  sort_by: { en: 'Sort by', vi: 'Sắp xếp theo' },
  mark_done: { en: 'Mark done', vi: 'Đánh dấu xong' },
  archive: { en: 'Archive', vi: 'Lưu trữ' },
  restore: { en: 'Restore', vi: 'Khôi phục' },
  duplicate: { en: 'Duplicate', vi: 'Nhân bản' },
  upload: { en: 'Upload', vi: 'Tải lên' },
  actions: { en: 'Actions', vi: 'Thao tác' },
  status: { en: 'Status', vi: 'Trạng thái' },
  priority: { en: 'Priority', vi: 'Ưu tiên' },
  subject: { en: 'Subject', vi: 'Môn học' },
  due_date: { en: 'Due date', vi: 'Hạn nộp' },
  notes: { en: 'Notes', vi: 'Ghi chú' },
  name: { en: 'Name', vi: 'Tên' },
  title: { en: 'Title', vi: 'Tiêu đề' },
  date: { en: 'Date', vi: 'Ngày' },
  time: { en: 'Time', vi: 'Giờ' },
  // ——— App Store (ratings removed — honesty; meta below is real) ———
  store_sub: { en: 'Connect and launch all your academic tools & integrations in one place', vi: 'Kết nối và mở mọi công cụ học tập tại một nơi' },
  installed: { en: 'Installed', vi: 'Đã cài' },
  install: { en: 'Install', vi: 'Cài đặt' },
  open_app: { en: 'Open App', vi: 'Mở app' },
  get_app: { en: 'GET', vi: 'TẢI' },
  featured: { en: 'Featured', vi: 'Nổi bật' },
  size: { en: 'Size', vi: 'Dung lượng' },
  permissions: { en: 'Permissions', vi: 'Quyền' },
  last_updated: { en: 'Last updated', vi: 'Cập nhật' },
  screenshots: { en: 'Screenshots', vi: 'Ảnh chụp' },
  about_app: { en: 'About this app', vi: 'Về ứng dụng' },
  key_capabilities: { en: 'Key capabilities', vi: 'Tính năng chính' },
  back_to_store: { en: 'Back to Store', vi: 'Về cửa hàng' },
  search_tools: { en: 'Search tools…', vi: 'Tìm công cụ…' },
  search_tools_long: { en: 'Search tools, Canvas, Desmos, Wolfram, Quizlet, Notes…', vi: 'Tìm công cụ, Canvas, Desmos, Wolfram, Quizlet, Ghi chú…' },
  cat_highlights: { en: 'Highlights', vi: 'Nổi bật' },
  cat_plan: { en: 'Plan', vi: 'Kế hoạch' },
  cat_create: { en: 'Create', vi: 'Sáng tạo' },
  cat_learn: { en: 'Learn', vi: 'Học tập' },
  cat_research: { en: 'Research', vi: 'Nghiên cứu' },
  cat_all: { en: 'All Apps', vi: 'Tất cả' },
  top8_title: { en: 'Top 8 Recommended Essentials', vi: '8 công cụ thiết yếu nên dùng' },
  top8_sub: { en: 'The curated core tools every student needs for daily academic workflow', vi: 'Các công cụ cốt lõi cho việc học mỗi ngày' },
  because_you: { en: 'Because you use', vi: 'Vì bạn hay dùng' },
  install_in_sidebar: { en: 'Install in Sidebar', vi: 'Ghim vào sidebar' },
  installed_in_sidebar: { en: 'Installed in Sidebar', vi: 'Đã ghim ở sidebar' },
  perms_browser: { en: 'Browser only', vi: 'Chỉ trong trình duyệt' },
  changelog_verified: { en: 'No telemetry until you connect Google. Verified open-source.', vi: 'Không thu thập dữ liệu cho đến khi bạn kết nối Google. Mã nguồn mở đã kiểm chứng.' },
  // ——— Landing comparison + privacy tables (EN/VI twin tables) ———
  cmp_feature: { en: 'Feature', vi: 'Tính năng' },
  cmp_canvas_sync: { en: 'Canvas LMS sync', vi: 'Đồng bộ Canvas LMS' },
  cmp_native_only: { en: 'Native only', vi: 'Chỉ trong Canvas' },
  cmp_gmail_scanner: { en: 'Gmail AI scanner', vi: 'Quét Gmail bằng AI' },
  cmp_bilingual: { en: '✓ Bilingual EN/VI', vi: '✓ Song ngữ Anh/Việt' },
  cmp_sheets: { en: 'Sheets 2-way', vi: 'Sheet 2 chiều' },
  cmp_master_tracker: { en: '✓ Master tracker', vi: '✓ Theo dõi tổng' },
  cmp_manual: { en: 'Manual', vi: 'Thủ công' },
  cmp_offline_pwa: { en: 'Offline PWA', vi: 'PWA offline' },
  cmp_partial: { en: 'Partial', vi: 'Một phần' },
  cmp_price: { en: 'Price', vi: 'Giá' },
  cmp_free_oss: { en: 'Free & OSS', vi: 'Miễn phí & OSS' },
  cmp_freemium: { en: 'Freemium', vi: 'Freemium' },
  cmp_institution: { en: 'Institution', vi: 'Nhà trường' },
  th_scope: { en: 'Scope', vi: 'Quyền' },
  th_purpose: { en: 'Purpose', vi: 'Mục đích' },
  th_stored: { en: 'Stored', vi: 'Lưu trữ' },
  scope_gmail: { en: 'Scan teacher emails', vi: 'Quét mail thầy cô' },
  stored_snippet: { en: 'Snippet + local', vi: 'Đoạn trích + cục bộ' },
  scope_drive: { en: 'List school files', vi: 'Liệt kê tệp học tập' },
  stored_meta: { en: 'Metadata only', vi: 'Chỉ siêu dữ liệu' },
  scope_cal: { en: 'Schedule blocks', vi: 'Các khung giờ học' },
  stored_local: { en: 'Local', vi: 'Cục bộ' },
  priv_body: { en: 'requests only the scopes needed to sync your own data locally. No data leaves your browser except for Gemini AI summaries (truncated snippets). Tokens stay in IndexedDB, never logged. Revoke anytime in Google Account.', vi: 'chỉ xin các quyền cần thiết để đồng bộ dữ liệu của chính bạn trên máy. Không dữ liệu nào rời trình duyệt trừ đoạn trích gửi Gemini AI để tóm tắt. Token nằm trong IndexedDB, không ghi log. Thu hồi bất cứ lúc nào trong Tài khoản Google.' },
  // ——— Gmail verification (Div A) ———
  ai_understood: { en: 'AI understood', vi: 'AI đã hiểu' },
  ai_confirm_hint: { en: 'Check the details below, then confirm or edit before saving.', vi: 'Kiểm tra chi tiết bên dưới, rồi xác nhận hoặc sửa trước khi lưu.' },
  unconfirmed_badge: { en: 'Unconfirmed', vi: 'Chưa xác nhận' },
  unknown_date_warn: { en: 'No clear due date found in the email.', vi: 'Không thấy hạn nộp rõ ràng trong email.' },
  open_source_email: { en: 'Open source email', vi: 'Mở email gốc' },
  report_miscat: { en: 'Report miscategorization', vi: 'Báo phân loại sai' },
  date_missing_explain: { en: 'The AI could not find an explicit due date. Pick one or save without a date.', vi: 'AI không tìm thấy hạn nộp cụ thể. Hãy chọn một ngày hoặc lưu mà không cần hạn.' },
  edit_and_save: { en: 'Edit & save', vi: 'Sửa & lưu' },
};

// Merged dictionary: core + per-area packs (later packs win on collision — keys must stay unique).
const STRINGS: Dict = {
  ...BASE_STRINGS,
  ...WS_TABS_STRINGS,
  ...WS1_STRINGS,
  ...WS2_STRINGS,
  ...WS3_STRINGS,
};

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('scc_lang_v1') as Lang | null;
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {}
  try {
    const nav = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
    if (nav.startsWith('vi')) return 'vi';
  } catch {}
  return 'en';
}

let current: Lang = detectInitialLang();

try {
  document.documentElement.lang = current;
} catch {}

const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang { return current; }
export function setLang(l: Lang) {
  if (l !== 'en' && l !== 'vi') return;
  if (current === l) return;
  current = l;
  try { localStorage.setItem('scc_lang_v1', l); } catch {}
  try { document.documentElement.lang = l; } catch {}
  listeners.forEach((fn) => fn(l));
}

export function t(key: string): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[current] ?? entry.en;
}

// Reactive helper: tKey re-renders the component on language change.
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setL] = useState<Lang>(current);
  useEffect(() => {
    const fn = (l: Lang) => setL(l);
    listeners.add(fn);
    setL(current);
    return () => { listeners.delete(fn); };
  }, []);
  return [lang, (l) => setLang(l)];
}

export const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];
