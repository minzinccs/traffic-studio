use super::*;
#[test]
fn actual_http_capture_and_rule_effect() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Native capture fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let port_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = port_listener.local_addr().unwrap().port();
    drop(port_listener);
    let origin = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = origin.local_addr().unwrap();
    let origin_thread = std::thread::spawn(move || {
        let (mut socket, _) = origin.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .unwrap();
        let mut request = [0; 8192];
        socket.read(&mut request).unwrap();
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nfixture")
            .unwrap();
    });
    let runtime = CaptureRuntime::default();
    let status = runtime
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "Fixture session".into(),
                port,
                certificate_id: ca.id,
                upstream_ca_pem: None,
                mode: "regular".into(),
                target: None,
                ssl_intercept: false,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    assert_eq!(status.state, "recording");
    let mut client = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
    client
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    write!(client,"GET http://{address}/fixture HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer local-fixture\r\nConnection: close\r\n\r\n").unwrap();
    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    assert!(response.ends_with("fixture"));
    origin_thread.join().unwrap();
    runtime.rules(json!([{"id":"fixture-rule","match":"/mock","action":"mock","status":201,"body":"mocked","enabled":true}]),1).unwrap();
    std::thread::sleep(Duration::from_millis(100));
    let mut client = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
    client
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    write!(
        client,
        "GET http://{address}/mock HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    assert!(response.contains("201"));
    assert!(response.ends_with("mocked"));
    std::thread::sleep(Duration::from_millis(300));
    runtime.stop().unwrap();
    assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_err());
    let records = db.query(&workspace.id, "flow", 200, 0).unwrap();
    assert_eq!(records.len(), 2);
    let captured = records
        .iter()
        .find(|row| row.payload["status"] == 200)
        .unwrap();
    assert_eq!(captured.payload["source"], "native_capture");
    assert!(captured.payload["requestHeaders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|header| header["key"]
            .as_str()
            .is_some_and(|key| key.eq_ignore_ascii_case("authorization"))
            && header["value"] == "Bearer local-fixture"));
    let body_id = captured.payload["responseBody"]["id"].as_str().unwrap();
    assert!(db.body_read(&workspace.id, body_id, 0, 100).unwrap().eof);
    drop(db);
    let reopened = Database::open(directory.path()).unwrap();
    assert_eq!(
        reopened.query(&workspace.id, "flow", 200, 0).unwrap().len(),
        2
    );
}

#[test]
fn actual_http3_reverse_capture() {
    struct Fixture(std::process::Child);
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("HTTP3 fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let runtime_root = root.join(".runtime");
    let runtime: RuntimeConfig =
        serde_json::from_slice(&std::fs::read(runtime_root.join("capture-runtime.json")).unwrap())
            .unwrap();
    let free_port = || {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.local_addr().unwrap().port()
    };
    let origin_port = free_port();
    let capture_port = free_port();
    let mut origin = Command::new(&runtime.python)
        .arg(root.join("engine-sidecar/quic_fixture.py"))
        .arg("serve")
        .arg(origin_port.to_string())
        .arg(directory.path())
        .env("PYTHONPATH", &runtime.site_packages)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut ready = String::new();
    BufReader::new(origin.stdout.take().unwrap())
        .read_line(&mut ready)
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&ready).unwrap()["ready"],
        true
    );
    let _origin = Fixture(origin);
    let runtime_capture = CaptureRuntime::default();
    runtime_capture
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "HTTP3 session".into(),
                port: capture_port,
                certificate_id: ca.id,
                upstream_ca_pem: Some(
                    std::fs::read_to_string(directory.path().join("origin.pem")).unwrap(),
                ),
                mode: "reverse".into(),
                target: Some(format!("http3://localhost:{origin_port}")),
                ssl_intercept: true,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    let ca_path = directory.path().join("capture-ca.pem");
    std::fs::write(&ca_path, ca.pem).unwrap();
    let result = Command::new(&runtime.python)
        .arg(root.join("engine-sidecar/quic_fixture.py"))
        .arg("client")
        .arg(capture_port.to_string())
        .arg(&ca_path)
        .env("PYTHONPATH", &runtime.site_packages)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "HTTP3 client failed: {}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert_eq!(
        serde_json::from_slice::<Value>(&result.stdout).unwrap()["body"],
        "cXVpYy1maXh0dXJl"
    );
    std::thread::sleep(Duration::from_millis(250));
    runtime_capture.stop().unwrap();
    let rows = db.query(&workspace.id, "flow", 10, 0).unwrap();
    assert_eq!(rows.len(), 1, "expected one captured HTTP3 flow");
    assert_eq!(rows[0].payload["protocol"], "HTTP/3");
}

#[test]
fn worker_exit_is_not_reported_as_recording() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Exit fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let runtime = CaptureRuntime::default();
    runtime
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "Exit session".into(),
                port,
                certificate_id: ca.id,
                upstream_ca_pem: None,
                mode: "regular".into(),
                target: None,
                ssl_intercept: false,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    {
        let mut guard = runtime.running.lock().unwrap();
        guard.as_mut().unwrap().child.kill().unwrap();
    }
    let mut status = runtime.status().unwrap();
    for _ in 0..50 {
        if status.state == "error" {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
        status = runtime.status().unwrap();
    }
    assert_eq!(status.state, "error");
    assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_err());
    let session = db.query(&workspace.id, "session", 1, 0).unwrap();
    assert_eq!(session[0].payload["state"], "error");
}

#[test]
fn gateway_preserves_path_and_method_filter() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Gateway fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let origin = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let origin_port = origin.local_addr().unwrap().port();
    let upstream = std::thread::spawn(move || {
        let (mut socket, _) = origin.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .unwrap();
        let mut input = [0; 8192];
        let n = socket.read(&mut input).unwrap();
        let request = String::from_utf8_lossy(&input[..n]);
        assert!(request.starts_with("GET /path?x=1 HTTP/"), "{request}");
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\ngateway")
            .unwrap();
    });
    let runtime = CaptureRuntime::default();
    runtime
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "Gateway session".into(),
                port,
                certificate_id: ca.id,
                upstream_ca_pem: None,
                mode: "regular".into(),
                target: None,
                ssl_intercept: false,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    runtime.rules(json!([{"id":"skip-post","match":"/path","method":"POST","action":"mock","status":201,"body":"wrong","enabled":true},{"id":"gateway","match":"/path","method":"GET","action":"gateway","target":format!("http://127.0.0.1:{origin_port}"),"enabled":true}]),1).unwrap();
    let mut client = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
    client
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    write!(client,"GET http://example.invalid/path?x=1 HTTP/1.1\r\nHost: example.invalid\r\nConnection: close\r\n\r\n").unwrap();
    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    assert!(response.ends_with("gateway"), "{response}");
    upstream.join().unwrap();
    std::thread::sleep(Duration::from_millis(150));
    runtime.stop().unwrap();
    let rows = db.query(&workspace.id, "flow", 10, 0).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].payload["status"], 200);
    assert_eq!(rows[0].payload["trace"], json!(["gateway"]));
}

#[test]
fn response_breakpoint_edits_real_reply() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Response breakpoint fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let origin = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = origin.local_addr().unwrap();
    let upstream = std::thread::spawn(move || {
        let (mut socket, _) = origin.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .unwrap();
        let mut input = [0; 8192];
        socket.read(&mut input).unwrap();
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\nbefore")
            .unwrap();
    });
    let runtime = CaptureRuntime::default();
    runtime
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "Breakpoint session".into(),
                port,
                certificate_id: ca.id,
                upstream_ca_pem: None,
                mode: "regular".into(),
                target: None,
                ssl_intercept: false,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    runtime.rules(json!([{"id":"response-break","match":"/break","method":"GET","action":"response-breakpoint","enabled":true}]),1).unwrap();
    let client = std::thread::spawn(move || {
        let mut socket = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        write!(
            socket,
            "GET http://{address}/break HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n"
        )
        .unwrap();
        let mut response = String::new();
        socket.read_to_string(&mut response).unwrap();
        response
    });
    let mut paused = None;
    for _ in 0..100 {
        paused = db
            .query(&workspace.id, "flow", 10, 0)
            .unwrap()
            .into_iter()
            .find(|row| row.payload["type"] == "paused" && row.payload["phase"] == "response");
        if paused.is_some() {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let paused = paused.expect("response breakpoint did not pause");
    assert_eq!(paused.payload["status"], 200);
    runtime.control(json!({"command":"decision","flowId":paused.id,"decision":"resume","status":202,"body":"after"})).unwrap();
    let response = client.join().unwrap();
    assert!(response.contains("202"), "{response}");
    assert!(response.ends_with("after"), "{response}");
    upstream.join().unwrap();
    std::thread::sleep(Duration::from_millis(150));
    runtime.stop().unwrap();
    let saved = db.get(&workspace.id, &paused.id).unwrap();
    assert_eq!(saved.payload["type"], "flow");
    assert_eq!(saved.payload["status"], 202);
}

#[test]
fn mirror_copies_request_without_credential_headers() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Mirror fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let primary = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let primary_port = primary.local_addr().unwrap().port();
    let first = std::thread::spawn(move || {
        let (mut socket, _) = primary.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .unwrap();
        let mut input = [0; 8192];
        let n = socket.read(&mut input).unwrap();
        assert!(String::from_utf8_lossy(&input[..n]).starts_with("POST /copy?x=1 HTTP/"));
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nprimary")
            .unwrap();
    });
    let mirror = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let mirror_port = mirror.local_addr().unwrap().port();
    mirror.set_nonblocking(true).unwrap();
    let second = std::thread::spawn(move || {
        let started = std::time::Instant::now();
        let (mut socket, _) = loop {
            match mirror.accept() {
                Ok(value) => break value,
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        && started.elapsed() < Duration::from_secs(8) =>
                {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Err(error) => panic!("mirror origin not contacted: {error}"),
            }
        };
        socket.set_nonblocking(false).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .unwrap();
        let mut input = Vec::new();
        let mut buffer = [0; 8192];
        loop {
            let n = socket.read(&mut buffer).unwrap();
            if n == 0 {
                break;
            }
            input.extend_from_slice(&buffer[..n]);
            if input.windows(4).any(|v| v == b"\r\n\r\n") && input.ends_with(b"data") {
                break;
            }
        }
        let text = String::from_utf8_lossy(&input);
        assert!(text.starts_with("POST /copy?x=1 HTTP/"), "{text}");
        let lower = text.to_ascii_lowercase();
        assert!(
            !lower.contains("authorization:")
                && !lower.contains("x-auth-token:")
                && !lower.contains("cookie:")
        );
        socket
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .unwrap();
    });
    let runtime = CaptureRuntime::default();
    runtime
        .start(
            &db,
            CaptureInput {
                workspace_id: workspace.id.clone(),
                name: "Mirror session".into(),
                port,
                certificate_id: ca.id,
                upstream_ca_pem: None,
                mode: "regular".into(),
                target: None,
                ssl_intercept: false,
            },
            Arc::new(|_, _, _, _| {}),
        )
        .unwrap();
    runtime.rules(json!([{"id":"mirror-rule","match":"/copy","method":"POST","action":"mirror","target":format!("http://127.0.0.1:{mirror_port}"),"enabled":true}]),1).unwrap();
    let mut client = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
    client
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    write!(client,"POST http://127.0.0.1:{primary_port}/copy?x=1 HTTP/1.1\r\nHost: 127.0.0.1:{primary_port}\r\nAuthorization: Bearer local-secret\r\nX-Auth-Token: another-secret\r\nCookie: session=secret\r\nContent-Length: 4\r\nConnection: close\r\n\r\ndata").unwrap();
    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    assert!(response.ends_with("primary"), "{response}");
    first.join().unwrap();
    second.join().unwrap();
    std::thread::sleep(Duration::from_millis(150));
    runtime.stop().unwrap();
    let rows = db.query(&workspace.id, "flow", 10, 0).unwrap();
    assert_eq!(rows.len(), 1);
    assert!(rows[0].payload["trace"]
        .as_array()
        .unwrap()
        .contains(&json!("mirror-rule:mirror-ok")));
}

#[test]
fn applied_rules_reload_before_capture_listener_starts() {
    let directory = tempfile::tempdir().unwrap();
    let db = Database::open(directory.path()).unwrap();
    let workspace = db.create_workspace("Durable rules fixture").unwrap();
    let ca = db.certificate_create().unwrap();
    let rule_id = uuid::Uuid::new_v4().to_string();
    let document_id = uuid::Uuid::new_v4().to_string();
    let rules = json!([{"id":rule_id,"enabled":true,"match":"/mock","method":"GET","action":"mock","status":201,"body":"durable"}]);
    let saved = db
        .save(SaveEntity {
            workspace_id: workspace.id.clone(),
            id: document_id.clone(),
            kind: "rule_set".into(),
            name: "Durable rules".into(),
            expected_revision: 0,
            payload: json!({"documentType":"capture_rules","rules":rules}),
        })
        .unwrap();
    db.set_active_rules(&workspace.id, &document_id, saved.revision)
        .unwrap();
    let runtime = CaptureRuntime::default();
    for index in 0..2 {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        runtime
            .start(
                &db,
                CaptureInput {
                    workspace_id: workspace.id.clone(),
                    name: format!("Capture {index}"),
                    port,
                    certificate_id: ca.id.clone(),
                    upstream_ca_pem: None,
                    mode: "regular".into(),
                    target: None,
                    ssl_intercept: false,
                },
                Arc::new(|_, _, _, _| {}),
            )
            .unwrap();
        let mut client = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        client
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        write!(client,"GET http://example.invalid/mock HTTP/1.1\r\nHost: example.invalid\r\nConnection: close\r\n\r\n").unwrap();
        let mut response = String::new();
        client.read_to_string(&mut response).unwrap();
        assert!(
            response.contains("201") && response.ends_with("durable"),
            "{response}"
        );
        runtime.stop().unwrap();
    }
    let changed = db
        .save(SaveEntity {
            workspace_id: workspace.id.clone(),
            id: document_id,
            kind: "rule_set".into(),
            name: "Changed rules".into(),
            expected_revision: saved.revision,
            payload: json!({"rules":rules}),
        })
        .unwrap();
    assert_eq!(changed.revision, 2);
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let result = runtime.start(
        &db,
        CaptureInput {
            workspace_id: workspace.id,
            name: "Stale rules".into(),
            port,
            certificate_id: ca.id,
            upstream_ca_pem: None,
            mode: "regular".into(),
            target: None,
            ssl_intercept: false,
        },
        Arc::new(|_, _, _, _| {}),
    );
    assert!(result.is_err());
    assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_err());
}
