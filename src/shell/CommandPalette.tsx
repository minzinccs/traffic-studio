import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Command, Search, X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';
import './commandPalette.css';

export type CommandItem = {
    id: string;
    label: string;
    hint?: string;
    group: string;
    shortcut?: string;
    action: () => void;
};

export function CommandPalette({ commands, onClose }: { commands: CommandItem[]; onClose: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    useDialogFocus(root, onClose);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase().includes(q));
    }, [commands, query]);

    const groups = useMemo(() => {
        const map = new Map<string, CommandItem[]>();
        filtered.forEach((c) => { if (!map.has(c.group)) map.set(c.group, []); map.get(c.group)!.push(c); });
        return [...map.entries()];
    }, [filtered]);

    useEffect(() => { setActiveIndex(0); }, [query]);
    useEffect(() => { input.current?.focus(); }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(filtered.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); const item = filtered[activeIndex]; if (item) { item.action(); onClose(); } }
            else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filtered, activeIndex, onClose]);

    return createPortal(
        <div className="command-palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={root} className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
                <div className="command-palette-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                        ref={input}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type a command or search…"
                        aria-label="Command palette search"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="command-palette-list"
                        aria-activedescendant={filtered[activeIndex] ? `command-item-${filtered[activeIndex].id}` : undefined}
                        autoComplete="off"
                    />
                    <button className="command-palette-close" aria-label="Close command palette" onClick={onClose}><X size={15} aria-hidden="true" /></button>
                </div>
                <div className="command-palette-list" id="command-palette-list" role="listbox" aria-label="Commands">
                    {groups.length === 0 && <div className="command-palette-empty" role="presentation">No matching command.</div>}
                    {groups.map(([group, items]) => (
                        <div key={group} className="command-palette-group" role="group" aria-label={group}>
                            <div className="command-palette-group-title" aria-hidden="true">{group}</div>
                            {items.map((item) => {
                                const flatIndex = filtered.indexOf(item);
                                const active = flatIndex === activeIndex;
                                return <button
                                    key={item.id}
                                    id={`command-item-${item.id}`}
                                    role="option"
                                    aria-selected={active}
                                    className={`command-palette-item ${active ? 'active' : ''}`}
                                    onMouseEnter={() => setActiveIndex(flatIndex)}
                                    onClick={() => { item.action(); onClose(); }}
                                >
                                    <Command size={13} aria-hidden="true" />
                                    <span className="command-palette-item-label">{item.label}</span>
                                    {item.hint && <span className="command-palette-item-hint">{item.hint}</span>}
                                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                                </button>;
                            })}
                        </div>
                    ))}
                </div>
                <div className="command-palette-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                    <span><kbd>↵</kbd> select</span>
                    <span><kbd>Esc</kbd> dismiss</span>
                </div>
            </div>
        </div>,
        document.body,
    );
}