const STYLE = `
      :root {
        color-scheme: light;
        --bg: #f3eee7;
        --paper: rgba(255, 253, 249, 0.96);
        --paper-strong: #fffdfa;
        --paper-muted: #f4ede4;
        --ink: #191613;
        --muted: #6a6157;
        --line: rgba(91, 74, 56, 0.14);
        --line-strong: rgba(91, 74, 56, 0.26);
        --accent: #a66039;
        --accent-strong: #854927;
        --accent-soft: rgba(166, 96, 57, 0.12);
        --sage: #2f665c;
        --sage-soft: rgba(47, 102, 92, 0.12);
        --blue: #3a5f7a;
        --blue-soft: rgba(58, 95, 122, 0.12);
        --warning: #9a6a1d;
        --warning-soft: rgba(154, 106, 29, 0.12);
        --danger: #aa4535;
        --danger-soft: rgba(170, 69, 53, 0.12);
        --shadow: 0 24px 56px rgba(53, 35, 18, 0.08);
        --shadow-soft: 0 12px 32px rgba(53, 35, 18, 0.055);
        --radius-xl: 32px;
        --radius-lg: 24px;
        --radius-md: 18px;
        --radius-sm: 12px;
      }

      * { box-sizing: border-box; }
      html {
        scroll-behavior: smooth;
        overflow-y: scroll;
        scrollbar-gutter: stable;
      }

      body {
        margin: 0;
        min-height: 100vh;
        overflow-y: auto;
        font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(166, 96, 57, 0.08), transparent 26%),
          radial-gradient(circle at top right, rgba(47, 102, 92, 0.08), transparent 24%),
          linear-gradient(180deg, #faf7f2 0%, #f5efe7 48%, var(--bg) 100%);
      }

      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        width: 14px;
      }

      html::-webkit-scrollbar-track,
      body::-webkit-scrollbar-track {
        background: rgba(244, 237, 228, 0.92);
      }

      html::-webkit-scrollbar-thumb,
      body::-webkit-scrollbar-thumb {
        border: 3px solid rgba(244, 237, 228, 0.92);
        border-radius: 999px;
        background: rgba(166, 96, 57, 0.32);
      }

      html::-webkit-scrollbar-thumb:hover,
      body::-webkit-scrollbar-thumb:hover {
        background: rgba(166, 96, 57, 0.48);
      }

      button,
      select,
      input,
      textarea { font: inherit; }

      .shell {
        display: grid;
        grid-template-columns: 296px minmax(0, 1fr);
        gap: 24px;
        min-height: 100vh;
        width: 100%;
        max-width: 1720px;
        margin: 0 auto;
        padding: 28px 28px 52px;
        align-items: start;
      }

      .sidebar {
        position: sticky;
        top: 28px;
        display: grid;
        align-content: start;
        gap: 18px;
        padding: 0;
      }

      .workspace {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 0;
      }

      .brand,
      .sidebar-panel,
      .panel,
      .topbar,
      .status-banner {
        border: 1px solid var(--line);
        box-shadow: var(--shadow-soft);
      }

      .brand {
        padding: 18px 20px;
        border-radius: var(--radius-lg);
        background:
          linear-gradient(145deg, rgba(255, 254, 251, 0.99), rgba(246, 239, 229, 0.98)),
          radial-gradient(circle at top left, rgba(166, 96, 57, 0.1), transparent 50%);
      }

      .brand h1 {
        margin: 0;
        font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1.2;
        color: rgba(25, 22, 19, 0.95);
      }

      .topbar-copy h2 {
        margin: 0 0 10px;
        font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        font-size: 34px;
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1.08;
      }

      .brand p,
      .panel-head p,
      .inline-note,
      .topbar-copy p,
      .list-item-note,
      .empty-state p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .sidebar-panel {
        padding: 18px;
        border-radius: var(--radius-lg);
        background: linear-gradient(180deg, rgba(255, 253, 249, 0.98), rgba(250, 245, 237, 0.96));
      }

      .sidebar-panel h2,
      .panel-head h3 {
        margin: 0;
        font-size: 17px;
        letter-spacing: -0.03em;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .nav-list,
      .future-list,
      .session-activity-list,
      .stack-list,
      .event-list,
      .alert-list,
      .pair-list,
      .chip-list,
      .diagnostic-list {
        display: grid;
        gap: 10px;
      }

      .nav-button,
      .future-button,
      .ghost-button {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: linear-gradient(180deg, rgba(255, 253, 249, 0.98), rgba(248, 242, 234, 0.9));
        color: inherit;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }

      .nav-button,
      .future-button { padding: 15px 16px; text-align: left; }

      .nav-button,
      .ghost-button,
      .secondary-button {
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
      }

      .nav-button:hover,
      .ghost-button:hover,
      .secondary-button:hover {
        border-color: var(--line-strong);
        transform: translateY(-1px);
      }

      .nav-button.is-active {
        border-color: rgba(166, 96, 57, 0.32);
        background:
          linear-gradient(180deg, rgba(166, 96, 57, 0.14), rgba(255, 252, 248, 0.98)),
          linear-gradient(90deg, rgba(166, 96, 57, 0.18), transparent 48%);
        box-shadow: 0 10px 24px rgba(86, 54, 31, 0.08);
      }

      .nav-label {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 5px;
      }

      .nav-label strong {
        font-size: 16px;
        color: var(--ink);
      }

      .nav-label span,
      .future-button span { font-size: 12px; }

      .future-button { opacity: 0.7; }

      .session-activity-list {
        display: grid;
        gap: 12px;
      }

      .session-activity-item {
        padding: 15px;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: linear-gradient(180deg, rgba(255, 253, 249, 0.98), rgba(248, 243, 235, 0.94));
      }

      .session-activity-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      .session-activity-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 7px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 251, 245, 0.9);
        font-size: 13px;
        font-weight: 700;
      }

      .session-activity-tag::before {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 999px;
        flex: 0 0 auto;
        background: var(--accent);
      }

      .session-activity-tag.info::before { background: var(--blue); }
      .session-activity-tag.success::before { background: var(--sage); }
      .session-activity-tag.warning::before { background: var(--warning); }

      .session-activity-time {
        color: var(--muted);
        font-size: 12px;
        white-space: nowrap;
      }

      .session-activity-item h3 {
        margin: 0;
        font-size: 19px;
        line-height: 1.3;
      }

      .session-activity-item p {
        margin: 10px 0 0;
        color: var(--muted);
        line-height: 1.65;
      }

      .sidebar-subsection {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--line);
      }

      .sidebar-subsection-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      .sidebar-subsection-head h3 {
        margin: 0;
        font-size: 16px;
      }

      .sidebar-hint {
        margin: 0 0 12px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }

      .ghost-button,
      .secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        padding: 0 14px;
        cursor: pointer;
      }

      .secondary-button {
        appearance: none;
        border: 1px solid var(--accent);
        border-radius: 999px;
        background: linear-gradient(135deg, #b56a42, #98532f);
        border-color: var(--accent);
        color: #fffaf4;
        width: auto;
        min-width: 140px;
        min-height: 38px;
        padding: 0 16px;
        flex: 0 0 auto;
        box-shadow: 0 10px 24px rgba(152, 83, 47, 0.18);
        font-weight: 700;
      }

      .topbar {
        display: grid;
        gap: 16px;
        padding: 24px 26px;
        border-radius: var(--radius-xl);
        background:
          radial-gradient(circle at top left, rgba(166, 96, 57, 0.12), transparent 28%),
          radial-gradient(circle at right center, rgba(47, 102, 92, 0.08), transparent 30%),
          linear-gradient(145deg, rgba(255, 254, 251, 0.99), rgba(246, 239, 229, 0.97));
      }

      .topbar-main {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 24px;
      }

      .topbar-copy {
        display: grid;
        gap: 8px;
      }

      .topbar-copy h2 {
        max-width: 18ch;
      }

      .topbar-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .meta-chip,
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 252, 248, 0.96);
        font-size: 13px;
      }

      .meta-chip strong {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .pill {
        border-color: transparent;
        background: var(--paper-muted);
      }

      .pill.success { background: var(--sage-soft); color: var(--sage); }
      .pill.info { background: var(--blue-soft); color: var(--blue); }
      .pill.warning { background: var(--warning-soft); color: var(--warning); }
      .pill.danger { background: var(--danger-soft); color: var(--danger); }
      .pill.muted { background: rgba(114, 104, 91, 0.12); color: var(--muted); }

      .status-banner {
        margin-top: 14px;
        padding: 13px 15px;
        border-radius: var(--radius-md);
        background: rgba(255, 252, 248, 0.92);
      }

      .status-banner.info { background: var(--blue-soft); color: var(--blue); }
      .status-banner.success { background: var(--sage-soft); color: var(--sage); }
      .status-banner.warning { background: var(--warning-soft); color: var(--warning); }
      .status-banner.danger { background: var(--danger-soft); color: var(--danger); }

      .views { margin-top: 16px; }
      .view { display: none; }
      .view.is-active { display: grid; gap: 18px; }

      .panel {
        padding: 22px;
        border-radius: var(--radius-lg);
        background: linear-gradient(180deg, rgba(255, 253, 249, 0.99), rgba(249, 244, 236, 0.97));
      }

      .panel-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 16px;
      }

      .panel-grid,
      .card-grid,
      .split-grid,
      .compare-grid,
      .subtle-grid {
        display: grid;
        gap: 16px;
      }

      .panel-grid,
      .split-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
      .card-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      .compare-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
      .subtle-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

      .card,
      .compare-card,
      .stack-item,
      .event-item,
      .alert-item,
      .payload-box,
      .note-card,
      .step-card {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: linear-gradient(180deg, rgba(255, 254, 251, 0.99), rgba(247, 242, 235, 0.96));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
      }

      .card strong,
      .compare-card strong,
      .note-card strong {
        display: block;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .card-value {
        margin-top: 10px;
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }

      .card-note { margin-top: 8px; color: var(--muted); line-height: 1.6; }
      .compare-card h4,
      .stack-item h4,
      .event-item h4,
      .alert-item h4 { margin: 0; font-size: 16px; }

      .compare-head,
      .stack-head,
      .event-head,
      .alert-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .compare-meta,
      .event-meta,
      .item-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .stack-item p,
      .event-item p,
      .alert-item p { margin: 0; line-height: 1.6; }

      .stack-body,
      .event-body { display: grid; gap: 10px; }

      .mono,
      .payload-box pre,
      .diagnostic-list code {
        font-family: "IBM Plex Mono", "JetBrains Mono", "Cascadia Mono", monospace;
      }

      .payload-box {
        overflow: auto;
        background: #211d18;
        border-color: rgba(255, 251, 245, 0.06);
        color: #f3eee6;
      }

      .payload-box pre {
        margin: 0;
        font-size: 13px;
        line-height: 1.65;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .empty-state {
        padding: 20px;
        border: 1px solid rgba(166, 96, 57, 0.16);
        border-radius: var(--radius-md);
        background:
          radial-gradient(circle at top left, rgba(166, 96, 57, 0.06), transparent 42%),
          linear-gradient(180deg, rgba(255, 252, 248, 0.96), rgba(247, 241, 233, 0.94));
      }

      .empty-state strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
      }

      .landing-grid,
      .step-grid {
        display: grid;
        gap: 14px;
      }

      .landing-grid {
        grid-template-columns: 1fr;
      }

      .landing-stack {
        display: grid;
        gap: 16px;
      }

      .step-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .step-card {
        display: grid;
        gap: 8px;
        min-height: 100%;
      }

      .step-card strong {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .step-card h4 {
        margin: 0;
        font-size: 17px;
      }

      .step-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }

      .step-card .item-row {
        margin-top: auto;
      }

      .status-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .diagnostic-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .diagnostic-list li {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--line);
        background: rgba(255, 250, 242, 0.74);
        line-height: 1.6;
      }

      .future-note {
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: var(--radius-md);
        background: rgba(49, 95, 131, 0.08);
        color: var(--blue);
        line-height: 1.6;
      }

      @media (max-width: 1180px) {
        .shell {
          grid-template-columns: 1fr;
          padding: 18px 18px 34px;
        }
        .sidebar {
          position: static;
        }
      }

      @media (max-width: 900px) {
        .topbar { padding: 20px; }
        .topbar-main { display: grid; }
        .topbar-copy h2 { font-size: 28px; }
        .secondary-button { width: 100%; }
        .brand h1 { font-size: 22px; }
      }
`;
const BODY = `
    <div class="shell">
      <aside class="sidebar">
        <section class="brand">
          <h1>上下文工作台</h1>
        </section>

        <section class="sidebar-panel">
          <div class="section-head">
            <h2>当前主线</h2>
          </div>
          <div class="nav-list">
            <button type="button" class="nav-button" data-nav="live">
              <div class="nav-label">
                <strong>运行态</strong>
              </div>
            </button>
            <button type="button" class="nav-button" data-nav="context">
              <div class="nav-label">
                <strong>上下文</strong>
              </div>
            </button>
            <button type="button" class="nav-button" data-nav="prompt">
              <div class="nav-label">
                <strong>模型输入</strong>
              </div>
            </button>
          </div>
          <div class="sidebar-subsection">
            <div class="sidebar-subsection-head">
              <h3>当前会话</h3>
            </div>
            <p class="sidebar-hint">待完善：当前只展示摘要，跳转和完整会话页后续补上。</p>
            <div id="currentSessionPanel"></div>
          </div>
        </section>

        <section class="sidebar-panel">
          <div class="section-head">
            <h2>预留扩展</h2>
          </div>
          <div class="future-list">
            <div class="future-button">
              <div class="nav-label">
                <strong>时间线</strong>
                <span>即将接入</span>
              </div>
            </div>
            <div class="future-button">
              <div class="nav-label">
                <strong>图谱</strong>
                <span>即将接入</span>
              </div>
            </div>
          </div>
        </section>

      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="topbar-main">
            <div class="topbar-copy">
              <h2 id="topbarTitle">正在加载运行态工作台</h2>
              <p id="topbarSubtitle"></p>
            </div>
            <button id="reloadPrimaryButton" type="button" class="secondary-button">刷新数据</button>
          </div>
          <div id="topbarMeta" class="topbar-meta"></div>
        </header>

        <div id="statusBanner" class="status-banner info">加载中</div>

        <div class="views">
          <section class="view is-active" data-view="live">
            <div id="livePage"></div>
          </section>
          <section class="view" data-view="context">
            <div id="contextPage"></div>
          </section>
          <section class="view" data-view="prompt">
            <div id="promptPage"></div>
          </section>
        </div>
      </main>
    </div>
`;
const SCRIPT = `
      (function () {
        const VALID_VIEWS = ['live', 'context', 'prompt'];

        const state = {
          view: parseInitialView(),
          snapshots: [],
          inspection: null,
          dashboard: null,
          events: [],
          sessionId: parseInitialSessionId(),
          loading: false,
          statusTone: 'info',
          statusMessage: '加载中'
        };

        document.addEventListener('DOMContentLoaded', function () {
          bindStaticEvents();
          loadWorkbench();
        });

        function bindStaticEvents() {
          document.querySelectorAll('[data-nav]').forEach(function (button) {
            button.addEventListener('click', function () {
              const nextView = button.getAttribute('data-nav') || 'live';
              state.view = VALID_VIEWS.includes(nextView) ? nextView : 'live';
              persistLocationState();
              render();
            });
          });

          const reloadPrimaryButton = byId('reloadPrimaryButton');
          if (reloadPrimaryButton) {
            reloadPrimaryButton.addEventListener('click', function () {
              loadWorkbench();
            });
          }

          window.addEventListener('hashchange', function () {
            state.view = parseInitialView();
            render();
          });
        }

        async function loadWorkbench() {
          state.loading = true;
          state.statusTone = 'info';
          state.statusMessage = '加载中';
          render();

          try {
            const listPromise = fetchJson('/api/runtime/snapshots');
            const dashboardPromise = fetchJson('/api/observability/dashboard?limit=6').catch(function () {
              return { payload: null };
            });
            const eventPromise = fetchJson('/api/platform/events?limit=12').catch(function () {
              return { payload: [] };
            });

            const listResponse = await listPromise;
            const dashboardResponse = await dashboardPromise;
            const eventResponse = await eventPromise;

            state.snapshots = sortSnapshots(normalizeArray(listResponse.payloads));
            state.dashboard = dashboardResponse.payload || null;
            state.events = normalizeArray(eventResponse.payload);

            if (!state.sessionId || !state.snapshots.some(function (item) { return item && item.sessionId === state.sessionId; })) {
              state.sessionId = state.snapshots[0] && typeof state.snapshots[0].sessionId === 'string'
                ? state.snapshots[0].sessionId
                : '';
            }

            if (state.sessionId) {
              await loadInspection(state.sessionId, false);
              return;
            }

            state.loading = false;
            state.inspection = null;
            state.statusTone = 'warning';
            state.statusMessage = '';
            render();
          } catch (error) {
            state.loading = false;
            state.statusTone = 'danger';
            state.statusMessage = '加载调试台失败：' + readErrorMessage(error);
            render();
          }
        }

        async function loadInspection(sessionId, preserveStatus) {
          state.loading = true;
          render();

          try {
            const response = await fetchJson('/api/runtime/snapshots?sessionId=' + encodeURIComponent(sessionId));
            state.inspection = response.payload || null;
            state.sessionId = sessionId;
            state.loading = false;
            state.statusTone = 'success';
            state.statusMessage = preserveStatus
              ? state.statusMessage
              : '';
            persistLocationState();
            render();
          } catch (error) {
            state.loading = false;
            state.statusTone = 'danger';
            state.statusMessage = '读取会话 ' + sessionId + ' 失败：' + readErrorMessage(error);
            render();
          }
        }

        function persistLocationState() {
          const url = new URL(window.location.href);
          if (state.sessionId) {
            url.searchParams.set('sessionId', state.sessionId);
          } else {
            url.searchParams.delete('sessionId');
          }
          url.hash = state.view;
          window.history.replaceState({}, '', url.toString());
        }

        function render() {
          renderNavigation();
          renderViews();
          renderStatusBanner();
          renderTopbar();
          renderCurrentSessionPanel();
          renderLivePage();
          renderContextPage();
          renderPromptPage();
        }

        function renderNavigation() {
          document.querySelectorAll('[data-nav]').forEach(function (button) {
            const isActive = button.getAttribute('data-nav') === state.view;
            button.classList.toggle('is-active', Boolean(isActive));
          });
        }

        function renderViews() {
          document.querySelectorAll('.view').forEach(function (section) {
            const isActive = section.getAttribute('data-view') === state.view;
            section.classList.toggle('is-active', Boolean(isActive));
          });
        }

        function renderStatusBanner() {
          const banner = byId('statusBanner');
          if (!banner) {
            return;
          }

          if (!state.statusMessage) {
            banner.style.display = 'none';
            banner.textContent = '';
            return;
          }

          banner.style.display = '';
          banner.className = 'status-banner ' + (state.statusTone || 'info');
          banner.textContent = state.statusMessage || '';
        }

        function renderTopbar() {
          const title = byId('topbarTitle');
          const subtitle = byId('topbarSubtitle');
          const meta = byId('topbarMeta');
          const inspection = state.inspection;

          if (!title || !subtitle || !meta) {
            return;
          }

          if (!inspection) {
            title.textContent = '待接入数据';
            subtitle.textContent = '';
            meta.innerHTML = [
              renderMetaChip('视图', mapViewLabel(state.view)),
              renderMetaChip('快照数', String(state.snapshots.length)),
              renderMetaChip('事件数', String(state.events.length)),
              renderMetaChip('状态', state.loading ? '加载中' : '待接入数据')
            ].join('');
            return;
          }

          const action = deriveCurrentAction(inspection);
          const occupancy = formatRatio(computeOccupancy(inspection));

          title.textContent = '会话 ' + truncateMiddle(String(inspection.sessionId || '未知会话'), 40);
          subtitle.textContent = action.label;
          meta.innerHTML = [
            renderMetaChip('视图', mapViewLabel(state.view)),
            renderMetaChip('来源', mapSourceLabel(inspection.source || 'unknown')),
            renderMetaChip('压缩态', mapCompressionModeLabel(resolveCompressionMode(inspection))),
            renderMetaChip('占比', occupancy),
            renderMetaChip('捕获时间', inspection.capturedAt ? formatTimestamp(inspection.capturedAt) : '暂无')
          ].join('');
        }

        function renderCurrentSessionPanel() {
          const container = byId('currentSessionPanel');
          const inspection = state.inspection;
          if (!container) {
            return;
          }

          if (!inspection) {
            container.innerHTML = renderEmptyState('暂无当前会话', '');
            return;
          }

          const relatedEvents = normalizeArray(state.events)
            .filter(function (event) {
              return Boolean(event && event.sessionId && String(event.sessionId) === String(inspection.sessionId));
            })
            .slice(0, 3);

          container.innerHTML = [
            '<div class="session-activity-list">',
            renderCurrentSessionSummary(inspection),
            relatedEvents.map(function (event) {
              return renderCurrentSessionEventItem(event);
            }).join(''),
            '</div>'
          ].join('');
        }

        function renderCurrentSessionSummary(inspection) {
          const query = typeof inspection.query === 'string' ? inspection.query.trim() : '';
          const mode = resolveCompressionMode(inspection);
          const finalCount = inspection.counts && typeof inspection.counts.final === 'number'
            ? inspection.counts.final
            : normalizeArray(inspection.finalMessages).length;

          return [
            '<article class="session-activity-item">',
            '<div class="session-activity-head">',
            '<span class="session-activity-tag success">当前会话</span>',
            '<span class="session-activity-time">', escapeHtml(formatRelativeTimestamp(inspection.capturedAt)), '</span>',
            '</div>',
            '<h3 class="mono">', escapeHtml(truncateMiddle(String(inspection.sessionId || '未知会话'), 26)), '</h3>',
            '<p>', escapeHtml(query || '当前没有查询文本。'), '</p>',
            '<div class="item-row" style="margin-top:12px;">',
            '<span class="pill muted">', escapeHtml(mapSourceLabel(inspection.source || 'unknown')), '</span>',
            '<span class="pill info">', escapeHtml(mapCompressionModeLabel(mode)), '</span>',
            '<span class="pill muted">最终窗口 ', escapeHtml(String(finalCount)), ' 条</span>',
            '</div>',
            '</article>'
          ].join('');
        }

        function renderCurrentSessionEventItem(event) {
          const resource = event && event.resourceId ? String(event.resourceId) : '';
          const stage = event && event.stage ? String(event.stage) : '';
          return [
            '<article class="session-activity-item">',
            '<div class="session-activity-head">',
            '<span class="session-activity-tag info">平台事件</span>',
            '<span class="session-activity-time">', escapeHtml(formatRelativeTimestamp(event && event.createdAt)), '</span>',
            '</div>',
            '<h3>', escapeHtml(event && event.type ? formatEventTypeLabel(String(event.type)) : '未知事件'), '</h3>',
            '<p>', escapeHtml(resource || '当前没有资源标识。'), '</p>',
            '<div class="item-row" style="margin-top:12px;">',
            stage ? '<span class="pill muted">' + escapeHtml(stage) + '</span>' : '',
            resource ? '<span class="pill muted mono">' + escapeHtml(truncateMiddle(resource, 22)) + '</span>' : '',
            '</div>',
            '</article>'
          ].join('');
        }

        function renderLivePage() {
          const container = byId('livePage');
          if (!container) {
            return;
          }

          const inspection = state.inspection;
          const dashboard = state.dashboard && state.dashboard.dashboard ? state.dashboard.dashboard : null;
          const metricCards = dashboard && Array.isArray(dashboard.metricCards) ? dashboard.metricCards : [];
          const alerts = dashboard && Array.isArray(dashboard.alerts) ? dashboard.alerts : [];
          const action = inspection ? deriveCurrentAction(inspection) : { label: '等待运行', detail: '当前还没有可用快照。' };

          if (!inspection) {
            container.innerHTML = [
              '<section class="panel">',
              renderPanelHead('运行态', ''),
              '<div class="landing-stack">',
              renderEmptyState('无运行快照', ''),
              '<div class="status-strip">',
              renderValueCard('快照数', String(state.snapshots.length), ''),
              renderValueCard('平台事件', String(state.events.length), ''),
              renderValueCard('观测卡片', metricCards.length ? String(metricCards.length) + ' 张' : '待返回', ''),
              '</div>',
              '</div>',
              '</section>'
            ].join('');
            return;
          }

          container.innerHTML = [
            '<section class="panel">',
            renderPanelHead('运行态', ''),
            '<div class="card-grid">',
            renderValueCard('当前会话', inspection ? String(inspection.sessionId || '未知会话') : 'n/a', ''),
            renderValueCard('当前动作', action.label, ''),
            renderValueCard('读取来源', inspection ? mapSourceLabel(inspection.source || 'unknown') : 'n/a', ''),
            renderValueCard('上下文占比', inspection ? formatRatio(computeOccupancy(inspection)) : 'n/a', ''),
            '</div>',
            '</section>',
            '<section class="split-grid">',
            '<div class="panel">',
            renderPanelHead('最近平台事件', ''),
            renderEventList(state.events),
            '</div>',
            '<div class="panel">',
            renderPanelHead('观测指标与告警', ''),
            renderObservabilityBlock(metricCards, alerts),
            '</div>',
            '</section>'
          ].join('');
        }

        function renderContextPage() {
          const container = byId('contextPage');
          const inspection = state.inspection;

          if (!container) {
            return;
          }

          if (!inspection) {
            container.innerHTML = [
              '<section class="panel">',
              renderPanelHead('上下文', ''),
              renderEmptyState('无运行快照', ''),
              '</section>'
            ].join('');
            return;
          }

          const promptSnapshot = inspection.promptAssemblySnapshot || {};
          const messageSummary = normalizeArray(promptSnapshot.messageSummary);
          const rawVisible = messageSummary.filter(function (item) {
            return !(item && item.toolResultCompression && item.toolResultCompression.compressed);
          });
          const compressedVisible = messageSummary.filter(function (item) {
            return Boolean(item && item.toolResultCompression && item.toolResultCompression.compressed);
          });
          const derivedCount = promptSnapshot.systemPromptAddition ? 1 : 0;
          const diagnostics = resolveDiagnostics(inspection);
          const compaction = inspection.compaction || null;
          const compressionPolicy = resolveCompressionPolicy(inspection);
          const baselineIds = compaction && Array.isArray(compaction.baselineIds) ? compaction.baselineIds : [];
          const incrementalActive = resolveCompressionMode(inspection) === 'incremental';
          const incrementalNote = diagnostics && typeof diagnostics.incrementalTokenEstimate === 'number'
            ? '估算令牌数约为 ' + diagnostics.incrementalTokenEstimate
            : '当前还没有返回中间层块标识；第一版先展示状态和令牌估算。';

          container.innerHTML = [
            '<section class="panel">',
            renderPanelHead('窗口对比', ''),
            '<div class="compare-grid">',
            renderCompareCard('入口窗口', inspection.counts ? inspection.counts.inbound : 0, inspection.inboundSummary),
            renderCompareCard('优选窗口', inspection.counts ? inspection.counts.preferred : 0, inspection.preferredSummary),
            renderCompareCard('最终窗口', inspection.counts ? inspection.counts.final : 0, inspection.finalSummary),
            '</div>',
            '</section>',
            '<section class="split-grid">',
            '<div class="panel">',
            renderPanelHead('原始 / 压缩 / 派生', ''),
            '<div class="card-grid">',
            renderValueCard('原始条目', String(rawVisible.length), ''),
            renderValueCard('压缩条目', String(compressedVisible.length), ''),
            renderValueCard('派生块', String(derivedCount), ''),
            renderValueCard('配对数', String(normalizeArray(promptSnapshot.toolCallResultPairs).length), ''),
            '</div>',
            '<div style="margin-top:16px;">',
            promptSnapshot.systemPromptAddition
              ? renderNoteCard('派生块', truncateText(String(promptSnapshot.systemPromptAddition), 220))
              : renderEmptyState('无派生块', ''),
            '</div>',
            '</div>',
            '<div class="panel">',
            renderPanelHead('压缩结构', ''),
            '<div class="subtle-grid">',
            renderNoteCard('最近两轮', compaction
              ? '保留轮次数：' + String(compaction.retainedRawTurnCount) + '。' + (compaction.retainedRawTurns.length
                ? ' 轮次 ID：' + compaction.retainedRawTurns.map(function (turn) { return turn.turnId; }).join(', ')
                : ' 当前没有保留轮次详情。')
              : '当前还没有压缩视图；旧快照会退化为只看诊断信息。'),
            renderNoteCard('当前策略', compressionPolicy
              ? formatCompressionPolicy(compressionPolicy)
              : '当前快照还没有记录压缩策略参数。'),
            renderNoteCard('中间层', incrementalActive ? '当前存在活跃中间层压缩块。' + incrementalNote : '当前没有活跃中间层压缩块。' + incrementalNote),
            renderNoteCard('历史摘要层', baselineIds.length
              ? '历史摘要数：' + String(baselineIds.length) + '。当前列表：' + baselineIds.join(', ')
              : '当前没有历史摘要列表，或尚未进入全量压缩。'),
            '</div>',
            diagnostics ? renderDiagnosticsSection(diagnostics) : renderEmptyState('没有压缩诊断', '当前会话还没有记录结构化压缩诊断。'),
            '</div>',
            '</section>'
          ].join('');
        }

        function renderPromptPage() {
          const container = byId('promptPage');
          const inspection = state.inspection;

          if (!container) {
            return;
          }

          if (!inspection) {
            container.innerHTML = [
              '<section class="panel">',
              renderPanelHead('模型输入', ''),
              '<div class="landing-stack">',
              renderEmptyState('无运行快照', ''),
              '<div class="status-strip">',
              renderValueCard('消息数', 'n/a', ''),
              renderValueCard('系统补充块', 'n/a', ''),
              renderValueCard('旁路引用', 'n/a', ''),
              '</div>',
              '</div>',
              '</section>'
            ].join('');
            return;
          }

          const promptSnapshot = inspection.promptAssemblySnapshot || {};
          const sidecarReferences = normalizeArray(promptSnapshot.sidecarReferences);
          const messageSummary = normalizeArray(promptSnapshot.messageSummary);
          const inlineCompressed = messageSummary.filter(function (item) {
            return Boolean(item && item.toolResultCompression && item.toolResultCompression.compressed && !item.toolResultCompression.artifactPath);
          });
          const payloadView = {
            messages: promptSnapshot.messages || [],
            systemPromptAddition: promptSnapshot.systemPromptAddition,
            estimatedTokens: promptSnapshot.estimatedTokens
          };

          container.innerHTML = [
            '<section class="panel">',
            renderPanelHead('模型输入内容', ''),
            '<div class="card-grid">',
            renderValueCard('最终消息数', String(normalizeArray(promptSnapshot.messages).length), ''),
            renderValueCard('估算令牌数', typeof promptSnapshot.estimatedTokens === 'number' ? String(promptSnapshot.estimatedTokens) : 'n/a', ''),
            renderValueCard('旁路引用数', String(sidecarReferences.length), ''),
            renderValueCard('工具配对', String(normalizeArray(promptSnapshot.toolCallResultPairs).length), ''),
            '</div>',
            '</section>',
            '<section class="split-grid">',
            '<div class="panel">',
            renderPanelHead('系统补充块', ''),
            promptSnapshot.systemPromptAddition
              ? renderPayloadBox(String(promptSnapshot.systemPromptAddition))
              : renderEmptyState('无系统补充块', ''),
            '<div style="margin-top:16px;">',
            renderContractChips(inspection.promptAssembly),
            '</div>',
            '</div>',
            '<div class="panel">',
            renderPanelHead('旁路引用与可见内容', ''),
            '<div class="subtle-grid">',
            renderPromptReferenceCard('真实旁路引用', sidecarReferences.map(function (item) {
              return (item.toolName ? '【' + item.toolName + '】' : '') + item.summary + (item.artifactPath ? ' 原文路径：' + item.artifactPath : '');
            }), '当前没有真实旁路引用。'),
            renderPromptReferenceCard('仅输入层可见压缩', inlineCompressed.map(function (item) {
              const compression = item.toolResultCompression;
              return compression ? compression.summary : item.preview;
            }), '当前没有仅内联压缩的工具结果。'),
            '</div>',
            '</div>',
            '</section>',
            '<section class="panel">',
            renderPanelHead('输入消息摘要', ''),
            renderMessageSummaryList(messageSummary, 12),
            '</section>',
            '<section class="split-grid">',
            '<div class="panel">',
            renderPanelHead('统一输入内容（JSON）', ''),
            renderPayloadBox(safeJson(payloadView)),
            '</div>',
            '<div class="panel">',
            renderPanelHead('工具调用 / 结果配对', ''),
            renderPairList(normalizeArray(promptSnapshot.toolCallResultPairs)),
            '</div>',
            '</section>'
          ].join('');
        }

        function renderPanelHead(title, description) {
          return [
            '<div class="panel-head">',
            '<div>',
            '<h3>', escapeHtml(title), '</h3>',
            description ? '<p>' + escapeHtml(description) + '</p>' : '',
            '</div>',
            state.loading ? '<span class="pill info">加载中</span>' : '',
            '</div>'
          ].join('');
        }

        function renderValueCard(label, value, note) {
          const displayValue = formatDisplayValue(value);
          return [
            '<article class="card">',
            '<strong>', escapeHtml(label), '</strong>',
            '<div class="card-value', String(displayValue).length > 26 ? ' mono' : '', '">', escapeHtml(truncateMiddle(String(displayValue), 36)), '</div>',
            note ? '<div class="card-note">' + escapeHtml(note) + '</div>' : '',
            '</article>'
          ].join('');
        }

        function renderNoteCard(label, note) {
          return [
            '<article class="note-card">',
            '<strong>', escapeHtml(label), '</strong>',
            '<div class="card-note">', escapeHtml(note), '</div>',
            '</article>'
          ].join('');
        }

        function renderStepCard(step, title, description, chips) {
          const items = normalizeArray(chips);
          return [
            '<article class="step-card">',
            '<strong>', escapeHtml(step), '</strong>',
            '<h4>', escapeHtml(title), '</h4>',
            '<p>', escapeHtml(description), '</p>',
            items.length
              ? '<div class="item-row">' + items.map(function (item) {
                  return '<span class="pill muted">' + escapeHtml(String(item)) + '</span>';
                }).join('') + '</div>'
              : '',
            '</article>'
          ].join('');
        }

        function renderCompareCard(title, count, summary) {
          return [
            '<article class="compare-card">',
            '<div class="compare-head">',
            '<div>',
            '<h4>', escapeHtml(title), '</h4>',
            '</div>',
            '<span class="pill info">', escapeHtml(String(count)), ' 条</span>',
            '</div>',
            renderMessageSummaryList(summary, 4),
            '</article>'
          ].join('');
        }

        function renderMessageSummaryList(summary, limit) {
          const items = normalizeArray(summary).slice(0, typeof limit === 'number' ? limit : 6);
          if (!items.length) {
            return renderEmptyState('没有消息摘要', '当前层没有可展示的消息摘要。');
          }

          return [
            '<div class="stack-list">',
            items.map(function (item) { return renderMessageSummaryItem(item); }).join(''),
            '</div>'
          ].join('');
        }

        function renderMessageSummaryItem(item) {
          const contentTypes = normalizeArray(item && item.contentTypes);
          const compression = item && item.toolResultCompression ? item.toolResultCompression : null;
          return [
            '<article class="stack-item">',
            '<div class="stack-head">',
            '<div>',
            '<h4>', escapeHtml(resolveSummaryTitle(item)), '</h4>',
            '<p class="list-item-note mono">', escapeHtml(item && item.id ? truncateMiddle(String(item.id), 28) : '没有消息标识'), '</p>',
            '</div>',
            '<div class="item-row">',
            '<span class="pill muted">', escapeHtml(mapRoleLabel(item && item.role ? String(item.role) : 'unknown')), '</span>',
            contentTypes.length ? '<span class="pill info">' + escapeHtml(contentTypes.map(mapContentTypeLabel).join('、')) + '</span>' : '',
            compression ? '<span class="pill warning">已压缩</span>' : '',
            '</div>',
            '</div>',
            '<div class="stack-body">',
            '<p>', escapeHtml(item && item.preview ? String(item.preview) : '当前没有预览内容'), '</p>',
            compression ? renderCompressionSummary(compression) : '',
            '</div>',
            '</article>'
          ].join('');
        }

        function renderCompressionSummary(compression) {
          const droppedSections = normalizeArray(compression && compression.droppedSections);
          return [
            '<div class="item-row">',
            '<span class="pill warning">', escapeHtml(compression && compression.summary ? String(compression.summary) : '已压缩'), '</span>',
            compression && compression.artifactPath ? '<span class="pill success mono">' + escapeHtml(String(compression.artifactPath)) + '</span>' : '<span class="pill muted">没有真实旁路原文</span>',
            droppedSections.length ? '<span class="pill muted">省略段：' + escapeHtml(droppedSections.join('、')) + '</span>' : '',
            '</div>'
          ].join('');
        }

        function renderEventList(events) {
          const items = normalizeArray(events);
          if (!items.length) {
            return renderEmptyState('还没有平台事件', '当前工作台会先展示平台事件；后续会被更细的运行时间线替换。');
          }

          return [
            '<div class="event-list">',
            items.map(function (event) {
              return [
                '<article class="event-item">',
                '<div class="event-head">',
                '<div>',
                '<h4>', escapeHtml(event && event.type ? formatEventTypeLabel(String(event.type)) : '未知事件'), '</h4>',
                '<p>', escapeHtml(event && event.createdAt ? formatTimestamp(String(event.createdAt)) : '暂无时间'), '</p>',
                '</div>',
                '<div class="event-meta">',
                event && event.stage ? '<span class="pill info">' + escapeHtml(String(event.stage)) + '</span>' : '',
                event && event.workspaceId ? '<span class="pill muted">工作区：' + escapeHtml(String(event.workspaceId)) + '</span>' : '',
                '</div>',
                '</div>',
                '<div class="event-body">',
                '<p class="mono">', escapeHtml(event && event.resourceId ? String(event.resourceId) : '没有资源标识'), '</p>',
                event && event.sessionId ? '<p>会话：<span class="mono">' + escapeHtml(String(event.sessionId)) + '</span></p>' : '',
                '</div>',
                '</article>'
              ].join('');
            }).join(''),
            '</div>'
          ].join('');
        }

        function renderObservabilityBlock(metricCards, alerts) {
          const metrics = normalizeArray(metricCards);
          const alertItems = normalizeArray(alerts);

          return [
            metrics.length
              ? '<div class="card-grid">' + metrics.map(function (metric) { return renderMetricCard(metric); }).join('') + '</div>'
              : renderEmptyState('没有观测卡片', '当前观测面还没有返回观测卡片。'),
            '<div style="margin-top:16px;"></div>',
            alertItems.length
              ? '<div class="alert-list">' + alertItems.map(function (alert) { return renderAlertItem(alert); }).join('') + '</div>'
              : renderEmptyState('当前没有告警', '如果实时运行占比、兜底占比或其他阈值越界，这里会出现结构化告警。')
          ].join('');
        }

        function renderMetricCard(metric) {
          const status = String(metric && metric.status ? metric.status : 'unknown');
          return [
            '<article class="card">',
            '<strong>', escapeHtml(metric && metric.label ? String(metric.label) : '观测项'), '</strong>',
            '<div class="card-value">', escapeHtml(formatMetricValue(metric)), '</div>',
            '<div class="item-row" style="margin-top:10px;">',
            '<span class="pill ', mapStatusClass(status), '">', escapeHtml(mapMetricStatusLabel(status)), '</span>',
            metric && metric.source ? '<span class="pill muted">' + escapeHtml(String(metric.source)) + '</span>' : '',
            metric && metric.threshold ? '<span class="pill muted">' + escapeHtml(formatThreshold(metric.threshold)) + '</span>' : '',
            '</div>',
            '</article>'
          ].join('');
        }

        function renderAlertItem(alert) {
          return [
            '<article class="alert-item">',
            '<div class="alert-head">',
            '<div>',
            '<h4>', escapeHtml(String(alert && alert.key ? alert.key : '告警')), '</h4>',
            '<p>', escapeHtml(alert && alert.message ? String(alert.message) : '没有告警说明'), '</p>',
            '</div>',
            '<span class="pill ', alert && alert.severity === 'critical' ? 'danger' : 'warning', '">',
            escapeHtml(mapSeverityLabel(String(alert && alert.severity ? alert.severity : 'warning'))),
            '</span>',
            '</div>',
            '<div class="item-row">',
            '<span class="pill muted">当前值：', escapeHtml(String(alert && typeof alert.currentValue === 'number' ? alert.currentValue : '暂无')), '</span>',
            alert && alert.threshold ? '<span class="pill muted">' + escapeHtml(formatThreshold(alert.threshold)) + '</span>' : '',
            '</div>',
            '</article>'
          ].join('');
        }

        function renderDiagnosticsSection(diagnostics) {
          const items = [];

          if (diagnostics.trigger) { items.push('触发原因：' + mapDiagnosticTriggerLabel(diagnostics.trigger)); }
          if (typeof diagnostics.occupancyRatioBefore === 'number' || typeof diagnostics.occupancyRatioAfter === 'number') {
            items.push('上下文占比：' + formatRatio(diagnostics.occupancyRatioBefore) + ' -> ' + formatRatio(diagnostics.occupancyRatioAfter));
          }
          if (diagnostics.sealedIncrementalId) { items.push('封存中间层：' + diagnostics.sealedIncrementalId); }
          if (diagnostics.appendedBaselineId) { items.push('新增历史摘要：' + diagnostics.appendedBaselineId); }
          if (Array.isArray(diagnostics.mergedBaselineIds) && diagnostics.mergedBaselineIds.length) {
            items.push('合并来源：' + diagnostics.mergedBaselineIds.join(', '));
          }
          if (diagnostics.mergedBaselineResultId) { items.push('合并结果：' + diagnostics.mergedBaselineResultId); }
          if (diagnostics.rollback) { items.push('发生回滚：是'); }
          if (diagnostics.evictedBaselineId) { items.push('淘汰历史摘要：' + diagnostics.evictedBaselineId); }
          if (typeof diagnostics.rawTailTokenEstimate === 'number') { items.push('最近两轮估算：' + diagnostics.rawTailTokenEstimate); }
          if (typeof diagnostics.incrementalTokenEstimate === 'number') { items.push('中间层估算：' + diagnostics.incrementalTokenEstimate); }
          if (typeof diagnostics.baselineTokenEstimate === 'number') { items.push('历史层估算：' + diagnostics.baselineTokenEstimate); }
          if (typeof diagnostics.baselineCount === 'number') { items.push('历史摘要数：' + diagnostics.baselineCount); }
          if (typeof diagnostics.sidecarReferenceCount === 'number') { items.push('旁路引用数：' + diagnostics.sidecarReferenceCount); }
          if (diagnostics.fallbackLevel) { items.push('兜底级别：' + mapFallbackLevelLabel(diagnostics.fallbackLevel)); }

          if (!items.length) {
            return renderEmptyState('没有诊断字段', '当前会话虽然有压缩态，但还没有诊断明细。');
          }

          return [
            '<div style="margin-top:16px;">',
            '<div class="section-head" style="margin-bottom:10px;"><h2>压缩诊断</h2></div>',
            '<ul class="diagnostic-list">',
            items.map(function (line) {
              return '<li><code>' + escapeHtml(line) + '</code></li>';
            }).join(''),
            '</ul>',
            '</div>'
          ].join('');
        }

        function renderPayloadBox(value) {
          return '<div class="payload-box"><pre>' + escapeHtml(value) + '</pre></div>';
        }

        function renderContractChips(contract) {
          if (!contract) {
            return renderEmptyState('没有输入装配合同', '当前检查结果没有返回统一输入合同。');
          }

          const providerOutputs = normalizeArray(contract.providerNeutralOutputs);
          const responsibilities = normalizeArray(contract.hostAssemblyResponsibilities);

          return [
            '<div class="chip-list">',
            '<div class="item-row">',
            '<span class="pill muted">版本：', escapeHtml(String(contract.version || '暂无')), '</span>',
            '<span class="pill info">最终消息数：', escapeHtml(String(contract.finalMessageCount || 0)), '</span>',
            '<span class="pill ', contract.includesSystemPromptAddition ? 'success' : 'muted', '">',
            contract.includesSystemPromptAddition ? '包含系统补充块' : '没有系统补充块',
            '</span>',
            '</div>',
            providerOutputs.length
              ? '<div class="item-row">' + providerOutputs.map(function (item) {
                  return '<span class="pill info">' + escapeHtml(String(item)) + '</span>';
                }).join('') + '</div>'
              : '',
            responsibilities.length
              ? '<div class="item-row">' + responsibilities.map(function (item) {
                  return '<span class="pill muted">' + escapeHtml(String(item)) + '</span>';
                }).join('') + '</div>'
              : '',
            '</div>'
          ].join('');
        }

        function renderPromptReferenceCard(title, lines, emptyText) {
          const items = normalizeArray(lines);
          return [
            '<article class="note-card">',
            '<strong>', escapeHtml(title), '</strong>',
            items.length
              ? '<div class="stack-list" style="margin-top:10px;">' + items.map(function (line) {
                  return '<div class="stack-item"><p>' + escapeHtml(String(line)) + '</p></div>';
                }).join('') + '</div>'
              : '<div class="card-note" style="margin-top:10px;">' + escapeHtml(emptyText) + '</div>',
            '</article>'
          ].join('');
        }

        function renderPairList(pairs) {
          const items = normalizeArray(pairs);
          if (!items.length) {
            return renderEmptyState('没有配对信息', '当前输入快照没有工具调用与结果配对。');
          }

          return [
            '<div class="pair-list">',
            items.map(function (pair) {
              return [
                '<article class="stack-item">',
                '<div class="stack-head">',
                '<div>',
                '<h4>', escapeHtml(String(pair && pair.toolName ? pair.toolName : '未知工具')), '</h4>',
                '<p class="list-item-note mono">', escapeHtml(pair && pair.toolCallId ? String(pair.toolCallId) : '没有工具调用标识'), '</p>',
                '</div>',
                '<span class="pill ', pair && pair.matchKind === 'tool_call_id' ? 'success' : 'warning', '">',
                escapeHtml(mapMatchKindLabel(String(pair && pair.matchKind ? pair.matchKind : 'unknown'))),
                '</span>',
                '</div>',
                '<div class="item-row">',
                pair && pair.assistantMessageId ? '<span class="pill muted">助手消息：' + escapeHtml(String(pair.assistantMessageId)) + '</span>' : '',
                pair && pair.resultMessageId ? '<span class="pill muted">结果消息：' + escapeHtml(String(pair.resultMessageId)) + '</span>' : '',
                '</div>',
                '</article>'
              ].join('');
            }).join(''),
            '</div>'
          ].join('');
        }

        function renderMetaChip(label, value) {
          const displayValue = formatDisplayValue(value);
          return [
            '<span class="meta-chip">',
            '<strong>', escapeHtml(label), '</strong>',
            '<span class="mono">', escapeHtml(String(displayValue)), '</span>',
            '</span>'
          ].join('');
        }

        function renderEmptyState(title, body) {
          return [
            '<div class="empty-state">',
            '<strong>', escapeHtml(title), '</strong>',
            body ? '<p>' + escapeHtml(body) + '</p>' : '',
            '</div>'
          ].join('');
        }

        function computeOccupancy(inspection) {
          if (!inspection || typeof inspection.totalBudget !== 'number' || inspection.totalBudget <= 0) {
            return undefined;
          }

          const estimatedTokens = typeof inspection.estimatedTokens === 'number'
            ? inspection.estimatedTokens
            : inspection.promptAssembly && typeof inspection.promptAssembly.estimatedTokens === 'number'
              ? inspection.promptAssembly.estimatedTokens
              : inspection.promptAssemblySnapshot && typeof inspection.promptAssemblySnapshot.estimatedTokens === 'number'
                ? inspection.promptAssemblySnapshot.estimatedTokens
                : undefined;

          if (typeof estimatedTokens !== 'number') {
            return undefined;
          }

          return estimatedTokens / inspection.totalBudget;
        }

        function deriveCurrentAction(inspection) {
          const diagnostics = resolveDiagnostics(inspection);
          const mode = resolveCompressionMode(inspection);

          if (diagnostics && diagnostics.fallbackLevel === 'live_recent_messages') {
            return { label: '实时兜底', detail: '本轮组装退回最近消息，避免带着坏上下文继续送给模型。' };
          }
          if (inspection && inspection.source === 'transcript_fallback') {
            return { label: '转录回放', detail: '当前运行态窗口来自转录兜底，而不是实时运行快照。' };
          }
          if (mode === 'full') {
            return { label: '全量压缩完成', detail: '历史摘要层已整理完成，可以直接检查合并、淘汰和诊断结果。' };
          }
          if (mode === 'incremental') {
            return { label: '增量压缩完成', detail: '当前保留最近两轮，并挂接 1 块中间层压缩内容。' };
          }
          return { label: '输入就绪', detail: '当前窗口未进入重压缩态，统一输入内容已可直接查看。' };
        }

        function mapViewLabel(view) {
          if (view === 'live') { return '运行态'; }
          if (view === 'context') { return '上下文'; }
          if (view === 'prompt') { return '模型输入'; }
          return String(view || 'unknown');
        }

        function mapSourceLabel(source) {
          if (source === 'live_runtime') { return '实时运行态'; }
          if (source === 'persisted_snapshot') { return '持久化快照'; }
          if (source === 'transcript_fallback') { return '转录兜底'; }
          return formatDisplayValue(source);
        }

        function mapCompressionModeLabel(mode) {
          if (mode === 'none') { return '未压缩'; }
          if (mode === 'incremental') { return '增量压缩'; }
          if (mode === 'full') { return '全量压缩'; }
          return formatDisplayValue(mode);
        }

        function formatDisplayValue(value) {
          if (value === 'n/a') { return '暂无'; }
          if (value === 'unknown') { return '未知'; }
          return value;
        }

        function mapRoleLabel(role) {
          if (role === 'user') { return '用户'; }
          if (role === 'assistant') { return '助手'; }
          if (role === 'system') { return '系统'; }
          if (role === 'tool') { return '工具'; }
          if (role === 'message') { return '消息'; }
          return formatDisplayValue(role);
        }

        function mapContentTypeLabel(type) {
          if (type === 'text') { return '文本'; }
          if (type === 'tool_call') { return '工具调用'; }
          if (type === 'tool_result') { return '工具结果'; }
          if (type === 'image') { return '图片'; }
          if (type === 'input_text') { return '输入文本'; }
          if (type === 'output_text') { return '输出文本'; }
          return formatDisplayValue(type);
        }

        function mapMatchKindLabel(kind) {
          if (kind === 'tool_call_id') { return '按调用标识匹配'; }
          if (kind === 'sequence_fallback') { return '按顺序回退匹配'; }
          if (kind === 'unknown') { return '未知'; }
          return formatDisplayValue(kind);
        }

        function mapMetricStatusLabel(status) {
          if (status === 'healthy') { return '正常'; }
          if (status === 'warning') { return '注意'; }
          if (status === 'critical') { return '严重'; }
          return formatDisplayValue(status);
        }

        function mapSeverityLabel(severity) {
          if (severity === 'critical') { return '严重'; }
          if (severity === 'warning') { return '注意'; }
          if (severity === 'info') { return '提示'; }
          return formatDisplayValue(severity);
        }

        function mapDiagnosticTriggerLabel(trigger) {
          if (trigger === 'occupancy') { return '上下文占比超阈值'; }
          if (trigger === 'baseline_count') { return '历史摘要数量超阈值'; }
          return formatDisplayValue(trigger);
        }

        function mapFallbackLevelLabel(level) {
          if (level === 'live_recent_messages') { return '退回最近消息'; }
          if (level === 'none') { return '无'; }
          return formatDisplayValue(level);
        }

        function formatEventTypeLabel(type) {
          if (type === 'runtime.snapshot.created') { return '运行快照已生成'; }
          if (type === 'runtime.snapshot.updated') { return '运行快照已更新'; }
          if (type === 'runtime.snapshot.persisted') { return '运行快照已持久化'; }
          if (type === 'platform.started') { return '平台已启动'; }
          if (type === 'platform.reloaded') { return '平台已刷新'; }
          if (type === 'governance.proposal.created') { return '治理提案已创建'; }
          if (type === 'observability.snapshot.recorded') { return '观测快照已记录'; }
          if (type === 'unknown.event') { return '未知事件'; }
          if (typeof type !== 'string' || !type) { return '未知事件'; }
          return type.replace(/[._]+/g, ' / ');
        }

        function resolveCompressionMode(inspection) {
          if (!inspection) { return 'none'; }
          if (inspection.compaction && inspection.compaction.mode) { return String(inspection.compaction.mode); }
          if (inspection.promptAssemblySnapshot && inspection.promptAssemblySnapshot.compression && inspection.promptAssemblySnapshot.compression.mode) {
            return String(inspection.promptAssemblySnapshot.compression.mode);
          }
          if (inspection.window && inspection.window.compression && inspection.window.compression.compressionMode) {
            return String(inspection.window.compression.compressionMode);
          }
          if (inspection.compressionMode) { return String(inspection.compressionMode); }
          return 'none';
        }

        function resolveDiagnostics(inspection) {
          if (!inspection) { return undefined; }
          if (inspection.compaction && inspection.compaction.diagnostics) { return inspection.compaction.diagnostics; }
          if (inspection.promptAssemblySnapshot && inspection.promptAssemblySnapshot.compression) {
            return inspection.promptAssemblySnapshot.compression.diagnostics;
          }
          return undefined;
        }

        function resolveCompressionPolicy(inspection) {
          if (!inspection) { return undefined; }
          if (inspection.window && inspection.window.compression && inspection.window.compression.policy) {
            return inspection.window.compression.policy;
          }
          if (inspection.compaction && inspection.compaction.policy) {
            return inspection.compaction.policy;
          }
          if (inspection.promptAssemblySnapshot && inspection.promptAssemblySnapshot.compression) {
            return inspection.promptAssemblySnapshot.compression.policy;
          }
          return undefined;
        }

        function formatCompressionPolicy(policy) {
          return [
            '最近原文轮次 ' + formatDisplayValue(policy && policy.rawTailTurnCount),
            'full 阈值 ' + formatRatio(policy && policy.fullCompactionThresholdRatio),
            '历史摘要上限 ' + formatDisplayValue(policy && policy.maxBaselineCount),
            'rollup 上限 ' + formatRatio(policy && policy.maxBaselineRollupRatio)
          ].join(' | ');
        }

        function resolveSummaryTitle(item) {
          if (!item) { return '未知消息'; }
          const role = item.role ? mapRoleLabel(String(item.role)) : '消息';
          const index = typeof item.index === 'number' ? String(item.index) : '?';
          return role + ' #' + index;
        }

        function mapStatusClass(status) {
          if (status === 'healthy') { return 'success'; }
          if (status === 'warning') { return 'warning'; }
          if (status === 'critical') { return 'danger'; }
          return 'muted';
        }

        function formatMetricValue(metric) {
          if (!metric || typeof metric.value !== 'number') { return 'n/a'; }
          if (metric.unit === 'ratio') { return formatRatio(metric.value); }
          return String(metric.value);
        }

        function formatThreshold(threshold) {
          if (!threshold || typeof threshold.value !== 'number') { return '阈值：暂无'; }
          const value = threshold.direction === 'min'
            ? '>=' + formatThresholdValue(threshold.value)
            : '<=' + formatThresholdValue(threshold.value);
          return (threshold.direction === 'min' ? '至少 ' : '至多 ') + value;
        }

        function formatThresholdValue(value) {
          if (value <= 1) { return formatRatio(value); }
          return String(value);
        }

        function formatRatio(value) {
          if (typeof value !== 'number' || !Number.isFinite(value)) { return 'n/a'; }
          return (value * 100).toFixed(1) + '%';
        }

        function formatTimestamp(value) {
          try {
            return new Date(value).toLocaleString('zh-CN', { hour12: false });
          } catch {
            return value;
          }
        }

        function formatRelativeTimestamp(value) {
          if (!value) {
            return '暂无时间';
          }

          const timestamp = Date.parse(String(value));
          if (!Number.isFinite(timestamp)) {
            return formatTimestamp(value);
          }

          const diffMs = Date.now() - timestamp;
          const diffMinutes = Math.floor(diffMs / 60000);
          if (diffMinutes < 1) { return '刚刚'; }
          if (diffMinutes < 60) { return diffMinutes + ' 分钟前'; }

          const diffHours = Math.floor(diffMinutes / 60);
          if (diffHours < 24) { return diffHours + ' 小时前'; }

          const diffDays = Math.floor(diffHours / 24);
          if (diffDays < 7) { return diffDays + ' 天前'; }

          return formatTimestamp(value);
        }

        function truncateText(value, maxLength) {
          if (typeof value !== 'string' || value.length <= maxLength) { return value; }
          return value.slice(0, Math.max(0, maxLength - 1)) + '…';
        }

        function truncateMiddle(value, maxLength) {
          if (typeof value !== 'string' || value.length <= maxLength) { return value; }
          const visible = Math.max(6, Math.floor((maxLength - 1) / 2));
          return value.slice(0, visible) + '…' + value.slice(value.length - visible);
        }

        function safeJson(value) {
          try {
            return JSON.stringify(value, null, 2);
          } catch {
            return String(value);
          }
        }

        function normalizeArray(value) {
          return Array.isArray(value) ? value : [];
        }

        function sortSnapshots(payloads) {
          return normalizeArray(payloads).slice().sort(function (left, right) {
            const leftTime = left && left.capturedAt ? Date.parse(String(left.capturedAt)) : 0;
            const rightTime = right && right.capturedAt ? Date.parse(String(right.capturedAt)) : 0;
            return rightTime - leftTime;
          });
        }

        function parseInitialView() {
          const hash = window.location.hash.replace('#', '').trim();
          return VALID_VIEWS.includes(hash) ? hash : 'live';
        }

        function parseInitialSessionId() {
          const url = new URL(window.location.href);
          return url.searchParams.get('sessionId') || '';
        }

        async function fetchJson(url, options) {
          const response = await fetch(url, options);
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ' ' + response.statusText);
          }
          return response.json();
        }

        function readErrorMessage(error) {
          return error instanceof Error ? error.message : String(error);
        }

        function escapeHtml(value) {
          return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function byId(id) {
          return document.getElementById(id);
        }
      })();
`;

export function renderControlPlaneConsole(): string {
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <title>上下文工作台</title>',
    '    <style>',
    STYLE,
    '    </style>',
    '  </head>',
    '  <body>',
    BODY,
    '    <script>',
    SCRIPT,
    '    </script>',
    '  </body>',
    '</html>'
  ].join('\n');
}
