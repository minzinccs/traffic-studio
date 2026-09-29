import http from 'node:http';
import http2 from 'node:http2';
import fs from 'node:fs';
const plain=http.createServer((req,res)=>res.end('fixture'));
plain.on('upgrade',(req,socket)=>{
 import('node:crypto').then(({createHash})=>{
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let pending=Buffer.alloc(0);socket.on('data',data=>{pending=Buffer.concat([pending,data]);if(pending.length<6)return;const n=pending[1]&127;if(n>125){socket.destroy();return;}if(pending.length<6+n)return;const payload=Buffer.from(pending.subarray(6,6+n));for(let i=0;i<n;i++)payload[i]^=pending[2+i%4];socket.write(Buffer.concat([Buffer.from([0x81,n]),payload]));pending=pending.subarray(6+n);});
 });
});
const secure=http2.createSecureServer({key:fs.readFileSync(process.argv[2]),cert:fs.readFileSync(process.argv[3]),allowHTTP1:true},(req,res)=>{res.setHeader('x-fixture-http-version',req.httpVersion);res.end('h2-fixture');});
await Promise.all([new Promise(r=>plain.listen(0,'127.0.0.1',r)),new Promise(r=>secure.listen(0,'127.0.0.1',r))]);
console.log(JSON.stringify({ws:plain.address().port,h2:secure.address().port}));
