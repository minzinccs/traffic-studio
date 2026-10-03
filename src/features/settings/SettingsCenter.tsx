import { NativeMaintenance } from '../storage/NativeMaintenance';
import { isTauri } from '@tauri-apps/api/core';
import { NativeIntegrations } from '../integrations';
import { WindowsProxyPanel } from './WindowsProxyPanel';
import { ManualWindowsProxy } from './ManualWindowsProxy';
import { CertificateManager } from '../certificates';
import { CertificateSetupGuide } from '../certificates/CertificateSetupGuide';
import type { CertificateTarget } from '../certificates/setup';
import { UiText, LocalePicker } from '../localization';
import { RepositoryPanel, RuntimeSummary } from '../storage';
import { BackupRecovery } from './BackupRecovery';
import { ShortcutEditor, validateKeybindings } from './shortcuts';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { defaults, usePreferences, type Preferences } from './preferences';
import { Personalization } from './Personalization';
import { IntegrationDrafts } from './IntegrationDrafts';
import { useDialogFocus } from '../../shell/useDialogFocus';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';

export const settingsPages = ['General', 'Appearance', 'Proxy & Certificate', 'API defaults', 'Advanced', 'Storage', 'Help'] as const;
export type SettingsPage = typeof settingsPages[number];

export function SettingsCenter({ initial, onClose, flash, motion, onMotion, integrationTab, certificateTarget = 'overview' }: {
  initial: SettingsPage;
  onClose: () => void;
  flash: (m: string) => void;
  motion: boolean;
  onMotion: () => void;
  integrationTab?: string;
  certificateTarget?: CertificateTarget;
}) {
  const [page, setPage] = useState(initial);
  const [prefs, save] = usePreferences();
  const [draft, setDraft] = useState(prefs);
  const [certTarget, setCertTarget] = useState<CertificateTarget>(certificateTarget);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState(() => Object.keys(localStorage).filter(k => k.startsWith('traffic-studio-')));
  const root = useRef<HTMLDivElement>(null);
  useDialogFocus(root, onClose);

  function update(patch: Partial<Preferences>) { setDraft(d => ({ ...d, ...patch })); setError(''); }
  function proxy(patch: Partial<Preferences['proxy']>) { update({ proxy: { ...draft.proxy, ...patch } }); }

  function apply() {
    if (!draft.proxy.host.trim() || !Number.isInteger(draft.proxy.port) || draft.proxy.port < 1 || draft.proxy.port > 65535) {
      setError('Enter a host and an integer port between 1 and 65535.'); setPage('Proxy & Certificate'); return;
    }
    if (draft.proxy.upstream && !/^https?:\/\/[^\s:@]+(?::\d+)?$/i.test(draft.proxy.upstream)) {
      setError('Upstream must be http(s)://host[:port], without credentials.'); setPage('Proxy & Certificate'); return;
    }
    if (!Number.isFinite(draft.api.timeout) || draft.api.timeout < 100 || draft.api.timeout > 120000) {
      setError('Timeout must be between 100 and 120000 ms.'); setPage('API defaults'); return;
    }
    const shortcutError = validateKeybindings(draft.keybindings);
    if (shortcutError) { setError(shortcutError); setPage('Advanced'); return; }
    try { save(draft); }
    catch { setError('Could not save preferences. Browser storage is unavailable or full.'); return; }
    flash('Preferences saved locally. Capture draft values do not change a running listener.');
  }

  return <div className="settings-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={root} className="settings-center" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
      <header>
        <div><span className="eyebrow">LOCAL PREFERENCES · {isTauri() ? 'NATIVE RUNTIME' : 'BROWSER SAMPLE MODE'}</span><h2 id="settings-heading"><UiText text={"Settings"} /></h2></div>
        <button aria-label="Close settings" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="settings-content">
        <nav aria-label="Settings sections">
          {settingsPages.map(item => <button key={item} aria-current={page === item ? 'page' : undefined} onClick={() => setPage(item)}><UiText text={item} /></button>)}
        </nav>
        <main>
          <h3><UiText text={page} /></h3>

          {page === 'General' && <>
            <LocalePicker />
            <Button size="sm" onClick={() => { onClose(); window.dispatchEvent(new Event('traffic-studio-workspaces')); }}><UiText text={"Manage workspaces"} /></Button>
            <p>Local desktop workspace. Browser drafts and the native repository are separate; no account or telemetry is required.</p>
            <RuntimeSummary />
            {!isTauri() && <label>Capture mock scenario<SelectField label="Capture mock scenario" value={draft.captureScenario} options={[{ value: 'Success', label: 'Success' }, { value: 'Failure', label: 'Failure' }]} onChange={value => update({ captureScenario: value as Preferences['captureScenario'] })} /></label>}
            {isTauri()
              ? <><label>Sample retention plan — browser preview only (days)<input type="number" min={1} max={365} value={draft.retention} onChange={e => update({ retention: Math.min(365, Math.max(1, Number(e.target.value))) })} /></label><p>Browser preview only. Native body cleanup runs under Storage — Native backup and maintenance; samples here are never deleted automatically.</p></>
              : <><label>Sample retention plan (days)<input type="number" min={1} max={365} value={draft.retention} onChange={e => update({ retention: Math.min(365, Math.max(1, Number(e.target.value))) })} /></label><p>Retention is a configuration draft. Samples are never deleted automatically.</p></>}
            <Button size="sm" onClick={() => { setDraft(defaults); setError('Defaults loaded into the draft. Apply to save.'); }}><UiText text={"Load preference defaults"} /></Button>
          </>}

          {page === 'Appearance' && <>
            <Personalization draft={draft} onChange={update} />
            <label><UiText text={"Theme"} /><SelectField label="Theme" value={draft.theme} options={[{ value: 'dark', label: 'Mine Shaft dark' }, { value: 'light', label: 'Light' }]} onChange={value => update({ theme: value as Preferences['theme'] })} /></label>
            <label><UiText text={"Accent"} /><input type="color" value={draft.accent} onChange={e => update({ accent: e.target.value })} /></label>
            <label><UiText text={"Traffic row density"} /><SelectField label="Traffic row density" value={draft.density} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} onChange={value => update({ density: value as Preferences['density'] })} /></label>
            <label><UiText text={"Interface zoom"} /><SelectField label="Interface zoom" value={String(draft.zoom)} options={[{ value: '80', label: '80%' }, { value: '90', label: '90%' }, { value: '100', label: '100%' }, { value: '110', label: '110%' }, { value: '125', label: '125%' }]} onChange={value => update({ zoom: Number(value) })} /></label>
            <label><input type="checkbox" checked={draft.toolbar} onChange={e => update({ toolbar: e.target.checked })} /> <UiText text={"Show capture toolbar"} /></label>
            <label><input type="checkbox" checked={draft.statusbar} onChange={e => update({ statusbar: e.target.checked })} /> <UiText text={"Show status bar"} /></label>
            <label><input type="checkbox" checked={motion} onChange={onMotion} /> <UiText text={"Animations (applies immediately)"} /></label>
          </>}

          {page === 'Proxy & Certificate' && <>
            <WindowsProxyPanel />
            <ManualWindowsProxy />
            <div className="settings-status">Capture settings below are drafts; they do not change the running listener.</div>
            <label><UiText text={"Listen host"} /><input value={draft.proxy.host} onChange={e => proxy({ host: e.target.value })} /></label>
            <label><UiText text={"Port"} /><input type="number" value={draft.proxy.port} onChange={e => proxy({ port: Number(e.target.value) })} /></label>
            <label><UiText text={"Protocol"} /><SelectField label="Protocol" value={draft.proxy.mode} options={[{ value: 'HTTP / HTTPS', label: 'HTTP / HTTPS' }, { value: 'SOCKS5', label: 'SOCKS5' }, { value: 'HTTP + SOCKS5', label: 'HTTP + SOCKS5' }]} onChange={value => proxy({ mode: value })} /></label>
            {(['system', 'override', 'loopback', 'upstreamEnabled'] as const).map(k => <label key={k}><input type="checkbox" checked={draft.proxy[k]} onChange={e => proxy({ [k]: e.target.checked })} />{{ system: 'System proxy (planned)', override: 'Auto override (planned)', loopback: 'Allow loopback (planned)', upstreamEnabled: 'Use upstream (planned)' }[k]}</label>)}
            <label><UiText text={"Bypass patterns"} /><textarea value={draft.proxy.bypass} onChange={e => proxy({ bypass: e.target.value })} /></label>
            <label><UiText text={"Upstream URL (no credentials)"} /><input placeholder="http://127.0.0.1:8080" value={draft.proxy.upstream} onChange={e => proxy({ upstream: e.target.value })} /></label>
            <Button size="sm" disabled title="Requires native bridge"><UiText text={"Apply to Windows"} /></Button>
            <p>Capture configuration remains a draft. Use the manual endpoint control above for explicit WinINet changes and its restore backup. No capture listener is started here.</p>

            <h4>Certificate</h4>
            <label>Setup target<SelectField label="Setup target" value={certTarget} options={[{ value: 'overview', label: 'Overview' }, { value: 'local-machine', label: 'Windows Local Machine' }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }, { value: 'firefox', label: 'Firefox' }, { value: 'java', label: 'Java VM' }, { value: 'view', label: 'View Root Certificate' }, { value: 'manage', label: 'Root Certificate Management' }, { value: 'ssl', label: 'SSL Certificate' }]} onChange={value => setCertTarget(value as CertificateTarget)} /></label>
            <CertificateSetupGuide target={certTarget} />
            <CertificateManager showPemInitially={certTarget === 'view'} />
            <label>SSL proxying URL patterns (capture draft)<textarea value={draft.proxy.sslPatterns} onChange={e => proxy({ sslPatterns: e.target.value })} /></label>
          </>}

          {page === 'API defaults' && <>
            <label><UiText text={"Default timeout (ms)"} /><input type="number" min={100} max={120000} value={draft.api.timeout} onChange={e => update({ api: { ...draft.api, timeout: Number(e.target.value) } })} /></label>
            <label><input type="checkbox" checked={draft.api.redirects} onChange={e => update({ api: { ...draft.api, redirects: e.target.checked } })} /> <UiText text={"Follow redirects by default"} /></label>
            <label><input type="checkbox" checked={draft.api.tls} onChange={e => update({ api: { ...draft.api, tls: e.target.checked } })} /> Verify TLS for new native request drafts</label>
            <p>Defaults apply to new drafts. Native sends use timeout, redirect and TLS verification settings.</p>
          </>}

          {page === 'Advanced' && <>
            <h4>Notifications</h4>
            <label><input type="checkbox" checked={draft.toastEnabled} onChange={e => update({ toastEnabled: e.target.checked })} /> <UiText text={"Show in-app toasts"} /></label>
            <label><UiText text={"Toast duration"} /><SelectField label="Toast duration" value={String(draft.toastSeconds)} options={[{ value: '2', label: '2 seconds' }, { value: '4', label: '4 seconds' }, { value: '6', label: '6 seconds' }, { value: '10', label: '10 seconds' }]} onChange={value => update({ toastSeconds: Number(value) })} /></label>
            <Button size="sm" onClick={() => flash('Test notification — local preview.')}><UiText text={"Send test notification"} /></Button>
            <p>Notification history lasts for this app session. No Windows push notification or background monitor is started.</p>

            <h4>Shortcuts</h4>
            <ShortcutEditor draft={draft} onChange={update} />

            <h4>Integrations</h4>
            {isTauri() && <NativeIntegrations />}
            <IntegrationDrafts initial={integrationTab} />
          </>}

          {page === 'Storage' && <>
            <p>{storage.length} Traffic Studio local entries. Auth values and credential headers are excluded from API saves; body and notes can still contain private data.</p>
            <div className="storage-list">{storage.map(key => <div key={key}><span>{key.replace('traffic-studio-', '')}</span><small>{new Blob([localStorage.getItem(key) ?? '']).size} bytes</small></div>)}</div>
            <Button size="sm" onClick={() => { const data = Object.fromEntries(storage.map(k => [k, localStorage.getItem(k)])); const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, entries: data }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'traffic-studio-local-backup.json'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }}><UiText text={"Export browser backup"} /></Button>
            <Button size="sm" onClick={() => { setStorage(Object.keys(localStorage).filter(k => k.startsWith('traffic-studio-'))); flash('Local storage inventory refreshed.'); }}><UiText text={"Refresh inventory"} /></Button>
            <p>Recovery: reload reopens browser drafts. Copy important content before clearing site data. Document recovery below validates and restores into a separate workspace. Native SQLite/file recovery is available in the desktop app; browser backup is separate.</p>
            <BackupRecovery flash={flash} />
            <RepositoryPanel />
            {isTauri() && <NativeMaintenance />}
          </>}

          {page === 'Help' && <>
            <h4>Traffic Studio 0.1.0</h4>
            <p>Traffic samples and the API preview transport are simulated. Native Send HTTP contacts the entered URL; Toolbox and document editing run locally.</p>
            <h4><UiText text={"Changelog"} /></h4>
            <ul><li>Context sidebars, keyboard menus and persistent API tabs.</li><li>Request/response inspector, windowed traffic table.</li><li>Settings, mock network configuration, notifications and named layouts.</li></ul>
            <h4><UiText text={"Troubleshooting"} /></h4>
            <p>If the screen is empty, load Sample Traffic or create an API request. A disconnected engine is expected. Browser storage must remain enabled to keep drafts.</p>
            <Button size="sm" disabled title="No update channel configured"><UiText text={"Check updates"} /></Button>{' '}
            <Button size="sm" disabled title="No feedback service configured"><UiText text={"Send feedback"} /></Button>
          </>}
        </main>
      </div>
      <footer>
        {error && <span role="alert">{error}</span>}
        <Button onClick={() => { setDraft(prefs); setError(''); }}><UiText text={"Discard edits"} /></Button>
        <Button variant="default" onClick={apply}><UiText text={"Apply locally"} /></Button>
        <Button onClick={onClose}><UiText text={"Close"} /></Button>
      </footer>
    </div>
  </div>;
}