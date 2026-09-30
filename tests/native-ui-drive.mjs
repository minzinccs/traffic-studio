// Native UI driver: drives the running Windows app through WebView2 remote debugging (CDP) and
// reports console/exception/log problems, layout overflow, invisible and disabled controls, plus
// screenshots of each step. Node 22+ only; it uses the built-in fetch/WebSocket, so no browser
// automation dependency is added.
//
// Prerequisites:
//   1. Build and start the app with the debugging port enabled:
//        $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
//        src-tauri\target\release\traffic-studio.exe
//   2. node tests/native-ui-drive.mjs .runtime/uitest/shots
//
// Optional environment:
//   UI_SECTIONS_FILE  path to a JSON array of steps: {name, rail, wait, check}
//   UI_SECTIONS       inline JSON array instead of a file
//   UI_RESET=1        clear the app diagnostic ring and reload before driving
//   CDP_PORT          debugging port (default 9222)
//
// Rail indexes follow App.tsx: 0 Traffic, 1 API client, 2 Rules, 3 History, 4 Tracker, 5 Analytics,
// 6 Environments, 7 Devices, 8 Toolbox, 9 Mixed workspace, 10 Toggle sidebar, 11 Settings.
// `check` is a JS expression whose value is recorded; it is how a test asserts real screen state.
//
// Only real console/exception/log entries are counted as problems. Optional tooling the app reports
// inside its own panels (for example a missing dumpcap/Npcap pair) is not a driver failure.

// Native UI driver for the Traffic Studio release window (WebView2 remote debugging).
// Requires the app launched with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
// Usage: node .runtime/uitest/drive.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.CDP_PORT ?? 9222);
const outDir = process.argv[2] ?? '.runtime/uitest/shots';
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pickPage() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find(t => t.type === 'page' && !/^(devtools|chrome)/.test(t.url)) ?? list.find(t => t.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('No page target. Start the app with --remote-debugging-port first.');
  return page;
}

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.onEvent = null; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', () => reject(new Error('CDP websocket error')));
      this.ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
          const { resolve: done, reject: fail } = this.pending.get(message.id);
          this.pending.delete(message.id);
          message.error ? fail(new Error(message.error.message)) : done(message.result);
        } else if (message.method) this.onEvent?.(message);
      });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    });
  }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

const flatten = args => args.map(a => a.value ?? a.description ?? a.type ?? '').join(' ').replace(/\s+/g, ' ').slice(0, 300);

const page = await pickPage();
const cdp = new Cdp(page.webSocketDebuggerUrl);
const problems = [];
await cdp.connect();
cdp.onEvent = message => {
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(message.params.type)) {
    problems.push({ kind: 'console', level: message.params.type, text: flatten(message.params.args) });
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    problems.push({ kind: 'exception', text: (details?.exception?.description ?? details?.text ?? '').slice(0, 400) });
  }
  if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) {
    problems.push({ kind: 'log', level: message.params.entry.level, source: message.params.entry.source, text: message.params.entry.text.slice(0, 300) });
  }
};
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function shoot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
  return `${name}.png`;
}

if (process.env.UI_RESET === '1') {
  await evaluate(`localStorage.removeItem('traffic-studio-diagnostic-errors-v1')`);
  await cdp.send('Page.reload');
  await sleep(3000);
}

const probe = `(() => {
  const active = document.querySelector('.rail-button.active');
  const rect = document.documentElement;
  const invisible = [...document.querySelectorAll('.app-body button')].filter(button => {
    const box = button.getBoundingClientRect();
    return box.width === 0 || box.height === 0;
  }).map(button => button.getAttribute('aria-label') || button.textContent.trim().slice(0, 40));
  const disabled = [...document.querySelectorAll('.app-body button[disabled]')].map(button => button.getAttribute('aria-label') || button.textContent.trim().slice(0, 40));
  return JSON.stringify({
    active: active ? active.getAttribute('aria-label') : null,
    overflowX: rect.scrollWidth - rect.clientWidth,
    invisible,
    disabled,
    text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 700),
  });
})()`;

const railClick = index => `(() => {
  const button = document.querySelectorAll('.rail-button')[${index}];
  if (!button) return 'missing';
  button.click();
  return button.getAttribute('aria-label');
})()`;

const targets = JSON.parse(process.env.UI_SECTIONS_FILE ? fs.readFileSync(process.env.UI_SECTIONS_FILE, 'utf8') : process.env.UI_SECTIONS ?? '[]');
const results = [];
for (const target of targets) {
  const clicked = target.rail === null ? null : await evaluate(railClick(target.rail));
  const opened = target.open ? await evaluate(target.open) : null;
  await sleep(target.wait ?? 900);
  const state = JSON.parse(await evaluate(probe));
  const check = target.check ? JSON.parse(await evaluate(target.check)) : null;
  const shot = await shoot(target.name);
  results.push({ ...target, clicked, opened, state, check, shot });
}

const diagnostics = await evaluate(`localStorage.getItem('traffic-studio-diagnostic-errors-v1')`);
const report = {
  url: page.url,
  viewport: await evaluate('JSON.stringify({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })'),
  diagnostics,
  problems,
  results,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ url: report.url, viewport: report.viewport, problemCount: problems.length, problems: problems.slice(0, 12), diagnostics, sections: results.map(r => ({ name: r.name, active: r.state.active, overflowX: r.state.overflowX, invisible: r.state.invisible, disabledCount: r.state.disabled.length })) }, null, 1));
cdp.close();
