import { CircleAlert } from 'lucide-react';

// Shared page chrome used by the workspace views. Kept in the shell so feature
// modules (devices, history, tools…) can build pages without importing each
// other or the monolithic workspace page file.
export function PageHead({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-head-action">{action}</div>}</div>;
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return <div className="demo-note"><CircleAlert size={15}/>{children}</div>;
}
