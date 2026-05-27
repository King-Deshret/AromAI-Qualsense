import { describe, it, expect } from 'vitest';
import { test as fcTest } from '@fast-check/vitest';
import fc from 'fast-check';

describe('Testing infrastructure verification', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('vitest globals are available', () => {
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });

  fcTest.prop([fc.integer(), fc.integer()])(
    'fast-check property: addition is commutative',
    (a, b) => {
      expect(a + b).toBe(b + a);
    }
  );

  fcTest.prop([fc.string()])(
    'fast-check property: string length is non-negative',
    (s) => {
      expect(s.length).toBeGreaterThanOrEqual(0);
    }
  );
});
