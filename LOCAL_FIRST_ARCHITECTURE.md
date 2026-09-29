# Local-first product and deployment model

Decision updated 2026-09-27 from the user's clarification: Traffic Studio is a local desktop application with phone companions. Developing or running it does not require a production website, hosted backend, cloud subscription or account.

## Runtime boundary

The Windows process contains the Tauri shell, React interface, Rust commands, SQLite metadata, local body files, Windows protected credentials and a future selected proxy sidecar. Frontend-to-backend calls use local Tauri IPC. The Vite server is only a loopback development server; packaged frontend assets are local files. Downloading build dependencies during setup does not turn runtime into a cloud service.

Core capture, API editing/sending, rules, tracker, analytics, sessions and import/export must remain useful offline. Network requests explicitly sent by the user and captured traffic naturally use their selected network destinations; those are independent of a hosted Traffic Studio backend. Desktop OS proxy/certificate behavior remains explicit. The current implementation has not yet completed real capture/HTTP transport.

## Phone linking

Phone companion linking is a first-class product requirement, not a cloud substitute. The intended path is user-started authenticated PC↔phone pairing over LAN, QR discovery and revocable device credentials. No LAN listener is exposed by default. Device capture/tunnel and session/collection transfer need explicit permission and conflict/recovery handling. Current device screens are previews; this decision does not claim mobile/linking has been implemented.

## Optional remote service

Keep a provider-neutral, versioned protocol boundary for remote relay/sync. A user can optionally deploy a compatible service to a personal VPS. A managed paid service could implement the same boundary later, with billing/account functionality restricted to that service. Choosing a provider must not change the local document format or require uploading existing workspaces. Local and direct LAN operation stay available when the service is absent or unreachable.

2026-09-29 scope decision: do not implement an Internet relay/cloud service in the current app. DEC-CLOUD is resolved as an accepted optional exclusion; this does not defer direct PC↔phone linking on the same Wi-Fi/LAN. A future explicit request can reopen a self-hosted VPS or managed-service design. The earlier vendor cloud quotas in FEATURE_INVENTORY are reference information, not automatic limits on this app's local storage.

## Open-source direction

Design for inspectable source, reproducible local builds, documented modules and open versioned exchange/protocol formats. The user described an open-source style; the exact repository license, contribution policy and paid-service licensing have not been selected. Do not invent a license grant or publish the repository to imply that decision is complete. Dependency licenses still require review before distribution.

## Run locally

On Windows install Rust stable with the MSVC target, Visual Studio C++ tools/Windows SDK and WebView2. Run from the repository:

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/dev-native.ps1
```

The script locates Cargo through CARGO_HOME or the user .cargo directory and starts Tauri plus the loopback Vite development server. `-NoWatch` disables native watching. It does not enable proxy capture, configure Windows trust, expose LAN or deploy anything.
