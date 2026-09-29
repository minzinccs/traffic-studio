export function responseText(bytes:Uint8Array,headers:{key:string;value:string}[]):string {
  const mime=headers.find(header=>header.key.toLowerCase()==='content-type')?.value??'';
  const charset=/;\s*charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(mime);
  const encoding=charset?.[1]??charset?.[2]??'utf-8';
  try{return new TextDecoder(encoding).decode(bytes);}catch{return new TextDecoder('utf-8').decode(bytes);}
}
