import { Component, type ReactNode } from 'react';
import { recordDiagnostic } from './diagnosticLog';
import './diagnostics.css';

export class DiagnosticBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { recordDiagnostic('frontend', 'react_render', 'render_error'); }
  render() {
    if (this.state.failed) return <main className="diagnostics-fatal" role="alert"><h1>Traffic Studio could not show this view.</h1><p>A local error record was saved without request contents. Reload the app to retry.</p><button type="button" onClick={() => window.location.reload()}>Reload app</button></main>;
    return this.props.children;
  }
}
