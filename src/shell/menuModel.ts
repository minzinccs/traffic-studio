import type { ReactNode } from 'react';
import type { View } from '../domain/types';
import { sidebarModes, type SidebarMode } from './sidebarModes';

// Typed command model for the desktop menu bar (FE-1).
// Rules enforced here:
//  - A shortcut is only shown when the command is really bound in the shell.
//  - Anything that needs the proxy/HTTP/crypto/storage core is disabled with a
//    plain-language reason instead of firing a fake "success" toast.
//  - `checked` is only used for state this frontend truly owns.
export type MenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  hint?: string;
  disabledReason?: string;
  checked?: boolean;
  separatorBefore?: boolean;
  children?: MenuItem[];
  action?: () => void;
};

export type MenuDefinition = { id: string; label: string; items: MenuItem[] };

export type MenuContext = {
  // File
  newApiRequest: () => void;
  openHar: () => void;
  closeActiveTab: () => void;
  closeOtherTabs: () => void;
  closeAllTabs: () => void;
  reopenClosedTab: () => void;
  canCloseActive: boolean;
  canCloseTabs: boolean;
  canReopen: boolean;
  // Navigation
  openView: (view: View) => void;
  openToolbox: (tool: string, mode?: string) => void;
  // View state
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  apiActive: boolean;
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
  motionEnabled: boolean;
  toggleMotion: () => void;
  splitActive: boolean;
  toggleSplit: () => void;
  // Traffic
  captureRunning: boolean;
  toggleCapture: () => void;
  sampleLoaded: boolean;
  loadSample: () => void;
  clearTraffic: () => void;
  // Proxy / Certificate
  editEndpoint: () => void;
  // Help
  openAbout: () => void;
  openShortcuts: () => void;
};

const CORE = 'Requires the proxy core — not connected in this preview.';

export function buildMenus(ctx: MenuContext): MenuDefinition[] {
  const disabled = (reason: string): Pick<MenuItem, 'disabledReason'> => ({ disabledReason: reason });

  return [
    {
      id: 'file', label: 'File', items: [
        { id: 'file-new-http', label: 'New HTTP Request', shortcut: 'Ctrl+T', action: ctx.newApiRequest },
        { id: 'file-new-ws', label: 'New WebSocket Request', ...disabled('The WebSocket client is not built yet.') },
        { id: 'file-new-workspace', label: 'New Workspace', separatorBefore: true, ...disabled('Multi-workspace support is not built yet.') },
        { id: 'file-open-file', label: 'Open File…', separatorBefore: true, ...disabled('The local file bridge is not connected.') },
        { id: 'file-open-har', label: 'Open HAR File…', shortcut: 'Ctrl+O', hint: 'Preview only — HAR import needs the local storage bridge.', action: ctx.openHar },
        { id: 'file-open-clipboard', label: 'Open from Clipboard', ...disabled('Clipboard import is not built yet.') },
        {
          id: 'file-recent', label: 'Recent', children: [
            { id: 'file-recent-1', label: 'No recent files', ...disabled('Recent items appear once local storage is connected.') },
          ],
        },
        { id: 'file-close', label: 'Close Tab', shortcut: 'Ctrl+W', separatorBefore: true, ...(ctx.canCloseActive ? { action: ctx.closeActiveTab } : disabled('No closeable API tab is active.')) },
        { id: 'file-close-others', label: 'Close Other Tabs', ...(ctx.canCloseTabs ? { action: ctx.closeOtherTabs } : disabled('No other API tabs are open.')) },
        { id: 'file-close-all', label: 'Close All API Tabs', ...(ctx.canCloseTabs ? { action: ctx.closeAllTabs } : disabled('No API tabs are open.')) },
        { id: 'file-reopen', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T', ...(ctx.canReopen ? { action: ctx.reopenClosedTab } : disabled('No recently closed tab.')) },
        { id: 'file-exit', label: 'Exit', separatorBefore: true, ...disabled('The native Windows build is not available on this machine.') },
      ],
    },
    {
      id: 'tools', label: 'Tools', items: [
        { id: 'tools-toolbox', label: 'Open Toolbox', action: () => ctx.openView('tools') },
        {
          id: 'tools-decode', label: 'Decode', separatorBefore: true, children: [
            { id: 'tools-decode-b64', label: 'Base64 Decode', action: () => ctx.openToolbox('Base64', 'Decode') },
            { id: 'tools-decode-url', label: 'URL Decode', action: () => ctx.openToolbox('URL', 'Decode') },
            { id: 'tools-decode-hex', label: 'Hex → Text', ...disabled('Hex decode is not built yet.') },
            { id: 'tools-decode-jwt', label: 'JWT Decode', ...disabled('JWT tools are not built yet.') },
          ],
        },
        {
          id: 'tools-encode', label: 'Encode', children: [
            { id: 'tools-encode-b64', label: 'Base64 Encode', action: () => ctx.openToolbox('Base64', 'Encode') },
            { id: 'tools-encode-url', label: 'URL Encode', action: () => ctx.openToolbox('URL', 'Encode') },
            { id: 'tools-encode-json', label: 'JSON Format', action: () => ctx.openToolbox('JSON format') },
            { id: 'tools-encode-hex', label: 'Text → Hex', ...disabled('Hex encode is not built yet.') },
          ],
        },
        {
          id: 'tools-generate', label: 'Generate', children: [
            { id: 'tools-gen-uuid', label: 'UUID v4', action: () => ctx.openToolbox('UUID') },
            { id: 'tools-gen-timestamp', label: 'Timestamp', action: () => ctx.openToolbox('Timestamp') },
          ],
        },
        {
          id: 'tools-hash', label: 'Hash / HMAC', children: [
            { id: 'tools-hash-md5', label: 'MD5', ...disabled('Hash tools are not built yet.') },
            { id: 'tools-hash-sha1', label: 'SHA-1', ...disabled('Hash tools are not built yet.') },
            { id: 'tools-hash-sha256', label: 'SHA-256', ...disabled('Hash tools are not built yet.') },
            { id: 'tools-hash-hmac', label: 'HMAC', ...disabled('Hash tools are not built yet.') },
          ],
        },
        {
          id: 'tools-crypto', label: 'Encrypt / Decrypt', children: [
            { id: 'tools-crypto-aes', label: 'AES', ...disabled('No crypto core is wired up.') },
            { id: 'tools-crypto-rsa', label: 'RSA', ...disabled('No crypto core is wired up.') },
          ],
        },
        { id: 'tools-terminal', label: 'Proxy Terminal', separatorBefore: true, ...disabled(CORE) },
        { id: 'tools-mcp', label: 'MCP Server', ...disabled(CORE) },
      ],
    },
    {
      id: 'view', label: 'View', items: [
        { id: 'view-traffic', label: 'Traffic', action: () => ctx.openView('traffic') },
        { id: 'view-api', label: 'API Client', action: () => ctx.openView('api') },
        { id: 'view-rules', label: 'Rules', action: () => ctx.openView('rules') },
        { id: 'view-history', label: 'History', action: () => ctx.openView('history') },
        { id: 'view-tracker', label: 'Tracker', action: () => ctx.openView('tracker') },
        { id: 'view-analytics', label: 'Analytics', action: () => ctx.openView('analytics') },
        { id: 'view-environments', label: 'Environments', action: () => ctx.openView('environments') },
        { id: 'view-devices', label: 'Devices', action: () => ctx.openView('devices') },
        { id: 'view-toolbox', label: 'Toolbox', action: () => ctx.openView('tools') },
        { id: 'view-sidebar', label: ctx.sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar', separatorBefore: true, checked: ctx.sidebarVisible, action: ctx.toggleSidebar },
        // FE-2 — the six contextual sidebar modes. Each one also switches the
        // workspace section, so the menu and the side rail land on the same mode.
        ...sidebarModes.map((meta) => ({
          id: `view-mode-${meta.mode}`,
          label: `Sidebar: ${meta.label}`,
          shortcut: meta.shortcut,
          hint: meta.hint,
          checked: ctx.sidebarMode === meta.mode,
          action: () => ctx.setSidebarMode(meta.mode),
        })),
        { id: 'view-split', label: ctx.splitActive ? 'Merge API Panes' : 'Split API Panes', separatorBefore: true, ...(ctx.apiActive ? { action: ctx.toggleSplit } : disabled('Open the API client to split panes.')) },
        { id: 'view-motion', label: `Animations: ${ctx.motionEnabled ? 'On' : 'Off'}`, checked: ctx.motionEnabled, action: ctx.toggleMotion },
        { id: 'view-zen', label: 'Zen Mode', separatorBefore: true, ...disabled('Zen Mode lands with the layout package (FE-6).') },
        { id: 'view-layout', label: 'Save Named Layout…', ...disabled('Named layouts land with FE-6.') },
      ],
    },
    {
      id: 'traffic', label: 'Traffic', items: [
        { id: 'traffic-capture', label: ctx.captureRunning ? 'Stop Capture (preview)' : 'Start Capture (preview)', shortcut: 'Ctrl+G', hint: 'Simulated — no proxy listener is running.', action: ctx.toggleCapture },
        { id: 'traffic-sample', label: 'Load Sample Traffic', action: ctx.loadSample },
        { id: 'traffic-clear', label: 'Clear Traffic', separatorBefore: true, ...(ctx.sampleLoaded ? { action: ctx.clearTraffic } : disabled('No sample traffic is loaded.')) },
        { id: 'traffic-import', label: 'Import HAR…', separatorBefore: true, hint: 'Preview only.', action: ctx.openHar },
        { id: 'traffic-export', label: 'Export HAR…', ...disabled(CORE) },
        { id: 'traffic-record', label: 'Start Recording to File', ...disabled(CORE) },
      ],
    },
    {
      id: 'proxy', label: 'Proxy', items: [
        { id: 'proxy-endpoint', label: 'Edit Listen Address…', action: ctx.editEndpoint },
        { id: 'proxy-system', label: 'System Proxy', separatorBefore: true, ...disabled('The proxy engine is not connected — no system proxy is changed.') },
        { id: 'proxy-override', label: 'Auto Override Rules', ...disabled(CORE) },
        { id: 'proxy-upstream', label: 'Upstream Proxy', ...disabled(CORE) },
        { id: 'proxy-loopback', label: 'Loopback / SOCKS Mode', ...disabled(CORE) },
      ],
    },
    {
      id: 'certificate', label: 'Certificate', items: [
        { id: 'cert-status', label: 'Status: Unknown (engine not connected)', ...disabled('The certificate manager reports once the capture core is wired up.') },
        { id: 'cert-install', label: 'Install Root Certificate', separatorBefore: true, ...disabled('Installing a root CA needs OS confirmation and the capture core.') },
        { id: 'cert-remove', label: 'Remove Root Certificate', ...disabled('Nothing is installed by this preview.') },
        { id: 'cert-detail', label: 'SSL Proxying Detail', ...disabled(CORE) },
      ],
    },
    {
      id: 'help', label: 'Help', items: [
        { id: 'help-shortcuts', label: 'Keyboard Shortcuts', action: ctx.openShortcuts },
        { id: 'help-about', label: 'About Traffic Studio', action: ctx.openAbout },
        { id: 'help-docs', label: 'Documentation', separatorBefore: true, ...disabled('No documentation URL is configured.') },
        { id: 'help-feedback', label: 'Report an Issue', ...disabled('No external feedback URL is configured.') },
        { id: 'help-recovery', label: 'Data Recovery', ...disabled('Local storage bridge is not connected.') },
        { id: 'help-changelog', label: 'Changelog', ...disabled('No changelog is bundled.') },
        { id: 'help-update', label: 'Check for Updates', ...disabled('The update channel is not configured.') },
      ],
    },
  ];
}
