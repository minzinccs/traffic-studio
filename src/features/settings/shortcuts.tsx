import { UiText } from '../localization';
import type { Preferences } from './preferences';

export const shortcutCommands = [
  ['newRequest', 'New HTTP draft', 'Ctrl+T'], ['closeTab', 'Close API tab', 'Ctrl+W'],
  ['reopenTab', 'Reopen closed tab', 'Ctrl+Shift+T'], ['nextTab', 'Next tab', 'Ctrl+Tab'],
  ['previousTab', 'Previous tab', 'Ctrl+Shift+Tab'], ['capture', 'Toggle mock capture', 'Ctrl+G'],
  ['openSession', 'Open HAR/session preview', 'Ctrl+O'], ['search', 'Traffic search', 'Ctrl+K'],
  ['explorer', 'Explorer sidebar', 'F1'], ['collections', 'Collections sidebar', 'F2'],
  ['environment', 'Environment sidebar', 'F3'], ['history', 'History sidebar', 'F4'],
  ['device', 'Device sidebar', 'F5'], ['toolbox', 'Toolbox sidebar', 'F6'],
] as const;
export type ShortcutCommand = typeof shortcutCommands[number][0];
export type Keybindings = Partial<Record<ShortcutCommand, string>>;
export function binding(bindings: Keybindings, command: ShortcutCommand): string {
  return bindings[command] ?? shortcutCommands.find(([id]) => id === command)![2];
}
export function keyChord(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string {
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return '';
  return `${event.ctrlKey || event.metaKey ? 'Ctrl+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.key.length === 1 ? event.key.toUpperCase() : event.key}`;
}
export function validateKeybindings(bindings: Keybindings): string {
  const seen = new Set<string>();
  for (const [id, label] of shortcutCommands) {
    const chord = binding(bindings, id);
    if (!chord) continue;
    if (!/^(?:(?:Ctrl\+)(?:Alt\+)?(?:Shift\+)?(?:[A-Z0-9]|Tab)|F(?:[1-9]|1[0-2]))$/.test(chord)) return `${label}: use Ctrl with a letter/number/Tab, or F1–F12.`;
    if (seen.has(chord)) return `Duplicate shortcut: ${chord}. Clear or change the other command first.`;
    seen.add(chord);
  }
  return '';
}
export function ShortcutEditor({ draft, onChange }: { draft: Preferences; onChange: (value: Partial<Preferences>) => void }) {
  return <><p>Focus a shortcut and press the new combination. Clear disables a command. Escape keeps its dialog/menu behavior. Apply locally saves your changes.</p>{shortcutCommands.map(([id, label]) => <label key={id}>{label}<input aria-label={`Shortcut for ${label}`} readOnly value={binding(draft.keybindings, id)} placeholder="Disabled" onKeyDown={e => {
    if (e.key === 'Escape' || e.key === 'Tab' && !e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    const chord = keyChord(e.nativeEvent);
    if (chord) onChange({ keybindings: { ...draft.keybindings, [id]: chord } });
  }}/><button onClick={() => onChange({ keybindings: { ...draft.keybindings, [id]: '' } })}><UiText text={"Clear"}/> {label}</button></label>)}<button onClick={() => onChange({ keybindings: {} })}><UiText text={"Reset shortcuts"}/></button><p>Some combinations are reserved by the browser or Windows. Use available combinations in browser preview.</p></>;
}
