import type {
  OpenClawCliProgramLike,
  OpenClawPluginApi
} from '@openclaw-compact-context/openclaw-adapter/openclaw/types';
import { createProcessCliIo, executeContextCli } from './context-cli-runtime.js';

type HostCommandOptions = Record<string, unknown>;

export function registerCompactContextHostCli(api: OpenClawPluginApi): void {
  if (!api.registerCli) {
    return;
  }

  api.registerCli(
    ({ program }) => {
      const compactContext = program
        .command('compact-context')
        .description('Compact Context Engine 的摘要、roundtrip、explain 与模型管理命令。');

      compactContext.addHelpText?.(
        'after',
        () =>
          '\nExamples:\n' +
          '  openclaw compact-context summarize --text "今天先把首页做成控制塔视角，并保留任务总览。"\n' +
          '  openclaw compact-context roundtrip --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"\n' +
          '  openclaw compact-context explain --mode llm --model qwen-compatible/qwen3.5-plus --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2\n' +
          '  openclaw compact-context models list\n'
      );

      registerSummarizeCommand(compactContext);
      registerRoundtripCommand(compactContext);
      registerExplainCommand(compactContext);
      registerModelsCommands(compactContext);
      registerAuthCommands(compactContext);
    },
    { commands: ['compact-context'] }
  );
}

function registerSummarizeCommand(program: OpenClawCliProgramLike): void {
  program
    .command('summarize')
    .description('对一段文本做代码摘要、Codex 摘要或通用 LLM 摘要。')
    .option('--text <text>', '直接传入输入文本。')
    .option('--file <path>', '从 UTF-8 文件读取输入文本。')
    .option('--mode <mode>', 'auto / code / codex / codex-cli / codex-oauth / openai-responses / llm（默认 llm）')
    .option('--instruction <text>', '覆盖默认摘要指令。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--model <provider>/<model>', '显式指定模型。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('summarize', options, ['text', 'file', 'mode', 'instruction', 'config', 'model'], ['json']));
    });
}

function registerRoundtripCommand(program: OpenClawCliProgramLike): void {
  program
    .command('roundtrip')
    .description('对一段文本执行 ingest -> compile，并输出紧凑视图或 JSON。')
    .option('--text <text>', '直接传入输入文本。')
    .option('--file <path>', '从 UTF-8 文件读取输入文本。')
    .option('--query <text>', '覆盖 compile query。')
    .option('--mode <mode>', 'auto / code / codex / codex-cli / codex-oauth / openai-responses / llm（默认 llm）')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--model <provider>/<model>', '显式指定模型。')
    .option('--token-budget <n>', 'compile token budget。')
    .option('--session <id>', '显式 session id。')
    .option('--workspace <id>', '显式 workspace id。')
    .option('--instruction <text>', '覆盖默认摘要指令。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(
        buildArgs(
          'roundtrip',
          options,
          ['text', 'file', 'query', 'mode', 'config', 'model', 'tokenBudget', 'session', 'workspace', 'instruction'],
          ['json']
        )
      );
    });
}

function registerExplainCommand(program: OpenClawCliProgramLike): void {
  program
    .command('explain')
    .description('对当前 bundle 里的选中节点执行 explain。')
    .option('--text <text>', '直接传入输入文本。')
    .option('--file <path>', '从 UTF-8 文件读取输入文本。')
    .option('--query <text>', '覆盖 compile query。')
    .option('--mode <mode>', 'auto / code / codex / codex-cli / codex-oauth / openai-responses / llm（默认 llm）')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--model <provider>/<model>', '显式指定模型。')
    .option('--limit <n>', '解释节点数量上限。')
    .option('--node-id <id>', '只解释一个指定 node。')
    .option('--token-budget <n>', 'compile token budget。')
    .option('--session <id>', '显式 session id。')
    .option('--workspace <id>', '显式 workspace id。')
    .option('--instruction <text>', '覆盖默认摘要指令。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(
        buildArgs(
          'explain',
          options,
          [
            'text',
            'file',
            'query',
            'mode',
            'config',
            'model',
            'limit',
            'nodeId',
            'tokenBudget',
            'session',
            'workspace',
            'instruction'
          ],
          ['json']
        )
      );
    });
}

function registerModelsCommands(program: OpenClawCliProgramLike): void {
  const models = program.command('models').description('查看、设置当前模型和默认模型。');

  models
    .command('list')
    .description('列出 catalog 里的 provider 与模型。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['list']));
    });

  models
    .command('current')
    .description('显示当前模型、默认模型与最终生效模型。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['current']));
    });

  models
    .command('use')
    .description('设置当前模型。')
    .argument('<modelRef>', '模型引用，格式为 <provider>/<model>')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (modelRef: unknown, options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['use', String(modelRef)]));
    });

  models
    .command('default')
    .description('设置长期默认模型。')
    .argument('<modelRef>', '模型引用，格式为 <provider>/<model>')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (modelRef: unknown, options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['default', String(modelRef)]));
    });

  models
    .command('clear')
    .description('清空当前模型状态。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['clear']));
    });

  models
    .command('reset')
    .description('同时清空当前模型状态和默认模型。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('models', options, ['config'], ['json'], ['reset']));
    });
}

function registerAuthCommands(program: OpenClawCliProgramLike): void {
  const auth = program.command('auth').description('查看、登录或清理 Codex OAuth 凭据。');

  auth
    .command('status')
    .description('显示当前 Codex OAuth 凭据状态。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('auth', options, ['config'], ['json'], ['status']));
    });

  auth
    .command('login')
    .description('打开浏览器完成 Codex OAuth 登录，并写入凭据文件。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--timeout-ms <n>', '等待浏览器回调的超时时间。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('auth', options, ['config', 'timeoutMs'], ['json'], ['login']));
    });

  auth
    .command('logout')
    .description('清理本地 Codex OAuth 凭据文件。')
    .option('--config <path>', '指定 LLM 配置文件。')
    .option('--json', '输出完整 JSON。', false)
    .action(async (options: HostCommandOptions) => {
      await runHostCommand(buildArgs('auth', options, ['config'], ['json'], ['logout']));
    });
}

async function runHostCommand(args: string[]): Promise<void> {
  const exitCode = await executeContextCli(args, createProcessCliIo(), {
    invocationName: 'openclaw compact-context'
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function buildArgs(
  command: string,
  options: HostCommandOptions,
  valueKeys: string[],
  booleanKeys: string[],
  prefixArgs: string[] = []
): string[] {
  const args = [command, ...prefixArgs];

  for (const key of valueKeys) {
    const value = options[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    args.push(toCliFlag(key), String(value));
  }

  for (const key of booleanKeys) {
    if (options[key] === true) {
      args.push(toCliFlag(key));
    }
  }

  return args;
}

function toCliFlag(key: string): string {
  return `--${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}
