# Traffic Studio — ý tưởng sản phẩm

Ứng dụng desktop để bắt, phân tích, chỉnh sửa và kiểm thử lưu lượng HTTP(S), lấy cảm hứng từ workflow của Reqable. Ưu tiên local-first, nhiều phiên/bảng và giao diện tối rõ ràng.

**Đích cuối:** đủ mọi tính năng Community + Premium của Reqable theo [checklist](FEATURE_INVENTORY.md), trừ phần chỉ có ở Enterprise, và thêm tracker/analytics/view theo yêu cầu. **App PC là sản phẩm chính và được làm trước; Android/iOS là app phụ trợ ở giai đoạn sau.** Các mốc bên dưới là thứ tự thực hiện, không phải cắt bớt phạm vi cuối.

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

Windows desktop trước: capture HTTP(S) qua explicit/system proxy, danh sách request + inspector, filter/search, replay, session persistence, tracker đa bảng, split view 2–4 pane. Sau đó hoàn thiện toàn bộ feature parity desktop (rewrite/mock, API client, analytics, rules, MCP và các mục trong checklist) trước khi bắt đầu app phụ trợ Android/iOS. Kết nối PC↔mobile qua LAN/IP chỉ triển khai khi đến giai đoạn mobile.

## Hướng kỹ thuật cần thử nghiệm

- Ưu tiên đánh giá fork [ProxyPin](https://github.com/wanghongenpin/proxypin) trước: đã có Flutter đa nền tảng, capture/rewrite và kết nối QR giữa thiết bị. [Whistle](https://github.com/avwo/whistle) và [mitmproxy](https://github.com/mitmproxy/mitmproxy) là ứng viên engine nếu core ProxyPin thiếu khả năng cần thiết.
- Chỉ chọn lại UI desktop sau khi kiểm tra mức tái sử dụng thực tế; không mặc định dựng engine từ đầu.
- SQLite + FTS cho metadata/tìm kiếm; payload file riêng, có quota và redaction.
- Mô hình dữ liệu: `request` ↔ `board_item` (many-to-many), `view` chứa filter/sort/columns/layout, `event` lưu audit.

## Nguyên tắc thiết kế

Có thể dùng bảng màu charcoal + amber và mật độ thông tin giống ảnh tham khảo, nhưng tự thiết kế biểu tượng, tên, spacing, component và tài sản đồ họa riêng. Không sao chép mã nguồn hay tài sản độc quyền của Reqable.

## Tài liệu chi tiết

- [Kiểm kê tính năng Reqable](FEATURE_INVENTORY.md)
- [Phương án self-host](SELF_HOSTING.md)
- [Repo/core nên tái sử dụng](CORE_REUSE.md)
- [Quyết định thiết kế và gate chọn core](DESIGN_DECISION.md)
- [Repo mã nguồn mở để tham khảo](research.md)

Đây là đề xuất ban đầu; các giới hạn không được ghi rõ trong tài liệu Reqable cần đối chiếu trực tiếp trong app trước khi coi là yêu cầu đã xác minh.
