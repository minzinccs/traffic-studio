#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod domain;
mod storage;
mod platform;
mod commands;
mod engine;
mod http;
mod certificates;
mod scripts;
mod capture;
mod rules;
mod analytics;
mod protocols;
mod integrations;
mod devices;
mod decoder;
mod packets;
use tauri::Manager;
fn main() {
    let app=tauri::Builder::default()
        .manage(engine::Supervisor::default())
        .manage(capture::CaptureRuntime::default())
        .manage(protocols::ProtocolRuntime::default())
        .manage(integrations::mcp::McpRuntime::default())
        .manage(integrations::terminal::TerminalRuntime::default())
        .manage(devices::LanReadRuntime::default())
        .manage(packets::PacketRuntime::default())
        .manage(http::HttpRuntime::default())
        .manage(scripts::ScriptRuntime::default())
        .manage(http::oauth::OAuthRuntime::default())
        .setup(|app| {
            #[cfg(debug_assertions)] eprintln!("Traffic Studio: initializing local storage");
            let root=app.path().app_local_data_dir()?;
            platform::native_log::initialize(&root);
            let database=storage::Database::open(&root).map_err(|error|{platform::native_log::record("startup","storage");std::io::Error::other(error.message)})?;
            app.manage(database);
            #[cfg(debug_assertions)] eprintln!("Traffic Studio: local storage initialized");
            if let Some(window)=app.get_webview_window("main") { window.show()?; }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::packet_status,commands::packet_interfaces,commands::packet_start,commands::packet_stop,commands::packet_clear,commands::packet_keylog_select,commands::packet_keylog_clear,commands::packet_inspect,commands::packet_export,commands::decode_run,commands::sha_file,commands::runtime_diagnostics,commands::native_error_log,commands::native_error_clear,commands::workbench_detach,commands::workbench_close,commands::storage_retention,commands::workspace_backup,commands::workspace_restore,commands::lan_status,commands::lan_start,commands::lan_stop,commands::mcp_status,commands::mcp_audit,commands::mcp_start,commands::mcp_stop,commands::terminal_start,commands::terminal_status,commands::terminal_stop,commands::report_preview,commands::report_send,commands::session_import_har,commands::session_import_charles_xml,commands::session_export_har,commands::body_decode,commands::stream_start,commands::stream_stop,commands::stream_send,commands::analytics_query,commands::breakpoint_decide,commands::entity_batch,commands::rules_apply,commands::active_rules,commands::capture_status,commands::capture_start,commands::capture_stop,commands::runtime_info,commands::workspace_list,commands::workspace_create,commands::workspace_rename,commands::entity_query,commands::entity_get,commands::entity_save,commands::entity_delete,commands::migration_import,commands::body_begin,commands::body_append,commands::body_finish,commands::body_cancel,commands::body_read,commands::secret_put,commands::secret_get,commands::secret_delete,commands::engine_status,commands::engine_start,commands::engine_stop,commands::http_send,commands::http_cancel,commands::windows_proxy_read,commands::http_clear_cookies,commands::certificate_list,commands::certificate_create,commands::certificate_trust,commands::script_run,commands::script_cancel,commands::entity_import,commands::oauth_exchange,commands::oauth_cancel,commands::body_export,commands::http_record_scripts,commands::environment_save,commands::environment_load,commands::windows_proxy_recovery,commands::windows_proxy_apply,commands::windows_proxy_restore])
        .build(tauri::generate_context!())
        .expect("Traffic Studio startup failed; local data is preserved.");
    #[cfg(debug_assertions)] eprintln!("Traffic Studio: native event loop starting");
    app.run(|handle,event|{if matches!(event,tauri::RunEvent::Exit){let _=handle.state::<packets::PacketRuntime>().stop(&handle.state::<storage::Database>());let _=handle.state::<devices::LanReadRuntime>().stop();let _=handle.state::<integrations::mcp::McpRuntime>().stop();let _=handle.state::<integrations::terminal::TerminalRuntime>().stop();let _=handle.state::<capture::CaptureRuntime>().stop();let _=handle.state::<engine::Supervisor>().stop();}});
}
