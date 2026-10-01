import { describe, it, expect } from 'vitest';
import { readLayout, flowStyles, alignStyles } from '../layout-flow.js';
import { spacingScale, radiusScale, mergeScale, onScale } from '../scale.js';

describe('readLayout', () => {
  it('reads flow and alignment in screen terms', () => {
    expect(readLayout({ display: 'block' }).flow).toBe('block');
    expect(readLayout({ display: 'grid' }).flow).toBe('grid');
    const row = readLayout({ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' });
    expect(row).toMatchObject({ flow: 'horizontal', x: 'center', y: 'end', between: false });
    // In a column, justify is vertical and align is horizontal
    const col = readLayout({ display: 'inline-flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' });
    expect(col).toMatchObject({ flow: 'vertical', x: 'center', y: 'end' });
    expect(readLayout({ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' })).toMatchObject({ between: true, wrap: true });
  });
});

describe('flowStyles / alignStyles', () => {
  it('keeps inline-ness when switching flow', () => {
    expect(flowStyles('vertical', 'block')).toEqual({ display: 'flex', flexDirection: 'column' });
    expect(flowStyles('horizontal', 'inline-flex')).toEqual({ display: 'inline-flex', flexDirection: 'row' });
    expect(flowStyles('block', 'flex')).toEqual({ display: 'block' });
  });

  it('maps the grid click to justify/align by direction', () => {
    expect(alignStyles('horizontal', 'end', 'center', false)).toEqual({ justifyContent: 'flex-end', alignItems: 'center' });
    expect(alignStyles('vertical', 'end', 'center', false)).toEqual({ justifyContent: 'center', alignItems: 'flex-end' });
    // Distributing: only the cross axis moves
    expect(alignStyles('horizontal', 'end', 'center', true)).toEqual({ alignItems: 'center' });
  });
});

describe('scale', () => {
  it('turns the Tailwind base into named steps', () => {
    const s = spacingScale(4);
    expect(s.find(t => t.value === '8px')).toMatchObject({ name: 'spacing.spacing-2', label: '2 · 8px' });
    expect(s.find(t => t.value === '10px')?.name).toBe('spacing.spacing-2.5');
  });

  it('uses resolved radius values, defaults only on Tailwind v4', () => {
    expect(radiusScale({ md: 10 }, false)).toEqual([{ name: 'spacing.radius-md', value: '10px', type: 'spacing', label: 'md · 10px' }]);
    expect(radiusScale({}, true).find(t => t.value === '6px')?.name).toBe('spacing.radius-md');
    expect(radiusScale({}, false)).toEqual([]);
  });

  it('drops project tokens that repeat a step', () => {
    const merged = mergeScale(spacingScale(4), [
      { name: 'spacing.scroll-fade-size', value: '48px', type: 'spacing' },
      { name: 'spacing.odd', value: '13px', type: 'spacing' },
    ]);
    expect(merged.filter(t => t.value === '48px')).toHaveLength(1);
    expect(merged.at(-1)?.name).toBe('spacing.odd');
  });

  it('treats a shorthand of on-scale sides as on-standard', () => {
    const s = spacingScale(4);
    expect(onScale('4px 8px', s)).toBe(true);
    expect(onScale('4px 13px', s)).toBe(false);
    expect(onScale('13px', s)).toBe(false);
  });
});

import { readSize, sizeStyles } from '../layout-flow.js';

describe('sizing', () => {
  it('reads the mode from authored classes, CSS defaults otherwise', () => {
    expect(readSize('width', ['w-full'], null, 'block')).toBe('fill');
    expect(readSize('width', ['flex-1'], 'row', 'block')).toBe('fill');
    expect(readSize('width', ['w-fit'], null, 'block')).toBe('hug');
    expect(readSize('width', ['w-[320px]'], null, 'block')).toBe('fixed');
    expect(readSize('width', ['md:w-full'], null, 'block')).toBe('fill'); // block default, variant ignored
    expect(readSize('width', [], 'row', 'block')).toBe('hug');
    expect(readSize('height', [], null, 'block')).toBe('hug');
  });

  it('fills with grow along a flex parent, 100% otherwise', () => {
    expect(sizeStyles('width', 'fill', 'row', '')).toEqual({ width: 'auto', flexGrow: '1' });
    expect(sizeStyles('width', 'fill', null, '')).toEqual({ width: '100%' });
    expect(sizeStyles('height', 'hug', 'row', '')).toEqual({ height: 'fit-content' });
    expect(sizeStyles('width', 'fixed', null, '320px')).toEqual({ width: '320px' });
  });
});

import { sidesOf, boxMode, effectiveSides, boxStyles, withBoxLonghands } from '../layout-flow.js';
import { visibleWindow } from '../value-select.js';

describe('box spacing', () => {
  it('expands shorthand and picks the simplest mode', () => {
    expect(sidesOf('8px 16px')).toEqual(['8px', '16px', '8px', '16px']);
    expect(boxMode(sidesOf('8px'))).toBe('all');
    expect(boxMode(sidesOf('8px 16px'))).toBe('axis');
    expect(boxMode(sidesOf('8px 16px 4px'))).toBe('sides');
  });

  it('layers edits and clears the other modes when writing one', () => {
    expect(effectiveSides('padding', { padding: '8px' }, { paddingInline: '16px' })).toEqual(['8px', '16px', '8px', '16px']);
    const w = boxStyles('padding', 'axis', ['4px', '12px', '4px', '12px']);
    expect(w).toMatchObject({ padding: '', paddingTop: '', paddingBlock: '4px', paddingInline: '12px' });
    expect(withBoxLonghands({ padding: '8px 16px' })).toMatchObject({ paddingInline: '16px', paddingBlock: '8px', paddingTop: '8px' });
  });
});

describe('visibleWindow', () => {
  it('shows at most 6, around the current value', () => {
    const xs = Array.from({ length: 21 }, (_, i) => i);
    expect(visibleWindow(xs, -1)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(visibleWindow(xs, 10)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(visibleWindow(xs, 20)).toEqual([15, 16, 17, 18, 19, 20]);
    expect(visibleWindow([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });
});

import { readStroke, strokeWidths } from '../layout-flow.js';

describe('stroke', () => {
  it('reads weight, style and sides; none means no stroke', () => {
    const all = withBoxLonghands({ borderWidth: '2px', borderStyle: 'dashed' });
    expect(readStroke(all)).toEqual({ has: true, weight: '2px', style: 'dashed', on: [true, true, true, true] });
    expect(readStroke(withBoxLonghands({})).has).toBe(false);
    expect(readStroke(withBoxLonghands({ borderWidth: '0px 0px 1px', borderStyle: 'solid' })).on).toEqual([false, false, true, false]);
  });
  it('writes one width for all sides, per side otherwise', () => {
    expect(strokeWidths([true, true, true, true], '1px')).toMatchObject({ borderWidth: '1px', borderTopWidth: '' });
    expect(strokeWidths([false, false, true, false], '1px')).toMatchObject({ borderWidth: '', borderTopWidth: '0px', borderBottomWidth: '1px' });
  });
});
