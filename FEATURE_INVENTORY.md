# Kiểm kê tính năng Reqable cho bản thiết kế

Nguồn kiểm tra: tài liệu chính thức của Reqable và [bảng giá](https://reqable.com/en-US/pricing/) ngày 2026-09-25. Phạm vi mục tiêu là mọi tính năng Community + Premium cho cá nhân/nhóm nhỏ, bỏ các mục chỉ có ở Enterprise. Danh sách là kiểm kê theo tài liệu công khai, chưa phải kiểm thử từng màn hình trong ứng dụng.

## 1. Capture và inspect

- HTTP(S) proxy trên Windows, macOS, Linux, Android, iOS; desktop có system proxy/explicit proxy, mobile có VPN cục bộ; chứng chỉ CA cho giải mã HTTPS; cấu hình SSL proxying theo rule.
- HTTP/1.1, HTTP/2, HTTP/3 (QUIC) theo khả năng nền tảng; WebSocket và SSE.
- Danh sách traffic: cột tùy chỉnh, nguồn ứng dụng, explorer theo app/domain, lọc và tìm kiếm điều kiện, highlight tự động, bookmark, comment, lịch sử, nhiều session/cửa sổ.
- Inspector request/response: summary, query, headers, cookies, body, raw, WebSocket frames, SSE messages, trailers, early hints, console, interceptor trace. Viewer cho JSON/XML/text/hex/image/protobuf và các loại nội dung khác.
- Diff giữa request/response; code snippets, URL viewer, QR code; xuất/nhập HAR, session và Charles session; copy cURL; export dữ liệu traffic.
- Repeat/replay request, compose request từ traffic, traffic history, turbo/large traffic handling, proxy terminal.

Nguồn: [Capture docs](https://github.com/reqable/reqable-docs/tree/master/en-US/capture), [tabs](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/04_tabs.md), [pricing](https://reqable.com/en-US/pricing/).

## 2. Điều khiển traffic

- Breakpoint để chặn và sửa request/response trực tiếp.
- Rewrite: redirect, replace request/response, modify request/response.
- Python script/addons xử lý request/response và log console.
- Gateway, mirror host, reverse proxy, secondary/upstream proxy, network conditions/throttle, access control.
- Rule sets, điều kiện URL/method, thứ tự rule, bật/tắt và import/export rule.
- Report Server gửi mỗi phiên hoàn tất thành HAR JSON qua POST tới URL người dùng cấu hình; server nhận có thể tự dựng. Đây không phải backend sync của Reqable.

Nguồn: [Rewrite](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/26_rewrite.mdx), [Script](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/23_script.mdx), [Report Server](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/30_report-server.md).

## 3. API testing và quản lý

- HTTP client: method tùy chỉnh, URL/query, headers, cookies, body nhiều kiểu, auth, redirect, proxy, HTTP/2 và HTTP/3.
- WebSocket client; request history, metrics/timing, import/export cURL.
- Collections/folders/API documentation, environment variables nhiều scope, settings và scripting templates.
- Kết nối capture ↔ API client: gửi request và bắt lại traffic, tạo API từ traffic, thêm traffic vào collection.

Nguồn: [API docs](https://github.com/reqable/reqable-docs/tree/master/en-US/rest), [tutorial](https://github.com/reqable/reqable-docs/blob/master/en-US/getting-started/tutorial-api/index.md), [pricing](https://reqable.com/en-US/pricing/).

## 4. Thiết bị, UI, công cụ

- Mobile ↔ desktop qua LAN/QR, đồng bộ CA và chuyển traffic mobile sang desktop; trên Android có chọn app để capture. Remote devices.
- Theme/appearance/accent, shortcuts, regex tool và toolbox.
- MCP server tích hợp để AI đọc traffic và điều khiển API/rules/collections; Community chỉ read-only, Premium có bộ tool đầy đủ theo bảng giá.

Nguồn: [Collaboration](https://github.com/reqable/reqable-docs/blob/master/en-US/getting-started/collaboration/index.md), [Theme](https://github.com/reqable/reqable-docs/blob/master/en-US/theme/index.mdx), [MCP](https://github.com/reqable/reqable-docs/blob/master/en-US/mcp/index.mdx).

## 5. Giới hạn gói đáng chú ý

| Mục | Community | Premium |
| --- | --- | --- |
| Rewrite/Script/Breakpoint/Gateway/Mirror | 3 rules mỗi loại | Không giới hạn |
| Secondary proxy / Reverse proxy | 1 / 3 rules | Không giới hạn |
| Search / Auto highlight | 1 điều kiện / 1 điều kiện | 3 điều kiện / không giới hạn |
| Bookmark | 2 folders | Không giới hạn |
| Traffic và API history | 30 ngày | Không giới hạn |
| Windows / Sessions | 1 / 1 | Không giới hạn |
| Diff pool | 2 items | Không giới hạn |
| Report server / Access control | 1 / 1 | Không giới hạn |
| Remote devices | 1 | Không giới hạn |
| MCP | Chỉ đọc | Tool đầy đủ |
| Cloud | 1 device, 100 MB | 6 devices, 1 GB và đồng bộ |

Theo [bảng giá chính thức](https://reqable.com/en-US/pricing/). Bảng giá không ghi rõ một tính năng tên “tracker” hoặc “analysis” và cũng không chứng minh giới hạn board/status cụ thể. Cần đối chiếu ảnh/màn hình của người dùng trước khi đặt tên tính năng tương ứng.

## 6. Phần loại trừ Enterprise

- Team collaboration thương mại của Reqable.
- Private deployment của hạ tầng Reqable theo hợp đồng.
- Phát triển tính năng riêng và cấp hỗ trợ doanh nghiệp.

Các khả năng cộng tác cơ bản cho sản phẩm riêng có thể thiết kế sau, nhưng không phải điều kiện để đạt feature parity Community + Premium.

## 7. Cải tiến riêng cần có

- Tracker là lớp metadata độc lập cho captured request: tags, status tùy biến, notes, liên kết issue, timeline và nhiều board/view cùng trỏ về một request.
- View table/Kanban/timeline/saved query; nhiều bảng không giới hạn, nhiều điều kiện filter, nhiều cột/nhóm.
- Split panes linh hoạt: traffic list, inspector, diff, API client, analytics và board có thể đặt cạnh nhau; layout lưu theo workspace.
- Analytics có drill-down: latency, lỗi, status, endpoint, payload, phiên bản và so sánh session.

## 8. Checklist parity theo toàn bộ mục tài liệu chính thức

Mọi dòng là **yêu cầu cần kiểm tra/triển khai**, chưa đánh dấu hoàn thành. Link dẫn tới đúng mục trong cây tài liệu Reqable. Dùng checklist này để tránh một bản "gần giống" nhưng bỏ sót tính năng.

### Capture, proxy và dữ liệu

- [ ] [Traffic list](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/01_list.mdx), [columns](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/02_column.md), [explorer](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/03_explorer.md), [detail tabs](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/04_tabs.md).
- [ ] [Search/filter](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/10_search.mdx), [proxy/system proxy](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/11_proxy.md), [SSL proxying/CA](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/12_ssl.md), [localhost](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/13_localhost.md), [sessions](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/14_sessions.md).
- [ ] [Access control](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/20_access-control.md), [gateway](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/21_gateway.mdx), [mirror](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/22_mirror.mdx), [script](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/23_script.mdx), [addons](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/24_addons.md), [breakpoint](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/25_breakpoint.mdx), [rewrite](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/26_rewrite.mdx).
- [ ] [Reverse proxy](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/27_reverse-proxy.md), [diff](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/28_diff.mdx), [network condition](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/29_network-condition.md), [report server](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/30_report-server.md).
- [ ] [Repeat](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/31_repeat.mdx), [compose](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/32_compose.mdx), [highlight](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/33_highlight.mdx), [HAR](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/34_har.mdx), [history](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/35_history.md), [turbo](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/36_turbo.md), [view/code snippets](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/37_view.mdx), [proxy terminal](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/38_proxy-terminal.md), [Charles session](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/40_chls.md).

### API client

- [ ] [Methods](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/01_method.md), [headers](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/02_header.mdx), [body](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/03_body.md), [protocols](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/04_protocol.md).
- [ ] [Request ID](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/10_request_id.md), [cookies](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/11_cookie.md), [authorization](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/12_authorization.md), [proxy](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/12_proxy.md), [redirect](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/13_redirect.md), [history](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/14_history.md).
- [ ] [Collections](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/15_collection.mdx), [environments](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/16_envrionment.md), [settings](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/17_settings.md), [metrics](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/20_metrics.md), [cURL](https://github.com/reqable/reqable-docs/blob/master/en-US/rest/21_curl.md).

### Các phần còn lại

- [ ] [Global/user/practice environments](https://github.com/reqable/reqable-docs/tree/master/en-US/environment), [desktop/mobile collaboration](https://github.com/reqable/reqable-docs/blob/master/en-US/getting-started/collaboration/index.md), [MCP](https://github.com/reqable/reqable-docs/blob/master/en-US/mcp/index.mdx), [theme](https://github.com/reqable/reqable-docs/blob/master/en-US/theme/index.mdx), [regex toolbox](https://github.com/reqable/reqable-docs/blob/master/en-US/tools/01_regex.md), [shortcuts](https://github.com/reqable/reqable-docs/blob/master/en-US/shortcuts/index.mdx).
- [ ] Đối chiếu [changelog v3 hiện tại](https://github.com/reqable/reqable-docs/tree/master/en-US/changelogs) và chạy app trên từng nền tảng để bổ sung tính năng chưa có trang tài liệu riêng.

Các checklist này không bao gồm tính năng độc quyền Enterprise đã nêu ở mục 6. Chúng cũng chưa chứng minh ProxyPin hoặc repo khác đã đáp ứng; dùng để đo gap trước khi chọn core.

## Frontend implementation map — 2026-09-26

See [FE_STATUS.md](FE_STATUS.md) for local interactions, mock configuration, verification evidence and remaining limitations. Runtime parity checkboxes above must not be marked complete solely because a mock screen exists.
