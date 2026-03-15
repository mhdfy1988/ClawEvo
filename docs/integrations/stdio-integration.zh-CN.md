# Context Engine Stdio 接入说明

## 1. 目标

这个入口用于让 OpenClaw 或其他宿主通过 `stdio` 调用 Context Engine 插件。

当前形式是：

```text
host process
-> spawn openclaw-context-plugin
-> stdin 发送一行一个 JSON request
-> stdout 返回一行一个 JSON response
```

## 2. 启动方式

构建后可直接启动：

```bash
node ./dist/bin/openclaw-context-plugin.js --db ./.openclaw/context-engine.sqlite
```

如果只想临时跑内存模式：

```bash
node ./dist/bin/openclaw-context-plugin.js --memory
```

## 3. 协议格式

每个请求必须是一行 JSON。

示例：

```json
{
  "requestId": "req-1",
  "method": "health",
  "payload": {
    "includeStorage": true
  }
}
```

插件会返回一行 JSON 响应：

```json
{
  "requestId": "req-1",
  "method": "health",
  "ok": true,
  "data": {
    "ok": true,
    "storage": {
      "graph": "sqlite",
      "persistence": "sqlite"
    }
  }
}
```

## 4. 推荐宿主调用顺序

对一次典型任务，推荐顺序如下：

1. `ingest_context`
2. `compile_context`
3. `create_checkpoint`
4. `crystallize_skills`
5. `explain` 或 `query_nodes/query_edges`

## 5. 示例请求

### 5.1 ingest_context

```json
{
  "requestId": "req-ingest-1",
  "method": "ingest_context",
  "payload": {
    "sessionId": "session-demo",
    "records": [
      {
        "scope": "global",
        "sourceType": "rule",
        "content": "Default mode forbids request_user_input",
        "metadata": {
          "nodeType": "Rule",
          "strength": "hard"
        }
      }
    ]
  }
}
```

### 5.2 compile_context

```json
{
  "requestId": "req-compile-1",
  "method": "compile_context",
  "payload": {
    "sessionId": "session-demo",
    "query": "build sqlite persistence for plugin runtime",
    "tokenBudget": 1600
  }
}
```

### 5.3 create_checkpoint

`create_checkpoint` 需要先拿到 `compile_context` 返回的 `bundle` 再原样传回。

## 6. 代码入口

- 启动脚本：
  [openclaw-context-plugin.ts](/d:/C_Project/openclaw_compact_context/src/bin/openclaw-context-plugin.ts)

- stdio server：
  [stdio-server.ts](/d:/C_Project/openclaw_compact_context/src/plugin/stdio-server.ts)

- 插件适配器：
  [context-engine-plugin.ts](/d:/C_Project/openclaw_compact_context/src/plugin/context-engine-plugin.ts)

## 7. 当前假设

这份接入层采用的是通用 `stdio JSONL` 协议。  
如果后面 OpenClaw 有固定插件协议，可以保留当前 `ContextEnginePlugin` 作为核心适配层，只替换最外层传输壳。
