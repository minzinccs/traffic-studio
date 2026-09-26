import type { Flow, FlowDetail } from '../../domain/types';
import { getFlowDetail } from '../../bridge/mockBridge';
export type PreviewSession = { id: string; name: string; flows: Flow[]; details: Record<number, FlowDetail>; created: string };
export const sessionsKey = 'traffic-studio-preview-sessions-v1';
export function readPreviewSessions(): PreviewSession[] { try { const v = JSON.parse(localStorage.getItem(sessionsKey) ?? '[]'); return Array.isArray(v) ? v.filter(s => s && typeof s.name === 'string' && Array.isArray(s.flows) && s.details) : []; } catch { return []; } }
const safeHeaders = (headers: { key: string; value: string }[]) => headers.filter(h => !/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key));
export function snapshot(name: string, flows: Flow[], details: Record<number, FlowDetail>): PreviewSession {
  return { id: crypto.randomUUID(), name, created: new Date().toISOString(), flows, details: Object.fromEntries(flows.map(f => { const d = details[f.id] ?? getFlowDetail(f.id); return [f.id, d ? { ...d, requestHeaders: safeHeaders(d.requestHeaders), responseHeaders: safeHeaders(d.responseHeaders) } : undefined]; }).filter(([,d]) => d)) };
}
export function parseHar(text: string): PreviewSession {
  const v = JSON.parse(text); const entries = v?.log?.entries;
  if (!Array.isArray(entries) || entries.length > 50000) throw Error('Expected HAR log.entries, up to 50,000 entries.');
  const details: Record<number, FlowDetail> = {};
  const flows: Flow[] = entries.map((entry, i) => {
    if (!entry?.request || typeof entry.request.url !== 'string' || typeof entry.request.method !== 'string' || !entry.response || typeof entry.response.status !== 'number') throw Error(`Invalid HAR entry ${i + 1}.`);
    const url = new URL(entry.request.url); if (!['http:','https:'].includes(url.protocol)) throw Error('Only HTTP(S) entries are supported.');
    const id = i + 1; const type = typeof entry.response.content?.mimeType === 'string' ? entry.response.content.mimeType : 'unknown';
    const headers = (raw: unknown) => Array.isArray(raw) ? safeHeaders(raw.filter(h => h && typeof h.name === 'string' && typeof h.value === 'string').map(h => ({ key:h.name,value:h.value }))) : [];
    let responseBody = typeof entry.response.content?.text === 'string' ? entry.response.content.text : '';
    if (entry.response.content?.encoding === 'base64') { try { responseBody = new TextDecoder().decode(Uint8Array.from(atob(responseBody), c => c.charCodeAt(0))); } catch { throw Error(`Invalid Base64 content in entry ${id}.`); } }
    details[id] = { id, scheme:url.protocol === 'https:' ? 'https' : 'http', url:url.toString(), startedAt:typeof entry.startedDateTime === 'string' ? entry.startedDateTime : '',device:'Not recorded',app:'Not recorded',query:Array.from(url.searchParams,([key,value]) => ({ key,value })),requestHeaders:headers(entry.request.headers),responseHeaders:headers(entry.response.headers),requestBody:typeof entry.request.postData?.text === 'string' ? entry.request.postData.text : '',responseBody,timeline:[] };
    return { id,method:entry.request.method,host:url.host,path:url.pathname+url.search,status:entry.response.status,type,duration:typeof entry.time === 'number' ? Math.max(0,entry.time) : 0,size:`${Math.max(0,Number(entry.response.content?.size) || 0)} B`,scheme:details[id].scheme };
  });
  return { id:crypto.randomUUID(),name:'Imported HAR preview',created:new Date().toISOString(),flows,details };
}
export function exportHar(flows: Flow[], details: Record<number, FlowDetail>): string {
  return JSON.stringify({ log: { version:'1.2',creator:{name:'Traffic Studio Preview',version:'0.1.0'},entries:flows.map(f => { const d = details[f.id] ?? getFlowDetail(f.id); return { startedDateTime:d?.startedAt || new Date().toISOString(),time:f.duration,request:{method:f.method,url:d?.url ?? `${f.scheme ?? 'https'}://${f.host}${f.path}`,httpVersion:'',headers:safeHeaders(d?.requestHeaders ?? []).map(h => ({name:h.key,value:h.value})),queryString:d?.query.map(h => ({name:h.key,value:h.value})) ?? [],cookies:[],headersSize:-1,bodySize:-1,...(d?.requestBody ? {postData:{mimeType:'text/plain',text:d.requestBody}} : {})},response:{status:f.status,statusText:'',httpVersion:'',headers:safeHeaders(d?.responseHeaders ?? []).map(h => ({name:h.key,value:h.value})),cookies:[],content:{size:new TextEncoder().encode(d?.responseBody ?? '').length,mimeType:f.type,text:d?.responseBody ?? ''},redirectURL:'',headersSize:-1,bodySize:-1},cache:{},timings:{send:0,wait:f.duration,receive:0},_trafficStudioPreview:true }; }) } },null,2);
}
