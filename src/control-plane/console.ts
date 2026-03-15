export function renderControlPlaneConsole(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compact Context Control Plane</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f2eb;
        --panel: #fffaf2;
        --ink: #1e1f1c;
        --muted: #6b6a66;
        --line: #d9d2c5;
        --accent: #9d5a2d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(157, 90, 45, 0.12), transparent 32%),
          linear-gradient(180deg, #f7f1e6 0%, var(--bg) 60%);
      }
      header, main { max-width: 1200px; margin: 0 auto; padding: 24px; }
      header h1 { margin: 0 0 8px; font-size: 30px; }
      header p { margin: 0; color: var(--muted); }
      main { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
      section {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 14px 34px rgba(48, 31, 19, 0.06);
      }
      h2 { margin: 0 0 12px; font-size: 18px; }
      button, input {
        font: inherit;
        border-radius: 12px;
        border: 1px solid var(--line);
        padding: 10px 12px;
      }
      button {
        background: var(--accent);
        color: white;
        border: none;
        cursor: pointer;
      }
      .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
      pre {
        margin: 0;
        min-height: 160px;
        max-height: 420px;
        overflow: auto;
        padding: 12px;
        border-radius: 14px;
        background: #221f1b;
        color: #f8f3ea;
        font-size: 12px;
        line-height: 1.5;
      }
      .muted { color: var(--muted); font-size: 13px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Compact Context Control Plane</h1>
      <p>阶段 8 运行面板：治理、观测、导入、工作台与 runtime snapshot 的统一控制台。</p>
    </header>
    <main>
      <section>
        <h2>Health</h2>
        <div class="row">
          <button data-load="/api/health" data-target="health">刷新</button>
        </div>
        <pre id="health">loading...</pre>
      </section>
      <section>
        <h2>Observability</h2>
        <div class="row">
          <button data-load="/api/observability/dashboard" data-target="observability">Dashboard</button>
          <button data-load="/api/observability/history" data-target="observabilityHistory">History</button>
          <button data-load="/api/observability/thresholds?stage=default" data-target="observabilityThresholds">Thresholds</button>
          <button data-load="/api/observability/notifications" data-target="observabilityNotifications">Alerts</button>
        </div>
        <pre id="observability">loading...</pre>
        <pre id="observabilityHistory" style="margin-top:12px;">waiting...</pre>
        <pre id="observabilityThresholds" style="margin-top:12px;">waiting...</pre>
        <pre id="observabilityNotifications" style="margin-top:12px;">waiting...</pre>
      </section>
      <section>
        <h2>Import Catalog / Jobs</h2>
        <div class="row">
          <button data-load="/api/import/catalog" data-target="catalog">Catalog</button>
          <button data-load="/api/import/jobs" data-target="jobs">Jobs</button>
          <button data-load="/api/import/dead-letters" data-target="deadLetters">Dead Letters</button>
        </div>
        <pre id="catalog">loading...</pre>
        <pre id="jobs" style="margin-top:12px;">waiting...</pre>
        <pre id="deadLetters" style="margin-top:12px;">waiting...</pre>
      </section>
      <section>
        <h2>Governance</h2>
        <div class="row">
          <button data-load="/api/governance/proposals" data-target="proposals">Proposals</button>
          <button data-load="/api/governance/audit" data-target="audit">Audit</button>
          <button data-load="/api/governance/templates" data-target="templates">Templates</button>
        </div>
        <pre id="proposals">loading...</pre>
        <pre id="audit" style="margin-top:12px;">waiting...</pre>
        <pre id="templates" style="margin-top:12px;">waiting...</pre>
      </section>
      <section>
        <h2>Workbench</h2>
        <div class="row">
          <button data-load="/api/workbench/aliases" data-target="aliases">Aliases</button>
          <button data-load="/api/workbench/import-review" data-target="importReview">Import Review</button>
        </div>
        <pre id="aliases">loading...</pre>
        <pre id="importReview" style="margin-top:12px;">waiting...</pre>
      </section>
      <section style="grid-column: 1 / -1;">
        <h2>Runtime Snapshot</h2>
        <div class="row">
          <input id="sessionId" placeholder="输入 sessionId 后查看单会话窗口" />
          <button id="loadSnapshots">最新快照</button>
          <button id="loadSessionSnapshot">按 sessionId 查看</button>
          <button id="loadTrace">Runtime / Governance Trace</button>
        </div>
        <p class="muted">如果未输入 sessionId，则返回最近快照列表；输入后优先返回对应 session 的 runtime window，并可联查治理与导入轨迹。</p>
        <pre id="runtimeSnapshots">loading...</pre>
        <pre id="runtimeTrace" style="margin-top:12px;">waiting...</pre>
      </section>
    </main>
    <script>
      async function load(url, targetId) {
        const target = document.getElementById(targetId);
        target.textContent = 'loading...';
        try {
          const response = await fetch(url);
          const data = await response.json();
          target.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          target.textContent = String(error);
        }
      }

      document.querySelectorAll('button[data-load]').forEach((button) => {
        button.addEventListener('click', () => load(button.dataset.load, button.dataset.target));
      });

      document.getElementById('loadSnapshots').addEventListener('click', () => {
        load('/api/runtime/snapshots', 'runtimeSnapshots');
      });

      document.getElementById('loadSessionSnapshot').addEventListener('click', () => {
        const sessionId = document.getElementById('sessionId').value.trim();
        const suffix = sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : '';
        load('/api/runtime/snapshots' + suffix, 'runtimeSnapshots');
      });

      document.getElementById('loadTrace').addEventListener('click', () => {
        const sessionId = document.getElementById('sessionId').value.trim();
        if (!sessionId) {
          document.getElementById('runtimeTrace').textContent = 'sessionId is required';
          return;
        }
        load('/api/workbench/runtime-governance-trace?sessionId=' + encodeURIComponent(sessionId), 'runtimeTrace');
      });

      load('/api/health', 'health');
      load('/api/observability/dashboard', 'observability');
      load('/api/import/catalog', 'catalog');
      load('/api/governance/proposals', 'proposals');
      load('/api/workbench/aliases', 'aliases');
      load('/api/runtime/snapshots', 'runtimeSnapshots');
    </script>
  </body>
</html>`;
}
