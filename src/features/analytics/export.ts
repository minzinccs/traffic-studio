import type {CommandMap} from '../../bridge';

type Metrics=CommandMap['analytics_query']['result'];
type Filters={workspaceId:string;sessionId:string;compareSessionId:string;host:string;since:string;until:string};

function csvCell(value:unknown){
 const text=String(value??'');
 const safe=/^[=+\-@\t\r]/.test(text)?`'${text}`:text;
 return `"${safe.replaceAll('"','""')}"`;
}

export function exportAnalytics(format:'json'|'csv',filters:Filters,current:Metrics,comparison:Metrics|null){
 const name=`traffic-analytics-${new Date().toISOString().replaceAll(':','-')}`;
 let content:string;let type:string;let extension:string;
 if(format==='json'){
  content=JSON.stringify({format:'traffic-studio-analytics',version:1,exportedAt:new Date().toISOString(),filters,current,comparison},null,2);
  type='application/json';extension='json';
 }else{
  const rows:unknown[][]=[['dataset','group','key','value']];
  for(const [dataset,metrics] of [['current',current],['comparison',comparison]] as const){
   if(!metrics)continue;
   for(const [key,value] of [['requests',metrics.requests],['errors',metrics.errors],['payloadBytes',metrics.payloadBytes],['averageMs',metrics.averageMs],['p95Ms',metrics.p95Ms]])rows.push([dataset,'metric',key,value]);
   for(const group of ['hosts','statuses','protocols','endpoints'] as const)for(const [key,value] of Object.entries(metrics[group]))rows.push([dataset,group,key,value]);
  }
  content=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  type='text/csv;charset=utf-8';extension='csv';
 }
 const url=URL.createObjectURL(new Blob([content],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`${name}.${extension}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
