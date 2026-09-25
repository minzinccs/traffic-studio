# Khảo sát core để tái sử dụng

Kiểm tra ngày 2026-09-25. Số sao là ảnh chụp tại thời điểm kiểm tra bằng GitHub API, có thể thay đổi. "Có" dưới đây chỉ có nghĩa README/tài liệu repo xác nhận, không phải đã chạy test hay xác nhận parity với Reqable.

| Repo | Sao | License | Nên dùng cho | Chưa có/chưa xác nhận |
| --- | ---: | --- | --- | --- |
| [ProxyPin](https://github.com/wanghongenpin/proxypin) | 14,004 | Apache-2.0 | Core Dart tham khảo cho PC Tauri: Flutter Windows/macOS/Linux/Android/iOS, HTTP(S) capture/inspect/rewrite, script JS, mock/mapping, history/HAR, QR kết nối và forward traffic giữa thiết bị | API client đầy đủ kiểu Reqable, HTTP/3, analytics, tracker đa bảng, split view nhiều pane chưa được xác nhận. Cần chạy thử. |
| [Whistle](https://github.com/avwo/whistle) | 15,709 | MIT | Engine/server proxy: HTTP(S)/HTTP2/WebSocket/TCP, rules, plugins, Composer, UI; chạy headless và dùng như npm module | Mobile native, API collections/environments, tracker và UI Reqable phải bổ sung; HTTP/3 chưa xác nhận. |
| [mitmproxy](https://github.com/mitmproxy/mitmproxy) | 45,146 | MIT | Engine MITM trưởng thành: interception, replay, modify, script/API, nhiều proxy mode; dùng qua sidecar/process | UI hiện có không phải workflow Reqable; tích hợp Python runtime, API client/board/split view cần thêm. |
| [HTTP Toolkit UI + Server + Desktop](https://github.com/httptoolkit) | 377 / 563 / 734 | AGPL-3.0 | Nền desktop capture/inspect/rewrite/mock/API client gần dạng sản phẩm hoàn chỉnh | License AGPL ảnh hưởng việc phân phối/sửa đổi; mobile/LAN và tracker đa bảng chưa được xác nhận. |
| [Hoppscotch](https://github.com/hoppscotch/hoppscotch) | 80,506 | MIT | API client/collections/testing nếu cần tham khảo chức năng | Không phải core MITM traffic capture; ghép nguyên app vào proxy khác rất tốn công. |
| [Insomnia](https://github.com/Kong/insomnia) | 40,029 | Apache-2.0 | API client đa giao thức, local/Git storage | Không phải core capture proxy; app lớn, tích hợp nguyên khối phức tạp. |

## Kết luận kỹ thuật hiện tại cho app PC

Giao diện đã chọn Tauri + React/TypeScript và **không dùng Flutter**. Vì ProxyPin là Dart core chạy trong Flutter process, không fork nguyên app hoặc nhúng trực tiếp core vào Rust. Cây mã nguồn ProxyPin bên dưới vẫn là tài liệu để đối chiếu tính năng và học cấu trúc.

Đưa **Whistle** và **mitmproxy** vào spike runtime trên Windows để chọn sidecar proxy. Whistle có lợi thế Node module/headless/rule/plugin và MIT; mitmproxy có MITM/scripting trưởng thành. Chưa repo nào được xác nhận đạt toàn bộ Reqable. Kết quả spike sẽ quyết định core, không dựa riêng vào số sao.

API client, tracker nhiều bảng, analytics và dockable views là phần sản phẩm cần xây quanh core được chọn. [Quyết định stack](DESIGN_DECISION.md) là nguồn hiện hành nếu các nhận định cũ trong tài liệu khảo sát khác đi.
## Kiểm tra trực tiếp cây mã nguồn ProxyPin

Đã xác nhận **mã tồn tại**, chưa xác nhận chất lượng hoặc chạy đúng trên mọi OS:

- [ProxyServer](https://github.com/wanghongenpin/proxypin/blob/main/lib/network/bin/server.dart) và các [interceptor](https://github.com/wanghongenpin/proxypin/tree/main/lib/network/components): proxy listener, host, map, rewrite, script, block, breakpoint, network condition, report server. Đây là lõi nên tái sử dụng thay vì viết lại.
- [HTTP/2 codec](https://github.com/wanghongenpin/proxypin/tree/main/lib/network/http/h2), [WebSocket handler](https://github.com/wanghongenpin/proxypin/blob/main/lib/network/handle/websocket_handle.dart), [SSE handler](https://github.com/wanghongenpin/proxypin/blob/main/lib/network/handle/sse_handle.dart), [certificate utilities](https://github.com/wanghongenpin/proxypin/tree/main/lib/network/util/cert).
- [VPN Android](https://github.com/wanghongenpin/proxypin/blob/main/android/app/src/main/kotlin/com/network/proxy/ProxyVpnService.kt) và [Packet Tunnel iOS](https://github.com/wanghongenpin/proxypin/blob/main/ios/ProxyPin/PacketTunnelProvider.swift).
- [QR desktop](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/desktop/toolbar/phone_connect.dart) mã hóa host/port để mobile kết nối. Cần kiểm tra thêm xác thực thiết bị, mã hóa và cách chuyển session/collection; QR host/port một mình không chứng minh có data sync.
- [MCP server](https://github.com/wanghongenpin/proxypin/tree/main/lib/mcp) đã có trong code. Chưa so sánh số lượng/capability tool với Reqable.
- [VerticalSplitView](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/component/split_view.dart) chỉ là hai pane trái/phải co giãn; không tương đương layout nhiều pane/tab độc lập và lưu layout.
- UI có [request editor](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/desktop/request/request_editor.dart), [repeat](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/desktop/request/repeat.dart), [environment](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/desktop/setting/environment.dart), [diff tool](https://github.com/wanghongenpin/proxypin/blob/main/lib/ui/toolbox/text_diff.dart). Không suy ra API collections/auth/scripts tương đương Reqable khi chưa chạy thử.

Tìm tên path trong cây mã nguồn không thấy module rõ ràng cho collections, HTTP/3/QUIC, board hoặc analytics; đây là **chưa thấy bằng chứng**, không phải kết luận chắc chắn tính năng không tồn tại.

## Điểm cần sửa trong tài liệu cũ

Repo [reqable/reqable-app](https://github.com/reqable/reqable-app) là issue tracker, [reqable/reqable-docs](https://github.com/reqable/reqable-docs) là tài liệu. **Core ứng dụng Reqable không được công bố để fork**; không thể "lấy core Reqable" từ hai repo này. Kế hoạch tái sử dụng nói đến core của dự án open source khác.
