import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';
import type { MenuDefinition, MenuItem } from './menuModel';
import './menu.css';

type Level = { anchor: string; items: MenuItem[] };

export function MenuBar({ menus }: { menus: MenuDefinition[] }) {
  const [openTop, setOpenTop] = useState<string | null>(null);
  const [subPath, setSubPath] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Record<string, { top: number; left: number }>>({});

  const barRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const popoverRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastTrigger = useRef<string | null>(null);

  const openMenu = menus.find((m) => m.id === openTop) ?? null;
  const levels: Level[] = [];
  if (openMenu) {
    levels.push({ anchor: openMenu.id, items: openMenu.items });
    let items = openMenu.items;
    for (const pid of subPath) {
      const parent = items.find((it) => it.id === pid);
      if (!parent?.children) break;
      items = parent.children;
      levels.push({ anchor: pid, items });
    }
  }
  const deepest = levels.length - 1;
  const deepestItems = deepest >= 0 ? levels[deepest].items : [];

  const focusTrigger = useCallback((id: string) => { triggerRefs.current[id]?.focus(); }, []);
  const closeAll = useCallback((returnFocus = true) => {
    const id = lastTrigger.current;
    setOpenTop(null); setSubPath([]); setActive(0);
    if (returnFocus && id) focusTrigger(id);
  }, [focusTrigger]);

  const openTopMenu = useCallback((id: string) => { lastTrigger.current = id; setOpenTop(id); setSubPath([]); setActive(0); }, []);

  // Position top popover under its trigger and each submenu beside its parent item.
  useLayoutEffect(() => {
    if (!openTop) { setPos({}); return; }
    const next: Record<string, { top: number; left: number }> = {};
    const trigger = triggerRefs.current[openTop];
    if (trigger) {
      const r = trigger.getBoundingClientRect();
      next[openTop] = { top: r.bottom + 2, left: Math.max(6, Math.min(r.left, window.innerWidth - 252)) };
    }
    for (const pid of subPath) {
      const el = itemRefs.current[pid];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[pid] = { top: r.top - 6, left: r.right - 4 };
    }
    setPos(next);
  }, [openTop, subPath]);

  // Clamp popovers so submenus never overflow the viewport.
  useLayoutEffect(() => {
    if (!openTop) return;
    const patch: Record<string, { top: number; left: number }> = {};
    let changed = false;
    for (const level of levels) {
      const el = popoverRefs.current[level.anchor];
      const current = pos[level.anchor];
      if (!el || !current) continue;
      const w = el.offsetWidth, h = el.offsetHeight;
      let left = current.left, top = current.top;
      if (left + w > window.innerWidth - 8) left = Math.max(6, window.innerWidth - w - 8);
      if (top + h > window.innerHeight - 8) top = Math.max(6, window.innerHeight - h - 8);
      if (Math.abs(left - current.left) > 0.5 || Math.abs(top - current.top) > 0.5) { patch[level.anchor] = { top, left }; changed = true; }
    }
    if (changed) setPos((p) => ({ ...p, ...patch }));
  }, [pos, openTop, levels.length, subPath]);

  const hover = useCallback((level: number, item: MenuItem, index: number) => {
    if (level === subPath.length) {
      setActive(index);
      setSubPath(item.children ? [...subPath, item.id] : subPath);
    } else {
      setSubPath(subPath.slice(0, level).concat(item.children ? [item.id] : []));
      setActive(0);
    }
  }, [subPath]);

  const activate = useCallback((level: number, item: MenuItem) => {
    if (item.disabledReason) return;
    if (item.children) { setSubPath(subPath.slice(0, level).concat(item.id)); setActive(0); return; }
    item.action?.();
    closeAll();
  }, [subPath, closeAll]);

  // Keyboard navigation while a menu is open.
  useEffect(() => {
    if (!openTop) return;
    function onKey(event: KeyboardEvent) {
      const items = deepestItems;
      switch (event.key) {
        case 'Escape': event.preventDefault(); closeAll(); return;
        case 'ArrowDown': event.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); return;
        case 'ArrowUp': event.preventDefault(); setActive((i) => Math.max(0, i - 1)); return;
        case 'Home': event.preventDefault(); setActive(0); return;
        case 'End': event.preventDefault(); setActive(items.length - 1); return;
        case 'Tab': closeAll(false); return;
        case 'ArrowRight': {
          event.preventDefault();
          const item = items[active];
          if (item?.children) { setSubPath((p) => p.slice(0, deepest).concat(item.id)); setActive(0); return; }
          const idx = menus.findIndex((m) => m.id === openTop);
          openTopMenu(menus[(idx + 1) % menus.length].id);
          return;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (subPath.length) {
            const parentId = subPath[subPath.length - 1];
            const parentLevel = levels[subPath.length - 1];
            setSubPath((p) => p.slice(0, -1));
            setActive(Math.max(0, parentLevel.items.findIndex((it) => it.id === parentId)));
            return;
          }
          const idx = menus.findIndex((m) => m.id === openTop);
          openTopMenu(menus[(idx - 1 + menus.length) % menus.length].id);
          return;
        }
        case 'Enter': case ' ': {
          event.preventDefault();
          const item = items[active];
          if (item) activate(deepest, item);
          return;
        }
        default: return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTop, subPath, active, deepest, deepestItems, levels, menus, activate, closeAll, openTopMenu]);

  // Move DOM focus to the active item so keyboard users can Tab-free navigate.
  useEffect(() => {
    if (!openTop) return;
    const item = deepestItems[active];
    if (!item) return;
    const el = document.getElementById(`menu-item-${item.id}`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }, [openTop, subPath, active, deepestItems]);

  // Close on outside pointer-down (no backdrop, so top-level hover-switching still works).
  useEffect(() => {
    if (!openTop) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (overlayRef.current?.contains(target) || barRef.current?.contains(target)) return;
      closeAll(false);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openTop, closeAll]);

  const renderItems = (items: MenuItem[], level: number) => (
    <ul className="menu-layer-list" role="menu">
      {items.map((item, index) => {
        const isActive = level === deepest && index === active;
        const expanded = subPath[level] === item.id;
        const disabled = Boolean(item.disabledReason);
        return (
          <li key={item.id} role="none" ref={(el) => { itemRefs.current[item.id] = el; }}>
            {item.separatorBefore && <div className="menu-layer-sep" role="separator"/>}
            <button
              type="button"
              id={`menu-item-${item.id}`}
              role="menuitem"
              className={`menu-layer-item ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''} ${expanded ? 'expanded' : ''}`}
              aria-disabled={disabled || undefined}
              aria-haspopup={item.children ? 'menu' : undefined}
              aria-expanded={item.children ? expanded : undefined}
              title={item.disabledReason ?? item.hint ?? item.label}
              onMouseEnter={() => hover(level, item, index)}
              onClick={(event) => { event.stopPropagation(); activate(level, item); }}
            >
              {item.icon && <span className="menu-layer-icon">{item.icon}</span>}
              <span className="menu-layer-label">{item.label}</span>
              {item.checked && <Check className="menu-layer-check" size={14}/>}
              {item.shortcut && <kbd className="menu-layer-kbd">{item.shortcut}</kbd>}
              {item.children && <ChevronRight className="menu-layer-caret" size={14}/>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return <>
    <nav className="menu-bar" role="menubar" aria-label="Application menu" ref={barRef}>
      {menus.map((menu) => {
        const isOpen = openTop === menu.id;
        return (
          <button
            key={menu.id}
            type="button"
            role="menuitem"
            className={`menu-trigger ${isOpen ? 'menu-open' : ''}`}
            aria-haspopup="true"
            aria-expanded={isOpen}
            ref={(el) => { triggerRefs.current[menu.id] = el; }}
            onClick={(event) => { event.stopPropagation(); if (isOpen) closeAll(); else openTopMenu(menu.id); }}
            onMouseEnter={() => { if (openTop && openTop !== menu.id) openTopMenu(menu.id); }}
            onKeyDown={(event) => {
              const isOpenKey = event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ';
              if (!isOpenKey) return;
              event.preventDefault();
              // When the menu is still closed, this keypress only opens it. Stop it
              // here so the menu's own window listener (registered as the menu opens)
              // does not receive the same event and immediately activate or skip the
              // first item.
              if (!isOpen) event.stopPropagation();
              openTopMenu(menu.id);
            }}
          >
            {menu.label}
          </button>
        );
      })}
    </nav>

    {openMenu && createPortal(
      <div className="menu-layer-root" ref={overlayRef}>
        {levels.map((level) => (
          <div
            key={level.anchor}
            className="menu-layer-popover"
            role="presentation"
            ref={(el) => { popoverRefs.current[level.anchor] = el; }}
            style={{ top: pos[level.anchor]?.top ?? -9999, left: pos[level.anchor]?.left ?? -9999 }}
          >
            {renderItems(level.items, levels.findIndex((l) => l.anchor === level.anchor))}
          </div>
        ))}
      </div>,
      document.body,
    )}
  </>;
}
