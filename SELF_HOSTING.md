# Self-host: ba nghĩa cần phân biệt

## 1. Reqable hiện tại

Reqable là ứng dụng client/proxy chạy trên thiết bị. Tài liệu cho phép **tự dựng Report Server** để nhận HAR JSON qua POST từ các phiên capture. Đây chỉ là đầu nhận dữ liệu, không thay cho tài khoản, cloud sync hay backend cộng tác của Reqable. [Nguồn](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/30_report-server.md).

Bảng giá liệt kê **Private deployment** trong Enterprise. Không có bằng chứng công khai rằng gói Community/Premium cho phép tự host toàn bộ backend Reqable; không nên dựa vào giả định đó. [Nguồn](https://reqable.com/en-US/pricing/).

## 2. LAN/IP trong Reqable đã có tới đâu?

Tài liệu [Collaboration](https://github.com/reqable/reqable-docs/blob/master/en-US/getting-started/collaboration/index.md) xác nhận mobile có thể quét QR/tự tìm desktop cùng LAN, đồng bộ cấu hình/chứng chỉ cần thiết và **chuyển traffic đang capture** sang desktop để inspect/rules. Đây là kết nối thiết bị trực tiếp, không đòi cloud tự host. Tài liệu không xác nhận cơ chế đồng bộ đầy đủ database, collections, lịch sử và board giữa hai máy qua IP. Không được coi hai việc này là một.

## 3. Sản phẩm mình xây

**Ưu tiên peer-to-peer qua LAN/IP, không cần cloud.** Cấu trúc đề xuất:

- Desktop app chạy offline, proxy/CA và dữ liệu mặc định nằm tại máy.
- Desktop có local listener trên IP:port; mobile/desktop khác ghép cặp bằng QR hoặc mã một lần qua LAN. Dùng nó để stream traffic, đẩy HAR/session, và chuyển collections/rules/workspace khi người dùng chọn.
- Đồng bộ không cần server trung tâm: snapshot + incremental changes, nhận diện bản sao và giải quyết xung đột nếu hai bên sửa cùng dữ liệu. Mã hóa kênh và xác thực thiết bị là bắt buộc vì traffic có thể chứa token/cookie.
- Nếu sau này cần truy cập xuyên Internet hoặc nhiều máy không online đồng thời, có thể thêm **relay/server tự host tùy chọn**, không phải dependency của core. Đừng đưa PostgreSQL/MinIO/Docker Compose vào MVP chỉ để chuyển dữ liệu trong LAN.

## 4. Trình tự làm

1. Chốt danh sách feature parity và thiết kế data model.
2. Làm desktop local-first và tracker/split view.
3. Sau khi app PC đạt feature parity, làm app phụ trợ Android/iOS và kết nối LAN/IP: stream capture và chuyển session/collections/rules.
4. Chỉ cân nhắc relay tự host khi xuất hiện nhu cầu truy cập ngoài LAN.

Không cần dựng cloud hay server riêng chỉ để dùng một máy hoặc ghép cặp trong LAN. Mobile capture vẫn cần VPN cục bộ và xử lý chứng chỉ trên từng hệ điều hành.
