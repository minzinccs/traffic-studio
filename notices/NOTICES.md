# Third-party notices — Traffic Studio (DRAFT)

> Status: DRAFT 2026-09-30. Covers the release-bundled subset only: frontend production
> dependencies (32 npm packages, the Vite build input) plus the full Cargo dependency closure
> (513 crates, compiled into traffic-studio.exe via the Tauri CLI release build).
> Dev-only packages (Vite/toolchain, .runtime engine candidates) are excluded; see README.
> Items marked TODO need a human decision before any public distribution.

## 1. npm production dependencies (32)

| Package | Version | License | Source |
| --- | --- | --- | --- |
| @tauri-apps/api | 2.12.0 | Apache-2.0 OR MIT | git+https://github.com/tauri-apps/tauri.git |
| ansi-regex | 5.0.1 | MIT | chalk/ansi-regex |
| ansi-styles | 4.3.0 | MIT | chalk/ansi-styles |
| camelcase | 5.3.1 | MIT | sindresorhus/camelcase |
| cliui | 6.0.0 | ISC | http://github.com/yargs/cliui.git |
| color-convert | 2.0.1 | MIT | Qix-/color-convert |
| color-name | 1.1.4 | MIT | git@github.com:colorjs/color-name.git |
| decamelize | 1.2.0 | MIT | sindresorhus/decamelize |
| dijkstrajs | 1.0.3 | MIT | git://github.com/tcort/dijkstrajs |
| find-up | 4.1.0 | MIT | sindresorhus/find-up |
| get-caller-file | 2.0.5 | ISC | git+https://github.com/stefanpenner/get-caller-file.git |
| locate-path | 5.0.0 | MIT | sindresorhus/locate-path |
| lucide-react | 0.577.0 | ISC | https://github.com/lucide-icons/lucide.git |
| p-limit | 2.3.0 | MIT | sindresorhus/p-limit |
| p-locate | 4.1.0 | MIT | sindresorhus/p-locate |
| p-try | 2.2.0 | MIT | sindresorhus/p-try |
| path-exists | 4.0.0 | MIT | sindresorhus/path-exists |
| pngjs | 5.0.0 | MIT | git://github.com/lukeapage/pngjs.git |
| qrcode | 1.5.4 | MIT | git://github.com/soldair/node-qrcode.git |
| react-dom | 19.2.5 | MIT | https://github.com/facebook/react.git |
| react | 19.2.5 | MIT | https://github.com/facebook/react.git |
| require-directory | 2.1.1 | MIT | git://github.com/troygoode/node-require-directory.git |
| require-main-filename | 2.0.0 | ISC | git+ssh://git@github.com/yargs/require-main-filename.git |
| scheduler | 0.27.0 | MIT | https://github.com/facebook/react.git |
| set-blocking | 2.0.0 | ISC | git+https://github.com/yargs/set-blocking.git |
| string-width | 4.2.3 | MIT | sindresorhus/string-width |
| strip-ansi | 6.0.1 | MIT | chalk/strip-ansi |
| which-module | 2.0.1 | ISC | git+https://github.com/nexdrew/which-module.git |
| wrap-ansi | 6.2.0 | MIT | chalk/wrap-ansi |
| y18n | 4.0.3 | ISC | git@github.com:yargs/y18n.git |
| yargs-parser | 18.1.3 | ISC | https://github.com/yargs/yargs-parser.git |
| yargs | 15.4.1 | MIT | https://github.com/yargs/yargs.git |

## 2. Rust crates (Cargo.lock closure, compiled into the release binary)

| Crate | Version | License (SPDX) | Evidence |
| --- | --- | --- | --- |
| adler2 | 2.0.1 | 0BSD OR MIT OR Apache-2.0 | crates.io API |
| aho-corasick | 1.1.5 | Unlicense OR MIT | crates.io API |
| alloc-no-stdlib | 2.0.4 | BSD-3-Clause | crates.io API |
| alloc-no-stdlib | 3.0.0 | BSD-3-Clause | crates.io API |
| alloc-stdlib | 0.2.4 | BSD-3-Clause | crates.io API |
| alloc-stdlib | 0.3.0 | BSD-3-Clause | crates.io API |
| allocator-api2 | 0.2.21 | MIT OR Apache-2.0 | crates.io API |
| android_system_properties | 0.1.6 | MIT OR Apache-2.0 | crates.io API |
| anyhow | 1.0.104 | MIT OR Apache-2.0 | crates.io API |
| asn1-rs-derive | 0.6.0 | MIT OR Apache-2.0 | crates.io API |
| asn1-rs-impl | 0.2.0 | MIT/Apache-2.0 | crates.io API |
| asn1-rs | 0.7.2 | MIT OR Apache-2.0 | crates.io API |
| atk-sys | 0.18.2 | MIT | crates.io API |
| atk | 0.18.2 | MIT | crates.io API |
| atomic-waker | 1.1.2 | Apache-2.0 OR MIT | crates.io API |
| autocfg | 1.5.1 | Apache-2.0 OR MIT | crates.io API |
| base64 | 0.21.7 | MIT OR Apache-2.0 | crates.io API |
| base64 | 0.22.1 | MIT OR Apache-2.0 | crates.io API |
| base64 | 0.23.1 | MIT OR Apache-2.0 | crates.io API |
| bit-set | 0.8.0 | Apache-2.0 OR MIT | crates.io API |
| bit-vec | 0.8.0 | Apache-2.0 OR MIT | crates.io API |
| bit-vec | 0.9.1 | Apache-2.0 OR MIT | crates.io API |
| bitflags | 1.3.2 | MIT/Apache-2.0 | crates.io API |
| bitflags | 2.13.2 | MIT OR Apache-2.0 | crates.io API |
| block-buffer | 0.10.4 | MIT OR Apache-2.0 | crates.io API |
| block-buffer | 0.12.1 | MIT OR Apache-2.0 | crates.io API |
| block2 | 0.6.2 | MIT | crates.io API |
| brotli-decompressor | 5.0.3 | BSD-3-Clause/MIT | crates.io API |
| brotli-decompressor | 6.0.1 | BSD-3-Clause/MIT | crates.io API |
| brotli | 8.0.4 | BSD-3-Clause AND MIT | crates.io API |
| brotli | 9.0.0 | BSD-3-Clause AND MIT | crates.io API |
| bs58 | 0.5.1 | MIT/Apache-2.0 | crates.io API |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 | crates.io API |
| bytemuck | 1.25.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| byteorder | 1.5.0 | Unlicense OR MIT | crates.io API |
| bytes | 1.12.1 | MIT | crates.io API |
| cairo-rs | 0.18.5 | MIT | crates.io API |
| cairo-sys-rs | 0.18.2 | MIT | crates.io API |
| camino | 1.2.6 | MIT OR Apache-2.0 | crates.io API |
| cargo_metadata | 0.19.2 | MIT | crates.io API |
| cargo_toml | 1.0.1 | Apache-2.0 OR MIT | crates.io API |
| cargo-platform | 0.1.9 | MIT OR Apache-2.0 | crates.io API |
| cc | 1.5.1 | MIT OR Apache-2.0 | crates.io API |
| cesu8 | 1.1.0 | Apache-2.0/MIT | crates.io API |
| cfb | 0.14.0 | MIT | crates.io API |
| cfg-expr | 0.15.8 | MIT OR Apache-2.0 | crates.io API |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 | crates.io API |
| chacha20 | 0.10.2 | MIT OR Apache-2.0 | crates.io API |
| chrono | 0.4.45 | MIT OR Apache-2.0 | crates.io API |
| combine | 4.6.8 | MIT | crates.io API |
| const-oid | 0.10.2 | Apache-2.0 OR MIT | crates.io API |
| cookie_store | 0.22.1 | MIT OR Apache-2.0 | crates.io API |
| cookie | 0.18.2 | MIT OR Apache-2.0 | crates.io API |
| core-foundation-sys | 0.8.7 | MIT OR Apache-2.0 | crates.io API |
| core-foundation | 0.10.1 | MIT OR Apache-2.0 | crates.io API |
| core-graphics-types | 0.2.0 | MIT OR Apache-2.0 | crates.io API |
| core-graphics | 0.25.0 | MIT OR Apache-2.0 | crates.io API |
| cpufeatures | 0.2.17 | MIT OR Apache-2.0 | crates.io API |
| cpufeatures | 0.3.1 | MIT OR Apache-2.0 | crates.io API |
| crc32fast | 1.5.2 | MIT OR Apache-2.0 | crates.io API |
| crossbeam-channel | 0.5.17 | MIT OR Apache-2.0 | crates.io API |
| crossbeam-utils | 0.8.23 | MIT OR Apache-2.0 | crates.io API |
| crypto-common | 0.1.7 | MIT OR Apache-2.0 | crates.io API |
| crypto-common | 0.2.2 | MIT OR Apache-2.0 | crates.io API |
| cssparser-macros | 0.7.1 | MPL-2.0 | crates.io API |
| cssparser | 0.37.0 | MPL-2.0 | crates.io API |
| ctor | 1.0.13 | Apache-2.0 OR MIT | crates.io API |
| darling_core | 0.24.1 | MIT | crates.io API |
| darling_macro | 0.24.1 | MIT | crates.io API |
| darling | 0.24.1 | MIT | crates.io API |
| data-encoding | 2.11.1 | MIT | crates.io API |
| dbus | 0.9.12 | Apache-2.0/MIT | crates.io API |
| defmt-macros | 1.1.1 | MIT OR Apache-2.0 | crates.io API |
| defmt-parser | 1.0.0 | MIT OR Apache-2.0 | crates.io API |
| defmt | 1.1.1 | MIT OR Apache-2.0 | crates.io API |
| der-parser | 10.0.0 | MIT OR Apache-2.0 | crates.io API |
| deranged | 0.5.8 | MIT OR Apache-2.0 | crates.io API |
| derive_more-impl | 2.1.1 | MIT | crates.io API |
| derive_more | 2.1.1 | MIT | crates.io API |
| digest_auth | 0.3.1 | MIT | crates.io API |
| digest | 0.10.7 | MIT OR Apache-2.0 | crates.io API |
| digest | 0.11.3 | MIT OR Apache-2.0 | crates.io API |
| dirs-sys | 0.5.0 | MIT OR Apache-2.0 | crates.io API |
| dirs | 7.0.0 | MIT OR Apache-2.0 | crates.io API |
| dispatch2 | 0.3.1 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| displaydoc | 0.2.7 | MIT OR Apache-2.0 | crates.io API |
| dlopen2_derive | 0.4.3 | MIT | crates.io API |
| dlopen2 | 0.8.2 | MIT | crates.io API |
| document-features | 0.2.12 | MIT OR Apache-2.0 | crates.io API |
| dom_query | 0.28.0 | MIT | crates.io API |
| dpi | 0.1.2 | Apache-2.0 AND MIT | crates.io API |
| dtoa-short | 0.3.5 | MPL-2.0 | crates.io API |
| dtoa | 1.0.11 | MIT OR Apache-2.0 | crates.io API |
| dunce | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 | crates.io API |
| dyn-clone | 1.0.20 | MIT OR Apache-2.0 | crates.io API |
| embed_plist | 1.2.2 | MIT OR Apache-2.0 | crates.io API |
| embed-resource | 3.0.11 | MIT | crates.io API |
| equivalent | 1.0.2 | Apache-2.0 OR MIT | crates.io API |
| erased-serde | 0.4.10 | MIT OR Apache-2.0 | crates.io API |
| errno | 0.3.14 | MIT OR Apache-2.0 | crates.io API |
| fallible-iterator | 0.3.0 | MIT/Apache-2.0 | crates.io API |
| fallible-streaming-iterator | 0.1.9 | MIT/Apache-2.0 | crates.io API |
| fastrand | 2.5.0 | Apache-2.0 OR MIT | crates.io API |
| fdeflate | 0.3.7 | MIT OR Apache-2.0 | crates.io API |
| field-offset | 0.3.6 | MIT OR Apache-2.0 | crates.io API |
| find-msvc-tools | 0.1.14 | MIT OR Apache-2.0 | crates.io API |
| flate2 | 1.1.10 | MIT OR Apache-2.0 | crates.io API |
| fnv | 1.0.7 | Apache-2.0 / MIT | crates.io API |
| foldhash | 0.2.0 | Zlib | crates.io API |
| foreign-types-macros | 0.2.4 | MIT/Apache-2.0 | crates.io API |
| foreign-types-shared | 0.1.1 | MIT/Apache-2.0 | crates.io API |
| foreign-types-shared | 0.3.1 | MIT/Apache-2.0 | crates.io API |
| foreign-types | 0.3.2 | MIT/Apache-2.0 | crates.io API |
| foreign-types | 0.5.0 | MIT/Apache-2.0 | crates.io API |
| form_urlencoded | 1.2.2 | MIT OR Apache-2.0 | crates.io API |
| futures-channel | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-core | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-executor | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-io | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-macro | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-sink | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-task | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| futures-util | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| gdk-pixbuf-sys | 0.18.0 | MIT | crates.io API |
| gdk-pixbuf | 0.18.5 | MIT | crates.io API |
| gdk-sys | 0.18.2 | MIT | crates.io API |
| gdk | 0.18.2 | MIT | crates.io API |
| gdkwayland-sys | 0.18.2 | MIT | crates.io API |
| gdkx11-sys | 0.18.2 | MIT | crates.io API |
| gdkx11 | 0.18.2 | MIT | crates.io API |
| generic-array | 0.14.7 | MIT | crates.io API |
| getrandom | 0.2.17 | MIT OR Apache-2.0 | crates.io API |
| getrandom | 0.3.4 | MIT OR Apache-2.0 | crates.io API |
| getrandom | 0.4.3 | MIT OR Apache-2.0 | crates.io API |
| gio-sys | 0.18.1 | MIT | crates.io API |
| gio | 0.18.4 | MIT | crates.io API |
| glib-macros | 0.18.5 | MIT | crates.io API |
| glib-sys | 0.18.1 | MIT | crates.io API |
| glib | 0.18.5 | MIT | crates.io API |
| glob | 0.3.4 | MIT OR Apache-2.0 | crates.io API |
| gobject-sys | 0.18.0 | MIT | crates.io API |
| gtk-sys | 0.18.2 | MIT | crates.io API |
| gtk | 0.18.2 | MIT | crates.io API |
| gtk3-macros | 0.18.2 | MIT | crates.io API |
| h2 | 0.4.19 | MIT | crates.io API |
| hashbrown | 0.12.3 | MIT OR Apache-2.0 | crates.io API |
| hashbrown | 0.16.1 | MIT OR Apache-2.0 | crates.io API |
| hashbrown | 0.17.1 | MIT OR Apache-2.0 | crates.io API |
| hashlink | 0.12.2 | MIT OR Apache-2.0 | crates.io API |
| heck | 0.4.1 | MIT OR Apache-2.0 | crates.io API |
| heck | 0.5.0 | MIT OR Apache-2.0 | crates.io API |
| hex | 0.4.3 | MIT OR Apache-2.0 | crates.io API |
| html5ever | 0.39.0 | MIT OR Apache-2.0 | crates.io API |
| http-body-util | 0.1.5 | MIT | crates.io API |
| http-body | 1.1.0 | MIT | crates.io API |
| http | 1.5.0 | MIT OR Apache-2.0 | crates.io API |
| httparse | 1.10.1 | MIT OR Apache-2.0 | crates.io API |
| hybrid-array | 0.4.15 | MIT OR Apache-2.0 | crates.io API |
| hyper-rustls | 0.27.10 | Apache-2.0 OR ISC OR MIT | crates.io API |
| hyper-tls | 0.6.0 | MIT/Apache-2.0 | crates.io API |
| hyper-util | 0.1.21 | MIT | crates.io API |
| hyper | 1.11.1 | MIT | crates.io API |
| iana-time-zone-haiku | 0.1.2 | MIT OR Apache-2.0 | crates.io API |
| iana-time-zone | 0.1.65 | MIT OR Apache-2.0 | crates.io API |
| ico | 0.5.0 | MIT | crates.io API |
| icu_collections | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_locale_core | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_normalizer_data | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_normalizer | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_properties_data | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_properties | 2.3.0 | Unicode-3.0 | crates.io API |
| icu_provider | 2.3.1 | Unicode-3.0 | crates.io API |
| ident_case | 1.0.1 | MIT/Apache-2.0 | crates.io API |
| idna_adapter | 1.2.2 | Apache-2.0 OR MIT | crates.io API |
| idna | 1.1.0 | MIT OR Apache-2.0 | crates.io API |
| indexmap | 1.9.3 | Apache-2.0 OR MIT | crates.io API |
| indexmap | 2.14.2 | Apache-2.0 OR MIT | crates.io API |
| infer | 0.22.0 | MIT | crates.io API |
| ipnet | 2.12.2 | MIT OR Apache-2.0 | crates.io API |
| itoa | 1.0.18 | MIT OR Apache-2.0 | crates.io API |
| javascriptcore-rs-sys | 1.1.1 | MIT | crates.io API |
| javascriptcore-rs | 1.1.2 | MIT | crates.io API |
| jiff-core | 0.1.1 | Unlicense OR MIT | crates.io API |
| jiff-static | 0.2.37 | Unlicense OR MIT | crates.io API |
| jiff-tzdb-platform | 0.1.3 | Unlicense OR MIT | crates.io API |
| jiff-tzdb | 0.1.8 | Unlicense OR MIT | crates.io API |
| jiff | 0.2.37 | Unlicense OR MIT | crates.io API |
| jni-sys-macros | 0.4.1 | MIT OR Apache-2.0 | crates.io API |
| jni-sys | 0.3.1 | MIT OR Apache-2.0 | crates.io API |
| jni-sys | 0.4.1 | MIT OR Apache-2.0 | crates.io API |
| jni | 0.21.1 | MIT/Apache-2.0 | crates.io API |
| js-sys | 0.3.106 | MIT OR Apache-2.0 | crates.io API |
| json-patch | 4.2.0 | MIT/Apache-2.0 | crates.io API |
| jsonptr | 0.7.1 | MIT OR Apache-2.0 | crates.io API |
| keyboard-types | 0.8.3 | MIT OR Apache-2.0 | crates.io API |
| lazy_static | 1.5.0 | MIT OR Apache-2.0 | crates.io API |
| libappindicator-sys | 0.9.0 | Apache-2.0 OR MIT | crates.io API |
| libappindicator | 0.9.0 | Apache-2.0 OR MIT | crates.io API |
| libc | 0.2.189 | MIT OR Apache-2.0 | crates.io API |
| libdbus-sys | 0.2.7 | Apache-2.0/MIT | crates.io API |
| libloading | 0.7.4 | ISC | crates.io API |
| libredox | 0.1.25 | MIT | crates.io API |
| libsqlite3-sys | 0.38.2 | MIT | crates.io API |
| linux-raw-sys | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | crates.io API |
| litemap | 0.8.3 | Unicode-3.0 | crates.io API |
| litrs | 1.0.0 | MIT OR Apache-2.0 | crates.io API |
| lock_api | 0.4.14 | MIT OR Apache-2.0 | crates.io API |
| log | 0.4.34 | MIT OR Apache-2.0 | crates.io API |
| markup5ever | 0.39.0 | MIT OR Apache-2.0 | crates.io API |
| md-5 | 0.10.6 | MIT OR Apache-2.0 | crates.io API |
| memchr | 2.8.3 | Unlicense OR MIT | crates.io API |
| memoffset | 0.9.1 | MIT | crates.io API |
| mime_guess | 2.0.5 | MIT | crates.io API |
| mime | 0.3.17 | MIT OR Apache-2.0 | crates.io API |
| minimal-lexical | 0.2.1 | MIT/Apache-2.0 | crates.io API |
| miniz_oxide | 0.8.9 | MIT OR Zlib OR Apache-2.0 | crates.io API |
| miniz_oxide | 0.9.1 | MIT OR Zlib OR Apache-2.0 | crates.io API |
| mio | 1.2.3 | MIT | crates.io API |
| muda | 0.20.0 | Apache-2.0 OR MIT | crates.io API |
| native-tls | 0.2.18 | MIT OR Apache-2.0 | crates.io API |
| ndk-context | 0.1.1 | MIT OR Apache-2.0 | crates.io API |
| ndk-sys | 0.6.0+11769913 | MIT OR Apache-2.0 | crates.io API |
| ndk | 0.9.0 | MIT OR Apache-2.0 | crates.io API |
| new_debug_unreachable | 1.0.6 | MIT | crates.io API |
| nom | 7.1.3 | MIT | crates.io API |
| num_enum_derive | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 | crates.io API |
| num_enum | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 | crates.io API |
| num-bigint | 0.4.8 | MIT OR Apache-2.0 | crates.io API |
| num-conv | 0.2.2 | MIT OR Apache-2.0 | crates.io API |
| num-integer | 0.1.47 | MIT OR Apache-2.0 | crates.io API |
| num-traits | 0.2.19 | MIT OR Apache-2.0 | crates.io API |
| objc2-app-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-cloud-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-data | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-foundation | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-graphics | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-image | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-location | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-core-text | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-encode | 4.1.0 | MIT | crates.io API |
| objc2-exception-helper | 0.1.1 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-foundation | 0.3.2 | MIT | crates.io API |
| objc2-io-surface | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-quartz-core | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-ui-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-user-notifications | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2-web-kit | 0.3.2 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| objc2 | 0.6.4 | MIT | crates.io API |
| oid-registry | 0.8.1 | MIT OR Apache-2.0 | crates.io API |
| once_cell | 1.21.4 | MIT OR Apache-2.0 | crates.io API |
| openssl-macros | 0.1.1 | MIT/Apache-2.0 | crates.io API |
| openssl-probe | 0.2.1 | MIT OR Apache-2.0 | crates.io API |
| openssl-sys | 0.9.117 | MIT | crates.io API |
| openssl | 0.10.81 | Apache-2.0 | crates.io API |
| option-ext | 0.2.0 | MPL-2.0 | crates.io API |
| pango-sys | 0.18.0 | MIT | crates.io API |
| pango | 0.18.3 | MIT | crates.io API |
| parking_lot_core | 0.9.12 | MIT OR Apache-2.0 | crates.io API |
| parking_lot | 0.12.5 | MIT OR Apache-2.0 | crates.io API |
| pem | 4.0.0 | MIT | crates.io API |
| percent-encoding | 2.3.2 | MIT OR Apache-2.0 | crates.io API |
| phf_codegen | 0.13.1 | MIT | crates.io API |
| phf_generator | 0.13.1 | MIT | crates.io API |
| phf_macros | 0.13.1 | MIT | crates.io API |
| phf_shared | 0.13.1 | MIT | crates.io API |
| phf | 0.13.1 | MIT | crates.io API |
| pin-project-lite | 0.2.17 | Apache-2.0 OR MIT | crates.io API |
| pkg-config | 0.3.34 | MIT OR Apache-2.0 | crates.io API |
| plist | 1.10.1 | MIT | crates.io API |
| png | 0.17.16 | MIT OR Apache-2.0 | crates.io API |
| png | 0.18.1 | MIT OR Apache-2.0 | crates.io API |
| portable-atomic-util | 0.2.8 | Apache-2.0 OR MIT | crates.io API |
| portable-atomic | 1.15.0 | Apache-2.0 OR MIT | crates.io API |
| potential_utf | 0.1.6 | Unicode-3.0 | crates.io API |
| powerfmt | 0.2.0 | MIT OR Apache-2.0 | crates.io API |
| ppv-lite86 | 0.2.21 | MIT OR Apache-2.0 | crates.io API |
| precomputed-hash | 0.1.1 | MIT | crates.io API |
| proc-macro-crate | 1.3.1 | MIT OR Apache-2.0 | crates.io API |
| proc-macro-crate | 2.0.2 | MIT OR Apache-2.0 | crates.io API |
| proc-macro-crate | 3.5.0 | MIT OR Apache-2.0 | crates.io API |
| proc-macro-error-attr | 1.0.4 | MIT OR Apache-2.0 | crates.io API |
| proc-macro-error | 1.0.4 | MIT OR Apache-2.0 | crates.io API |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 | crates.io API |
| psl-types | 2.0.11 | MIT/Apache-2.0 | crates.io API |
| publicsuffix | 2.3.0 | MIT/Apache-2.0 | crates.io API |
| quick-xml | 0.42.0 | MIT | crates.io API |
| quote | 1.0.47 | MIT OR Apache-2.0 | crates.io API |
| r-efi | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | crates.io API |
| r-efi | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | crates.io API |
| rand_chacha | 0.3.1 | MIT OR Apache-2.0 | crates.io API |
| rand_core | 0.10.1 | MIT OR Apache-2.0 | crates.io API |
| rand_core | 0.6.4 | MIT OR Apache-2.0 | crates.io API |
| rand | 0.10.3 | MIT OR Apache-2.0 | crates.io API |
| rand | 0.8.8 | MIT OR Apache-2.0 | crates.io API |
| raw-window-handle | 0.6.2 | MIT OR Apache-2.0 OR Zlib | crates.io API |
| rcgen | 0.14.10 | MIT OR Apache-2.0 | crates.io API |
| redox_syscall | 0.5.18 | MIT | crates.io API |
| redox_users | 0.5.3 | MIT | crates.io API |
| ref-cast-impl | 1.0.27 | MIT OR Apache-2.0 | crates.io API |
| ref-cast | 1.0.27 | MIT OR Apache-2.0 | crates.io API |
| regex-automata | 0.4.18 | MIT OR Apache-2.0 | crates.io API |
| regex-syntax | 0.8.11 | MIT OR Apache-2.0 | crates.io API |
| regex | 1.13.1 | MIT OR Apache-2.0 | crates.io API |
| reqwest | 0.12.28 | MIT OR Apache-2.0 | crates.io API |
| reqwest | 0.13.5 | MIT OR Apache-2.0 | crates.io API |
| rfd | 0.17.2 | MIT | crates.io API |
| ring | 0.17.14 | Apache-2.0 AND ISC | crates.io API |
| rquickjs-core | 0.14.0 | MIT | crates.io API |
| rquickjs-sys | 0.14.0 | MIT | crates.io API |
| rquickjs | 0.14.0 | MIT | crates.io API |
| rsqlite-vfs | 0.1.1 | MIT | crates.io API |
| rusqlite | 0.40.2 | MIT | crates.io API |
| rustc_version | 0.4.1 | MIT OR Apache-2.0 | crates.io API |
| rustc-hash | 2.1.3 | Apache-2.0 OR MIT | crates.io API |
| rusticata-macros | 4.1.0 | MIT/Apache-2.0 | crates.io API |
| rustix | 1.1.5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | crates.io API |
| rustls-pki-types | 1.15.1 | MIT OR Apache-2.0 | crates.io API |
| rustls-webpki | 0.103.15 | ISC | crates.io API |
| rustls | 0.23.45 | Apache-2.0 OR ISC OR MIT | crates.io API |
| rustversion | 1.0.23 | MIT OR Apache-2.0 | crates.io API |
| ryu | 1.0.23 | Apache-2.0 OR BSL-1.0 | crates.io API |
| same-file | 1.0.6 | Unlicense/MIT | crates.io API |
| schannel | 0.1.29 | MIT | crates.io API |
| schemars_derive | 0.8.22 | MIT | crates.io API |
| schemars | 0.8.22 | MIT | crates.io API |
| schemars | 0.9.0 | MIT | crates.io API |
| schemars | 1.2.2 | MIT | crates.io API |
| scopeguard | 1.2.0 | MIT OR Apache-2.0 | crates.io API |
| security-framework-sys | 2.17.0 | MIT OR Apache-2.0 | crates.io API |
| security-framework | 3.7.0 | MIT OR Apache-2.0 | crates.io API |
| selectors | 0.38.0 | MPL-2.0 | crates.io API |
| semver | 1.0.28 | MIT OR Apache-2.0 | crates.io API |
| serde_core | 1.0.229 | MIT OR Apache-2.0 | crates.io API |
| serde_derive_internals | 0.29.1 | MIT OR Apache-2.0 | crates.io API |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 | crates.io API |
| serde_json | 1.0.151 | MIT OR Apache-2.0 | crates.io API |
| serde_repr | 0.1.21 | MIT OR Apache-2.0 | crates.io API |
| serde_spanned | 0.6.9 | MIT OR Apache-2.0 | crates.io API |
| serde_spanned | 1.1.1 | MIT OR Apache-2.0 | crates.io API |
| serde_urlencoded | 0.7.1 | MIT/Apache-2.0 | crates.io API |
| serde_with_macros | 3.24.0 | MIT OR Apache-2.0 | crates.io API |
| serde_with | 3.24.0 | MIT OR Apache-2.0 | crates.io API |
| serde-untagged | 0.1.9 | MIT OR Apache-2.0 | crates.io API |
| serde | 1.0.229 | MIT OR Apache-2.0 | crates.io API |
| serialize-to-javascript-impl | 0.1.2 | MIT OR Apache-2.0 | crates.io API |
| serialize-to-javascript | 0.1.2 | MIT OR Apache-2.0 | crates.io API |
| servo_arc | 0.4.3 | MIT OR Apache-2.0 | crates.io API |
| sha1_smol | 1.0.1 | BSD-3-Clause | crates.io API |
| sha1 | 0.11.0 | MIT OR Apache-2.0 | crates.io API |
| sha2 | 0.10.9 | MIT OR Apache-2.0 | crates.io API |
| shlex | 2.0.1 | MIT OR Apache-2.0 | crates.io API |
| simd-adler32 | 0.3.10 | MIT | crates.io API |
| siphasher | 1.0.4 | MIT OR Apache-2.0 | crates.io API |
| slab | 0.4.12 | MIT | crates.io API |
| smallvec | 1.16.2 | MIT OR Apache-2.0 | crates.io API |
| socket2 | 0.6.5 | MIT OR Apache-2.0 | crates.io API |
| softbuffer | 0.4.8 | MIT OR Apache-2.0 | crates.io API |
| soup3-sys | 0.5.0 | MIT | crates.io API |
| soup3 | 0.5.0 | MIT | crates.io API |
| sqlite-wasm-rs | 0.5.5 | MIT | crates.io API |
| stable_deref_trait | 1.2.1 | MIT OR Apache-2.0 | crates.io API |
| string_cache_codegen | 0.6.1 | MIT OR Apache-2.0 | crates.io API |
| string_cache | 0.9.0 | MIT OR Apache-2.0 | crates.io API |
| strsim | 0.11.1 | MIT | crates.io API |
| subtle | 2.6.1 | BSD-3-Clause | crates.io API |
| swift-rs | 1.0.8 | MIT OR Apache-2.0 | crates.io API |
| syn | 1.0.109 | MIT OR Apache-2.0 | crates.io API |
| syn | 2.0.119 | MIT OR Apache-2.0 | crates.io API |
| syn | 3.0.6 | MIT OR Apache-2.0 | crates.io API |
| sync_wrapper | 1.0.2 | Apache-2.0 | crates.io API |
| synstructure | 0.13.2 | MIT | crates.io API |
| synstructure | 0.14.0 | MIT | crates.io API |
| system-deps | 6.2.2 | MIT OR Apache-2.0 | crates.io API |
| tao-macros | 0.1.4 | MIT OR Apache-2.0 | crates.io API |
| tao | 0.37.1 | Apache-2.0 | crates.io API |
| target-lexicon | 0.12.16 | Apache-2.0 WITH LLVM-exception | crates.io API |
| tauri-build | 2.7.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-codegen | 2.7.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-macros | 2.7.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-runtime-wry | 2.12.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-runtime | 2.12.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-utils | 2.10.0 | Apache-2.0 OR MIT | crates.io API |
| tauri-winres | 0.3.6 | MIT | crates.io API |
| tauri | 2.12.0 | Apache-2.0 OR MIT | crates.io API |
| tempfile | 3.27.0 | MIT OR Apache-2.0 | crates.io API |
| tendril | 0.5.1 | MIT OR Apache-2.0 | crates.io API |
| thiserror-impl | 1.0.69 | MIT OR Apache-2.0 | crates.io API |
| thiserror-impl | 2.0.21 | MIT OR Apache-2.0 | crates.io API |
| thiserror | 1.0.69 | MIT OR Apache-2.0 | crates.io API |
| thiserror | 2.0.21 | MIT OR Apache-2.0 | crates.io API |
| time-core | 0.1.9 | MIT OR Apache-2.0 | crates.io API |
| time-macros | 0.2.32 | MIT OR Apache-2.0 | crates.io API |
| time | 0.3.55 | MIT OR Apache-2.0 | crates.io API |
| tinystr | 0.8.4 | Unicode-3.0 | crates.io API |
| tinyvec | 1.13.3 | Zlib OR Apache-2.0 OR MIT | crates.io API |
| tokio-macros | 2.7.2 | MIT | crates.io API |
| tokio-native-tls | 0.3.1 | MIT | crates.io API |
| tokio-rustls | 0.26.5 | MIT OR Apache-2.0 | crates.io API |
| tokio-tungstenite | 0.30.0 | MIT | crates.io API |
| tokio-util | 0.7.19 | MIT | crates.io API |
| tokio | 1.53.1 | MIT | crates.io API |
| toml_datetime | 0.6.3 | MIT OR Apache-2.0 | crates.io API |
| toml_datetime | 1.1.1+spec-1.1.0 | MIT OR Apache-2.0 | crates.io API |
| toml_edit | 0.19.15 | MIT OR Apache-2.0 | crates.io API |
| toml_edit | 0.20.2 | MIT OR Apache-2.0 | crates.io API |
| toml_edit | 0.25.15+spec-1.1.0 | MIT OR Apache-2.0 | crates.io API |
| toml_parser | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 | crates.io API |
| toml_writer | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 | crates.io API |
| toml | 0.8.2 | MIT OR Apache-2.0 | crates.io API |
| toml | 1.1.6+spec-1.1.0 | MIT OR Apache-2.0 | crates.io API |
| tower-http | 0.6.11 | MIT | crates.io API |
| tower-layer | 0.3.3 | MIT | crates.io API |
| tower-service | 0.3.3 | MIT | crates.io API |
| tower | 0.5.3 | MIT | crates.io API |
| tracing-core | 0.1.36 | MIT | crates.io API |
| tracing | 0.1.44 | MIT | crates.io API |
| tray-icon | 0.25.1 | MIT OR Apache-2.0 | crates.io API |
| try-lock | 0.2.5 | MIT | crates.io API |
| tungstenite | 0.30.0 | MIT OR Apache-2.0 | crates.io API |
| typeid | 1.0.3 | MIT OR Apache-2.0 | crates.io API |
| typenum | 1.20.1 | MIT OR Apache-2.0 | crates.io API |
| unicase | 2.9.0 | MIT OR Apache-2.0 | crates.io API |
| unicode-ident | 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 | crates.io API |
| unicode-segmentation | 1.13.3 | MIT OR Apache-2.0 | crates.io API |
| untrusted | 0.9.0 | ISC | crates.io API |
| url | 2.5.8 | MIT OR Apache-2.0 | crates.io API |
| urlpattern | 0.6.0 | MIT | crates.io API |
| utf8_iter | 1.0.4 | Apache-2.0 OR MIT | crates.io API |
| uuid | 1.26.1 | Apache-2.0 OR MIT | crates.io API |
| vcpkg | 0.2.15 | MIT/Apache-2.0 | crates.io API |
| version_check | 0.9.5 | MIT/Apache-2.0 | crates.io API |
| version-compare | 0.2.1 | MIT | crates.io API |
| vswhom-sys | 0.1.3 | MIT | crates.io API |
| vswhom | 0.1.0 | MIT | crates.io API |
| walkdir | 2.5.0 | Unlicense/MIT | crates.io API |
| want | 0.3.1 | MIT | crates.io API |
| wasi | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | crates.io API |
| wasip2 | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | crates.io API |
| wasm-bindgen-futures | 0.4.79 | MIT OR Apache-2.0 | crates.io API |
| wasm-bindgen-macro-support | 0.2.129 | MIT OR Apache-2.0 | crates.io API |
| wasm-bindgen-macro | 0.2.129 | MIT OR Apache-2.0 | crates.io API |
| wasm-bindgen-shared | 0.2.129 | MIT OR Apache-2.0 | crates.io API |
| wasm-bindgen | 0.2.129 | MIT OR Apache-2.0 | crates.io API |
| wasm-streams | 0.4.2 | MIT OR Apache-2.0 | crates.io API |
| wasm-streams | 0.5.0 | MIT OR Apache-2.0 | crates.io API |
| web_atoms | 0.2.6 | MIT OR Apache-2.0 | crates.io API |
| web-sys | 0.3.106 | MIT OR Apache-2.0 | crates.io API |
| web-time | 1.1.0 | MIT OR Apache-2.0 | crates.io API |
| webkit2gtk-sys | 2.0.2 | MIT | crates.io API |
| webkit2gtk | 2.0.2 | MIT | crates.io API |
| webview2-com-macros | 0.8.1 | MIT | crates.io API |
| webview2-com-sys | 0.39.1 | MIT | crates.io API |
| webview2-com | 0.39.1 | MIT | crates.io API |
| winapi-i686-pc-windows-gnu | 0.4.0 | MIT/Apache-2.0 | crates.io API |
| winapi-util | 0.1.11 | Unlicense OR MIT | crates.io API |
| winapi-x86_64-pc-windows-gnu | 0.4.0 | MIT/Apache-2.0 | crates.io API |
| winapi | 0.3.9 | MIT/Apache-2.0 | crates.io API |
| window-vibrancy | 0.8.1 | Apache-2.0 OR MIT | crates.io API |
| windows_aarch64_gnullvm | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_aarch64_gnullvm | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_aarch64_msvc | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_aarch64_msvc | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_i686_gnu | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_i686_gnu | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_i686_gnullvm | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_i686_msvc | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_i686_msvc | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_gnu | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_gnu | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_gnullvm | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_gnullvm | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_msvc | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows_x86_64_msvc | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows-collections | 0.3.2 | MIT OR Apache-2.0 | crates.io API |
| windows-core | 0.62.2 | MIT OR Apache-2.0 | crates.io API |
| windows-future | 0.3.2 | MIT OR Apache-2.0 | crates.io API |
| windows-implement | 0.60.2 | MIT OR Apache-2.0 | crates.io API |
| windows-interface | 0.59.3 | MIT OR Apache-2.0 | crates.io API |
| windows-link | 0.2.1 | MIT OR Apache-2.0 | crates.io API |
| windows-numerics | 0.3.1 | MIT OR Apache-2.0 | crates.io API |
| windows-result | 0.4.1 | MIT OR Apache-2.0 | crates.io API |
| windows-strings | 0.5.1 | MIT OR Apache-2.0 | crates.io API |
| windows-sys | 0.45.0 | MIT OR Apache-2.0 | crates.io API |
| windows-sys | 0.52.0 | MIT OR Apache-2.0 | crates.io API |
| windows-sys | 0.59.0 | MIT OR Apache-2.0 | crates.io API |
| windows-sys | 0.61.2 | MIT OR Apache-2.0 | crates.io API |
| windows-targets | 0.42.2 | MIT OR Apache-2.0 | crates.io API |
| windows-targets | 0.52.6 | MIT OR Apache-2.0 | crates.io API |
| windows-threading | 0.2.1 | MIT OR Apache-2.0 | crates.io API |
| windows-version | 0.1.7 | MIT OR Apache-2.0 | crates.io API |
| windows | 0.62.2 | MIT OR Apache-2.0 | crates.io API |
| winnow | 0.5.40 | MIT | crates.io API |
| winnow | 1.0.4 | MIT | crates.io API |
| winreg | 0.55.0 | MIT | crates.io API |
| wit-bindgen | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | crates.io API |
| writeable | 0.6.4 | Unicode-3.0 | crates.io API |
| wry | 0.57.0 | Apache-2.0 OR MIT | crates.io API |
| x11-dl | 2.21.0 | MIT | crates.io API |
| x11 | 2.21.0 | MIT | crates.io API |
| x509-parser | 0.18.1 | MIT OR Apache-2.0 | crates.io API |
| yasna | 0.6.0 | MIT OR Apache-2.0 | crates.io API |
| yoke-derive | 0.8.3 | Unicode-3.0 | crates.io API |
| yoke | 0.8.3 | Unicode-3.0 | crates.io API |
| zerocopy-derive | 0.8.59 | BSD-2-Clause OR Apache-2.0 OR MIT | crates.io API |
| zerocopy | 0.8.59 | BSD-2-Clause OR Apache-2.0 OR MIT | crates.io API |
| zerofrom-derive | 0.1.8 | Unicode-3.0 | crates.io API |
| zerofrom | 0.1.8 | Unicode-3.0 | crates.io API |
| zeroize | 1.9.0 | Apache-2.0 OR MIT | crates.io API |
| zerotrie | 0.2.5 | Unicode-3.0 | crates.io API |
| zerovec-derive | 0.11.6 | Unicode-3.0 | crates.io API |
| zerovec | 0.11.8 | Unicode-3.0 | crates.io API |
| zlib-rs | 0.6.8 | Zlib | crates.io API |
| zmij | 1.0.23 | MIT | crates.io API |

## 4. Full license texts

See `licenses/` (one file per distinct SPDX identifier, fetched verbatim from SPDX license-list-data).
Any identifier without a file is listed as TODO in README.
