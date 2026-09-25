import type { View } from '../domain/types';

// FE-2 — the sidebar is contextual.
//
// One mode owns exactly one workspace section and one sidebar panel, and the
// same mode is reachable three ways: the side rail, View → Sidebar, and F1–F6.
// Everything here is UI state only: no panel in this group talks to a proxy,
// HTTP client or filesystem, so each panel reads local drafts or the labelled
// sample fixtures instead of pretending to be a live capture.
export type SidebarMode = 'explorer' | 'collections' | 'environment' | 'history' | 'device' | 'toolbox';

// `traffic` is a section-owned sidebar rather than a switchable mode: it only
// appears inside the Traffic view, so it is a separate kind.
export type SidebarKind = SidebarMode | 'traffic';

export type SidebarModeMeta = {
  mode: SidebarMode;
  label: string;
  shortcut: string;
  section: View;
  hint: string;
};

export const sidebarModes: SidebarModeMeta[] = [
  { mode: 'explorer', label: 'Explorer', shortcut: 'F1', section: 'api', hint: 'Workspace files for the API client.' },
  { mode: 'collections', label: 'Collections', shortcut: 'F2', section: 'api', hint: 'Saved API profiles grouped into collections.' },
  { mode: 'environment', label: 'Environment', shortcut: 'F3', section: 'environments', hint: 'Variables that requests can reference.' },
  { mode: 'history', label: 'History', shortcut: 'F4', section: 'history', hint: 'Sample sessions and browser-saved requests.' },
  { mode: 'device', label: 'Device', shortcut: 'F5', section: 'devices', hint: 'Host, connected and available devices.' },
  { mode: 'toolbox', label: 'Toolbox', shortcut: 'F6', section: 'tools', hint: 'Local codec and generator tools.' },
];

const modeById = new Map(sidebarModes.map((item) => [item.mode, item]));

export function isSidebarMode(value: unknown): value is SidebarMode {
  return typeof value === 'string' && modeById.has(value as SidebarMode);
}

export function modeMeta(mode: SidebarMode): SidebarModeMeta {
  return modeById.get(mode) as SidebarModeMeta;
}

export function sectionForMode(mode: SidebarMode): View {
  return modeMeta(mode).section;
}

// Sections that do not own a sidebar (traffic, rules, tracker, analytics) keep
// the last chosen mode, so returning to a workspace section restores it.
export function modeForSection(section: View, current: SidebarMode): SidebarMode {
  switch (section) {
    case 'api': return current === 'collections' ? 'collections' : 'explorer';
    case 'environments': return 'environment';
    case 'history': return 'history';
    case 'devices': return 'device';
    case 'tools': return 'toolbox';
    default: return current;
  }
}

// Which panel (if any) the sidebar renders for the current section. Derived from
// the section so the panel can never disagree with the visible workspace.
export function sidebarKindFor(section: View, mode: SidebarMode): SidebarKind | null {
  if (section === 'traffic') return 'traffic';
  if (section === 'api') return mode === 'collections' ? 'collections' : 'explorer';
  if (section === 'environments') return 'environment';
  if (section === 'history') return 'history';
  if (section === 'devices') return 'device';
  if (section === 'tools') return 'toolbox';
  return null;
}
