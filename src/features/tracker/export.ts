import type {StoredEntity} from '../../domain/workspace';

function cell(value:unknown){
 const text=String(value??'');
 const safe=/^[=+\-@\t\r]/.test(text)?`'${text}`:text;
 return `"${safe.replaceAll('"','""')}"`;
}

export function exportTrackerPage(format:'json'|'csv',workspaceId:string,offset:number,rows:StoredEntity[]){
 const date=new Date().toISOString();
 const filename=`traffic-tracker-${date.replaceAll(':','-')}.${format}`;
 let content:string;let mime:string;
 if(format==='json'){
  content=JSON.stringify({format:'traffic-studio-tracker-page',version:1,exportedAt:date,workspaceId,offset,items:rows.map(row=>({id:row.id,name:row.name,revision:row.revision,payload:row.payload}))},null,2);
  mime='application/json';
 }else{
  const table:unknown[][]=[['id','name','revision','status','priority','category','tags','notes','flowIds','timeline','customFields']];
  for(const row of rows)table.push([row.id,row.name,row.revision,row.payload.status,row.payload.priority,row.payload.category,row.payload.tags,row.payload.notes,JSON.stringify(row.payload.flowIds??[]),JSON.stringify(row.payload.timeline??[]),JSON.stringify(row.payload.customFields??{})]);
  content=table.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';mime='text/csv;charset=utf-8';
 }
 const url=URL.createObjectURL(new Blob([content],{type:mime}));const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
