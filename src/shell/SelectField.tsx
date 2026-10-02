import { ChevronsUpDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './selectField.css';

export type SelectOption = { value: string; label: string; disabled?: boolean; className?: string };

type Props = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SelectField({ label, value, options, onChange, disabled, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [activeValue, setActiveValue] = useState(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const enabled = options.filter(option => !option.disabled);
  const selected = options.find(option => option.value === value);
  const menuWidth = Math.min(window.innerWidth - 12, Math.max(rect?.width ?? 0, 200));

  useEffect(() => { if (open) setActiveValue(value); }, [open, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setRect(trigger.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open, rect]);

  function move(from: number, amount: number) {
    if (!enabled.length) return;
    const next = enabled[(from + amount + enabled.length) % enabled.length];
    if (!next) return;
    setActiveValue(next.value);
    popup.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpen(true); }
      return;
    }
    const activeEl = document.activeElement as HTMLElement | null;
    const focused = activeEl?.dataset?.value ?? (event.target as HTMLElement).closest<HTMLElement>('[data-value]')?.dataset.value ?? activeValue ?? value;
    const index = Math.max(0, enabled.findIndex(option => option.value === focused));
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(index, event.key === 'ArrowDown' ? 1 : -1); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const target = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1]; if (target) { setActiveValue(target.value); popup.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(target.value)}"]`)?.focus(); } }
    else if (event.key === 'Tab') setOpen(false);
    else if (event.key === 'Enter' || event.key === ' ') {
      const current = enabled[index];
      const activeIsOption = (document.activeElement as Element | null)?.hasAttribute?.('data-value') ?? false;
      if (current && activeIsOption) { event.preventDefault(); onChange(current.value); setOpen(false); trigger.current?.focus(); }
    }
  }

  const below = rect ? window.innerHeight - rect.bottom >= Math.min(280, options.length * 34 + 12) || rect.top < window.innerHeight - rect.bottom : true;
  const room = rect ? (below ? window.innerHeight - rect.bottom - 8 : rect.top - 8) : 280;
  return <>
    <button ref={trigger} type="button" className={`select-field ${className}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={onKeyDown}>
      <span className="select-field-value">{selected?.label ?? value}</span><ChevronsUpDown size={16} aria-hidden="true" className="select-field-chevrons"/>
    </button>
    {open && rect && createPortal(<div ref={popup} id={id} className={`select-field-menu ${trigger.current?.closest<HTMLElement>('.app-shell')?.dataset.theme === 'light' ? 'light' : ''}`} role="listbox" aria-label={label} onKeyDown={onKeyDown} onMouseLeave={() => setActiveValue(value)} style={{ left: Math.max(6, Math.min(rect.left, window.innerWidth - menuWidth - 6)), top: below ? rect.bottom + 4 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + 4, width: menuWidth, maxHeight: Math.max(60, Math.min(280, room)) }}>
      {options.map(option => {
        const isSelected = option.value === value;
        const isActive = option.value === activeValue;
        return <button type="button" key={option.value} role="option" data-value={option.value} aria-selected={isSelected} data-active={isActive ? 'true' : undefined} className={[isActive ? 'is-active' : '', option.className ?? ''].join(' ').trim() || undefined} disabled={option.disabled} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }} onMouseEnter={() => { if (!option.disabled) setActiveValue(option.value); }} onFocus={() => { if (!option.disabled) setActiveValue(option.value); }}>
          <span className="select-field-check" aria-hidden="true">{isSelected && <Check size={16} />}</span><span className="select-field-label">{option.label}</span>
        </button>;
      })}
    </div>, document.body)}
  </>;
}
