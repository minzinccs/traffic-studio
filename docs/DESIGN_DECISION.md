# Quyết định thiết kế v0.3 — PC trước

**Current core decision (2026-09-28):** mitmproxy 12.2.3 is selected for the initial local capture adapter after a measured Windows Whistle comparison. `ENGINE_SELECTION.md` gives evidence, gaps and fallback. Local HTTP and H3 reverse capture fixtures pass. Release bundling/license and complete parity acceptance are still open. Earlier “core unselected” text below is historical.

## Mục tiêu

App **Windows PC là sản phẩm chính**. Đích cuối là bộ tính năng Reqable Community + Premium theo [checklist](FEATURE_INVENTORY.md), bỏ phần chỉ dành cho Enterprise, cộng tracker nhiều bảng, analytics và bố cục view linh hoạt. Android/iOS là app phụ trợ sau khi desktop ổn định. Việc triển khai theo giai đoạn không cắt bớt phạm vi cuối.

## Stack đã chọn cho giao diện PC

- **Tauri 2 + React 19 + TypeScript + Vite**, không dùng Flutter.
- Rust cung cấp desktop shell và sau này là cầu nối lệnh/sự kiện với proxy engine.
- Frontend gồm menu, sidebar, toolbar capture, tab workspace, traffic list/inspector, API workspace và các màn Rules/History/Devices/Toolbox.
- Theme, layout và tokens ở [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Giao diện được thiết kế riêng, không sao chép tài sản/nhận diện Reqable.
- Mã hiện tại là **UI shell**. Sample traffic là dữ liệu giả để thử bố cục; recording, certificate, HTTP send và import HAR chưa kết nối engine.

## Core còn phải kiểm tra

Stack UI đã chốt, **proxy core chưa chốt**. Chuyển nguyên core ProxyPin vào app Tauri không còn là đường ngắn: nó được viết bằng Dart, chạy trong Flutter process và nối UI bằng event listener. Có thể tận dụng thuật toán/cấu trúc làm tham khảo, nhưng muốn dùng trực tiếp cần Dart sidecar/IPC. Do đó ProxyPin không còn là ứng viên fork nguyên app trong bản PC.

Ưu tiên kiểm thử [Whistle](https://github.com/avwo/whistle) như headless proxy/sidecar Node vì MIT, rule engine, HTTP(S)/HTTP2/WebSocket, replay/Composer và API/plugin. Đối chiếu [mitmproxy](https://github.com/mitmproxy/mitmproxy) nếu Whistle thiếu khả năng then chốt. Chỉ viết proxy core Rust mới khi hai lựa chọn không đáp ứng yêu cầu hoặc chi phí đóng gói/tích hợp vượt chi phí tự xây.

API client, tracker, analytics và dockable layout thuộc lớp sản phẩm của mình; có thể tái sử dụng thư viện/component, không ghép nguyên UI app khác.

**P04 source update — 2026-09-27:** HTTP client trực tiếp dùng Rust reqwest/Tokio qua typed Tauri bridge, độc lập core capture; không cần chờ proxy sidecar để viết client. Có native transport/request/run repositories và preview transport tách rõ. Capture core vẫn chưa chọn; không dùng HTTP client build thành evidence capture hay bỏ core-selection gate. Chi tiết xem CHANGELOG.md.

## Gate trước khi nối engine

1. Build/run Whistle và mitmproxy trên Windows bằng traffic thử có kiểm soát.
2. Kiểm tra từng mục [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md), ghi `đạt`, `đạt một phần`, `thiếu`, `chưa kiểm tra` cùng bằng chứng. Đặc biệt: HTTPS CA, HTTP/2, HTTP/3/QUIC, WebSocket/SSE, breakpoint, rewrite, mock, script, reverse/upstream proxy, report, HAR và replay.
3. Đo throughput, RAM, độ ổn định, cơ chế API/event, khả năng đóng gói cùng Tauri và license.
4. Chọn engine rồi xây interface ổn định: `start_capture`, `stop_capture`, `set_proxy_endpoint`, `subscribe_flows`, `get_flow`, `import_har`, `send_request`.

**Windows spike update 2026-09-28:** hai ứng viên đã chạy cùng fixture HTTP/HTTPS/H2/WebSocket/SSE/rewrite, có startup/throughput/p95/RAM và shutdown measurements. Chọn mitmproxy 12.2.3 cho adapter đầu tiên theo [ENGINE_SELECTION.md](ENGINE_SELECTION.md). Gate parity đầy đủ vẫn chưa hoàn thành; các gaps được giữ trong tracker. Không coi UI preview hay lựa chọn adapter là runtime capture acceptance.

## Kết nối thiết bị

Desktop local-first. Mobile và QR/IP LAN là giai đoạn sau. Cloud/server riêng không nằm trong luồng chính. Chuyển session, collections, rules và workspace giữa thiết bị là tính năng cần thiết kế/kiểm thử, không suy ra từ khả năng stream traffic hiện có của Reqable hoặc ProxyPin.

**Chốt lại theo user 2026-09-27:** đây là app local, frontend/backend chạy trong máy và liên kết điện thoại. Không cần production online để phát triển/build/chạy. Kiến trúc theo hướng open-source, format/protocol mở; license cụ thể chưa chốt. Cloud chỉ là provider tùy chọn: VPS cá nhân tự host hoặc dịch vụ có thể mở bán về sau, dùng cùng boundary; không bắt buộc account/cloud cho desktop hoặc LAN linking. Xem LOCAL_FIRST_ARCHITECTURE.md. Chưa triển khai hay publish cloud/mobile.

## Điều kiện build native ở máy hiện tại

Frontend đã build được bằng `npm run build`. `tauri info` hiện báo **chưa có Rust/Cargo và Visual Studio Build Tools với MSVC + Windows SDK**; vì vậy chưa thể biên dịch/chạy cửa sổ Tauri native trên máy này. Source Tauri đã được tạo để nối sau khi cài toolchain.

**Cập nhật 2026-09-27 sau setup:** dòng trên là trạng thái cũ. Toolchain đã xác nhận đủ: Rust/Cargo 1.98.1, MSVC Visual Studio Community 2022, Windows SDK 10.0.26100.0, WebView2 153.0.4234.48. `cargo build --manifest-path src-tauri/Cargo.toml` đã qua và tạo `src-tauri/target/debug/traffic-studio.exe`. Native dev đã khởi chạy cùng Vite loopback; chưa nghiệm thu giao diện/IPC/DPAPI/capture, test suite vẫn hoãn theo yêu cầu.


## Execution roadmap — 2026-09-27

Detailed phase/task tracking docs were removed during release prep; see CHANGELOG.md for history and known limits. This adds no change to the chosen PC stack or proxy engine. Windows completion precedes macOS/Linux and Android/iOS/LAN work. Optional cloud inventory gap requires a later explicit scope decision; no cloud/login/listener default is introduced by planning.
