import {bridge} from './bridge';
import { LocaleRoot } from './features/localization';
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspaceRoot } from './features/workspaces';
import './styles.css';
import './theme.css';
import './motion.css';
import './controls.css';
// Appearance and shared dialog rules must load before the lazy Settings view opens.
import './features/settings/settings.css';
import { installDiagnostics } from './features/diagnostics/installDiagnostics';
import { DiagnosticBoundary } from './features/diagnostics/DiagnosticBoundary';

const NativeWorkbench = lazy(() => import('./features/layout/NativeWorkbench').then(module => ({ default: module.NativeWorkbench })));
installDiagnostics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DiagnosticBoundary><LocaleRoot>{(window as unknown as {__TRAFFIC_STUDIO_DETACHED__?:boolean}).__TRAFFIC_STUDIO_DETACHED__?<Suspense fallback={<div role="status">Loading workbench…</div>}><NativeWorkbench onClose={()=>void bridge.command('workbench_close',undefined)}/></Suspense>:<WorkspaceRoot/>}</LocaleRoot></DiagnosticBoundary>
  </React.StrictMode>,
);
