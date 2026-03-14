import type { ContextInputRouteKind, SemanticExtractionNodeTarget } from '../types/context-processing.js';
import { normalizeUtteranceText } from './utterance-parser.js';

const GOAL_REGEX =
  /\b(?:need|goal|want|trying to|aim to)\b|\u9700\u8981|\u76ee\u6807|\u60f3\u8981|\u6253\u7b97|\u51c6\u5907/iu;
const CONSTRAINT_REGEX =
  /\b(?:must|must not|should|should not|cannot|can not|can't|never|required|requirement)\b|\u5fc5\u987b|\u4e0d\u80fd|\u4e0d\u53ef\u4ee5|\u4e0d\u8981|\u7981\u6b62|\u8981\u6c42/iu;
const STEP_REGEX =
  /\b(?:step|next step|first|second|before|after|then)\b|\u7b2c.{0,3}\u6b65|\u4e0b\u4e00\u6b65|\u5148|\u518d|\u4e4b\u540e|\u7136\u540e/iu;
const PROCESS_REGEX =
  /\b(?:process|workflow|pipeline|phase|stage)\b|\u6d41\u7a0b|\u5de5\u4f5c\u6d41|\u9636\u6bb5|\u7ba1\u7ebf/iu;
const RISK_REGEX =
  /\b(?:risk|warning|blocked|failure|failed|error|exception|timeout|incident)\b|\u98ce\u9669|\u8b66\u544a|\u5931\u8d25|\u9519\u8bef|\u5f02\u5e38|\u8d85\u65f6|\u963b\u585e/iu;
const OUTCOME_REGEX =
  /\b(?:result|outcome|success|succeeded|completed)\b|\u7ed3\u679c|\u4ea7\u51fa|\u6210\u529f|\u5b8c\u6210/iu;
const TOOL_REGEX =
  /\b(?:tool|cli|command|api|script|artifact)\b|\u5de5\u5177|\u547d\u4ee4|\u811a\u672c|\u63a5\u53e3|\u4ea7\u7269/iu;
const MODE_REGEX =
  /\b(?:mode|strict mode|debug mode|compatibility)\b|\u6a21\u5f0f|\u8c03\u8bd5\u6a21\u5f0f|\u4e25\u683c\u6a21\u5f0f|\u517c\u5bb9\u6a21\u5f0f/iu;
const SKILL_REGEX =
  /\b(?:skill|pattern|playbook|procedure)\b|\u6280\u80fd|\u6a21\u5f0f|\u7ecf\u9a8c|\u6d41\u7a0b\u5361\u7247/iu;
const TOPIC_REGEX =
  /\b(?:provenance|checkpoint|knowledge graph|context compression|prompt|bundle|trace)\b|\u77e5\u8bc6\u56fe\u8c31|\u4e0a\u4e0b\u6587\u538b\u7f29|\u6765\u6e90\u8ffd\u8e2a|\u68c0\u67e5\u70b9|\u63d0\u793a\u8bcd|\u4e0a\u4e0b\u6587\u5305/iu;
const QUESTION_REGEX =
  /\?$|\u600e\u4e48|\u5982\u4f55|\u4e3a\u4f55|\u4e3a\u4ec0\u4e48|\u54ea\u4e00\u6b65|\u54ea\u4e2a|\u4ec0\u4e48|\b(?:what|why|how|which)\b/iu;

export function classifySemanticSpan(
  text: string,
  route: ContextInputRouteKind,
  supportedTypes: readonly SemanticExtractionNodeTarget[],
  hasConceptMatch: boolean
): SemanticExtractionNodeTarget[] {
  const normalized = normalizeUtteranceText(text);
  const candidates = new Set<SemanticExtractionNodeTarget>();
  const add = (type: SemanticExtractionNodeTarget): void => {
    if (supportedTypes.includes(type)) {
      candidates.add(type);
    }
  };

  if (route === 'conversation') {
    add('Intent');
  } else if (route === 'tool_result') {
    add('State');
  } else if (route === 'transcript' || route === 'experience_trace') {
    add('Decision');
  } else {
    add('Topic');
  }

  if (QUESTION_REGEX.test(normalized)) {
    add('Intent');
    add('Topic');
  }

  if (GOAL_REGEX.test(normalized)) {
    add('Goal');
  }

  if (CONSTRAINT_REGEX.test(normalized)) {
    add('Constraint');
    add('Rule');
  }

  if (STEP_REGEX.test(normalized)) {
    add('Step');
    add('Process');
  }

  if (PROCESS_REGEX.test(normalized)) {
    add('Process');
  }

  if (RISK_REGEX.test(normalized)) {
    add('Risk');
    add('State');
  }

  if (OUTCOME_REGEX.test(normalized)) {
    add('Outcome');
  }

  if (TOOL_REGEX.test(normalized)) {
    add('Tool');
  }

  if (MODE_REGEX.test(normalized)) {
    add('Mode');
  }

  if (SKILL_REGEX.test(normalized)) {
    add('Skill');
  }

  if (TOPIC_REGEX.test(normalized)) {
    add('Topic');
    add('Concept');
  }

  if (hasConceptMatch) {
    add('Topic');
    add('Concept');
  }

  if (candidates.size === 0) {
    for (const fallbackType of defaultFallbackTypes(route, supportedTypes)) {
      candidates.add(fallbackType);
    }
  }

  return [...candidates];
}

function defaultFallbackTypes(
  route: ContextInputRouteKind,
  supportedTypes: readonly SemanticExtractionNodeTarget[]
): SemanticExtractionNodeTarget[] {
  const preferredByRoute: Record<ContextInputRouteKind, SemanticExtractionNodeTarget[]> = {
    conversation: ['Intent', 'Topic'],
    tool_result: ['State', 'Risk'],
    transcript: ['Decision', 'Topic'],
    document: ['Rule', 'Topic'],
    experience_trace: ['Decision', 'State'],
    system: ['Rule', 'Constraint']
  };

  return preferredByRoute[route].filter((type) => supportedTypes.includes(type));
}
