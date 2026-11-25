import { describe, it, expect } from 'vitest';
import { resolveCaptureViewport } from '../utils.js';

describe('resolveCaptureViewport (fix/font-design-viewport)', () => {
  it('returns null when the caller pinned an explicit viewport', () => {
    expect(resolveCaptureViewport({ width: 2560, height: 1440 }, { width: 1280, height: 720 })).toBeNull();
  });
  it('returns the rounded design rect when no viewport was pinned', () => {
    expect(resolveCaptureViewport(null, { width: 1280.4, height: 719.6 })).toEqual({ width: 1280, height: 720 });
  });
  it('returns null for an unusable design rect', () => {
    expect(resolveCaptureViewport(null, null)).toBeNull();
    expect(resolveCaptureViewport(null, { width: 0, height: 720 })).toBeNull();
  });
});
