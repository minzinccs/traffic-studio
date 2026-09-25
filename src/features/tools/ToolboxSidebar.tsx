import { Wrench } from 'lucide-react';
import { toolGroups, toolsInGroup } from './tools';
import { toolIcon } from './toolIcons';
import './toolboxSidebar.css';

// FE-2 — Toolbox sidebar (mode F6).
//
// Lists every tool by group. Tools that are not built are disabled and explain
// why, rather than opening an empty panel.
export function ToolboxSidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return <aside className="explorer-sidebar" aria-label="Toolbox sidebar">
    <div className="explorer-title"><span>TOOLBOX · LOCAL</span><Wrench size={15}/></div>
    <div className="tool-scroll">
      {toolGroups.map((group) => <div key={group}>
        <div className="tool-group">{group === 'Later' ? 'COMING LATER' : group.toUpperCase()}</div>
        {toolsInGroup(group).map((tool) => <button
          key={tool.id}
          className={`tool-node ${active === tool.id ? 'selected' : ''}`}
          disabled={!tool.available}
          aria-pressed={tool.available ? active === tool.id : undefined}
          title={tool.available ? `Open ${tool.label}` : tool.hint}
          onClick={() => onSelect(tool.id)}
        >
          {toolIcon(tool.id)}
          <span>{tool.label}</span>
          {!tool.available && <em className="tool-later">LATER</em>}
        </button>)}
      </div>)}
      <div className="tool-note">Codec and generator tools run entirely on this device. Nothing is uploaded.</div>
    </div>
  </aside>;
}
