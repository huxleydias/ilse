import { describe, it, expect } from 'vitest';
import { augmentAnnotation, historyRef } from '../augment.js';
import type { Annotation } from '../../types.js';

const base: Annotation = {
  id: 'a1f3', note: 'mais respiro', element: 'button.cta', styles: {},
  status: 'pending', timestamp: '', component: 'Card',
};

describe('historyRef', () => {
  it('names the owner component and located file', () => {
    const ann: Annotation = { ...base, source: [{ file: 'src/components/Button.tsx', line: 14, endLine: 14, owner: 'Button', kind: 'element', score: 9, reasons: [], snippet: '' }] };
    expect(historyRef(ann)).toBe('ilse · annotation a1f3 · Button · src/components/Button.tsx');
    expect(augmentAnnotation(ann).context).toContain('**Ilse ref:** ilse · annotation a1f3 · Button');
  });

  it('falls back to the component when nothing was located', () => {
    expect(historyRef(base)).toBe('ilse · annotation a1f3 · Card');
  });
});
