# Optional whole-machine packet capture (Windows)

The native HTTP(S) proxy and the new optional packet adapter are separate. A Windows system-proxy setting only reaches clients that honor it; the browser build at `127.0.0.1:1420` cannot start either native engine.

## Implemented source (2026-09-29)

- `src-tauri/src/packets/` discovers an existing Wireshark `dumpcap`/`tshark`, lists capture interfaces, starts an explicit selected-interface PCAPNG ring (5 × 10 MiB), limits total retained capture storage to 200 MiB, stops the child on command/exit, and exports or explicitly deletes retained PCAPNG files. It does not install a driver.
- A user-selected NSS TLS key-log file is validated (1 MiB/4096-entry limit), kept as an in-memory path and passed to `tshark` for analysis of the first 300 frame summaries. The UI never labels TLS as decrypted merely because packets or a key-log file exist; matching HTTP method/status columns are the available proof of dissection. Key-log secrets are not stored in the app database.
- Toolbox has a bounded QuickJS decoder with an in-memory key, code-only reusable URL-substring profiles, Web Crypto AES-GCM with a supplied raw key/nonce, and streaming SHA-224/256/384/512 file hashing. A captured response body preview can be sent into that decoder.
- On the development PC, `dumpcap`/`tshark` were not found; real packet start, driver permissions, key-log-based dissection and native UI remain unverified. The adapter is opt-in and reports unavailable when tools are absent.

## Proposed local integration

1. Verify the adapter on a Windows machine with an installed Npcap/dumpcap pair. Detect driver status and permission errors separately from missing executables. Add bounded capture filters and more reliable process-start diagnostics.
2. Keep packet metadata separate from HTTP proxy flows. Extend the analyzer to supported decrypted body/protocol views with bounded output and true source attribution, without mapping raw packet frames into HTTP objects before reconstruction is verified.
3. Do not install a driver or alter system proxy/trust automatically. For an open-source distribution, provide a user-directed Npcap install path; bundling the free Npcap installer is not permitted by its redistribution terms. OEM distribution requires a license.
4. Packet capture can observe traffic from programs that bypass the proxy, but captured TLS/QUIC payloads remain encrypted absent matching secrets. Key-log selection is implemented for local analysis; full decrypted body display, key-log lifecycle and cross-app acceptance are pending.
5. Transparent redirection to the HTTP proxy is a different feature. It would require a carefully scoped Windows Filtering Platform design, elevated/signed components where applicable, loop prevention, process exclusions and reliable recovery. Do not imply Npcap alone provides transparent HTTP interception.

## Acceptance gate

On a Windows test machine with Npcap installed, demonstrate loopback and non-loopback packet capture from a client that bypasses the system proxy, bounded storage, correct stop/restart and PCAPNG export. Demonstrate the same client remains absent from proxy HTTP flows unless explicitly proxied or redirected. Verify encrypted payloads remain labelled encrypted. Test driver-absent, access-denied and adapter-removed states. This physical-device acceptance gate remains open.

References: [Reqable proxy documentation](https://github.com/reqable/reqable-docs/blob/master/en-US/capture/11_proxy.md), [Npcap reference](https://npcap.com/guide/), [Npcap redistribution](https://npcap.com/oem/redist), [Wireshark TLS decryption](https://www.wireshark.org/docs/wsug_html_chunked/), [Microsoft WFP overview](https://learn.microsoft.com/en-us/windows/win32/fwp/about-windows-filtering-platform).
