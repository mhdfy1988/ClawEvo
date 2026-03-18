import type { RawContextRecord } from '@openclaw-compact-context/contracts';
import type {
  ContextInputRouteKind,
  ContextProcessingFallbackKind,
  UtteranceClause,
  UtteranceClauseBoundary,
  UtteranceParseResult,
  UtteranceSentence
} from '@openclaw-compact-context/contracts';
import {
  CONTEXT_PROCESSING_CONTRACT_VERSION,
  getSemanticExtractionContract,
  resolveContextInputRoute
} from './context-processing-contracts.js';

const ENGLISH_SENTENCE_TERMINATORS = new Set(['.', '!', '?']);
const CJK_SENTENCE_TERMINATORS = new Set(['。', '！', '？']);
const CLAUSE_PUNCTUATION = new Set([',', '，', ';', '；']);
const CONNECTOR_REGEX =
  /\b(?:and|but|then|however|because|while|before|after|if|when|unless|so|or)\b|但是|不过|然后|并且|而且|以及|如果|因为|所以|否则|之后|之前|同时|另外|或者/gimu;
const CONNECTOR_LEFT_BOUNDARY = /[\s,，；。\[{'"“‘]/u;

export function parseContextRecordUtterance(record: RawContextRecord): UtteranceParseResult {
  const route = resolveContextInputRoute(record);
  return parseUtterance(record.content, route);
}

export function parseUtterance(text: string, route: ContextInputRouteKind): UtteranceParseResult {
  const contract = getSemanticExtractionContract(route);
  const sentences = splitIntoSentences(text);
  const appliedFallbacks: ContextProcessingFallbackKind[] = [];

  if (sentences.length === 0) {
    return {
      version: CONTEXT_PROCESSING_CONTRACT_VERSION,
      route,
      clauseSplitApplied: false,
      appliedFallbacks: ['raw_record'],
      sentences: [],
      clauses: []
    };
  }

  const clauses = contract.clauseSplit
    ? splitSentencesIntoClauses(text, sentences)
    : buildFallbackClausesFromSentences(sentences);

  if (!contract.clauseSplit) {
    appliedFallbacks.push('sentence_split');
  }

  if (clauses.length === 0) {
    appliedFallbacks.push('coarse_node');
  }

  return {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route,
    clauseSplitApplied: contract.clauseSplit,
    appliedFallbacks,
    sentences,
    clauses: clauses.length > 0 ? clauses : buildFallbackClausesFromSentences(sentences)
  };
}

function splitIntoSentences(text: string): UtteranceSentence[] {
  const sentences: UtteranceSentence[] = [];
  let cursor = 0;
  let sentenceIndex = 0;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];

    if (!current) {
      continue;
    }

    if (isSentenceBoundary(text, index, current)) {
      const segment = trimSegment(text, cursor, index + 1);

      if (segment) {
        sentenceIndex += 1;
        sentences.push({
          id: `sentence-${sentenceIndex}`,
          text: segment.text,
          normalizedText: normalizeUtteranceText(segment.text),
          startOffset: segment.startOffset,
          endOffset: segment.endOffset
        });
      }

      cursor = index + 1;
    }
  }

  const trailing = trimSegment(text, cursor, text.length);

  if (trailing) {
    sentenceIndex += 1;
    sentences.push({
      id: `sentence-${sentenceIndex}`,
      text: trailing.text,
      normalizedText: normalizeUtteranceText(trailing.text),
      startOffset: trailing.startOffset,
      endOffset: trailing.endOffset
    });
  }

  return sentences;
}

function splitSentencesIntoClauses(sourceText: string, sentences: UtteranceSentence[]): UtteranceClause[] {
  const clauses: UtteranceClause[] = [];

  for (const sentence of sentences) {
    const localText = sourceText.slice(sentence.startOffset, sentence.endOffset);
    const splitPoints = new Map<number, UtteranceClauseBoundary>();

    for (let index = 0; index < localText.length; index += 1) {
      const current = localText[index];

      if (current && CLAUSE_PUNCTUATION.has(current)) {
        splitPoints.set(index + 1, 'punctuation');
      }
    }

    CONNECTOR_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = CONNECTOR_REGEX.exec(localText);
    while (match) {
      const connectorIndex = match.index;

      if (connectorIndex > 0) {
        const previous = localText[connectorIndex - 1] ?? '';
        if (CONNECTOR_LEFT_BOUNDARY.test(previous)) {
          splitPoints.set(connectorIndex, 'connector');
        }
      }

      match = CONNECTOR_REGEX.exec(localText);
    }

    const orderedSplitPoints = [...splitPoints.entries()]
      .filter(([position]) => position > 0 && position < localText.length)
      .sort((left, right) => left[0] - right[0]);

    let cursor = 0;
    let clauseIndex = 0;

    for (const [position, boundary] of orderedSplitPoints) {
      const segment = trimSegment(localText, cursor, position, sentence.startOffset);

      if (segment) {
        clauseIndex += 1;
        clauses.push({
          id: `${sentence.id}-clause-${clauseIndex}`,
          sentenceId: sentence.id,
          text: segment.text,
          normalizedText: normalizeUtteranceText(segment.text),
          startOffset: segment.startOffset,
          endOffset: segment.endOffset,
          boundary
        });
      }

      cursor = position;
    }

    const trailing = trimSegment(localText, cursor, localText.length, sentence.startOffset);

    if (trailing) {
      clauseIndex += 1;
      const lastBoundary = orderedSplitPoints.length > 0 ? orderedSplitPoints[orderedSplitPoints.length - 1]?.[1] : undefined;
      clauses.push({
        id: `${sentence.id}-clause-${clauseIndex}`,
        sentenceId: sentence.id,
        text: trailing.text,
        normalizedText: normalizeUtteranceText(trailing.text),
        startOffset: trailing.startOffset,
        endOffset: trailing.endOffset,
        boundary: lastBoundary ?? 'sentence'
      });
    }
  }

  return clauses;
}

function buildFallbackClausesFromSentences(sentences: UtteranceSentence[]): UtteranceClause[] {
  return sentences.map((sentence) => ({
    id: `${sentence.id}-clause-1`,
    sentenceId: sentence.id,
    text: sentence.text,
    normalizedText: sentence.normalizedText,
    startOffset: sentence.startOffset,
    endOffset: sentence.endOffset,
    boundary: 'fallback'
  }));
}

function isSentenceBoundary(text: string, index: number, current: string): boolean {
  if (CJK_SENTENCE_TERMINATORS.has(current)) {
    return true;
  }

  if (ENGLISH_SENTENCE_TERMINATORS.has(current)) {
    if (current === '.') {
      const previous = text[index - 1] ?? '';
      const next = text[index + 1] ?? '';
      const looksLikeNumber = /\d/.test(previous) && /\d/.test(next);

      if (looksLikeNumber) {
        return false;
      }
    }

    const next = text[index + 1];
    return next === undefined || /\s/u.test(next);
  }

  if (current === '\n') {
    const next = text[index + 1] ?? '';
    return next === '\n';
  }

  return false;
}

type TrimmedSegment = {
  text: string;
  startOffset: number;
  endOffset: number;
};

function trimSegment(
  text: string,
  start: number,
  end: number,
  absoluteOffset = 0
): TrimmedSegment | undefined {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && isTrimWhitespace(text[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && isTrimWhitespace(text[nextEnd - 1])) {
    nextEnd -= 1;
  }

  if (nextStart >= nextEnd) {
    return undefined;
  }

  return {
    text: text.slice(nextStart, nextEnd),
    startOffset: absoluteOffset + nextStart,
    endOffset: absoluteOffset + nextEnd
  };
}

function isTrimWhitespace(value: string | undefined): boolean {
  return value === undefined ? false : /\s/u.test(value);
}

export function normalizeUtteranceText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}
