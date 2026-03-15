# Context Processing 文档说明

这个目录只放“上下文处理”本身的文档，重点回答：

- runtime window 从哪里来
- 上下文如何解析、归一化、压缩、编译
- 我们最终产出的 provider-neutral 结果是什么
- runtime snapshot 怎么持久化和调试

适合放在这里的文档：
- runtime context contract
- prompt assembly contract
- runtime snapshot persistence
- 上下文处理代码流转图
- 上下文处理专项 TODO / 策略说明

推荐先看：
1. [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
2. [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
3. [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
4. [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)

不建议放在这里的内容：
- control plane service contract
- import job 规范
- gateway 运维手册
- 阶段状态报告
