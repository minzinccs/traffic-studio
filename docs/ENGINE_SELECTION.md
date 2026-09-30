# Windows capture adapter decision — 2026-09-28

Choose mitmproxy 12.2.3 for the first native capture adapter. Both candidates were installed locally and executed on Windows 11 10.0.26200 using the same loopback fixtures. This decision permits adapter implementation; it does not accept all P02/P05 requirements or declare protocol parity.

| Measurement | Whistle 2.10.10 | mitmproxy 12.2.3 |
|---|---:|---:|
| Startup | 484 ms | 818 ms |
| Sequential HTTP, 100 requests | 183.26 requests/s | 124.61 requests/s |
| HTTP p95 | 25.16 ms | 26.74 ms |
| Process working set | 128450560 bytes | 79138816 bytes |
| HTTP/HTTPS/H2/WS/SSE/header rewrite | Passed | Passed |
| Listener released after termination | Passed | Passed |
| Native flow recording | Not measured | 194555 bytes |

Raw measurements: `.workbuddy-ai/engine-spikes/comparison.json`. Reproduce with `.runtime/mitmproxy/Scripts/python.exe engine-sidecar/benchmark.py`. Certificate verification is bypassed solely for the self-signed fixture in this benchmark; no CA installation or system proxy changes occurred. These are short local spike measurements, not production or soak targets.

Mitmproxy provides an embeddable Python event API and native flow reader/writer, suitable for an authenticated stdin/stdout adapter. Upstream license is MIT; Python and wheel dependencies require package notices before distribution. Whistle remains a fallback if mitmproxy packaging, latency or API compatibility fail. Development currently uses a project-local wheel installation with a configured base Python interpreter; a relocatable Windows package has not been accepted.

Subsequent native adapter fixtures now pass HTTP/3 over QUIC in `reverse:http3` mode, plus regular HTTP and a live mock rule. Reverse/upstream modes and editable request breakpoints have source implementations, but their full behavior matrix remains unaccepted. Coverage gaps: SOCKS, mirror/gateway, response breakpoints, loss/bandwidth controls, complete replay round trips, and crash recovery/soak. Regular explicit-proxy QUIC and direct HTTP/3 API calls are not supported. Python addons have host access upstream: user code must not be loaded until a separate permission/runtime design is implemented. Default capture stays loopback only; no arbitrary scripts, cloud, OS trust mutation or OS proxy mutation is enabled by adapter startup. P11 soak and clean installation remain future acceptance work.

Sources: [mitmproxy options](https://docs.mitmproxy.org/stable/concepts/options/), [event API](https://docs.mitmproxy.org/stable/api/events.html), and the installed version's `certs.py`, `tools/dump.py`, `addons/tlsconfig.py` were reviewed before integration. No H2 result is relabeled H3.
