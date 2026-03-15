import type { ManualCorrectionRecord } from '@openclaw-compact-context/contracts';

let activeContextProcessingCorrections: readonly ManualCorrectionRecord[] = [];

export function setManualContextProcessingCorrections(
  corrections: readonly ManualCorrectionRecord[]
): void {
  activeContextProcessingCorrections = [...corrections];
}

export function getManualContextProcessingCorrections(): readonly ManualCorrectionRecord[] {
  return activeContextProcessingCorrections;
}
