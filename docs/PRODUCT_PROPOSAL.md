# Traffic Studio â€” Ã½ tÆ°á»Ÿng sáº£n pháº©m

**Current development status (2026-09-30):** see [CHANGELOG.md](../CHANGELOG.md) â€” native HTTP/capture/rules/protocols, HAR, tracker/analytics/layout and opt-in integrations in source; FTS5 flow search, native Explorer and mode-honest copy added (Rust parts unverified on machines without a toolchain). Browser preview remains sample-labelled. Native UI interaction, portable installer and full acceptance remain open.

á»¨ng dá»¥ng desktop Ä‘á»ƒ báº¯t, phÃ¢n tÃ­ch, chá»‰nh sá»­a vÃ  kiá»ƒm thá»­ lÆ°u lÆ°á»£ng HTTP(S), láº¥y cáº£m há»©ng tá»« workflow cá»§a Reqable. Æ¯u tiÃªn local-first, nhiá»u phiÃªn/báº£ng vÃ  giao diá»‡n tá»‘i rÃµ rÃ ng.

**App local:** React + Rust backend cháº¡y trong Tauri trÃªn mÃ¡y, khÃ´ng cáº§n production online/account. Äiá»‡n thoáº¡i lÃ  companion qua pairing; VPS cÃ¡ nhÃ¢n hoáº·c dá»‹ch vá»¥ cloud lÃ  tÃ¹y chá»n vá» sau. HÆ°á»›ng thiáº¿t káº¿ open-source; license cá»¥ thá»ƒ chÆ°a chá»n. Xem [kiáº¿n trÃºc local-first](docs/LOCAL_FIRST_ARCHITECTURE.md). Cháº¡y native dev: `powershell -ExecutionPolicy Bypass -File scripts/dev-native.ps1`. Táº¡o release executable trong checkout: `powershell -ExecutionPolicy Bypass -File scripts/build-local-release.ps1` (cáº§n `scripts/setup-capture.ps1` cho capture; chÆ°a pháº£i installer mang sang mÃ¡y khÃ¡c). Script nÃ y báº¯t buá»™c Ä‘i qua Tauri CLI (`npm run tauri -- build`): `cargo build --release` tráº§n táº¡o binary dev-mode (táº£i `devUrl` `http://127.0.0.1:1420`, khÃ´ng nhÃºng `dist`) nÃªn chá»‰ cháº¡y khi Vite dev server Ä‘ang má»Ÿ; script tá»± kiá»ƒm tra vÃ  bÃ¡o lá»—i náº¿u exe thiáº¿u frontend. Test UI native cÃ³ báº±ng chá»©ng: `node tests/native-ui-drive.mjs` khi app má»Ÿ vá»›i `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`.

**ÄÃ­ch cuá»‘i:** Ä‘á»§ má»i tÃ­nh nÄƒng Community + Premium cá»§a Reqable theo [checklist](docs/FEATURE_INVENTORY.md), trá»« pháº§n chá»‰ cÃ³ á»Ÿ Enterprise, vÃ  thÃªm tracker/analytics/view theo yÃªu cáº§u. **App PC lÃ  sáº£n pháº©m chÃ­nh vÃ  Ä‘Æ°á»£c lÃ m trÆ°á»›c; Android/iOS lÃ  app phá»¥ trá»£ á»Ÿ giai Ä‘oáº¡n sau.** CÃ¡c má»‘c bÃªn dÆ°á»›i lÃ  thá»© tá»± thá»±c hiá»‡n, khÃ´ng pháº£i cáº¯t bá»›t pháº¡m vi cuá»‘i.

## Váº¥n Ä‘á» cáº§n giáº£i quyáº¿t

- Muá»‘n dÃ¹ng tracker/analysis nÃ¢ng cao mÃ  khÃ´ng bá»‹ giá»›i háº¡n theo gÃ³i tráº£ phÃ­.
- Má»™t request cáº§n gáº¯n nhiá»u nhÃ£n, tráº¡ng thÃ¡i, ghi chÃº vÃ  theo dÃµi qua nhiá»u báº£ng.
- Muá»‘n chia mÃ n hÃ¬nh Ä‘á»ƒ so sÃ¡nh capture, request/response, API client vÃ  thá»‘ng kÃª cÃ¹ng lÃºc.
- Cáº§n giá»¯ dá»¯ liá»‡u cá»¥c bá»™ vÃ  xuáº¥t Ä‘Æ°á»£c dá»¯ liá»‡u, thay vÃ¬ phá»¥ thuá»™c tÃ i khoáº£n/cloud.

## Äá» xuáº¥t trá»ng tÃ¢m

1. **Capture workspace**: nhiá»u session Ä‘á»“ng thá»i; filter theo app, host, path, method, status, thá»i gian; tÃ¬m trong header/body; lÆ°u phiÃªn, HAR, cURL.
2. **Tracker linh hoáº¡t**: má»—i request cÃ³ tags, tráº¡ng thÃ¡i tÃ¹y biáº¿n, ngÆ°á»i phá»¥ trÃ¡ch tÃ¹y chá»n, ghi chÃº, lá»‹ch sá»­ thay Ä‘á»•i. Má»™t request cÃ³ thá»ƒ xuáº¥t hiá»‡n trÃªn nhiá»u board/view mÃ  khÃ´ng nhÃ¢n báº£n dá»¯ liá»‡u.
3. **Nhiá»u view**: table, Kanban, timeline vÃ  saved filters trÃªn cÃ¹ng má»™t táº­p dá»¯ liá»‡u; cá»™t, thá»© tá»±, nhÃ³m vÃ  sort tÃ¹y chá»‰nh.
4. **Split view**: pane kÃ©o tháº£, tab Ä‘á»™c láº­p; so sÃ¡nh hai request/response hoáº·c hai session; lÆ°u layout theo workspace.
5. **API client gáº¯n vá»›i capture**: gá»­i láº¡i request Ä‘Ã£ báº¯t, sá»­a headers/body/auth, biáº¿n mÃ´i trÆ°á»ng, collection, assertions, history.
6. **Debug**: breakpoint, rewrite, mock/map local, throttle, repeat/replay; rule cÃ³ pháº¡m vi rÃµ rÃ ng vÃ  cÃ³ thá»ƒ báº­t táº¯t.
7. **Analysis**: tá»•ng há»£p latency, status, lá»—i, endpoint vÃ  kÃ­ch thÆ°á»›c payload; biá»ƒu Ä‘á»“ theo khoáº£ng thá»i gian, drill-down vá» request gá»‘c.
8. **Local-first**: SQLite cho metadata; payload lÆ°u cá»¥c bá»™ cÃ³ giá»›i háº¡n/retention; export/import HAR vÃ  Ä‘á»‹nh dáº¡ng dá»± Ã¡n má»Ÿ; secrets khÃ´ng náº±m trong export máº·c Ä‘á»‹nh.

## Base giao diá»‡n Ä‘Ã£ táº¡o

Source trong `src/` vÃ  `src-tauri/` Ä‘Ã£ cÃ³ native HTTP client, SQLite/body storage, Digest/OAuth, scripts sandbox, import collection, environment/vault vÃ  cÃ¡c Ä‘iá»u khiá»ƒn CA/proxy Windows. Frontend build qua; nghiá»‡m thu tÆ°Æ¡ng tÃ¡c native vÃ  Rust trÃªn mÃ¡y build xem [CHANGELOG.md](../CHANGELOG.md). Capture engine: mitmproxy qua adapter localhost, xem [engine selection](docs/ENGINE_SELECTION.md).

## MVP Ä‘á» xuáº¥t

Windows desktop trÆ°á»›c: capture HTTP(S) qua explicit/system proxy, danh sÃ¡ch request + inspector, filter/search, replay, session persistence, tracker Ä‘a báº£ng, split view 2â€“4 pane. Sau Ä‘Ã³ hoÃ n thiá»‡n toÃ n bá»™ feature parity desktop (rewrite/mock, API client, analytics, rules, MCP vÃ  cÃ¡c má»¥c trong checklist) trÆ°á»›c khi báº¯t Ä‘áº§u app phá»¥ trá»£ Android/iOS. Káº¿t ná»‘i PCâ†”mobile qua LAN/IP chá»‰ triá»ƒn khai khi Ä‘áº¿n giai Ä‘oáº¡n mobile.

## HÆ°á»›ng ká»¹ thuáº­t cáº§n thá»­ nghiá»‡m

- Giao diá»‡n PC: Tauri 2 + React/TypeScript, theme vÃ  layout riÃªng theo [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). KhÃ´ng dÃ¹ng Flutter.
- Proxy core chÆ°a chá»‘t: kiá»ƒm thá»­ Whistle vÃ  mitmproxy nhÆ° sidecar trÆ°á»›c khi cÃ¢n nháº¯c viáº¿t engine Rust. ProxyPin/Dart chá»‰ lÃ  tÃ i liá»‡u tham kháº£o cho app PC.
- SQLite + FTS cho metadata/tÃ¬m kiáº¿m; payload file riÃªng, cÃ³ quota vÃ  redaction.
- MÃ´ hÃ¬nh dá»¯ liá»‡u: `request` â†” `board_item` (many-to-many), `view` chá»©a filter/sort/columns/layout, `event` lÆ°u audit.

## NguyÃªn táº¯c thiáº¿t káº¿

CÃ³ thá»ƒ dÃ¹ng báº£ng mÃ u charcoal + amber vÃ  máº­t Ä‘á»™ thÃ´ng tin giá»‘ng áº£nh tham kháº£o, nhÆ°ng tá»± thiáº¿t káº¿ biá»ƒu tÆ°á»£ng, tÃªn, spacing, component vÃ  tÃ i sáº£n Ä‘á»“ há»a riÃªng. KhÃ´ng sao chÃ©p mÃ£ nguá»“n hay tÃ i sáº£n Ä‘á»™c quyá»n cá»§a Reqable.

## TÃ i liá»‡u chi tiáº¿t

- [Kiá»ƒm kÃª tÃ­nh nÄƒng Reqable](docs/FEATURE_INVENTORY.md)
- [PhÆ°Æ¡ng Ã¡n self-host](docs/SELF_HOSTING.md)
- [Repo/core nÃªn tÃ¡i sá»­ dá»¥ng](docs/CORE_REUSE.md)
- [Quyáº¿t Ä‘á»‹nh thiáº¿t káº¿ vÃ  gate chá»n core](docs/DESIGN_DECISION.md)
- [Design system giao diá»‡n PC](docs/DESIGN_SYSTEM.md)
- [Quy táº¯c cho AI/code agents](AGENTS.md)
- [Cáº¥u trÃºc vÃ  ranh giá»›i module](docs/STRUCTURE.md)
- [Nháº­t kÃ½ thay Ä‘á»•i](../CHANGELOG.md)

ÄÃ¢y lÃ  Ä‘á» xuáº¥t ban Ä‘áº§u; cÃ¡c giá»›i háº¡n khÃ´ng Ä‘Æ°á»£c ghi rÃµ trong tÃ i liá»‡u Reqable cáº§n Ä‘á»‘i chiáº¿u trá»±c tiáº¿p trong app trÆ°á»›c khi coi lÃ  yÃªu cáº§u Ä‘Ã£ xÃ¡c minh.
