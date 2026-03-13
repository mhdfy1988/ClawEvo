const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'why',
  'with'
]);

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const NON_ASCII_PATTERN = /[^\x00-\x7F]/;

export interface TextMatchFeatures {
  normalizedQuery: string;
  exactPhrase: boolean;
  queryTerms: string[];
  matchedTerms: string[];
  coverage: number;
}

export interface TextMatchScoreWeights {
  exactPhrase: number;
  matchedTerm: number;
  coverage: number;
  fullCoverage: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSearchTerms(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const rawTokens = normalized.match(TOKEN_PATTERN) ?? [];

  if (rawTokens.length === 0) {
    return [];
  }

  const informativeTokens = uniqueTerms(rawTokens.filter(isInformativeToken));

  if (informativeTokens.length > 0) {
    return informativeTokens;
  }

  return uniqueTerms(rawTokens.filter((token) => token.length > 0));
}

export function analyzeTextMatch(target: string, query: string): TextMatchFeatures {
  const normalizedTarget = normalizeSearchText(target);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return {
      normalizedQuery,
      exactPhrase: false,
      queryTerms: [],
      matchedTerms: [],
      coverage: 0
    };
  }

  const queryTerms = extractSearchTerms(query);
  const matchedTerms = queryTerms.filter((term) => normalizedTarget.includes(term));

  return {
    normalizedQuery,
    exactPhrase: normalizedTarget.includes(normalizedQuery),
    queryTerms,
    matchedTerms,
    coverage: queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0
  };
}

export function matchesTextFilter(target: string, query: string): boolean {
  const features = analyzeTextMatch(target, query);

  if (!features.normalizedQuery) {
    return true;
  }

  if (features.exactPhrase) {
    return true;
  }

  if (features.queryTerms.length === 0) {
    return false;
  }

  return features.matchedTerms.length >= requiredTermMatches(features.queryTerms.length);
}

export function scoreTextMatch(target: string, query: string, weights: TextMatchScoreWeights): number {
  const features = analyzeTextMatch(target, query);

  if (!features.normalizedQuery) {
    return 0;
  }

  let score = 0;

  if (features.exactPhrase) {
    score += weights.exactPhrase;
  }

  score += features.matchedTerms.length * weights.matchedTerm;
  score += features.coverage * weights.coverage;

  if (features.queryTerms.length > 0 && features.matchedTerms.length === features.queryTerms.length) {
    score += weights.fullCoverage;
  }

  return score;
}

function isInformativeToken(token: string): boolean {
  if (NON_ASCII_PATTERN.test(token)) {
    return token.length > 0;
  }

  return token.length >= 2 && !ENGLISH_STOPWORDS.has(token);
}

function requiredTermMatches(termCount: number): number {
  if (termCount <= 2) {
    return termCount;
  }

  return Math.max(2, Math.ceil(termCount * 0.6));
}

function uniqueTerms(terms: string[]): string[] {
  return Array.from(new Set(terms));
}
