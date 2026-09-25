# Quyết định thiết kế v0.2

## Phạm vi

Đích là tương đương toàn bộ chức năng Reqable Community + Premium trên các nền tảng được hỗ trợ, **ngoại trừ phần chỉ dành cho Enterprise**, bỏ giới hạn gói. Bổ sung tracker nhiều bảng, trạng thái tùy chỉnh, analytics và bố cục view linh hoạt. [Checklist chi tiết](FEATURE_INVENTORY.md) là chuẩn để kiểm thử parity; không được đánh dấu hoàn thành chỉ vì một repo có tên file tương ứng.

## Giao diện

Thiết kế sản phẩm/UI riêng. Bố cục charcoal + amber có thể là cảm hứng thị giác, nhưng không sao chép tài sản, logo hay mã giao diện của Reqable. Editor gồm dockable panes/tabs: capture list, inspector, API client, diff, analytics, board. Pane có thể chia ngang/dọc, di chuyển, ghim và lưu layout theo workspace. ProxyPin hiện có component hai pane đơn giản; có thể thay lớp UI dần khi giữ core chạy.

## Core

Fork ProxyPin để thử nghiệm là hướng ưu tiên, do core Dart, Flutter desktop/mobile, VPN mobile và QR/LAN đã có. Giữ các `lib/network`, `lib/native` và mã VPN platform lúc đầu; xây adapter giữa capture events và data model mới. Tránh tách core sang Tauri/React ngay vì sẽ phải tạo cầu nối Dart ↔ process/IPC và làm lại mobile integration. Nếu Flutter không đáp ứng dockable UI hoặc hiệu năng, quyết định lại sau prototype có số đo.

Whistle hoặc mitmproxy là phương án dự phòng cho proxy engine khi spike tìm thấy gap cụ thể. Không ghép nhiều engine và API client lớn ngay từ đầu; chi phí tích hợp có thể lớn hơn tự bổ sung tính năng còn thiếu.

## Kết nối thiết bị

Local-first. Capture, rule, API client và tracker hoạt động offline. Kết nối LAN/IP bằng QR/manual host:port cho stream traffic như ProxyPin đã có. Chuyển session, collections, rules và workspace là **tính năng mới cần thiết kế và kiểm thử**; không giả định chức năng QR hiện tại đã làm việc đó. Cloud hoặc server tự host luôn là tùy chọn, không nằm trong đường đi chính.

## Gate chọn core trước khi viết nhiều UI

1. Build/run ProxyPin trên Windows; kiểm tra system proxy, chứng chỉ, HTTPS, HTTP/2, WebSocket/SSE, replay, breakpoint, rewrite, map/mock, script, history/HAR, QR với Android/iOS nếu có thiết bị.
2. Lập ma trận từng mục trong [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md): `đạt`, `đạt một phần`, `thiếu`, `chưa kiểm tra`; ghi nền tảng và bằng chứng test.
3. Kiểm tra phụ thuộc, license Apache-2.0 và khả năng thay UI mà không phải sửa sâu proxy engine.
4. Chỉ khi kết quả đạt đủ phần core thiết yếu mới khóa hướng fork và bắt đầu UI/data model mới.

Hiện gate này **chưa hoàn thành**. Nghiên cứu mã nguồn cho thấy ứng viên mạnh, không phải đã chứng minh feature parity hoặc chất lượng runtime.
