import type { Flow } from '../../domain/types';
import { SelectField } from '../../shell/SelectField';
import './trafficFilters.css';

export type TrafficFacets = { scheme: string; type: string; method: string; status: string; host: string; app: string };
export const emptyFacets: TrafficFacets = { scheme: '', type: '', method: '', status: '', host: '', app: '' };

export function TrafficFilters({ flows, filter, onFilter, facets, onFacets, advancedOpen }: { flows: Flow[]; filter: string; onFilter: (value: string) => void; facets: TrafficFacets; onFacets: (value: TrafficFacets) => void; advancedOpen: boolean }) {
  const set = (key: keyof TrafficFacets, value: string) => onFacets({ ...facets, [key]: facets[key] === value ? '' : value });
  const reset = () => { onFilter('all'); onFacets(emptyFacets); };
  const quick = [
    { label: 'All', active: filter === 'all' && Object.values(facets).every((value) => !value), click: reset },
    { label: 'Favorites', active: filter === 'favorite', click: () => onFilter(filter === 'favorite' ? 'all' : 'favorite') },
    { label: 'Bookmarked', active: filter === 'tracked', click: () => onFilter(filter === 'tracked' ? 'all' : 'tracked') },
    { label: 'HTTP', active: facets.scheme === 'http', click: () => set('scheme', 'http') },
    { label: 'HTTPS', active: facets.scheme === 'https', click: () => set('scheme', 'https') },
    { label: 'JSON', active: facets.type === 'json', click: () => set('type', 'json') },
    { label: 'JavaScript', active: facets.type === 'javascript', click: () => set('type', 'javascript') },
    { label: '2xx', active: facets.status === '2', click: () => set('status', '2') },
    { label:'3xx',active:facets.status==='3',click:()=>set('status','3') },
    { label:'5xx',active:facets.status==='5',click:()=>set('status','5') },
    { label: '4xx', active: facets.status === '4', click: () => set('status', '4') },
  ];
  const hosts = [...new Set(flows.map((flow) => flow.host))];
  const apps = [...new Set(flows.map((flow) => flow.app).filter(Boolean))] as string[];
  const choose = (label: string, key: keyof TrafficFacets, values: string[]) => <label>{label}<SelectField label={`Filter ${label}`} value={facets[key]} onChange={(value) => onFacets({ ...facets, [key]: value })} options={[{value:'',label:'Any'},...values.map((value) => ({value,label:value}))]}/></label>;
  return <><div className="traffic-filter-strip traffic-filter-quick">{quick.map((item) => <button key={item.label} className={item.active ? 'active' : ''} onClick={item.click}>{item.label}</button>)}</div>{advancedOpen && <div className="traffic-filter-advanced"><div><strong>FILTER SAMPLE TRAFFIC</strong><span>Filters combine with search and Explorer selection.</span></div>{choose('Method', 'method', [...new Set(flows.map((flow) => flow.method))])}{choose('Host', 'host', hosts)}{choose('Application', 'app', apps)}{choose('Status class', 'status', ['2', '3', '4', '5'])}<button onClick={reset}>Clear all</button></div>}</>;
}
