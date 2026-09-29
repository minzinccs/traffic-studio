"""Windows loopback-only candidate measurements; does not touch OS proxy/trust."""
import datetime, hashlib, http.client, http.server, json, os, pathlib, socket, ssl, statistics, subprocess, threading, time, sys
import h2.connection, h2.events
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'.workbuddy-ai/engine-spikes'; OUT.mkdir(parents=True,exist_ok=True)
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')])
cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=1)).not_valid_after(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(__import__('ipaddress').ip_address('127.0.0.1'))]),False).sign(key,hashes.SHA256()))
(OUT/'fixture.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM)); (OUT/'fixture-key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=b'data: hello\n\n' if self.path.startswith('/sse') else b'fixture-response'
  self.send_response(200);self.send_header('Content-Type','text/event-stream' if self.path.startswith('/sse') else 'text/plain');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
plain=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);tls=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(OUT/'fixture.pem',OUT/'fixture-key.pem');tls.socket=ctx.wrap_socket(tls.socket,server_side=True)
for server in (plain,tls): threading.Thread(target=server.serve_forever,daemon=True).start()
protocol=subprocess.Popen(['node',str(ROOT/'engine-sidecar/protocol-fixture.mjs'),str(OUT/'fixture-key.pem'),str(OUT/'fixture.pem')],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,creationflags=0x08000000)
protocol_ports=json.loads(protocol.stdout.readline())
def websocket(port):
 s=socket.create_connection(('127.0.0.1',port),8);s.settimeout(8)
 s.sendall(f'GET http://127.0.0.1:{protocol_ports["ws"]}/ws HTTP/1.1\r\nHost: 127.0.0.1:{protocol_ports["ws"]}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: Zml4dHVyZS1rZXktMTIzNA==\r\nSec-WebSocket-Version: 13\r\n\r\n'.encode())
 head=b''
 while b'\r\n\r\n' not in head:head+=s.recv(1)
 assert b'101' in head.split(b'\r\n')[0]
 payload=b'hello';mask=b'abcd';s.sendall(bytes([0x81,0x80|len(payload)])+mask+bytes(v^mask[i%4] for i,v in enumerate(payload)))
 head=s.recv(2);body=b''
 while len(body)<head[1]:body+=s.recv(head[1]-len(body))
 assert body==payload;s.close()
def http2case(port):
 c=http.client.HTTPConnection('127.0.0.1',port,timeout=8);c.set_tunnel('localhost',protocol_ports['h2']);c.connect()
 context=ssl._create_unverified_context();context.set_alpn_protocols(['h2']);s=context.wrap_socket(c.sock,server_hostname='localhost');assert s.selected_alpn_protocol()=='h2'
 client=h2.connection.H2Connection();client.initiate_connection();client.send_headers(1,[(':method','GET'),(':scheme','https'),(':authority',f'localhost:{protocol_ports["h2"]}'),(':path','/')],end_stream=True);s.sendall(client.data_to_send());body=b'';headers={}
 while True:
  for event in client.receive_data(s.recv(65536)):
   if isinstance(event,h2.events.ResponseReceived):headers=dict(event.headers)
   if isinstance(event,h2.events.DataReceived):body+=event.data;client.acknowledge_received_data(event.flow_controlled_length,event.stream_id)
   if isinstance(event,h2.events.StreamEnded):assert body==b'h2-fixture';assert headers.get(b'x-fixture-http-version')==b'2.0';s.close();return
  s.sendall(client.data_to_send())
def request(port,path='/',https=False):
 c=http.client.HTTPConnection('127.0.0.1',port,timeout=8)
 if https:
  c.set_tunnel('localhost',tls.server_port);c.connect();c.sock=ssl._create_unverified_context().wrap_socket(c.sock,server_hostname='localhost');target=path
 else:target=f'http://127.0.0.1:{plain.server_port}{path}'
 c.request('GET',target);r=c.getresponse();body=r.read();headers=dict(r.getheaders());c.close();assert r.status==200;return body,headers
results=[]
try:
 for candidate in ('whistle','mitmproxy'):
  sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();directory=OUT/candidate;directory.mkdir(exist_ok=True)
  if candidate=='whistle':command=['node',str(ROOT/'engine-sidecar/whistle-spike.cjs'),str(port),str(directory)]
  else:command=[sys._base_executable,'-c','from mitmproxy.tools.main import mitmdump; mitmdump()','--listen-host','127.0.0.1','--listen-port',str(port),'--set',f'confdir={directory}','--set','ssl_insecure=true','--set','onboarding=false','--set','modify_headers=|~u /rewrite|x-fixture|rewritten','-w',str(directory/'flows.mitm')]
  env=dict(os.environ,PYTHONPATH=str(ROOT/'.runtime/mitmproxy/Lib/site-packages'))
  log=open(directory/'launch.log','w');started=time.perf_counter();child=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=log,env=env,creationflags=0x08000000)
  result={'candidate':candidate,'pid':child.pid,'cases':{},'platform':__import__('platform').platform(),'version':json.loads((ROOT/'.runtime/whistle/node_modules/whistle/package.json').read_text())['version'] if candidate=='whistle' else '12.2.3'}
  try:
   for _ in range(150):
    if child.poll() is not None:raise RuntimeError('candidate exited before ready')
    try:socket.create_connection(('127.0.0.1',port),.1).close();break
    except OSError:time.sleep(.1)
   else:raise RuntimeError('startup timeout')
   result['startupMs']=round((time.perf_counter()-started)*1000)
   for case,path,secure in [('http','/',False),('https','/',True),('sse','/sse',False),('rewrite','/rewrite',False)]:
    try:
     body,headers=request(port,path,secure);assert body==(b'data: hello\n\n' if case=='sse' else b'fixture-response')
     if case=='rewrite':assert headers.get('x-fixture')=='rewritten'
     result['cases'][case]='passed'
    except Exception as e:result['cases'][case]=type(e).__name__
   for case,run in [('websocket',websocket),('h2',http2case)]:
    try:run(port);result['cases'][case]='passed'
    except Exception as e:result['cases'][case]=type(e).__name__
   samples=[];begin=time.perf_counter()
   for _ in range(100):
    stamp=time.perf_counter();assert request(port)[0]==b'fixture-response';samples.append((time.perf_counter()-stamp)*1000)
   result.update(requests=100,throughputRps=round(100/(time.perf_counter()-begin),2),p95Ms=round(sorted(samples)[94],2),medianMs=round(statistics.median(samples),2))
   memory=subprocess.check_output(['powershell','-NoProfile','-Command',f'(Get-Process -Id {child.pid}).WorkingSet64'],text=True);result['workingSetBytes']=int(memory.strip())
  except Exception as e:result['failure']=str(e)
  finally:
   child.terminate()
   try:child.wait(timeout=8)
   except subprocess.TimeoutExpired:child.kill();child.wait()
   log.close()
   try:socket.create_connection(('127.0.0.1',port),.3).close();result['listenerReleased']=False
   except OSError:result['listenerReleased']=True
  if candidate=='mitmproxy':result['recordedBytes']=(directory/'flows.mitm').stat().st_size if (directory/'flows.mitm').exists() else 0
  result['unmeasured']=['H3','breakpoints','Python permissions','crash recovery','packaged cold install','2h soak']
  results.append(result);print(json.dumps(result),flush=True)
finally:
 protocol.terminate();protocol.wait(timeout=8)
 for server in (plain,tls):server.shutdown();server.server_close()
(OUT/'comparison.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
