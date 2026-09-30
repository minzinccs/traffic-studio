# Engine integration staging

Core is deliberately unselected. User requested implementation P01–P03 while deferring behavioral/integration tests until after five phases. Therefore benchmark execution and the evidence-based selection ADR stay pending; no candidates are automatically installed or started.

`protocol.ts` records proposed versioned authenticated stdio messages. Rust `engine::Supervisor` verifies a packaged manifest/checksum, starts only a packaged executable, requires matching handshake token/version/adapter within 5 seconds and stops on app exit. Supervisor does not implement capture/flow event routing yet. No executable/manifest is packaged by default; native start reports unsupported.

An eventual packaged `engine-manifest.json` must contain `protocolVersion:1`, `adapter:whistle|mitmproxy`, a relative `executable`, its `sha256`, and nonempty `selectionEvidence`. Do not fabricate evidence to enable this gate. Windows descendant process/job-object handling remains pending; direct child cleanup is implemented, not validated.

Candidate profiles and the benchmark runner live in candidates.json and engine-sidecar/benchmark.py (the generic spike script was removed during release prep; engine choice is recorded in docs/ENGINE_SELECTION.md). Measure actual protocol/mode support rather than inferring it from advertised options. Keep traffic limited to controlled fixtures and loopback; do not install an OS CA or alter system proxy during a generic spike command.
