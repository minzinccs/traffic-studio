"""Version-pinned mitmproxy adapter. Private signing key arrives over inherited stdin only."""
import asyncio, base64, hashlib, json, os, pathlib, sys, time, uuid
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from mitmproxy import certs, http, options
from mitmproxy.tools.dump import DumpMaster

config=json.loads(sys.stdin.readline(262145))
if config.get('protocolVersion')!=1 or not config.get('token'):raise SystemExit(2)
root=pathlib.Path(config['spool']);root.mkdir(parents=True,exist_ok=True)
private=load_pem_private_key(config.pop('privatePem').encode(),None)
ca=certs.Cert.from_pem(config.pop('caPem').encode())
store=certs.CertStore(private,ca,None,certs.dummy_crl(private,ca._cert),certs.DHParams(certs.DEFAULT_DHPARAM))
certs.CertStore.from_store=classmethod(lambda cls,**kwargs:store)
def headers(message):return [{'key':k,'value':v} for k,v in message.headers.items(multi=True)]
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
def mirror_once(url,method,body,values):
 opener=build_opener(ProxyHandler({}),NoRedirect)
 with opener.open(Request(url,data=body if body else None,headers=values,method=method),timeout=3) as response:response.read(1)
def body(data):
 data=data or b''
 if len(data)>64*1024*1024:return {'unavailable':'Body exceeds capture limit','size':len(data)}
 digest=hashlib.sha256(data).hexdigest();target=root/digest
 if not target.exists():
  temporary=root/(str(uuid.uuid4())+'.partial');temporary.write_bytes(data);os.replace(temporary,target)
 return {'sha256':digest,'size':len(data)}
class Adapter:
 def __init__(self):self.sequence=0;self.rules=config.get('initialRules',[]);self.pending={};self.dropped=0
 def emit(self,event):
  self.sequence+=1;event.update(sequence=self.sequence,protocolVersion=1)
  line=json.dumps(event,separators=(',',':'))
  if len(line)>512*1024:self.dropped+=1;return
  print(line,flush=True)
 def running(self):self.emit({'type':'ready','adapter':'mitmproxy','token':config['token'],'port':config['port']})
 def matches(self,rule,flow):return rule.get('enabled',True) and rule.get('match','') in flow.request.pretty_url and rule.get('method','*') in ('*','',flow.request.method)
 async def request(self,flow):
  flow.metadata['ts_id']=str(uuid.uuid4());flow.metadata['ts_trace']=[]
  for rule in self.rules:
   if not self.matches(rule,flow):continue
   action=rule.get('action');flow.metadata['ts_trace'].append(rule['id'])
   if action=='mock':flow.response=http.Response.make(int(rule.get('status',200)),rule.get('body','').encode(),{'Content-Type':rule.get('contentType','text/plain')})
   elif action=='request-header':flow.request.headers[rule['key']]=rule.get('value','')
   elif action=='request-body':flow.request.content=rule.get('body','').encode()
   elif action=='redirect':flow.response=http.Response.make(int(rule.get('status',302)),b'',{'Location':rule['target']})
   elif action=='map-remote':flow.request.url=rule['target']
   elif action=='gateway':
    origin=urlsplit(rule['target']);flow.request.url=f'{origin.scheme}://{origin.netloc}{flow.request.path}'
   elif action=='mirror':
    data=flow.request.raw_content or b''
    if len(data)>1024*1024:flow.metadata['ts_trace'].append(f"{rule['id']}:mirror-body-limit")
    else:
     origin=urlsplit(rule['target']);url=f'{origin.scheme}://{origin.netloc}{flow.request.path}'
     excluded={'host','content-length','transfer-encoding','connection','upgrade','proxy-connection'}
     private_parts=('auth','token','secret','cookie','credential','api-key')
     copied={key:value for key,value in flow.request.headers.items(multi=True) if key.lower() not in excluded and not any(part in key.lower() for part in private_parts)}
     try:await asyncio.wait_for(asyncio.to_thread(mirror_once,url,flow.request.method,data,copied),4);flow.metadata['ts_trace'].append(f"{rule['id']}:mirror-ok")
     except Exception:flow.metadata['ts_trace'].append(f"{rule['id']}:mirror-error")
   elif action=='delay':await asyncio.sleep(min(max(float(rule.get('delayMs',0)),0),30000)/1000)
   elif action=='drop':flow.kill();return
   elif action=='breakpoint':
    future=asyncio.get_running_loop().create_future();self.pending[flow.metadata['ts_id']]=(future,flow)
    self.emit({'type':'paused','id':flow.metadata['ts_id'],'url':flow.request.pretty_url,'method':flow.request.method,'protocol':flow.request.http_version,'requestHeaders':headers(flow.request),'requestBody':body(flow.request.raw_content),'state':'paused','trace':flow.metadata['ts_trace']})
    try:
     decision=await asyncio.wait_for(future,30)
     if decision.get('decision')=='drop':flow.kill();return
     if 'url' in decision:flow.request.url=decision['url']
     if 'body' in decision:flow.request.content=decision['body'].encode()
    except asyncio.TimeoutError:flow.kill();return
    finally:self.pending.pop(flow.metadata['ts_id'],None)
 async def response(self,flow):
  for rule in self.rules:
   if not self.matches(rule,flow):continue
   action=rule.get('action')
   if action=='response-header':flow.response.headers[rule['key']]=rule.get('value','');flow.metadata['ts_trace'].append(rule['id'])
   elif action=='response-body':flow.response.content=rule.get('body','').encode();flow.metadata['ts_trace'].append(rule['id'])
   elif action=='response-breakpoint':
    flow.metadata['ts_trace'].append(rule['id']);future=asyncio.get_running_loop().create_future();self.pending[flow.metadata['ts_id']]=(future,flow)
    self.emit({'type':'paused','phase':'response','id':flow.metadata['ts_id'],'url':flow.request.pretty_url,'method':flow.request.method,'protocol':flow.request.http_version,'status':flow.response.status_code,'responseHeaders':headers(flow.response),'responseBody':body(flow.response.raw_content),'state':'paused','trace':flow.metadata['ts_trace']})
    try:
     decision=await asyncio.wait_for(future,30)
     if decision.get('decision')=='drop':flow.kill();return
     if 'body' in decision:flow.response.content=decision['body'].encode()
     if 'status' in decision:flow.response.status_code=int(decision['status'])
    except asyncio.TimeoutError:flow.kill();return
    finally:self.pending.pop(flow.metadata['ts_id'],None)
  self.capture(flow)
 def error(self,flow):self.capture(flow)
 def capture(self,flow):
  request=flow.request;response=flow.response
  self.emit({'type':'flow','id':flow.metadata.get('ts_id',str(uuid.uuid4())),'url':request.pretty_url,'method':request.method,'protocol':request.http_version,'status':response.status_code if response else None,'startedAt':int(request.timestamp_start*1000),'durationMs':max(0,int(((response.timestamp_end or time.time()) if response else time.time())*1000-request.timestamp_start*1000)),'requestHeaders':headers(request),'responseHeaders':headers(response) if response else [],'requestBody':body(request.raw_content),'responseBody':body(response.raw_content) if response else None,'error':'Upstream transport failed' if flow.error else None,'trace':flow.metadata.get('ts_trace',[]),'clientAddress':list(flow.client_conn.peername or []),'serverAddress':list(flow.server_conn.peername or []),'tlsVersion':flow.server_conn.tls_version,'cipher':flow.server_conn.cipher,'droppedEvents':self.dropped})
 def websocket_message(self,flow):
  message=flow.websocket.messages[-1];data=message.content
  self.emit({'type':'frame','id':str(uuid.uuid4()),'flowId':flow.metadata.get('ts_id',flow.id),'direction':'request' if message.from_client else 'response','opcode':int(message.type),'timestamp':int(message.timestamp*1000),'body':body(data)})

async def main():
 opts=options.Options(listen_host='127.0.0.1',listen_port=int(config['port']),ssl_insecure=False,confdir=str(root),mode=[config.get('mode','regular')])
 master=DumpMaster(opts,with_termlog=False,with_dumper=False);master.options.update(onboarding=False,body_size_limit='64m',connection_strategy='lazy')
 if config.get('upstreamCa'):master.options.update(ssl_verify_upstream_trusted_ca=config['upstreamCa'])
 if not config.get('sslIntercept',False):master.options.update(ignore_hosts=['.*'])
 addon=Adapter();master.addons.add(addon)
 async def commands():
  while True:
   line=await asyncio.to_thread(sys.stdin.readline,262145)
   if not line:master.shutdown();return
   try:
    command=json.loads(line)
    if command.get('token')!=config['token']:continue
    if command.get('command')=='shutdown':master.shutdown();return
    if command.get('command')=='rules':addon.rules=command.get('rules',[]);addon.emit({'type':'rules-applied','revision':command.get('revision',0),'operationId':command.get('operationId')})
    if command.get('command')=='decision':
     pending=addon.pending.get(command.get('flowId'))
     if pending and not pending[0].done():pending[0].set_result(command);addon.emit({'type':'decision-accepted','operationId':command.get('operationId')})
     else:addon.emit({'type':'decision-expired','operationId':command.get('operationId'),'failed':True})
   except Exception:addon.emit({'type':'adapter-error','message':'Invalid adapter command'})

 worker=asyncio.create_task(commands())
 try:await master.run()
 finally:worker.cancel()
asyncio.run(main())
