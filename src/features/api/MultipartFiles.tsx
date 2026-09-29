export type MultipartFile = { id:string; key:string; file:File };
export function MultipartFiles({files,onChange,disabled}:{files:MultipartFile[];onChange:(files:MultipartFile[])=>void;disabled:boolean}) {
  return <section aria-label="Multipart file attachments"><p>Files remain in memory until Send uploads them to this native workspace. Reselect after reload.</p>
    <input type="file" multiple aria-label="Add multipart files" disabled={disabled||files.length>=16} onChange={e=>{const added=Array.from(e.target.files??[]).slice(0,16-files.length).map(file=>({id:crypto.randomUUID(),key:'file',file}));onChange([...files,...added]);e.target.value='';}}/>
    {files.map(item=><div key={item.id}><input aria-label={`Field name for ${item.file.name}`} value={item.key} disabled={disabled} onChange={e=>onChange(files.map(row=>row.id===item.id?{...row,key:e.target.value}:row))}/><span>{item.file.name} · {item.file.size.toLocaleString()} bytes</span><button disabled={disabled} onClick={()=>onChange(files.filter(row=>row.id!==item.id))}>Remove {item.file.name}</button></div>)}
  </section>;
}
