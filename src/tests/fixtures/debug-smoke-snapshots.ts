export const EXPECTED_INSPECT_BUNDLE_SUMMARY = `[Compact Context Engine]
Goal: conversation:We need to understand why the build is blocked and keep provenance intact.
Active rules: rule:Always preserve provenance when selecting context.
Current step: workflow:Step 4: produce a long current process explanation with enough detail to overflow the tiny debug
Evidence: tool_output:build failed and is blocked by a sqlite timeout during migration step 4. | conversation:We need to understand why the build is blocked and keep provenance intact. | rule:Always preserve provenance when selecting context. | workflow:Step 4: produce a long current process explanation with enough detail to overflow the tiny debug
Open risks: tool_output:build failed and is blocked by a sqlite timeout during migration step 4.
Budget used: 705/720
[Selection Diagnostics]
Fixed context: selected 2 | skipped 0
activeRules: selected 1/1, skipped 0, budget 103, refill 0
openRisks: selected 1/1, skipped 0, budget 72, refill 0
relevantEvidence: selected 4/6, skipped 2, budget 82, refill 3`;

export const EXPECTED_INSPECT_BUNDLE_PROMPT_PREVIEW = `[Compact Context Engine]
Goal: conversation:We need to understand why the build is blocked and keep provenance intact.
Active rules: rule:Always preserve provenance when selecting context.
Current step: workflow:Step 4: produce a long current process explanation with enough detail to overflow the tiny debug
Evidence: tool_output:build failed and is blocked by a sqlite timeout during migration step 4. | conversation:We need to understand why the build is blocked and keep provenance intact. | rule:Always preserve provenance when selecting context. | workflow:Step 4: produce a long current process explanation with enough detail to overflow the tiny debug
Open risks: tool_output:build failed and is blocked by a sqlite timeout during migration step 4.
Budget used: 705/720`;

export const EXPECTED_QUERY_EXPLAIN_SNAPSHOT = {
  selectionContext: {
    sessionId: 'session-debug-snapshot',
    query: 'why is the build blocked'
  },
  explainedCount: 2,
  totalNodeCount: 2,
  truncated: false,
  explanations: [
    {
      type: 'Risk',
      label: 'tool_output:build failed and is blocked by a sqlite timeout during migration step 4.',
      provenance: 'raw/tool_output_raw',
      summary:
        'Risk "tool_output:build failed and is blocked by a sqlite timeout during migration step 4." is active in session scope with 1 linked edges. Provenance: raw / tool_output_raw / compact-context. Governance: state=raw; validity=freshness=active, confidence=0.95; prompt=eligible, raw, high, reserved, needs-evidence, needs-compression; scope=current=session, recall=session_primary, write=session_open, promote=stay. Derived from 1 node(s). Raw source id: session-debug-snapshot:risk. Selection: included in openRisks. Reason: open risk (raw:tool_output_raw, readiness:raw/high/reserved). Scope: session scope remains the primary recall source. Query: "why is the build blocked". Category budget: 43.',
      trace: {
        source: {
          sourceStage: 'tool_output_raw',
          rawSourceId: 'session-debug-snapshot:risk'
        },
        transformation: {
          evidenceNodeId: 'session-debug-snapshot:risk',
          semanticNodeIdPresent: true
        },
        selection: {
          evaluated: true,
          included: true,
          slot: 'openRisks',
          reason: 'open risk (raw:tool_output_raw, readiness:raw/high/reserved)',
          scopeReason: 'session scope remains the primary recall source',
          query: 'why is the build blocked',
          tokenBudget: 512,
          categoryBudget: 43
        },
        output: {
          promptReady: true,
          preferredForm: 'raw',
          assembledIntoPrompt: true,
          summarizedIntoCompactView: false,
          summaryOnlyReason: 'node requires compression before prompt assembly'
        }
      },
      selection: {
        included: true,
        slot: 'openRisks',
        reason: 'open risk (raw:tool_output_raw, readiness:raw/high/reserved)',
        scopeReason: 'session scope remains the primary recall source',
        query: 'why is the build blocked',
        tokenBudget: 512,
        categoryBudget: 43
      },
      relatedNodes: [
        {
          type: 'Evidence',
          label: 'tool_output:build failed and is blocked by a sqlite timeout during migration step 4.',
          provenance: 'raw/tool_output_raw'
        }
      ]
    },
    {
      type: 'Rule',
      label: 'rule:Always preserve provenance when selecting context.',
      provenance: 'raw/document_raw',
      summary:
        'Rule "rule:Always preserve provenance when selecting context." is active in session scope with 1 linked edges. Provenance: raw / document_raw / compact-context. Governance: state=raw; validity=freshness=active, confidence=1, conflict=none, resolution=unresolved; prompt=eligible, raw, high, reserved, needs-evidence; scope=current=session, recall=session_primary, write=session_open, promote=stay. Derived from 1 node(s). Raw source id: session-debug-snapshot:rule. Selection: included in activeRules. Reason: active rule (raw:document_raw, readiness:raw/high/reserved). Scope: session scope remains the primary recall source. Query: "why is the build blocked". Category budget: 61.',
      trace: {
        source: {
          sourceStage: 'document_raw',
          rawSourceId: 'session-debug-snapshot:rule'
        },
        transformation: {
          evidenceNodeId: 'session-debug-snapshot:rule',
          semanticNodeIdPresent: true
        },
        selection: {
          evaluated: true,
          included: true,
          slot: 'activeRules',
          reason: 'active rule (raw:document_raw, readiness:raw/high/reserved)',
          scopeReason: 'session scope remains the primary recall source',
          query: 'why is the build blocked',
          tokenBudget: 512,
          categoryBudget: 61
        },
        output: {
          promptReady: true,
          preferredForm: 'raw',
          assembledIntoPrompt: true,
          summarizedIntoCompactView: false
        }
      },
      selection: {
        included: true,
        slot: 'activeRules',
        reason: 'active rule (raw:document_raw, readiness:raw/high/reserved)',
        scopeReason: 'session scope remains the primary recall source',
        query: 'why is the build blocked',
        tokenBudget: 512,
        categoryBudget: 61
      },
      relatedNodes: [
        {
          type: 'Evidence',
          label: 'rule:Always preserve provenance when selecting context.',
          provenance: 'raw/document_raw'
        }
      ]
    }
  ]
} as const;
