# UI REDESIGN — CHECKLIST

Tracking các việc cần làm để giảm độ rối của Traffic Studio.
Bắt đầu: 2026-10-03. Target: làm #1–#3 trước, đo lại, rồi mới làm tiếp.

**Nguyên tắc chung:**
- Không rewrite CSS. Chỉ sửa cái gì hiển thị.
- Mỗi bước xong → `npm run build` + chạy thử → tick `[x]`.
- Không làm 2 bước cùng lúc.

**Học từ:** Prokcy, HTTP Toolkit, Proxyman, mitmweb (sleeyax), Hoppscotch.
**Chuẩn mực:** rail ≤7 nút · inspector ≤5 tab · traffic ≤6 cột · 1 thanh filter.

---

## PHASE 1 — Giảm thành phần hiển thị (tuần này)

### [ ] 1. Rail trái: 12 → 7 nút
**Học từ:** Prokcy (~6 nút)
**File:** `src/App.tsx`
**Giữ:** Traffic, API, Rules, Tracker, Toolbox, Settings, Toggle sidebar
**Bỏ khỏi rail:** History, Devices, Environments, Analytics, Mixed workspace
**Chuyển vào:** menu "View" hoặc menu con "More"
**Verify:** đếm lại số `<RailButton>` = 7

### [ ] 2. Inspector: 10 → 5 tab
**Học từ:** Prokcy (5 tab), Proxyman (5–6 tab)
**File:** `src/features/capture/TrafficInspector.tsx` — mảng `tabs`
**Giữ:** Summary, Headers, Body, Timeline, Raw
**Gộp vào Summary:** Cookies, TLS, Frames, SSE, Trace
**Verify:** mảng `tabs` có đúng 5 phần tử

### [ ] 3. Bảng traffic: 12 → 6 cột mặc định
**Học từ:** Prokcy (6 cột)
**File:** `src/features/capture/TrafficTable.tsx` — mảng `defaults`
**Mặc định visible:** method, url, status, duration, size, + 1 cột tuỳ chọn (waterfall/type)
**Mặc định ẩn:** id, favorite, bookmark, application, type, device, scheme
**Verify:** `defaults.filter(c => c.visible).length === 6`

**→ Sau #1+#2+#3: chạy app, chụp screenshot, tự đánh giá. Nếu đỡ rối rõ rệt → sang Phase 2. Nếu chưa → xem lại.**

---

## PHASE 2 — Cấu trúc lại khu vực (tuần sau)

### [ ] 4. Traffic: 3 thanh filter → 1 thanh
**Học từ:** Proxyman (1 filter bar)
**File:** `src/App.tsx` + `src/features/capture/TrafficFilters.tsx`
**Việc:** bỏ thanh "quick filter" riêng, gộp vào 1 thanh. Advanced filter mở khi bấm nút.
**Verify:** chỉ còn 1 `.traffic-controls`, không có `.traffic-filter-quick` riêng

### [ ] 5. Settings: 10 → 6 trang
**Học từ:** Proxyman, HTTP Toolkit
**File:** `src/features/settings/SettingsCenter.tsx` — mảng `settingsPages`
**Gộp:**
- Certificate + Proxy → "Proxy & Certificate"
- Integrations + Notifications → "Advanced"
**Giữ:** General, Appearance, Proxy & Certificate, Storage, Shortcuts, Help, Advanced
**Verify:** mảng `settingsPages.length === 7`

### [ ] 6. Body Previewer tự động
**Học từ:** Proxyman (tự beautify theo Content-Type)
**File:** `src/features/capture/MessagePane.tsx`
**Việc:** tự chọn format dựa vào `mimeType`:
- `application/json` → JSON tree/text
- `image/*` → preview ảnh
- `text/*` → text
- khác → hex
**Verify:** không cần user bấm chọn format thủ công

---

## PHASE 3 — Dọn dẹp (khi rảnh)

### [ ] 7. Empty state thông minh
**Học từ:** HTTP Toolkit (chỉ hiện cái cần thiết)
**File:** `src/App.tsx` (section traffic)
**Việc:** khi chưa capture → chỉ hiện hướng dẫn ngắn (3 dòng), không hiện bảng trống
**Verify:** mở app lần đầu thấy gọn, không thấy bảng trống

### [ ] 8. Menu top: 8 → 5
**File:** `src/shell/menuModel.ts`
**Gộp:** Proxy + Certificate vào View. Bỏ Traffic (đã có rail).
**Verify:** `menus.length <= 5`

### [ ] 9. Bớt banner "SAMPLE" / "DEMO"
**File:** nhiều feature components
**Việc:** chỉ giữ 1 badge "SAMPLE" ở status bar. Xoá các `<DemoNote>` rải rác.
**Verify:** search `SAMPLE|LOCAL PREVIEW|DEMO` — chỉ còn 1 chỗ trong status bar

### [ ] 10. Command Palette (Ctrl+K)
**Học từ:** Proxyman
**File:** tạo mới `src/shell/CommandPalette.tsx`
**Việc:** Ctrl+K mở overlay search request/rule/tool. Enter để nhảy tới.
**Verify:** bấm Ctrl+K trong app → overlay hiện

---

## KHÔNG LÀM

- ❌ Rewrite toàn bộ CSS / `theme.css`
- ❌ Đổi framework / UI library
- ❌ Thêm design system mới
- ❌ Đổi icon Material → Lucide hàng loạt (chỉ đổi khi cần)
- ❌ Sửa TSX trước khi sửa cái gì hiển thị

---

## TRẠNG THÁI HIỆN TẠI

| Khu vực | Hiện tại | Mục tiêu | Đã sửa |
|---|---|---|---|
| Rail trái | 12 nút | 7 | [ ] |
| Inspector tabs | 10 | 5 | [ ] |
| Traffic columns | 12 | 6 | [ ] |
| Traffic filter bars | 3 | 1 | [ ] |
| Settings pages | 10 | 7 | [ ] |
| Menu top | 8 | 5 | [ ] |
| Banner SAMPLE | 4 chỗ | 1 chỗ | [ ] |
| Body previewer | thủ công | tự động | [ ] |

---

## GHI CHÚ

- File này là checklist làm việc, không phải spec đầy đủ.
- Đọc lại mỗi khi bắt đầu session làm UI.
- Khi xong 1 mục → tick `[x]` + ghi ngày vào cuối dòng.
- Nếu bỏ qua 1 mục → ghi lý do, không xoá dòng.