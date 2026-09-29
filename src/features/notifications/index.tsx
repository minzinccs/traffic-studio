import { UiText } from '../localization';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import './notifications.css';
export type Notice = { id: number; text: string; time: string; read: boolean; kind: 'info' | 'error' };
export function NotificationCenter({ items, onRead, onClear, onClose }: { items: Notice[]; onRead: () => void; onClear: () => void; onClose: () => void }) {
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
  return <aside className="notification-center" role="dialog" aria-label="Notification center"><header><strong><UiText text={"Notifications"}/></strong><button aria-label="Close notifications" onClick={onClose}><X size={16}/></button></header><div className="notification-actions"><button onClick={onRead}><UiText text={"Mark all read"}/></button><button onClick={onClear}><UiText text={"Clear history"}/></button></div><div className="notification-list">{items.length ? items.map(item => <article key={item.id} data-read={item.read}><small>{item.time} · {item.kind.toUpperCase()}</small><p>{item.text}</p></article>) : <p>No notifications in this session.</p>}</div></aside>;
}
