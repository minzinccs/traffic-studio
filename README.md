# Traffic Studio — ý tưởng sản phẩm

Ứng dụng desktop để bắt, phân tích, chỉnh sửa và kiểm thử lưu lượng HTTP(S), lấy cảm hứng từ workflow của Reqable. Ưu tiên local-first, nhiều phiên/bảng và giao diện tối rõ ràng.

## Vấn đề cần giải quyết

- Muốn dùng tracker/analysis nâng cao mà không bị giới hạn theo gói trả phí.
- Một request cần gắn nhiều nhãn, trạng thái, ghi chú và theo dõi qua nhiều bảng.
- Muốn chia màn hình để so sánh capture, request/response, API client và thống kê cùng lúc.
- Cần giữ dữ liệu cục bộ và xuất được dữ liệu, thay vì phụ thuộc tài khoản/cloud.

## Đề xuất trọng tâm

1. **Capture workspace**: nhiều session đồng thời; filter theo app, host, path, method, status, thời gian; tìm trong header/body; lưu phiên, HAR, cURL.
2. **Tracker linh hoạt**: mỗi request có tags, trạng thái tùy biến, người phụ trách tùy chọn, ghi chú, lịch sử thay đổi. Một request có thể xuất hiện trên nhiều board/view mà không nhân bản dữ liệu.
3. **Nhiều view**: table, Kanban, timeline và saved filters trên cùng một tập dữ liệu; cột, thứ tự, nhóm và sort tùy chỉnh.
4. **Split view**: pane kéo thả, tab độc lập; so sánh hai request/response hoặc hai session; lưu layout theo workspace.
5. **API client gắn với capture**: gửi lại request đã bắt, sửa headers/body/auth, biến môi trường, collection, assertions, history.
6. **Debug**: breakpoint, rewrite, mock/map local, throttle, repeat/replay; rule có phạm vi rõ ràng và có thể bật tắt.
7. **Analysis**: tổng hợp latency, status, lỗi, endpoint và kích thước payload; biểu đồ theo khoảng thời gian, drill-down về request gốc.
8. **Local-first**: SQLite cho metadata; payload lưu cục bộ có giới hạn/retention; export/import HAR và định dạng dự án mở; secrets không nằm trong export mặc định.

## MVP đề xuất

Windows desktop trước: capture HTTP(S) qua explicit/system proxy, danh sách request + inspector, filter/search, replay, session persistence, tracker đa bảng, split view 2–4 pane. Các phần rewrite/mock, analytics sâu, mobile capture và sync triển khai sau khi lõi ổn định.

## Hướng kỹ thuật cần thử nghiệm

- UI desktop: Tauri + React/TypeScript để có layout và trạng thái linh hoạt.
- Proxy engine: đánh giá nhúng/điều khiển mitmproxy so với engine Rust tự xây. Làm spike đo độ ổn định, hiệu năng và khả năng cấp/chặn chứng chỉ trước khi chọn.
- SQLite + FTS cho metadata/tìm kiếm; payload file riêng, có quota và redaction.
- Mô hình dữ liệu: `request` ↔ `board_item` (many-to-many), `view` chứa filter/sort/columns/layout, `event` lưu audit.

## Nguyên tắc thiết kế

Có thể dùng bảng màu charcoal + amber và mật độ thông tin giống ảnh tham khảo, nhưng tự thiết kế biểu tượng, tên, spacing, component và tài sản đồ họa riêng. Không sao chép mã nguồn hay tài sản độc quyền của Reqable.

## Tham khảo

Xem [research.md](research.md) cho các repo hiện có và giới hạn của từng hướng. Đây là đề xuất ban đầu; các giới hạn phiên bản Reqable cần đối chiếu trực tiếp trong app trước khi coi là yêu cầu đã xác minh.
