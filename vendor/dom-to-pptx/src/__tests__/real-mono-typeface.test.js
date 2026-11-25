import { describe, it, expect } from 'vitest';
import { resolveRealTypeface } from '../utils.js';

describe('resolveRealTypeface (fix/real-mono-typeface)', () => {
  it('maps ui-monospace to a real monospace font', () => {
    expect(resolveRealTypeface('ui-monospace')).toBe('Consolas');
  });
  it('maps the proportional ui-* keywords to real defaults', () => {
    expect(resolveRealTypeface('ui-sans-serif')).toBe('Calibri');
    expect(resolveRealTypeface('ui-serif')).toBe('Georgia');
    expect(resolveRealTypeface('ui-rounded')).toBe('Calibri');
  });
  it('strips quotes/whitespace and passes real families through', () => {
    expect(resolveRealTypeface(' "SF Mono" ')).toBe('SF Mono');
    expect(resolveRealTypeface('Consolas')).toBe('Consolas');
    expect(resolveRealTypeface('')).toBe('');
  });
});
