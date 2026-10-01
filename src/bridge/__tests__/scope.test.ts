import { describe, it, expect } from 'vitest';
import { swapMatchesScope, formatScope } from '../augment.js';
import type { Annotation } from '../../types.js';

const ann = (choice: 'one' | 'all', owner: string, usage = false): Annotation => ({
  id: 'x', note: '', element: 'div', styles: {}, status: 'pending', timestamp: '',
  scope: { component: 'Card', count: 6, choice },
  source: [
    { file: 'Card.tsx', line: 4, endLine: 4, owner, kind: 'element', score: 20, reasons: [], snippet: '' },
    ...(usage ? [{ file: 'page.tsx', line: 30, endLine: 30, owner: 'Page', kind: 'usage' as const, score: 10, reasons: [], snippet: '' }] : []),
  ],
} as Annotation);

describe('scope', () => {
  it('a class swap is safe only when where the JSX lives matches the choice', () => {
    expect(swapMatchesScope(ann('all', 'Card'))).toBe(true);   // inside Card → every Card
    expect(swapMatchesScope(ann('one', 'Card'))).toBe(false);  // inside Card, but only this one → agent
    expect(swapMatchesScope(ann('one', 'Page'))).toBe(true);   // written at the usage → just here
    expect(swapMatchesScope(ann('all', 'Page'))).toBe(false);  // at the usage, but all → agent
    expect(swapMatchesScope({ ...ann('one', 'Card'), scope: undefined })).toBe(true);
  });

  it('tells the agent where the change goes', () => {
    expect(formatScope(ann('all', 'Card'))).toContain('ALL <Card>');
    const one = formatScope(ann('one', 'Card', true))!;
    expect(one).toContain('ONLY THIS <Card>');
    expect(one).toContain('`page.tsx:30`');
    expect(one).toContain('Do not change <Card>\'s definition');
  });
});

import { readHint } from '../augment.js';

describe('readHint', () => {
  it('points at the element with room around it, never the whole file', () => {
    expect(readHint({ file: 'a.tsx', line: 200, endLine: 210 })).toBe('To see more, Read `a.tsx` with offset 160 and limit 120 — not the whole file.');
    expect(readHint({ file: 'a.tsx', line: 10 })).toContain('offset 1 and limit 120');
    expect(readHint({ file: 'a.tsx', line: 100, endLine: 300 })).toContain('offset 60 and limit 300');
  });
});
