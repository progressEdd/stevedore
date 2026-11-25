import { describe, it, expect } from 'vitest';
import { pseudoSortKey } from '../utils.js';

describe('pseudoSortKey (fix/pseudo-z-index)', () => {
  it("uses the pseudo's own z-index so a z:2 ::after sorts above z:1 children", () => {
    expect(pseudoSortKey([0, 5], '::after', '2')).toEqual([0, 5, 2, Infinity]);
  });
  it("'auto' ::after keeps the above-same-z tree-order semantics", () => {
    expect(pseudoSortKey([0, 5], '::after', 'auto')).toEqual([0, 5, 0, Infinity]);
  });
  it("'auto' ::before keeps the below-content semantics", () => {
    expect(pseudoSortKey([0, 5], '::before', 'auto')).toEqual([0, 5, -1000000, -1]);
  });
  it('a z-indexed ::before participates at its own level', () => {
    expect(pseudoSortKey([0, 5], '::before', '2')).toEqual([0, 5, 2, -1]);
  });
  it('unparsable values fall back like auto', () => {
    expect(pseudoSortKey([0, 5], '::after', '')).toEqual([0, 5, 0, Infinity]);
  });
});
