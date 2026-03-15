export function renderControlPlaneConsole(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compact Context 平台控制台</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe6;
        --paper: rgba(255, 251, 245, 0.92);
        --paper-strong: #fffaf2;
        --ink: #1d1c19;
        --muted: #6f685f;
        --line: rgba(102, 84, 66, 0.18);
        --line-strong: rgba(102, 84, 66, 0.28);
        --accent: #b4572e;
        --accent-strong: #8f3e1e;
        --accent-soft: rgba(180, 87, 46, 0.12);
        --success: #2f7d5b;
        --warning: #b27913;
        --danger: #b3342d;
        --shadow: 0 26px 60px rgba(62, 37, 18, 0.08);
        --radius: 20px;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }

      body {
        margin: 0;
        font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(233, 196, 106, 0.22), transparent 28%),
          radial-gradient(circle at top right, rgba(180, 87, 46, 0.16), transparent 32%),
          linear-gradient(180deg, #f8f4ec 0%, #f1eadf 44%, var(--bg) 100%);
      }

      a { color: inherit; }
      button, input, select, textarea { font: inherit; }

      .shell {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        min-height: 100vh;
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 28px 20px 24px;
        border-right: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255, 251, 245, 0.96), rgba(247, 239, 227, 0.96));
        backdrop-filter: blur(16px);
        overflow: auto;
      }

      .brand { margin-bottom: 24px; }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .brand h1 {
        margin: 14px 0 10px;
        font-family: "Iowan Old Style", "Source Han Serif SC", serif;
        font-size: 30px;
        line-height: 1.08;
      }

      .brand p, .panel-title p, .hero p, .inline-note {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .sidebar-card {
        margin-top: 18px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 250, 242, 0.78);
      }

      .sidebar-card h2 {
        margin: 0 0 10px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .sidebar-stats {
        display: grid;
        gap: 10px;
      }

      .sidebar-stat {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 14px;
      }

      .sidebar nav {
        display: grid;
        gap: 8px;
        margin-top: 22px;
      }

      .sidebar nav a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        color: var(--muted);
        text-decoration: none;
        transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      }

      .sidebar nav a:hover {
        background: rgba(180, 87, 46, 0.08);
        color: var(--ink);
        transform: translateX(2px);
      }

      .sidebar nav strong { color: var(--ink); font-size: 14px; }
      .sidebar nav span { font-size: 12px; }
      .sidebar-actions { display: grid; gap: 10px; margin-top: 18px; }

      .content { padding: 28px; }

      .hero, .panel {
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }

      .hero {
        position: relative;
        overflow: hidden;
        padding: 30px;
        border-radius: 28px;
        background:
          radial-gradient(circle at top left, rgba(233, 196, 106, 0.18), transparent 24%),
          radial-gradient(circle at bottom right, rgba(180, 87, 46, 0.16), transparent 34%),
          linear-gradient(135deg, rgba(255, 251, 245, 0.98), rgba(249, 240, 226, 0.94));
      }

      .hero-grid {
        display: grid;
        gap: 22px;
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
      }

      .hero h2 {
        margin: 14px 0 12px;
        font-family: "Iowan Old Style", "Source Han Serif SC", serif;
        font-size: 40px;
        line-height: 1.04;
      }

      .hero-actions, .panel-actions, .table-actions, .chip-list, .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .hero-note, .layout { display: grid; gap: 18px; }
      .hero-note-card, .subpanel {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 250, 243, 0.82);
      }

      .hero-note-card strong, .metric-card strong, .overview-card strong {
        display: block;
        font-size: 13px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .hero-note-card span {
        display: block;
        margin-top: 8px;
        font-size: 16px;
        line-height: 1.5;
      }

      .layout { margin-top: 18px; }

      .panel {
        padding: 22px;
        border-radius: 24px;
        background: var(--paper);
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }

      .panel-title {
        display: grid;
        gap: 6px;
      }

      .panel-title h3 {
        margin: 0;
        font-size: 22px;
      }

      .panel-grid, .cards, .form-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .cards { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .form-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }

      .metric-card, .overview-card {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255, 251, 245, 0.98), rgba(249, 241, 229, 0.92));
      }

      .metric-card-header, .overview-card-header, .timeline-item-header, .status-bar, .status-indicator {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .metric-value, .overview-value {
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }

      .metric-trend, .overview-meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .badge, .chip, .tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 72px;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 12px;
        font-weight: 700;
      }

      .chip, .tag {
        min-width: 0;
        gap: 6px;
        border-color: var(--line);
        background: rgba(255, 251, 245, 0.86);
      }

      .badge-healthy, .badge-active, .badge-delivered, .badge-completed, .badge-approved {
        color: var(--success);
        background: rgba(47, 125, 91, 0.12);
        border-color: rgba(47, 125, 91, 0.2);
      }

      .badge-warning, .badge-pending, .badge-scheduled, .badge-review {
        color: var(--warning);
        background: rgba(178, 121, 19, 0.12);
        border-color: rgba(178, 121, 19, 0.2);
      }

      .badge-critical, .badge-failed, .badge-rejected, .badge-error {
        color: var(--danger);
        background: rgba(179, 52, 45, 0.12);
        border-color: rgba(179, 52, 45, 0.2);
      }

      .badge-unknown, .badge-paused, .badge-neutral {
        color: var(--muted);
        background: rgba(107, 104, 95, 0.1);
        border-color: rgba(107, 104, 95, 0.16);
      }

      .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 251, 245, 0.82);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 620px;
      }

      th, td {
        padding: 12px 14px;
        text-align: left;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: rgba(248, 241, 230, 0.96);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
      }

      td strong { display: block; margin-bottom: 4px; }

      .timeline { display: grid; gap: 12px; }

      .timeline-item {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 251, 245, 0.88);
      }

      .timeline-item p { margin: 0; color: var(--muted); line-height: 1.6; }
      .field { display: grid; gap: 8px; }
      .field label { font-size: 13px; font-weight: 600; color: var(--muted); }

      input, select, textarea {
        width: 100%;
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        padding: 11px 12px;
        background: rgba(255, 251, 245, 0.96);
        color: var(--ink);
      }

      textarea { min-height: 108px; resize: vertical; }

      .button {
        border: none;
        border-radius: 14px;
        padding: 11px 16px;
        background: var(--accent);
        color: #fff;
        cursor: pointer;
        font-weight: 700;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        box-shadow: 0 10px 20px rgba(180, 87, 46, 0.18);
      }

      .button:hover {
        transform: translateY(-1px);
        background: var(--accent-strong);
      }

      .button-secondary, .button-quiet {
        box-shadow: none;
      }

      .button-secondary {
        background: rgba(255, 251, 245, 0.9);
        color: var(--ink);
        border: 1px solid var(--line-strong);
      }

      .button-secondary:hover { background: rgba(255, 248, 239, 1); }

      .button-quiet {
        background: transparent;
        color: var(--muted);
        border: 1px dashed var(--line-strong);
      }

      .empty, .placeholder {
        padding: 18px;
        border-radius: 16px;
        border: 1px dashed var(--line-strong);
        color: var(--muted);
        background: rgba(255, 251, 245, 0.6);
      }

      .status-bar {
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 251, 245, 0.88);
      }

      .status-indicator { font-weight: 700; justify-content: flex-start; }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--warning);
        box-shadow: 0 0 0 6px rgba(178, 121, 19, 0.08);
      }

      .status-dot.success {
        background: var(--success);
        box-shadow: 0 0 0 6px rgba(47, 125, 91, 0.08);
      }

      .status-dot.error {
        background: var(--danger);
        box-shadow: 0 0 0 6px rgba(179, 52, 45, 0.08);
      }

      .toast {
        position: fixed;
        right: 24px;
        bottom: 24px;
        min-width: 280px;
        max-width: 420px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(29, 28, 25, 0.92);
        color: #fffaf2;
        box-shadow: var(--shadow);
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
        transition: opacity 0.18s ease, transform 0.18s ease;
      }

      .toast.visible {
        opacity: 1;
        transform: translateY(0);
      }

      details { margin-top: 14px; }
      details summary { cursor: pointer; color: var(--muted); font-weight: 600; }

      pre {
        margin: 10px 0 0;
        padding: 14px;
        overflow: auto;
        border-radius: 16px;
        border: 1px solid rgba(26, 24, 20, 0.16);
        background: #201d19;
        color: #f8f2e6;
        font-size: 12px;
        line-height: 1.6;
      }

      @media (max-width: 1180px) {
        .shell { grid-template-columns: 1fr; }
        .sidebar {
          position: static;
          height: auto;
          border-right: none;
          border-bottom: 1px solid var(--line);
        }
        .hero-grid { grid-template-columns: 1fr; }
      }

      @media (max-width: 720px) {
        .content { padding: 18px; }
        .hero, .panel { padding: 18px; border-radius: 20px; }
        .hero h2 { font-size: 32px; }
        .panel-header { align-items: start; flex-direction: column; }
        .cards { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="eyebrow">控制面</span>
          <h1>Compact Context 平台控制台</h1>
          <p>这不是单纯的 API 列表，而是围绕治理、观测、导入、运行时窗口和平台事件的一体化操作面板。</p>
        </div>

        <div class="sidebar-card">
          <h2>运行状态</h2>
          <div class="status-bar">
            <span class="status-indicator">
              <span id="statusDot" class="status-dot"></span>
              <span id="statusText">正在连接</span>
            </span>
            <button id="refreshAll" class="button button-secondary" type="button">刷新全部</button>
          </div>
          <p id="statusMeta" class="inline-note">等待首轮数据加载。</p>
        </div>

        <nav>
          <a href="#overview"><strong>总览</strong><span>健康度 / API 边界</span></a>
          <a href="#observability"><strong>观测</strong><span>指标 / 告警 / 历史</span></a>
          <a href="#governance"><strong>治理</strong><span>提案 / 审核 / 回滚</span></a>
          <a href="#imports"><strong>导入</strong><span>catalog / jobs / dead letters</span></a>
          <a href="#runtime"><strong>运行时</strong><span>窗口 / 轨迹 / 最新轮次</span></a>
          <a href="#platform"><strong>平台</strong><span>扩展 / 工作区 / 事件 / Webhook</span></a>
        </nav>

        <div class="sidebar-card">
          <h2>快速计数</h2>
          <div id="sidebarStats" class="sidebar-stats">
            <div class="placeholder">等待加载。</div>
          </div>
        </div>

        <div class="sidebar-card">
          <h2>说明</h2>
          <p class="inline-note">
            当前页优先消费 control-plane 已有 API。真正送模的最终 provider payload 仍然由 OpenClaw 宿主自己组装。
          </p>
        </div>
      </aside>

      <main class="content">
        <section class="hero">
          <div class="hero-grid">
            <div>
              <span class="eyebrow">平台控制台</span>
              <h2>从“能调 API”升级到“能实际运维”的控制面</h2>
              <p>
                这里会直接展示运行时快照、观测指标、治理提案、导入任务、平台事件和扩展状态，
                同时提供一批最小可用的动作表单，避免你每次都手写请求。
              </p>
              <div class="hero-actions">
                <a class="button" href="#runtime">查看运行时窗口</a>
                <a class="button button-secondary" href="#governance">发起治理提案</a>
                <a class="button button-secondary" href="#imports">创建导入任务</a>
              </div>
            </div>
            <div class="hero-note">
              <div class="hero-note-card">
                <strong>当前定位</strong>
                <span>平台底座已经可用；这版首页专注把已有能力组织成实际可操作的最小控制台。</span>
              </div>
              <div class="hero-note-card">
                <strong>当前重点</strong>
                <span id="heroFocus">优先读取健康度、观测面板、治理、导入、运行时快照和平台事件。</span>
              </div>
            </div>
          </div>
        </section>

        <div class="layout">
          <section id="overview" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>总览</h3>
                <p>先看平台是否健康，再看 API 边界、只读来源和总体能力计数。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-health" type="button">刷新健康度</button>
              </div>
            </div>
            <div id="overviewCards" class="cards"></div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>只读来源</h4>
                <div id="readonlySources" class="chip-list"></div>
              </div>
              <div class="subpanel">
                <h4>API 边界</h4>
                <div class="table-wrap">
                  <div id="apiBoundary"></div>
                </div>
              </div>
            </div>
          </section>

          <section id="observability" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>观测与告警</h3>
                <p>用指标卡看平台状态，用快照和历史点看趋势，并可以直接记录新的观测快照。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-observability" type="button">刷新观测</button>
                <button class="button" data-action="capture-observability" type="button">记录快照</button>
              </div>
            </div>
            <div id="metricCards" class="cards"></div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>活动告警</h4>
                <div id="observabilityAlerts"></div>
              </div>
              <div class="subpanel">
                <h4>阈值设置</h4>
                <div id="observabilityThresholds"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>历史快照</h4>
                <div class="table-wrap">
                  <div id="observabilityHistory"></div>
                </div>
              </div>
              <div class="subpanel">
                <h4>告警订阅</h4>
                <form id="subscriptionForm" class="field">
                  <div class="form-grid">
                    <div class="field">
                      <label for="subscriptionChannel">频道</label>
                      <select id="subscriptionChannel">
                        <option value="console">控制台</option>
                        <option value="webhook">Webhook</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="subscriptionTarget">目标</label>
                      <input id="subscriptionTarget" placeholder="例如 ops-team 或 Webhook 地址" />
                    </div>
                  </div>
                  <button class="button" type="submit">创建订阅</button>
                </form>
                <div id="subscriptionList" style="margin-top:14px;"></div>
              </div>
            </div>
            <details>
              <summary>查看 dashboard 原始 JSON</summary>
              <pre id="observabilityRaw">waiting...</pre>
            </details>
          </section>

          <section id="governance" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>治理工作台</h3>
                <p>快速发起 alias 提案、查看模板、审核提案并追踪 audit 记录。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-governance" type="button">刷新治理</button>
              </div>
            </div>
            <div class="panel-grid">
              <div class="subpanel">
                <h4>快速发起 alias 提案</h4>
                <form id="governanceForm" class="field">
                  <div class="form-grid">
                    <div class="field">
                      <label for="proposalScope">目标 scope</label>
                      <select id="proposalScope">
                        <option value="session">session</option>
                        <option value="workspace" selected>workspace</option>
                        <option value="global">global</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="proposalConceptId">Concept ID</label>
                      <input id="proposalConceptId" value="knowledge_graph" />
                    </div>
                    <div class="field">
                      <label for="proposalAlias">Alias</label>
                      <input id="proposalAlias" placeholder="例如 kg-console" />
                    </div>
                    <div class="field">
                      <label for="proposalSessionId">关联 sessionId</label>
                      <input id="proposalSessionId" placeholder="可选，用于绑定运行时快照" />
                    </div>
                  </div>
                  <div class="field">
                    <label for="proposalReason">原因</label>
                    <textarea id="proposalReason" placeholder="描述为什么要新增 alias 或调整规则。"></textarea>
                  </div>
                  <button class="button" type="submit">提交提案</button>
                </form>
              </div>
              <div class="subpanel">
                <h4>治理模板</h4>
                <div id="governanceTemplates"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>提案列表</h4>
                <div class="table-wrap">
                  <div id="governanceProposals"></div>
                </div>
              </div>
              <div class="subpanel">
                <h4>审核日志</h4>
                <div class="table-wrap">
                  <div id="governanceAudit"></div>
                </div>
              </div>
            </div>
            <details>
              <summary>查看治理原始 JSON</summary>
              <pre id="governanceRaw">waiting...</pre>
            </details>
          </section>

          <section id="imports" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>导入平台</h3>
                <p>浏览 importer catalog、创建最小导入任务，并直接运行、重试、重跑或查看历史。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-imports" type="button">刷新导入</button>
              </div>
            </div>
            <div class="panel-grid">
              <div class="subpanel">
                <h4>快速创建导入任务</h4>
                <form id="importForm" class="field">
                  <div class="form-grid">
                    <div class="field">
                      <label for="importSessionId">Session ID</label>
                      <input id="importSessionId" placeholder="例如 stage-console-session" />
                    </div>
                    <div class="field">
                      <label for="importWorkspaceId">工作区 ID</label>
                      <input id="importWorkspaceId" placeholder="可选" />
                    </div>
                    <div class="field">
                      <label for="importSourceKind">来源类型</label>
                      <select id="importSourceKind">
                        <option value="document">document</option>
                        <option value="repo_structure">repo_structure</option>
                        <option value="structured_input">structured_input</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="importContent">导入内容</label>
                    <textarea id="importContent" placeholder="贴入文档内容、仓库结构片段或结构化文本。"></textarea>
                  </div>
                  <button class="button" type="submit">创建任务</button>
                </form>
              </div>
              <div class="subpanel">
                <h4>导入器目录</h4>
                <div id="importCatalog" class="cards"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>导入任务</h4>
                <div class="table-wrap">
                  <div id="importJobs"></div>
                </div>
              </div>
              <div class="subpanel">
                <h4>死信 / 历史</h4>
                <div id="importHistory" class="placeholder">点击任务的“历史”查看最近尝试记录。</div>
                <div class="table-wrap" style="margin-top:12px;">
                  <div id="deadLetters"></div>
                </div>
              </div>
            </div>
            <details>
              <summary>查看导入原始 JSON</summary>
              <pre id="importRaw">waiting...</pre>
            </details>
          </section>

          <section id="runtime" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>运行时窗口</h3>
                <p>这里直接看运行时快照、提示组装相关信息，以及运行时治理轨迹。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-runtime-list" type="button">最近快照</button>
              </div>
            </div>
            <div class="panel-grid">
              <div class="subpanel">
                <h4>按 session 查询</h4>
                <form id="runtimeForm" class="field">
                  <div class="form-grid">
                    <div class="field">
                      <label for="runtimeSessionId">Session ID</label>
                      <input id="runtimeSessionId" placeholder="输入当前 OpenClaw sessionId" />
                    </div>
                  </div>
                  <div class="panel-actions">
                    <button class="button" type="submit">查看 runtime window</button>
                    <button class="button button-secondary" type="button" id="loadRuntimeTrace">联查治理轨迹</button>
                  </div>
                </form>
                <div id="runtimeSummary" style="margin-top:14px;"></div>
              </div>
              <div class="subpanel">
                <h4>提示组装</h4>
                <div id="runtimeAssembly"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>最终消息窗口</h4>
                <div id="runtimeMessages"></div>
              </div>
              <div class="subpanel">
                <h4>工具调用 / 结果配对</h4>
                <div id="runtimePairs"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>最近快照列表</h4>
                <div id="runtimeSnapshotList"></div>
              </div>
              <div class="subpanel">
                <h4>运行时 / 治理轨迹</h4>
                <div id="runtimeTrace"></div>
              </div>
            </div>
            <details>
              <summary>查看 runtime 原始 JSON</summary>
              <pre id="runtimeRaw">waiting...</pre>
            </details>
          </section>

          <section id="platform" class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h3>平台与生态</h3>
                <p>展示扩展、工作区、平台事件、Webhook，以及一批最小可用的注册动作。</p>
              </div>
              <div class="panel-actions">
                <button class="button button-secondary" data-action="refresh-platform" type="button">刷新平台</button>
              </div>
            </div>
            <div class="panel-grid">
              <div class="subpanel">
                <h4>注册扩展</h4>
                <form id="extensionForm" class="field">
                  <div class="form-grid">
                    <div class="field">
                      <label for="extensionId">Extension ID</label>
                      <input id="extensionId" placeholder="custom.extension.console" />
                    </div>
                    <div class="field">
                      <label for="extensionLabel">Label</label>
                      <input id="extensionLabel" placeholder="Console Extension" />
                    </div>
                    <div class="field">
                      <label for="extensionKind">Kind</label>
                      <select id="extensionKind">
                        <option value="sdk">sdk</option>
                        <option value="importer">importer</option>
                        <option value="governance">governance</option>
                        <option value="observability">observability</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="extensionDescription">Description</label>
                    <textarea id="extensionDescription" placeholder="描述这个扩展的作用和来源。"></textarea>
                  </div>
                  <div class="field">
                    <label for="extensionCapabilities">Capabilities（逗号分隔）</label>
                    <input id="extensionCapabilities" placeholder="sdk_client,event_consumer" />
                  </div>
                  <button class="button" type="submit">注册扩展</button>
                </form>
              </div>
              <div class="subpanel">
                <h4>Webhook 订阅</h4>
                <form id="webhookForm" class="field">
                  <div class="field">
                    <label for="webhookTarget">目标地址</label>
                      <input id="webhookTarget" placeholder="https://example.com/platform-webhook" />
                  </div>
                  <div class="field">
                    <label for="webhookEvents">事件类型（逗号分隔）</label>
                    <input id="webhookEvents" placeholder="例如 extension.registered,workspace.policy_saved" />
                  </div>
                  <button class="button" type="submit">创建 Webhook</button>
                </form>
                <div id="webhookList" style="margin-top:14px;"></div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>扩展列表</h4>
                <div id="extensionsList" class="cards"></div>
              </div>
              <div class="subpanel">
                <h4>工作区目录</h4>
                <div class="table-wrap">
                  <div id="workspaceList"></div>
                </div>
              </div>
            </div>
            <div class="panel-grid" style="margin-top:18px;">
              <div class="subpanel">
                <h4>平台事件</h4>
                <div class="table-wrap">
                  <div id="platformEvents"></div>
                </div>
              </div>
              <div class="subpanel">
                <h4>自治建议</h4>
                <div class="panel-actions" style="margin-bottom:12px;">
                  <button class="button button-secondary" data-action="refresh-autonomy" type="button">生成建议</button>
                </div>
                <div id="autonomyRecommendations"></div>
              </div>
            </div>
            <details>
              <summary>查看平台原始 JSON</summary>
              <pre id="platformRaw">waiting...</pre>
            </details>
          </section>
        </div>
      </main>
    </div>

    <div id="toast" class="toast"></div>
    <script>
      const state = {
        health: null,
        observability: null,
        observabilityHistory: null,
        thresholds: null,
        subscriptions: null,
        proposals: null,
        audit: null,
        templates: null,
        catalog: null,
        jobs: null,
        deadLetters: null,
        runtimeList: null,
        runtimeCurrent: null,
        runtimeTrace: null,
        extensions: null,
        workspaces: null,
        platformEvents: null,
        webhooks: null,
        autonomy: null,
        importHistory: null,
        lastLoadedAt: null
      };

      function byId(id) {
        return document.getElementById(id);
      }

      function escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function formatDate(value) {
        if (!value) {
          return '-';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return String(value);
        }
        return date.toLocaleString('zh-CN', { hour12: false });
      }

      function formatMetric(value, unit) {
        if (typeof value !== 'number') {
          return '-';
        }
        if (unit === 'count') {
          return value.toFixed(value >= 10 ? 0 : 1);
        }
        return (value * 100).toFixed(1) + '%';
      }

      function badgeTone(value) {
        const normalized = String(value ?? 'unknown').toLowerCase();
        if (['healthy', 'active', 'delivered', 'completed', 'approved'].includes(normalized)) {
          return 'healthy';
        }
        if (['warning', 'pending', 'scheduled', 'review'].includes(normalized)) {
          return 'warning';
        }
        if (['critical', 'failed', 'rejected', 'error'].includes(normalized)) {
          return 'critical';
        }
        return 'unknown';
      }

      function renderBadge(label, tone) {
        return '<span class="badge badge-' + tone + '">' + escapeHtml(label) + '</span>';
      }

      function localizeUiValue(value) {
        const map = {
          runtime_api: '运行时接口',
          debug_api: '调试接口',
          control_plane_service: '控制面服务',
          control_plane_api: '控制面 API',
          runtime_plugin: '运行时插件',
          control_plane_service_authority: '控制面服务',
          control_plane_service: '控制面服务',
          session_operator: '会话操作员',
          workspace_reviewer: '工作区审核者',
          global_reviewer: '全局审核者',
          healthy: '健康',
          warning: '警告',
          critical: '严重',
          unknown: '未知',
          pending: '待处理',
          approved: '已批准',
          rejected: '已拒绝',
          applied: '已应用',
          completed: '已完成',
          failed: '失败',
          running: '运行中',
          scheduled: '已调度',
          active: '已启用',
          delivered: '已送达',
          console: '控制台',
          webhook: 'Webhook',
          conversation: '对话',
          document: '文档',
          repo_structure: '仓库结构',
          structured_input: '结构化输入',
          live_runtime: '实时运行态',
          persisted_snapshot: '持久化快照',
          transcript_fallback: '转录回退',
          tool_call_id: '工具调用 ID',
          sequence_fallback: '顺序回退',
          tool_call_only: '仅调用',
          tool_result_only: '仅结果',
          submitted: '已提交',
          approved_event: '已批准',
          rejected_event: '已拒绝',
          applied_event: '已应用',
          rolled_back: '已回滚',
          low: '低',
          medium: '中',
          high: '高',
          neutral: '一般',
          min: '最小值',
          max: '最大值',
          runtime_windows: '运行时窗口',
          stage_report: '阶段报告',
          sdk: 'SDK',
          importer: '导入器',
          governance: '治理',
          observability: '观测',
          user: '用户',
          assistant: '助手',
          system: '系统',
          tool: '工具',
          run: '运行',
          retry: '重试',
          rerun: '重跑',
          rollback: '回滚',
          approve: '通过',
          reject: '拒绝',
          apply: '应用'
        };
        if (value === 'approved') {
          return '已批准';
        }
        if (value === 'rejected') {
          return '已拒绝';
        }
        return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : String(value ?? '');
      }

      function localizeMetricLabel(label) {
        const map = {
          'Runtime live window ratio': '实时运行窗口占比',
          'Runtime transcript fallback ratio': '转录回退占比',
          'Runtime average compressed count': '平均压缩消息数',
          'Runtime average final message count': '平均最终消息数',
          'Recall noise rate': '召回噪音率',
          'Promotion quality': '晋升质量',
          'Knowledge pollution rate': '知识污染率',
          'High-scope reuse benefit': '高作用域复用收益',
          'High-scope reuse intrusion': '高作用域复用侵入率',
          'Multi-source coverage': '多来源覆盖率'
        };
        return map[label] || label;
      }

      function emptyState(message) {
        return '<div class="empty">' + escapeHtml(message) + '</div>';
      }

      function renderTable(columns, rows, emptyMessage) {
        if (!rows.length) {
          return emptyState(emptyMessage);
        }
        const head = columns.map(function (column) {
          return '<th>' + escapeHtml(column.label) + '</th>';
        }).join('');
        const body = rows.map(function (row) {
          return '<tr>' + columns.map(function (column) {
            return '<td>' + (row[column.key] ?? '') + '</td>';
          }).join('') + '</tr>';
        }).join('');
        return '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
      }

      function setJson(id, value) {
        byId(id).textContent = JSON.stringify(value, null, 2);
      }

      function setStatus(message, tone, meta) {
        byId('statusText').textContent = message;
        byId('statusMeta').textContent = meta || '';
        const dot = byId('statusDot');
        dot.className = 'status-dot' + (tone === 'success' ? ' success' : tone === 'error' ? ' error' : '');
      }

      let toastTimer = undefined;
      function showToast(message, tone) {
        const toast = byId('toast');
        toast.textContent = message;
        toast.style.borderColor = tone === 'error' ? 'rgba(179, 52, 45, 0.4)' : 'rgba(255,255,255,0.12)';
        toast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          toast.classList.remove('visible');
        }, 2600);
      }

      async function requestJson(url, options) {
        const response = await fetch(url, options);
        const text = await response.text();
        let payload;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error('non-json response from ' + url + ': ' + text.slice(0, 120));
        }
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || ('request failed: ' + response.status));
        }
        return payload;
      }

      function authorityForScope(scope) {
        if (scope === 'session') {
          return 'session_operator';
        }
        if (scope === 'global') {
          return 'global_reviewer';
        }
        return 'workspace_reviewer';
      }

      function renderOverview() {
        const health = state.health;
        if (!health) {
          byId('overviewCards').innerHTML = emptyState('等待健康检查返回。');
          byId('readonlySources').innerHTML = '';
          byId('apiBoundary').innerHTML = emptyState('等待 API 边界。');
          byId('sidebarStats').innerHTML = emptyState('等待健康检查。');
          return;
        }

        const cards = [
          { title: 'API 边界', value: health.apiBoundary.length, meta: 'control-plane API surface' },
          { title: '只读来源', value: health.readonlySources.length, meta: health.readonlySources.join(' / ') },
          { title: '导入器', value: health.importerCount, meta: '内置导入器数量' },
          { title: '扩展', value: health.extensionCount, meta: '已注册的平台扩展数' }
        ];

        byId('overviewCards').innerHTML = cards.map(function (card) {
          return '<article class="overview-card"><div class="overview-card-header"><strong>' +
            escapeHtml(card.title) + '</strong>' + renderBadge('已就绪', 'healthy') +
            '</div><div class="overview-value">' + escapeHtml(card.value) +
            '</div><div class="overview-meta">' + escapeHtml(card.meta) + '</div></article>';
        }).join('');

        byId('readonlySources').innerHTML = health.readonlySources.map(function (item) {
          return '<span class="chip">' + escapeHtml(item) + '</span>';
        }).join('');

        byId('apiBoundary').innerHTML = renderTable(
          [
            { key: 'name', label: '接口' },
            { key: 'surface', label: '表面' },
            { key: 'readonly', label: '只读' },
            { key: 'authority', label: '权限来源' }
          ],
          health.apiBoundary.map(function (entry) {
            return {
              name: '<strong>' + escapeHtml(entry.name) + '</strong>',
              surface: escapeHtml(localizeUiValue(entry.surface)),
              readonly: renderBadge(entry.readonly ? '只读' : '可写', entry.readonly ? 'warning' : 'healthy'),
              authority: escapeHtml(localizeUiValue(entry.authority))
            };
          }),
          '当前没有 API 边界数据。'
        );

        byId('sidebarStats').innerHTML =
          '<div class="sidebar-stat"><span>API 端点</span><strong>' + escapeHtml(health.apiBoundary.length) + '</strong></div>' +
          '<div class="sidebar-stat"><span>只读来源</span><strong>' + escapeHtml(health.readonlySources.length) + '</strong></div>' +
          '<div class="sidebar-stat"><span>导入器</span><strong>' + escapeHtml(health.importerCount) + '</strong></div>' +
          '<div class="sidebar-stat"><span>扩展</span><strong>' + escapeHtml(health.extensionCount) + '</strong></div>';
      }

      function renderObservability() {
        const payload = state.observability && state.observability.payload;
        if (!payload) {
          byId('metricCards').innerHTML = emptyState('暂无 dashboard 数据。');
          byId('observabilityAlerts').innerHTML = emptyState('暂无告警。');
          byId('observabilityThresholds').innerHTML = emptyState('暂无阈值。');
          byId('observabilityHistory').innerHTML = emptyState('暂无历史点。');
          byId('subscriptionList').innerHTML = emptyState('暂无订阅。');
          setJson('observabilityRaw', state.observability);
          return;
        }

        const dashboard = payload.dashboard;
        byId('metricCards').innerHTML = dashboard.metricCards.map(function (card) {
          const tone = badgeTone(card.status);
          return '<article class="metric-card"><div class="metric-card-header"><strong>' +
              escapeHtml(localizeMetricLabel(card.label)) + '</strong>' + renderBadge(localizeUiValue(card.status), tone) +
            '</div><div class="metric-value">' + escapeHtml(formatMetric(card.value, card.unit)) +
            '</div><div class="metric-trend">来源: ' + escapeHtml(localizeUiValue(card.source)) +
            (card.threshold ? ' | 阈值: ' + escapeHtml(localizeUiValue(card.threshold.direction)) + ' ' + escapeHtml(formatMetric(card.threshold.value, card.unit)) : '') +
            (typeof card.trendDelta === 'number' ? ' | 变化: ' + escapeHtml(formatMetric(card.trendDelta, card.unit)) : '') +
            '</div></article>';
        }).join('');

        byId('observabilityAlerts').innerHTML = dashboard.alerts.length
          ? dashboard.alerts.map(function (alert) {
              return '<div class="timeline-item"><div class="timeline-item-header"><strong>' +
                escapeHtml(alert.key) + '</strong>' + renderBadge(localizeUiValue(alert.severity), badgeTone(alert.severity)) +
                '</div><p>' + escapeHtml(alert.message) + '</p></div>';
            }).join('')
          : emptyState('当前没有活跃告警。');

        byId('observabilityThresholds').innerHTML = Object.entries(dashboard.thresholds).map(function (entry) {
          return '<span class="tag"><strong>' + escapeHtml(entry[0]) + '</strong>&nbsp;' + escapeHtml(entry[1]) + '</span>';
        }).join('');

        byId('observabilityHistory').innerHTML = renderTable(
          [
            { key: 'capturedAt', label: 'Captured At' },
            { key: 'stage', label: '阶段' },
            { key: 'sampleCount', label: '窗口数' },
            { key: 'alerts', label: '告警数' }
          ],
          (payload.history.points || []).map(function (point) {
            return {
              capturedAt: escapeHtml(formatDate(point.capturedAt)),
              stage: escapeHtml(point.stage),
              sampleCount: escapeHtml(point.runtimeWindowSummary.sampleCount),
              alerts: escapeHtml(point.metricCards.filter(function (card) {
                return card.status === 'warning' || card.status === 'critical';
              }).length)
            };
          }),
          '还没有 dashboard history。'
        );

        byId('subscriptionList').innerHTML = state.subscriptions && state.subscriptions.subscriptions && state.subscriptions.subscriptions.length
          ? renderTable(
              [
                { key: 'channel', label: '渠道' },
                { key: 'target', label: '目标' },
                { key: 'stage', label: '阶段' },
                { key: 'severity', label: '最低级别' }
              ],
              state.subscriptions.subscriptions.map(function (item) {
                return {
                  channel: renderBadge(localizeUiValue(item.channel), 'neutral'),
                  target: '<strong>' + escapeHtml(item.target) + '</strong>',
                  stage: escapeHtml(item.stage || '全部'),
                  severity: renderBadge(localizeUiValue(item.minSeverity), badgeTone(item.minSeverity))
                };
              }),
              '暂无告警订阅。'
            )
          : emptyState('暂无告警订阅。');

        setJson('observabilityRaw', state.observability);
      }

      function renderGovernance() {
        byId('governanceTemplates').innerHTML = state.templates && state.templates.templates && state.templates.templates.length
          ? state.templates.templates.map(function (template) {
              return '<div class="timeline-item"><div class="timeline-item-header"><strong>' +
                escapeHtml(template.label) + '</strong>' +
                renderBadge(localizeUiValue(template.targetScope), badgeTone(template.targetScope === 'global' ? 'warning' : 'healthy')) +
                '</div><p>' + escapeHtml(template.summary) + '</p><div class="chip-list" style="margin-top:10px;">' +
                template.reviewChecklist.map(function (item) {
                  return '<span class="chip">' + escapeHtml(item) + '</span>';
                }).join('') + '</div></div>';
            }).join('')
          : emptyState('暂无治理模板。');

        byId('governanceProposals').innerHTML = state.proposals && state.proposals.proposals
          ? renderTable(
              [
                { key: 'summary', label: '提案' },
                { key: 'scope', label: '范围' },
                { key: 'status', label: '状态' },
                { key: 'actions', label: '动作' }
              ],
              state.proposals.proposals.map(function (proposal) {
                const actions = [];
                if (proposal.status === 'pending') {
                  actions.push('<button class="button button-secondary" data-proposal-action="approve" data-proposal-id="' + escapeHtml(proposal.id) + '" data-scope="' + escapeHtml(proposal.targetScope) + '" type="button">通过</button>');
                  actions.push('<button class="button button-secondary" data-proposal-action="reject" data-proposal-id="' + escapeHtml(proposal.id) + '" data-scope="' + escapeHtml(proposal.targetScope) + '" type="button">拒绝</button>');
                }
                if (proposal.status === 'approved') {
                  actions.push('<button class="button" data-proposal-action="apply" data-proposal-id="' + escapeHtml(proposal.id) + '" data-scope="' + escapeHtml(proposal.targetScope) + '" type="button">应用</button>');
                }
                if (proposal.status === 'applied') {
                  actions.push('<button class="button button-secondary" data-proposal-action="rollback" data-proposal-id="' + escapeHtml(proposal.id) + '" data-scope="' + escapeHtml(proposal.targetScope) + '" type="button">回滚</button>');
                }
                return {
                  summary: '<strong>' + escapeHtml(proposal.reason) + '</strong><span class="inline-note">提交者：' + escapeHtml(proposal.submittedBy) + ' · ' + escapeHtml(formatDate(proposal.submittedAt)) + '</span>',
                  scope: renderBadge(localizeUiValue(proposal.targetScope), badgeTone(proposal.targetScope === 'workspace' ? 'warning' : proposal.targetScope)),
                  status: renderBadge(localizeUiValue(proposal.status), badgeTone(proposal.status)),
                  actions: actions.length ? '<div class="table-actions">' + actions.join('') + '</div>' : '<span class="inline-note">无可执行动作</span>'
                };
              }),
              '当前没有治理提案。'
            )
          : emptyState('当前没有治理提案。');

        byId('governanceAudit').innerHTML = state.audit && state.audit.audit
          ? renderTable(
              [
                { key: 'event', label: '事件' },
                { key: 'actor', label: '执行者' },
                { key: 'timestamp', label: '时间' },
                { key: 'proposalId', label: '提案' }
              ],
              state.audit.audit.map(function (entry) {
                return {
                  event: renderBadge(localizeUiValue(entry.event), badgeTone(entry.event === 'rejected' ? 'critical' : entry.event)),
                  actor: escapeHtml(entry.actor),
                  timestamp: escapeHtml(formatDate(entry.timestamp)),
                  proposalId: '<strong>' + escapeHtml(entry.proposalId) + '</strong>'
                };
              }),
              '当前没有审计记录。'
            )
          : emptyState('当前没有审计记录。');

        setJson('governanceRaw', {
          proposals: state.proposals,
          audit: state.audit,
          templates: state.templates
        });
      }

      function renderImports() {
        byId('importCatalog').innerHTML = state.catalog && state.catalog.catalog && state.catalog.catalog.importers
          ? state.catalog.catalog.importers.map(function (importer) {
              return '<article class="overview-card"><div class="overview-card-header"><strong>' +
                escapeHtml(importer.label) + '</strong>' + renderBadge(localizeUiValue(importer.sourceKind), 'neutral') +
                '</div><div class="overview-meta">' + escapeHtml(importer.description) +
                '</div><div class="chip-list" style="margin-top:10px;">' +
                importer.acceptedFormats.map(function (item) {
                  return '<span class="chip">' + escapeHtml(item) + '</span>';
                }).join('') + '</div></article>';
            }).join('')
          : emptyState('暂无 importer catalog。');

        byId('importJobs').innerHTML = state.jobs && state.jobs.jobs
          ? renderTable(
              [
                { key: 'job', label: '任务' },
                { key: 'source', label: '来源' },
                { key: 'status', label: '状态' },
                { key: 'actions', label: '动作' }
              ],
              state.jobs.jobs.map(function (job) {
                const actions = ['<button class="button button-secondary" data-import-action="history" data-job-id="' + escapeHtml(job.id) + '" type="button">历史</button>'];
                if (job.status === 'pending' || job.status === 'scheduled') {
                  actions.push('<button class="button" data-import-action="run" data-job-id="' + escapeHtml(job.id) + '" type="button">运行</button>');
                }
                if (job.status === 'failed') {
                  actions.push('<button class="button" data-import-action="retry" data-job-id="' + escapeHtml(job.id) + '" type="button">重试</button>');
                }
                if (job.attemptCount > 0 && job.status !== 'running') {
                  actions.push('<button class="button button-secondary" data-import-action="rerun" data-job-id="' + escapeHtml(job.id) + '" type="button">重跑</button>');
                }
                return {
                  job: '<strong>' + escapeHtml(job.id) + '</strong><span class="inline-note">' + escapeHtml(job.sessionId) + (job.workspaceId ? ' · ' + escapeHtml(job.workspaceId) : '') + '</span>',
                  source: renderBadge(localizeUiValue(job.sourceKind), 'neutral') + '<div class="inline-note">尝试: ' + escapeHtml(job.attemptCount) + ' · 重试: ' + escapeHtml(job.retryCount) + '</div>',
                  status: renderBadge(localizeUiValue(job.status), badgeTone(job.status)),
                  actions: '<div class="table-actions">' + actions.join('') + '</div>'
                };
              }),
              '当前没有导入任务。'
            )
          : emptyState('当前没有导入任务。');

        byId('deadLetters').innerHTML = state.deadLetters && state.deadLetters.payload
          ? renderTable(
              [
                { key: 'jobId', label: '任务 ID' },
                { key: 'reason', label: '原因' },
                { key: 'retryCount', label: '重试次数' },
                { key: 'createdAt', label: '创建时间' }
              ],
              state.deadLetters.payload.map(function (entry) {
                return {
                  jobId: '<strong>' + escapeHtml(entry.jobId) + '</strong>',
                  reason: escapeHtml(entry.reason),
                  retryCount: escapeHtml(entry.retryCount),
                  createdAt: escapeHtml(formatDate(entry.createdAt))
                };
              }),
              '当前没有 dead letters。'
            )
          : emptyState('当前没有 dead letters。');

        setJson('importRaw', {
          catalog: state.catalog,
          jobs: state.jobs,
          deadLetters: state.deadLetters,
          history: state.importHistory
        });
      }

      function renderImportHistory() {
        const history = state.importHistory;
        if (!history || !history.payload) {
          byId('importHistory').innerHTML = emptyState('点击任务的“历史”查看最近尝试记录。');
          return;
        }
        byId('importHistory').innerHTML = renderTable(
          [
            { key: 'attempt', label: '尝试' },
            { key: 'action', label: '动作' },
            { key: 'status', label: '状态' },
            { key: 'completedAt', label: '完成时间' }
          ],
          history.payload.map(function (entry) {
            return {
              attempt: '<strong>#' + escapeHtml(entry.attemptNumber) + '</strong>',
              action: renderBadge(localizeUiValue(entry.action), 'neutral'),
              status: renderBadge(localizeUiValue(entry.status), badgeTone(entry.status)),
              completedAt: escapeHtml(formatDate(entry.completedAt))
            };
          }),
          '当前 job 没有历史记录。'
        );
      }

      function renderRuntime() {
        const response = state.runtimeCurrent;
        const payload = response && response.payload ? response.payload : null;
        const list = state.runtimeList && state.runtimeList.payloads ? state.runtimeList.payloads : [];

        if (payload && payload.window) {
          const windowData = payload.window;
          const compression = windowData.compression || {};
          byId('runtimeSummary').innerHTML =
            '<div class="cards">' +
            [
              { title: '来源', value: payload.source || windowData.source || '-', meta: '运行时窗口来源' },
              { title: '预算', value: windowData.totalBudget, meta: '总 token 预算' },
              { title: '压缩数', value: compression.compressedCount, meta: '被摘要替代的历史消息数' },
              { title: '最终消息', value: windowData.final && windowData.final.counts ? windowData.final.counts.total : 0, meta: '保留给宿主组装的消息数' }
            ].map(function (card) {
              return '<article class="overview-card"><div class="overview-card-header"><strong>' +
                escapeHtml(card.title) + '</strong>' + renderBadge('运行时', 'neutral') +
                '</div><div class="overview-value">' + escapeHtml(card.value) +
                '</div><div class="overview-meta">' + escapeHtml(card.meta) + '</div></article>';
            }).join('') +
            '</div>';

          byId('runtimeAssembly').innerHTML = payload.promptAssembly
            ? '<div class="timeline-item"><div class="timeline-item-header"><strong>宿主无关输出</strong>' +
              renderBadge(payload.promptAssembly.includesSystemPromptAddition ? '含 systemPromptAddition' : '仅消息', payload.promptAssembly.includesSystemPromptAddition ? 'healthy' : 'warning') +
              '</div><p>字段: ' + escapeHtml((payload.promptAssembly.providerNeutralOutputs || []).join(', ')) +
              '</p><p class="inline-note">宿主负责: ' + escapeHtml((payload.promptAssembly.hostAssemblyResponsibilities || []).join(' | ')) +
              '</p></div>'
            : emptyState('当前没有 prompt assembly contract。');

          byId('runtimeMessages').innerHTML = windowData.final && windowData.final.summary && windowData.final.summary.length
            ? '<div class="timeline">' + windowData.final.summary.map(function (entry) {
                return '<article class="timeline-item"><div class="timeline-item-header"><strong>' +
                  escapeHtml(localizeUiValue(entry.role)) + '</strong>' + renderBadge((entry.contentTypes || []).join(', ') || 'text', 'neutral') +
                  '</div><p>' + escapeHtml(entry.preview) +
                  '</p><div class="inline-note">' + escapeHtml(entry.id || '-') + ' · ' + escapeHtml(formatDate(entry.timestamp)) +
                  ' · ' + escapeHtml(entry.textLength) + ' 字符</div></article>';
              }).join('') + '</div>'
            : emptyState('当前没有 final message window。');

          byId('runtimePairs').innerHTML = renderTable(
            [
              { key: 'toolName', label: '工具' },
              { key: 'matchKind', label: '匹配方式' },
              { key: 'assistantMessageId', label: '调用消息' },
              { key: 'resultMessageId', label: '结果消息' }
            ],
            (windowData.toolCallResultPairs || []).map(function (pair) {
              return {
                toolName: escapeHtml(pair.toolName || pair.toolCallId || '未知'),
                matchKind: renderBadge(localizeUiValue(pair.matchKind), 'neutral'),
                assistantMessageId: escapeHtml(pair.assistantMessageId || '-'),
                resultMessageId: escapeHtml(pair.resultMessageId || '-')
              };
            }),
            '当前没有 tool call / result pairing。'
          );
        } else {
          byId('runtimeSummary').innerHTML = emptyState('输入 sessionId 后可以查看单条 runtime window；当前显示的是最近快照列表。');
          byId('runtimeAssembly').innerHTML = emptyState('等待指定 sessionId。');
          byId('runtimeMessages').innerHTML = emptyState('等待指定 sessionId。');
          byId('runtimePairs').innerHTML = emptyState('等待指定 sessionId。');
        }

        byId('runtimeSnapshotList').innerHTML = list.length
          ? '<div class="timeline">' + list.map(function (item) {
              const win = item.window;
              return '<article class="timeline-item"><div class="timeline-item-header"><strong>' +
                escapeHtml(win.sessionId) + '</strong>' + renderBadge(localizeUiValue(item.source || win.source || '快照'), 'neutral') +
                '</div><p>' + escapeHtml(item.query || win.query || '无查询词') +
                '</p><div class="inline-note">captured: ' + escapeHtml(formatDate(item.capturedAt || win.capturedAt)) +
                ' · 最终消息: ' + escapeHtml(win.final && win.final.counts ? win.final.counts.total : 0) + '</div></article>';
            }).join('') + '</div>'
          : emptyState('当前没有 runtime snapshots。');

        byId('runtimeTrace').innerHTML = state.runtimeTrace && state.runtimeTrace.payload
          ? '<div class="timeline"><article class="timeline-item"><div class="timeline-item-header"><strong>' +
            escapeHtml(state.runtimeTrace.payload.sessionId) + '</strong>' + renderBadge('轨迹', 'neutral') +
            '</div><p>提案: ' + escapeHtml(state.runtimeTrace.payload.proposals.length) +
            ' · 审计: ' + escapeHtml(state.runtimeTrace.payload.audit.length) +
            ' · 导入: ' + escapeHtml(state.runtimeTrace.payload.imports.length) +
            '</p></article></div>'
          : emptyState('输入 sessionId 后可联查运行时 / 治理轨迹。');

        setJson('runtimeRaw', {
          runtimeList: state.runtimeList,
          runtimeCurrent: state.runtimeCurrent,
          runtimeTrace: state.runtimeTrace
        });
      }

      function renderPlatform() {
        byId('extensionsList').innerHTML = state.extensions && state.extensions.extensions
          ? state.extensions.extensions.map(function (item) {
                return '<article class="overview-card"><div class="overview-card-header"><strong>' +
                  escapeHtml(item.label) + '</strong>' + renderBadge(localizeUiValue(item.status), badgeTone(item.status)) +
                '</div><div class="overview-meta">' + escapeHtml(item.description) +
                '</div><div class="chip-list" style="margin-top:10px;">' +
                (item.capabilities || []).map(function (capability) {
                  return '<span class="chip">' + escapeHtml(capability) + '</span>';
                }).join('') + '</div></article>';
            }).join('')
          : emptyState('暂无扩展。');

        byId('workspaceList').innerHTML = state.workspaces && state.workspaces.payload
          ? renderTable(
              [
                { key: 'workspaceId', label: '工作区' },
                { key: 'jobs', label: '任务数' },
                { key: 'proposals', label: '提案数' },
                { key: 'snapshots', label: '快照数' }
              ],
              state.workspaces.payload.map(function (item) {
                return {
                  workspaceId: '<strong>' + escapeHtml(item.workspaceId) + '</strong>',
                  jobs: escapeHtml(item.jobCount || 0),
                  proposals: escapeHtml(item.proposalCount || 0),
                  snapshots: escapeHtml(item.snapshotCount || 0)
                };
              }),
              '当前没有工作区目录。'
            )
          : emptyState('当前没有工作区目录。');

        byId('platformEvents').innerHTML = state.platformEvents && state.platformEvents.payload
          ? renderTable(
              [
                { key: 'type', label: '类型' },
                { key: 'resourceId', label: '资源' },
                { key: 'stage', label: '阶段' },
                { key: 'createdAt', label: '创建时间' }
              ],
              state.platformEvents.payload.map(function (item) {
                return {
                  type: renderBadge(localizeUiValue(item.type), 'neutral'),
                  resourceId: escapeHtml(item.resourceId || '-'),
                  stage: escapeHtml(item.stage || '-'),
                  createdAt: escapeHtml(formatDate(item.createdAt))
                };
              }),
              '当前没有平台事件。'
            )
          : emptyState('当前没有平台事件。');

        byId('webhookList').innerHTML = state.webhooks && state.webhooks.payload
          ? renderTable(
              [
                { key: 'target', label: '目标' },
                { key: 'eventTypes', label: '事件类型' },
                { key: 'createdAt', label: '创建时间' }
              ],
              state.webhooks.payload.map(function (item) {
                return {
                  target: '<strong>' + escapeHtml(item.target) + '</strong>',
                  eventTypes: escapeHtml((item.eventTypes || []).join(', ')),
                  createdAt: escapeHtml(formatDate(item.createdAt))
                };
              }),
              '当前没有 Webhook 订阅。'
            )
          : emptyState('当前没有 Webhook 订阅。');

        byId('autonomyRecommendations').innerHTML = state.autonomy && state.autonomy.payload
          ? state.autonomy.payload.recommendations && state.autonomy.payload.recommendations.length
            ? '<div class="timeline">' + state.autonomy.payload.recommendations.map(function (item) {
                return '<article class="timeline-item"><div class="timeline-item-header"><strong>' +
                  escapeHtml(item.title || localizeUiValue(item.type) || '建议') + '</strong>' +
                  renderBadge(localizeUiValue(item.priority || 'neutral'), badgeTone(item.priority === 'high' ? 'warning' : 'neutral')) +
                  '</div><p>' + escapeHtml(item.summary || item.message || '') + '</p></article>';
              }).join('') + '</div>'
            : emptyState('当前没有自治建议。')
          : emptyState('点击“生成建议”后在这里查看自治建议。');

        setJson('platformRaw', {
          extensions: state.extensions,
          workspaces: state.workspaces,
          platformEvents: state.platformEvents,
          webhooks: state.webhooks,
          autonomy: state.autonomy
        });
      }

      async function loadHealth() {
        state.health = await requestJson('/api/health');
        renderOverview();
      }

      async function loadObservability() {
        state.observability = await requestJson('/api/observability/dashboard');
        state.observabilityHistory = await requestJson('/api/observability/history');
        state.thresholds = await requestJson('/api/observability/thresholds?stage=default');
        state.subscriptions = await requestJson('/api/observability/subscriptions');
        renderObservability();
      }

      async function loadGovernance() {
        state.proposals = await requestJson('/api/governance/proposals');
        state.audit = await requestJson('/api/governance/audit');
        state.templates = await requestJson('/api/governance/templates');
        renderGovernance();
      }

      async function loadImports() {
        state.catalog = await requestJson('/api/import/catalog');
        state.jobs = await requestJson('/api/import/jobs');
        state.deadLetters = await requestJson('/api/import/dead-letters');
        renderImports();
        renderImportHistory();
      }

      async function loadImportHistory(jobId) {
        state.importHistory = await requestJson('/api/import/jobs/' + encodeURIComponent(jobId) + '/history');
        renderImports();
        renderImportHistory();
      }

      async function loadRuntimeList() {
        state.runtimeList = await requestJson('/api/runtime/snapshots');
        renderRuntime();
      }

      async function loadRuntimeSession(sessionId) {
        state.runtimeCurrent = await requestJson('/api/runtime/snapshots?sessionId=' + encodeURIComponent(sessionId));
        renderRuntime();
      }

      async function loadRuntimeTrace(sessionId) {
        state.runtimeTrace = await requestJson('/api/workbench/runtime-governance-trace?sessionId=' + encodeURIComponent(sessionId));
        renderRuntime();
      }

      async function loadPlatform() {
        state.extensions = await requestJson('/api/extensions');
        state.workspaces = await requestJson('/api/workspaces');
        state.platformEvents = await requestJson('/api/platform/events');
        state.webhooks = await requestJson('/api/platform/webhooks/subscriptions');
        renderPlatform();
      }

      async function loadAutonomy() {
        state.autonomy = await requestJson('/api/autonomy/recommendations?stage=stage-9');
        renderPlatform();
      }

      async function loadAll() {
        setStatus('正在加载', 'warning', '同步健康度、观测、治理、导入、运行时和平台数据');
        try {
          await Promise.all([loadHealth(), loadObservability(), loadGovernance(), loadImports(), loadRuntimeList(), loadPlatform()]);
          state.lastLoadedAt = new Date().toISOString();
          setStatus('平台可用', 'success', '最近刷新：' + formatDate(state.lastLoadedAt));
          byId('heroFocus').textContent = '当前数据已加载，可以直接在治理、导入、运行时和平台分区里执行动作。';
        } catch (error) {
          setStatus('加载失败', 'error', String(error));
          showToast('控制台初始化失败：' + error.message, 'error');
          throw error;
        }
      }

      async function submitGovernanceProposal(event) {
        event.preventDefault();
        const scope = byId('proposalScope').value;
        const conceptId = byId('proposalConceptId').value.trim();
        const alias = byId('proposalAlias').value.trim();
        const reason = byId('proposalReason').value.trim();
        const sessionId = byId('proposalSessionId').value.trim();
        if (!conceptId || !alias || !reason) {
          showToast('请把 Concept ID、别名和原因补完整。', 'error');
          return;
        }
        const createdAt = new Date().toISOString();
        await requestJson('/api/governance/proposals', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-control-plane-authority': authorityForScope(scope)
          },
          body: JSON.stringify({
            targetScope: scope,
            reason: reason,
            corrections: [
              {
                id: 'console-correction-' + Date.now(),
                targetKind: 'concept_alias',
                targetId: conceptId,
                action: 'apply',
                reason: reason,
                author: 'control-plane-console',
                createdAt: createdAt,
                metadata: {
                  alias: alias
                }
              }
            ],
            sessionId: sessionId || undefined,
            submittedBy: 'control-plane-console'
          })
        });
        showToast('治理提案已提交。', 'success');
        byId('proposalAlias').value = '';
        byId('proposalReason').value = '';
        await loadGovernance();
      }

      async function handleProposalAction(action, proposalId, scope) {
        const authority = authorityForScope(scope);
        const path = action === 'approve' || action === 'reject' ? 'review' : action;
        const body = action === 'approve' || action === 'reject'
          ? { reviewedBy: 'control-plane-console', decision: action === 'approve' ? 'approve' : 'reject' }
          : action === 'apply'
            ? { appliedBy: 'control-plane-console' }
            : { rolledBackBy: 'control-plane-console', note: 'rolled back from console' };
        await requestJson('/api/governance/proposals/' + encodeURIComponent(proposalId) + '/' + path, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-control-plane-authority': authority
          },
          body: JSON.stringify(body)
        });
        showToast('提案动作已执行：' + action, 'success');
        await loadGovernance();
      }

      function sourceTypeForImport(kind) {
        return kind === 'structured_input' ? 'conversation' : 'document';
      }

      async function submitImportJob(event) {
        event.preventDefault();
        const sessionId = byId('importSessionId').value.trim();
        const workspaceId = byId('importWorkspaceId').value.trim();
        const sourceKind = byId('importSourceKind').value;
        const content = byId('importContent').value.trim();
        if (!sessionId || !content) {
          showToast('导入任务至少需要 sessionId 和内容。', 'error');
          return;
        }
        await requestJson('/api/import/jobs', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: sessionId,
            workspaceId: workspaceId || undefined,
            sourceKind: sourceKind,
            requestedBy: 'control-plane-console',
            input: {
              sessionId: sessionId,
              workspaceId: workspaceId || undefined,
              records: [
                {
                  id: 'console-record-' + Date.now(),
                  scope: workspaceId ? 'workspace' : 'session',
                  sourceType: sourceTypeForImport(sourceKind),
                  role: 'system',
                  content: content
                }
              ]
            }
          })
        });
        showToast('导入任务已创建。', 'success');
        byId('importContent').value = '';
        await loadImports();
      }

      async function handleImportAction(action, jobId) {
        if (action === 'history') {
          await loadImportHistory(jobId);
          showToast('已加载导入历史。', 'success');
          return;
        }
        await requestJson('/api/import/jobs/' + encodeURIComponent(jobId) + '/' + action, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({})
        });
        showToast('导入动作已执行：' + action, 'success');
        await loadImports();
      }

      async function submitSubscription(event) {
        event.preventDefault();
        const channel = byId('subscriptionChannel').value;
        const target = byId('subscriptionTarget').value.trim();
        if (!target) {
          showToast('请输入订阅目标。', 'error');
          return;
        }
        await requestJson('/api/observability/subscriptions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            stage: 'default',
            channel: channel,
            target: target
          })
        });
        showToast('观测订阅已创建。', 'success');
        byId('subscriptionTarget').value = '';
        await loadObservability();
      }

      async function captureObservabilitySnapshot() {
        await requestJson('/api/observability/snapshots', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            stage: 'stage-6-observability-dashboard'
          })
        });
        showToast('观测快照已记录。', 'success');
        await loadObservability();
      }

      async function inspectRuntime(event) {
        event.preventDefault();
        const sessionId = byId('runtimeSessionId').value.trim();
        if (!sessionId) {
          showToast('请输入 sessionId。', 'error');
          return;
        }
        await loadRuntimeSession(sessionId);
        showToast('运行时窗口已刷新。', 'success');
      }

      async function submitExtension(event) {
        event.preventDefault();
        const id = byId('extensionId').value.trim();
        const label = byId('extensionLabel').value.trim();
        const kind = byId('extensionKind').value;
        const description = byId('extensionDescription').value.trim();
        const capabilities = byId('extensionCapabilities').value.split(',').map(function (item) {
          return item.trim();
        }).filter(Boolean);
        if (!id || !label || !description) {
          showToast('请把扩展 ID、名称和描述填完整。', 'error');
          return;
        }
        await requestJson('/api/extensions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            id: id,
            label: label,
            description: description,
            kind: kind,
            source: 'local',
            version: 'console.v1',
            apiVersion: 'control-plane-extension.v1',
            providerNeutral: true,
            capabilities: capabilities
          })
        });
        showToast('扩展已注册。', 'success');
        byId('extensionId').value = '';
        byId('extensionLabel').value = '';
        byId('extensionDescription').value = '';
        byId('extensionCapabilities').value = '';
        await loadPlatform();
      }

      async function submitWebhook(event) {
        event.preventDefault();
        const target = byId('webhookTarget').value.trim();
        const eventTypes = byId('webhookEvents').value.split(',').map(function (item) {
          return item.trim();
        }).filter(Boolean);
        if (!target || !eventTypes.length) {
          showToast('Webhook 需要目标地址和至少一个事件类型。', 'error');
          return;
        }
        await requestJson('/api/platform/webhooks/subscriptions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            target: target,
            eventTypes: eventTypes
          })
        });
        showToast('Webhook 已创建。', 'success');
        byId('webhookTarget').value = '';
        byId('webhookEvents').value = '';
        await loadPlatform();
      }

      document.addEventListener('click', function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const action = target.getAttribute('data-action');
        if (action === 'refresh-health') {
          loadHealth().then(function () { showToast('健康度已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-observability') {
          loadObservability().then(function () { showToast('观测数据已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'capture-observability') {
          captureObservabilitySnapshot().catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-governance') {
          loadGovernance().then(function () { showToast('治理数据已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-imports') {
          loadImports().then(function () { showToast('导入数据已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-runtime-list') {
          loadRuntimeList().then(function () { showToast('最近运行时快照已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-platform') {
          loadPlatform().then(function () { showToast('平台数据已刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }
        if (action === 'refresh-autonomy') {
          loadAutonomy().then(function () { showToast('自治建议已生成。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
          return;
        }

        const proposalAction = target.getAttribute('data-proposal-action');
        if (proposalAction) {
          handleProposalAction(proposalAction, target.getAttribute('data-proposal-id'), target.getAttribute('data-scope')).catch(function (error) {
            showToast(error.message, 'error');
          });
          return;
        }

        const importAction = target.getAttribute('data-import-action');
        if (importAction) {
          handleImportAction(importAction, target.getAttribute('data-job-id')).catch(function (error) {
            showToast(error.message, 'error');
          });
        }
      });

      byId('refreshAll').addEventListener('click', function () {
        loadAll().then(function () { showToast('控制台已完成整页刷新。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
      });
      byId('governanceForm').addEventListener('submit', function (event) { submitGovernanceProposal(event).catch(function (error) { showToast(error.message, 'error'); }); });
      byId('importForm').addEventListener('submit', function (event) { submitImportJob(event).catch(function (error) { showToast(error.message, 'error'); }); });
      byId('subscriptionForm').addEventListener('submit', function (event) { submitSubscription(event).catch(function (error) { showToast(error.message, 'error'); }); });
      byId('runtimeForm').addEventListener('submit', function (event) { inspectRuntime(event).catch(function (error) { showToast(error.message, 'error'); }); });
      byId('loadRuntimeTrace').addEventListener('click', function () {
        const sessionId = byId('runtimeSessionId').value.trim();
        if (!sessionId) {
          showToast('请先输入 sessionId。', 'error');
          return;
        }
        loadRuntimeTrace(sessionId).then(function () { showToast('运行时 / 治理轨迹已加载。', 'success'); }).catch(function (error) { showToast(error.message, 'error'); });
      });
      byId('extensionForm').addEventListener('submit', function (event) { submitExtension(event).catch(function (error) { showToast(error.message, 'error'); }); });
      byId('webhookForm').addEventListener('submit', function (event) { submitWebhook(event).catch(function (error) { showToast(error.message, 'error'); }); });

      loadAll().catch(function () {
        return undefined;
      });
    </script>
  </body>
</html>`;
}
