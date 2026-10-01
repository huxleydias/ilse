/**
 * Layout as a designer reads it — flow + alignment — mapped to the CSS a
 * front-end writes (display, flex-direction, justify-content, align-items).
 *
 * Reference is Figma's auto layout: pick a flow, then click a spot in the 3×3
 * grid. The grid is always in screen terms (x = left→right, y = top→bottom);
 * which of justify/align that means depends on the direction.
 */

export type Flow = 'block' | 'vertical' | 'horizontal' | 'grid';
export type Pos = 'start' | 'center' | 'end';

export interface LayoutState {
  flow: Flow;
  x: Pos;
  y: Pos;
  /** justify-content: space-between — the main axis is distributed, not placed */
  between: boolean;
  wrap: boolean;
}

function pos(v: string | undefined): Pos {
  const s = (v ?? '').trim();
  if (/center/.test(s)) return 'center';
  if (/(^|-)end$|right|bottom/.test(s)) return 'end';
  return 'start';
}

export function readLayout(s: Record<string, string | undefined>): LayoutState {
  const display = s.display ?? '';
  const flow: Flow = /flex/.test(display)
    ? ((s.flexDirection ?? '').startsWith('column') ? 'vertical' : 'horizontal')
    : /grid/.test(display) ? 'grid' : 'block';
  const main = pos(s.justifyContent);
  const cross = pos(s.alignItems);
  return {
    flow,
    x: flow === 'vertical' ? cross : main,
    y: flow === 'vertical' ? main : cross,
    between: s.justifyContent === 'space-between',
    wrap: (s.flexWrap ?? '').startsWith('wrap'),
  };
}

const CSS_POS: Record<Pos, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };

/** CSS for a flow, keeping inline-ness (inline-flex stays inline). */
export function flowStyles(flow: Flow, currentDisplay: string): Record<string, string> {
  const inline = currentDisplay.startsWith('inline');
  switch (flow) {
    case 'block': return { display: inline ? 'inline-block' : 'block' };
    case 'grid': return { display: inline ? 'inline-grid' : 'grid' };
    case 'vertical': return { display: inline ? 'inline-flex' : 'flex', flexDirection: 'column' };
    case 'horizontal': return { display: inline ? 'inline-flex' : 'flex', flexDirection: 'row' };
  }
}

/**
 * CSS for a click on the grid. While distributing, the main axis belongs to
 * space-between — only the cross axis moves.
 */
export function alignStyles(flow: Flow, x: Pos, y: Pos, between: boolean): Record<string, string> {
  const [main, cross] = flow === 'vertical' ? [y, x] : [x, y];
  return between
    ? { alignItems: CSS_POS[cross] }
    : { justifyContent: CSS_POS[main], alignItems: CSS_POS[cross] };
}

// ── Sizing — Figma's Fixed / Hug / Fill ──────────────────────────────────────

export type SizeMode = 'fixed' | 'hug' | 'fill';
export type Axis = 'width' | 'height';
/** Direction of the parent's flex, or null when the parent isn't flex */
export type ParentFlow = 'row' | 'column' | null;

const AXIS_PREFIX: Record<Axis, string> = { width: 'w', height: 'h' };

/**
 * What the designer set, read from the authored classes — the computed width is
 * always px and can't tell "fill" from "fixed". No class means the CSS default:
 * a block fills its row; a flex item (and any height) hugs its content.
 */
export function readSize(axis: Axis, classes: string[], parent: ParentFlow, display: string): SizeMode {
  const p = AXIS_PREFIX[axis];
  const own = classes.filter(c => !c.includes(':'));
  const mainAxis = (parent === 'row' && axis === 'width') || (parent === 'column' && axis === 'height');
  if (own.some(c => c === `${p}-full` || c === `${p}-screen`) || (mainAxis && own.some(c => /^(flex-1|grow|flex-grow)$/.test(c)))) return 'fill';
  if (own.some(c => new RegExp(`^${p}-(fit|auto|max|min)$`).test(c))) return 'hug';
  if (own.some(c => new RegExp(`^${p}-(\\d|\\[|px$)`).test(c))) return 'fixed';
  if (axis === 'width' && parent === null && !display.startsWith('inline')) return 'fill';
  return 'hug';
}

/** CSS for a sizing choice. Along a flex parent's main axis, fill is grow, not 100%. */
export function sizeStyles(axis: Axis, mode: SizeMode, parent: ParentFlow, fixedValue: string): Record<string, string> {
  const mainAxis = (parent === 'row' && axis === 'width') || (parent === 'column' && axis === 'height');
  switch (mode) {
    case 'fill': return mainAxis ? { [axis]: 'auto', flexGrow: '1' } : { [axis]: '100%' };
    case 'hug': return mainAxis ? { [axis]: 'fit-content', flexGrow: '0' } : { [axis]: 'fit-content' };
    case 'fixed': return mainAxis ? { [axis]: fixedValue, flexGrow: '0' } : { [axis]: fixedValue };
  }
}

// ── Box spacing — padding/margin as one value, per axis, or per side ─────────

export type BoxProp = 'padding' | 'margin';
export type BoxMode = 'all' | 'axis' | 'sides';
/** top, right, bottom, left */
export type Sides = [string, string, string, string];

const SIDE_KEYS = ['Top', 'Right', 'Bottom', 'Left'] as const;

/** Every longhand the panel may write for a box property, in write order */
export function boxKeys(prop: BoxProp): string[] {
  return [prop, `${prop}Inline`, `${prop}Block`, ...SIDE_KEYS.map(s => `${prop}${s}`)];
}

/** CSS shorthand (1–4 values) → the four sides */
export function sidesOf(shorthand: string | undefined): Sides {
  const v = (shorthand ?? '').trim().split(/\s+/).filter(Boolean);
  const [t = '0px', r = t, b = t, l = r] = v;
  return [t, r, b, l];
}

/** The simplest mode that describes these sides */
export function boxMode([t, r, b, l]: Sides): BoxMode {
  if (t === r && r === b && b === l) return 'all';
  if (t === b && l === r) return 'axis';
  return 'sides';
}

/** Sides with the panel's edits on top of the element's computed value */
export function effectiveSides(prop: BoxProp, styles: Record<string, string | undefined>, edits: Record<string, string>): Sides {
  const s = sidesOf(edits[prop] ?? styles[prop]);
  const inline = edits[`${prop}Inline`];
  const block = edits[`${prop}Block`];
  if (inline) { s[1] = inline; s[3] = inline; }
  if (block) { s[0] = block; s[2] = block; }
  SIDE_KEYS.forEach((side, i) => { const v = edits[`${prop}${side}`]; if (v) s[i] = v; });
  return s;
}

/**
 * The edit for a mode. Every longhand the property had is cleared first
 * ('' = back to the original), so the three modes never stack on each other.
 */
export function boxStyles(prop: BoxProp, mode: BoxMode, [t, r, b, l]: Sides): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of boxKeys(prop)) out[k] = '';
  if (mode === 'all') out[prop] = t;
  else if (mode === 'axis') { out[`${prop}Block`] = t; out[`${prop}Inline`] = r; }
  else [t, r, b, l].forEach((v, i) => { out[`${prop}${SIDE_KEYS[i]}`] = v; });
  return out;
}

/**
 * Computed styles carry the shorthand only. The longhands are added so an edit
 * that lands on the value the element already has is recognised as no change.
 */
export function withBoxLonghands(styles: Record<string, string>): Record<string, string> {
  const out = { ...styles };
  for (const prop of ['padding', 'margin'] as const) {
    const [t, r, b, l] = sidesOf(styles[prop]);
    [t, r, b, l].forEach((v, i) => { out[`${prop}${SIDE_KEYS[i]}`] = v; });
    if (l === r) out[`${prop}Inline`] = r;
    if (t === b) out[`${prop}Block`] = t;
    out[prop] = styles[prop] ?? '0px';
  }
  // Borders: computed styles leave out zero widths and `none` — fill them in
  const [t, r, b, l] = sidesOf(styles.borderWidth);
  ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].forEach((k, i) => { out[k] = styles[k] ?? [t, r, b, l][i]; });
  out.borderWidth = styles.borderWidth ?? '0px';
  out.borderStyle = styles.borderStyle ?? 'none';
  return out;
}

// ── Stroke — colour, weight, style, which sides ─────────────────────────────

export const STROKE_SIDES = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const;
export type SidesOn = [boolean, boolean, boolean, boolean];

export interface StrokeState {
  has: boolean;
  /** The weight the stroke is drawn at (first side that has one) */
  weight: string;
  style: string;
  on: SidesOn;
}

const zero = (v: string | undefined) => !v || parseFloat(v) === 0;

export function readStroke(s: Record<string, string | undefined>): StrokeState {
  const widths = STROKE_SIDES.map(k => s[k] ?? '0px');
  const on = widths.map(w => !zero(w)) as SidesOn;
  const style = s.borderStyle ?? 'none';
  return {
    has: on.some(Boolean) && style !== 'none' && style !== 'hidden',
    weight: widths.find(w => !zero(w)) ?? '1px',
    style: style === 'none' ? 'solid' : style,
    on,
  };
}

/**
 * Widths for a set of sides: one `border-width` when all four are on (border-2),
 * per side otherwise (border-b-2) — the shorter class wins when it can.
 */
export function strokeWidths(on: SidesOn, weight: string): Record<string, string> {
  if (on.every(Boolean)) return { borderWidth: weight, ...Object.fromEntries(STROKE_SIDES.map(k => [k, ''])) };
  return { borderWidth: '', ...Object.fromEntries(STROKE_SIDES.map((k, i) => [k, on[i] ? weight : '0px'])) };
}
