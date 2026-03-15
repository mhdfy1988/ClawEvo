import type { ManualCorrectionRecord } from '../types/context-processing.js';

let activeContextProcessingCorrections: readonly ManualCorrectionRecord[] = [];

export function setManualContextProcessingCorrections(
  corrections: readonly ManualCorrectionRecord[]
): void {
  activeContextProcessingCorrections = [...corrections];
}

export function getManualContextProcessingCorrections(): readonly ManualCorrectionRecord[] {
  return activeContextProcessingCorrections;
}
