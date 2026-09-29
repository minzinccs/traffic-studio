import { recordDiagnostic } from './diagnosticLog';

let installed = false;
export function installDiagnostics() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', event => {
    recordDiagnostic('frontend', 'window_error', event.error ? 'script_error' : 'resource_error');
  });
  window.addEventListener('unhandledrejection', () => {
    recordDiagnostic('frontend', 'unhandled_rejection', 'promise_error');
  });
}
