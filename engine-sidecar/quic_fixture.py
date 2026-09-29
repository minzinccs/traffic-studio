"""Controlled HTTP3 fixture/client, no OS changes. Used only by native tests."""
import asyncio, base64, datetime, ipaddress, json, pathlib, sys
from aioquic.asyncio import serve, connect
from aioquic.asyncio.protocol import QuicConnectionProtocol
from aioquic.h3.connection import H3Connection, H3_ALPN
from aioquic.h3.events import HeadersReceived,DataReceived
from aioquic.quic.configuration import QuicConfiguration
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
class Server(QuicConnectionProtocol):
 def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.http=H3Connection(self._quic)
 def quic_event_received(self,event):
  for received in self.http.handle_event(event):
   if isinstance(received,HeadersReceived):
    self.http.send_headers(received.stream_id,[(b':status',b'200'),(b'content-type',b'text/plain')]);self.http.send_data(received.stream_id,b'quic-fixture',end_stream=True);self.transmit()
class Client(QuicConnectionProtocol):
 def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.http=H3Connection(self._quic);self.result=asyncio.get_running_loop().create_future();self.data=b''
 def quic_event_received(self,event):
  for received in self.http.handle_event(event):
   if isinstance(received,DataReceived):
    self.data+=received.data
    if received.stream_ended and not self.result.done():self.result.set_result(self.data)
async def main():
 mode=sys.argv[1];port=int(sys.argv[2])
 if mode=='serve':
  directory=pathlib.Path(sys.argv[3]);key=rsa.generate_private_key(public_exponent=65537,key_size=2048);name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')]);now=datetime.datetime.now(datetime.timezone.utc)
  cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(minutes=1)).not_valid_after(now+datetime.timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),False).sign(key,hashes.SHA256());pem=directory/'origin.pem';private=directory/'origin-key.pem';pem.write_bytes(cert.public_bytes(serialization.Encoding.PEM));private.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
  config=QuicConfiguration(is_client=False,alpn_protocols=H3_ALPN);config.load_cert_chain(pem,private);server=await serve('127.0.0.1',port,configuration=config,create_protocol=Server);print(json.dumps({'ready':True,'pem':str(pem)}),flush=True);await asyncio.Future()
 else:
  config=QuicConfiguration(is_client=True,alpn_protocols=H3_ALPN,server_name='localhost');config.load_verify_locations(cafile=sys.argv[3])
  async with connect('127.0.0.1',port,configuration=config,create_protocol=Client) as client:
   stream=client._quic.get_next_available_stream_id();client.http.send_headers(stream,[(b':method',b'GET'),(b':scheme',b'https'),(b':authority',f'localhost:{port}'.encode()),(b':path',b'/quic')],end_stream=True);client.transmit();data=await asyncio.wait_for(client.result,10);print(json.dumps({'body':base64.b64encode(data).decode(),'protocol':'HTTP/3'}),flush=True)
asyncio.run(main())
