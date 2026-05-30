import type { LotStatus } from './types';
import { VALID_STATUS_TRANSITIONS } from './types';

export function isValidTransition(from: LotStatus, to: LotStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: LotStatus, to: LotStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid lot status transition: ${from} → ${to}`);
  }
}
