import { binding, type Keybindings } from '../features/settings/shortcuts';
import type { ReactNode } from 'react';
import type { CertificateTarget } from '../features/certificates/setup';
import type { View } from '../domain/types';
import { sidebarModes, type SidebarMode } from './sidebarModes';

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
  keybindings?: Keybindings;
  newApiRequest: () => void;
  openHar: () => void;
  closeActiveTab: () => void;
  closeOtherTabs: () => void;
  closeAllTabs: () => void;
  reopenClosedTab: () => void;
  canCloseActive: boolean;
  canCloseTabs: boolean;
  canReopen: boolean;
  openView: (view: View) => void;
  openToolbox: (tool: string, mode?: string) => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  apiActive: boolean;
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
  motionEnabled: boolean;
  toggleMotion: () => void;
  splitActive: boolean;
  toggleSplit: () => void;
  captureRunning: boolean;
  toggleCapture: () => void;
  sampleLoaded: boolean;
  loadSample: () => void;
  clearTraffic: () => void;
  editEndpoint: () => void;
  openCertificate: (target: CertificateTarget) => void;
  openClipboard: () => void;
  openIntegration: (tab: string) => void;
  openSessions: () => void;
  openCompare: () => void;
  openProtocols: () => void;
  openSettings: (page?: string) => void;
  zenActive: boolean;
  toggleZen: () => void;
  openLayouts: () => void;
  toggleDirection: () => void;
  direction: string;
  openAbout: () => void;
  openShortcuts: () => void;
};

const CORE = 'Requires the proxy core — not connected in this preview.';

export function buildMenus(ctx: MenuContext): MenuDefinition[] {
  const disabled = (reason: string): Pick<MenuItem, 'disabledReason'> => ({ disabledReason: reason });
  const kb = ctx.keybindings ?? {};

  return [
    {
      id: 'file', label: 'File', items: [
        { id: 'file-new-http', label: 'New HTTP Request', shortcut: binding(kb, 'newRequest'), action: ctx.newApiRequest },
        { id: 'file-new-ws', label: 'New WebSocket Request', hint: 'Mock frames only; no socket is opened.', action: ctx.openProtocols },
        { id: 'file-new-workspace', label: 'Workspaces…', separatorBefore: true, action: () => window.dispatchEvent(new Event('traffic-studio-workspaces')) },
        { id: 'file-open-file', label: 'Open File…', separatorBefore: true, action: ctx.openSessions },
        { id: 'file-open-har', label: 'Open HAR File…', shortcut: binding(kb, 'openSession'), hint: 'Parse HAR locally, with validation preview.', action: ctx.openHar },
        { id: 'file-open-clipboard', label: 'Open from Clipboard', action: ctx.openClipboard },
        {
          id: 'file-recent', label: 'Recent', children: [
            { id: 'file-recent-1', label: 'No recent files', ...disabled('Recent items appear once local storage is connected.') },
          ]
        },
        { id: 'file-close', label: 'Close Tab', shortcut: binding(kb, 'closeTab'), separatorBefore: true, ...(ctx.canCloseActive ? { action: ctx.closeActiveTab } : disabled('No closeable API tab is active.')) },
        { id: 'file-close-others', label: 'Close Other Tabs', ...(ctx.canCloseTabs ? { action: ctx.closeOtherTabs } : disabled('No other API tabs are open.')) },
        { id: 'file-close-all', label: 'Close All API Tabs', ...(ctx.canCloseTabs ? { action: ctx.closeAllTabs } : disabled('No API tabs are open.')) },
        { id: 'file-reopen', label: 'Reopen Closed Tab', shortcut: binding(kb, 'reopenTab'), ...(ctx.canReopen ? { action: ctx.reopenClosedTab } : disabled('No recently closed tab.')) },
        { id: 'file-settings', label: 'Settings…', action: () => ctx.openSettings() },
        { id: 'file-exit', label: 'Exit', separatorBefore: true, ...disabled('The native Windows build is not available on this machine.') },
      ],
    },
    {
      id: 'tools', label: 'Tools', items: [
        { id: 'tools-protocols', label: 'WebSocket / SSE Preview', action: ctx.openProtocols },
        { id: 'tools-regex', label: 'Regex Tester', action: () => ctx.openToolbox('Regex') },
        { id: 'tools-toolbox', label: 'Open Toolbox', action: () => ctx.openView('tools') },
        {
          id: 'tools-decode', label: 'Decode', separatorBefore: true, children: [
            { id: 'tools-decode-b64', label: 'Base64 Decode', action: () => ctx.openToolbox('Base64', 'Decode') },
            { id: 'tools-decode-url', label: 'URL Decode', action: () => ctx.openToolbox('URL', 'Decode') },
            { id: 'tools-decode-hex', label: 'Hex → Text', action: () => ctx.openToolbox('Hex', 'Decode') },
            { id: 'tools-decode-jwt', label: 'JWT Decode', action: () => ctx.openToolbox('JWT') },
          ]
        },
        {
          id: 'tools-encode', label: 'Encode', children: [
            { id: 'tools-encode-b64', label: 'Base64 Encode', action: () => ctx.openToolbox('Base64', 'Encode') },
            { id: 'tools-encode-url', label: 'URL Encode', action: () => ctx.openToolbox('URL', 'Encode') },
            { id: 'tools-encode-json', label: 'JSON Format', action: () => ctx.openToolbox('JSON format') },
            { id: 'tools-encode-hex', label: 'Text → Hex', action: () => ctx.openToolbox('Hex', 'Encode') },
          ]
        },
        {
          id: 'tools-generate', label: 'Generate', children: [
            { id: 'tools-gen-qr', label: 'QR Code', action: () => ctx.openToolbox('QR code') },
            { id: 'tools-gen-uuid', label: 'UUID v4', action: () => ctx.openToolbox('UUID') },
            { id: 'tools-gen-timestamp', label: 'Timestamp', action: () => ctx.openToolbox('Timestamp') },
          ]
        },
        {
          id: 'tools-hash', label: 'Hash / HMAC', children: [
            { id: 'tools-hash-md5', label: 'MD5', ...disabled('MD5 is unavailable in browser Web Crypto.') },
            { id: 'tools-hash-sha1', label: 'SHA-1', action: () => ctx.openToolbox('Hash / HMAC', 'SHA-1') },
            { id: 'tools-hash-sha256', label: 'SHA-256', action: () => ctx.openToolbox('Hash / HMAC', 'SHA-256') },
            { id: 'tools-hash-hmac', label: 'HMAC', action: () => ctx.openToolbox('Hash / HMAC', 'HMAC') },
          ]
        },
        {
          id: 'tools-crypto', label: 'Encrypt / Decrypt', children: [
            { id: 'tools-crypto-aes', label: 'AES-GCM', action: () => ctx.openToolbox('AES') },
            { id: 'tools-crypto-rsa', label: 'RSA-OAEP', action: () => ctx.openToolbox('RSA') },
          ]
        },
        { id: 'tools-terminal', label: 'Proxy Terminal (mock)', separatorBefore: true, action: () => ctx.openIntegration('Terminal') },
        { id: 'tools-packet', label: 'Packet Capture (local)', hint: 'dumpcap/Npcap frames + TLS key log.', action: () => ctx.openToolbox('Packet capture') },
        { id: 'tools-mcp', label: 'MCP Server Preview', action: () => ctx.openIntegration('MCP') },
      ],
    },
    {
      id: 'view', label: 'View', items: [
        // ---- Navigate (9 destinations) ----
        { id: 'view-traffic', label: 'Traffic', action: () => ctx.openView('traffic') },
        { id: 'view-api', label: 'API Client', action: () => ctx.openView('api') },
        { id: 'view-rules', label: 'Rules', action: () => ctx.openView('rules') },
        { id: 'view-history', label: 'History', action: () => ctx.openView('history') },
        { id: 'view-tracker', label: 'Tracker', action: () => ctx.openView('tracker') },
        { id: 'view-analytics', label: 'Analytics', action: () => ctx.openView('analytics') },
        { id: 'view-environments', label: 'Environments', action: () => ctx.openView('environments') },
        { id: 'view-devices', label: 'Devices', action: () => ctx.openView('devices') },
        { id: 'view-toolbox', label: 'Toolbox', action: () => ctx.openView('tools') },
        // ---- Sidebar submenu (was 7 top-level items) ----
        {
          id: 'view-sidebar', label: 'Sidebar', separatorBefore: true, children: [
            { id: 'view-sidebar-toggle', label: ctx.sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar', checked: ctx.sidebarVisible, action: ctx.toggleSidebar },
            ...sidebarModes.map((meta) => ({
              id: `view-mode-${meta.mode}`,
              label: meta.label,
              shortcut: binding(kb, meta.mode),
              hint: meta.hint,
              checked: ctx.sidebarMode === meta.mode,
              action: () => ctx.setSidebarMode(meta.mode),
              separatorBefore: meta.mode === 'explorer',
            })),
          ]
        },
        // ---- Layout submenu (was 6 top-level items) ----
        {
          id: 'view-layout-menu', label: 'Layout', children: [
            { id: 'view-split', label: ctx.splitActive ? 'Merge API Panes' : 'Split API Panes', ...(ctx.apiActive ? { action: ctx.toggleSplit } : disabled('Open the API client to split panes.')) },
            { id: 'view-direction', label: `Pane direction: ${ctx.direction}`, action: ctx.toggleDirection },
            { id: 'view-motion', label: `Animations: ${ctx.motionEnabled ? 'On' : 'Off'}`, checked: ctx.motionEnabled, action: ctx.toggleMotion },
            { id: 'view-zen', label: 'Zen Mode', checked: ctx.zenActive, action: ctx.toggleZen, separatorBefore: true },
            { id: 'view-appearance', label: 'Appearance…', action: () => ctx.openSettings('Appearance') },
            { id: 'view-layout-save', label: 'Save Named Layout…', action: ctx.openLayouts },
          ]
        },
        // ---- Traffic submenu (was 8 top-level items) ----
        {
          id: 'view-traffic-menu', label: 'Traffic Actions', children: [
            { id: 'traffic-capture', label: ctx.captureRunning ? 'Stop Capture (preview)' : 'Start Capture (preview)', shortcut: binding(kb, 'capture'), hint: 'Simulated — no proxy listener is running.', action: ctx.toggleCapture },
            { id: 'traffic-sample', label: 'Load Sample Traffic', action: ctx.loadSample },
            { id: 'traffic-clear', label: 'Clear Traffic', ...(ctx.sampleLoaded ? { action: ctx.clearTraffic } : disabled('No sample traffic is loaded.')) },
            { id: 'traffic-import', label: 'Import HAR…', hint: 'Preview only.', action: ctx.openHar, separatorBefore: true },
            { id: 'traffic-export', label: 'Export Preview HAR…', action: ctx.openSessions },
            { id: 'traffic-sessions', label: 'Local Preview Sessions…', action: ctx.openSessions },
            { id: 'traffic-compare', label: 'Compare Flows…', action: ctx.openCompare },
            { id: 'traffic-record', label: 'Start Recording to File', ...disabled(CORE) },
          ]
        },
      ],
    },
    {
      id: 'proxy', label: 'Proxy', items: [
        { id: 'proxy-config', label: 'Proxy Configuration…', action: () => ctx.openSettings('Proxy') },
        { id: 'proxy-endpoint', label: 'Edit Listen Address…', action: ctx.editEndpoint },
        { id: 'proxy-system', label: 'System Proxy', separatorBefore: true, hint: 'Planned configuration only', action: () => ctx.openSettings('Proxy') },
        { id: 'proxy-override', label: 'Auto Override Rules (config preview)', action: () => ctx.openSettings('Proxy') },
        { id: 'proxy-upstream', label: 'Upstream Proxy (config preview)', action: () => ctx.openSettings('Proxy') },
        { id: 'proxy-loopback', label: 'Loopback / SOCKS Mode (config preview)', action: () => ctx.openSettings('Proxy') },
        {
          id: 'cert-root', label: 'Certificate', separatorBefore: true, children: [
            { id: 'cert-local-machine', label: 'Install Root Certificate to Local Machine…', action: () => ctx.openCertificate('local-machine') },
            { id: 'cert-android', label: 'Install Root Certificate to Android…', action: () => ctx.openCertificate('android') },
            { id: 'cert-ios', label: 'Install Root Certificate to iOS…', action: () => ctx.openCertificate('ios') },
            { id: 'cert-firefox', label: 'Install Root Certificate to Firefox…', action: () => ctx.openCertificate('firefox') },
            { id: 'cert-java', label: 'Install Root Certificate to Java VM…', action: () => ctx.openCertificate('java') },
            { id: 'cert-view', label: 'View Root Certificate…', separatorBefore: true, action: () => ctx.openCertificate('view') },
            {
              id: 'cert-management', label: 'Root Certificate Management', children: [
                { id: 'cert-manage-create', label: 'Create / Export CA…', action: () => ctx.openCertificate('manage') },
                { id: 'cert-manage-trust', label: 'Trust / Remove for Current User…', action: () => ctx.openCertificate('manage') },
              ]
            },
            { id: 'cert-ssl', label: 'SSL Certificate…', separatorBefore: true, action: () => ctx.openCertificate('ssl') },
          ]
        },
      ],
    },
    {
      id: 'help', label: 'Help', items: [
        { id: 'help-shortcuts', label: 'Keyboard Shortcuts', action: ctx.openShortcuts },
        { id: 'help-about', label: 'About Traffic Studio', action: ctx.openAbout },
        { id: 'help-docs', label: 'Documentation', separatorBefore: true, action: () => ctx.openSettings('Help') },
        { id: 'help-feedback', label: 'Report an Issue', ...disabled('No external feedback URL is configured.') },
        { id: 'help-recovery', label: 'Data Recovery', action: () => ctx.openSettings('Storage') },
        { id: 'help-changelog', label: 'Changelog', action: () => ctx.openSettings('Help') },
        { id: 'help-update', label: 'Check for Updates', ...disabled('The update channel is not configured.') },
      ],
    },
  ];
}