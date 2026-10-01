/**
 * Semantic classification of JSX elements.
 * Determines the PURPOSE of an element based on context,
 * not just its tag name.
 */

export type ElementRole =
  | 'button'        // clickable card, action trigger
  | 'backdrop'      // modal overlay (fixed inset-0, bg-black/*, backdrop)
  | 'link'          // has href or navigates
  | 'toggle'        // switches state (checkbox-like)
  | 'container'     // wrapper with stopPropagation, not truly interactive
  | 'unknown';      // needs AI to classify

export interface ClassifyContext {
  tag: string;
  className: string;
  attributes: Map<string, unknown>;
  hasChildren: boolean;
  /** Raw source of the onClick handler (if extractable) */
  onClickSource?: string;
}

/**
 * Classify an interactive non-semantic element by its context.
 * Uses static heuristics — no AI, zero cost.
 *
 * Call this BEFORE generating a11y suggestions to avoid
 * wrong fixes (e.g. role="button" on a modal backdrop).
 */
export function classifyElement(ctx: ClassifyContext): ElementRole {
  const { tag, className, attributes, onClickSource } = ctx;

  // Links
  if (tag === 'a' || attributes.has('href')) return 'link';

  // Backdrop/overlay detection
  if (isBackdrop(className)) return 'backdrop';

  // Container that just stops propagation (not truly interactive)
  if (isStopPropagationOnly(onClickSource)) return 'container';

  // Toggle patterns
  if (isToggle(attributes)) return 'toggle';

  // If it has onClick and is a native HTML element, it's likely a button
  if (attributes.has('onClick')) return 'button';

  return 'unknown';
}

/**
 * Detect backdrop/overlay patterns from className.
 *
 * Common patterns:
 * - "fixed inset-0 ... bg-black/40"
 * - "absolute inset-0 ... backdrop-blur"
 * - "fixed inset-0 z-50 ... bg-black/50 backdrop-blur-sm"
 */
function isBackdrop(className: string): boolean {
  const classes = className.toLowerCase();

  // Must be full-screen positioned
  const isFullScreen = (classes.includes('fixed') || classes.includes('absolute'))
    && classes.includes('inset-0');

  if (!isFullScreen) return false;

  // Check for overlay indicators
  const hasOverlayBg = /bg-black\/|bg-white\/|bg-background\/|backdrop-blur/.test(classes);
  const hasOverlayKeyword = classes.includes('backdrop') || classes.includes('overlay');

  return hasOverlayBg || hasOverlayKeyword;
}

/**
 * Detect if onClick only calls stopPropagation / preventDefault.
 * These wrappers are not truly interactive — they just prevent event bubbling.
 */
function isStopPropagationOnly(onClickSource?: string): boolean {
  if (!onClickSource) return false;
  const normalized = onClickSource.replace(/\s+/g, '');

  // (e) => e.stopPropagation()
  // (e) => { e.stopPropagation(); }
  // (e) => { e.stopPropagation(); e.preventDefault(); }
  return /^\(?e\)?\s*=>\s*\{?\s*e\.stopPropagation\(\)\s*;?\s*\}?$/.test(normalized)
    || /^\(?e\)?\s*=>\s*\{?\s*e\.stopPropagation\(\)\s*;\s*e\.preventDefault\(\)\s*;?\s*\}?$/.test(normalized);
}

/**
 * Detect toggle/switch patterns from attributes.
 */
function isToggle(attributes: Map<string, unknown>): boolean {
  // Already has role="switch" or role="checkbox"
  const role = attributes.get('role');
  if (typeof role === 'string' && (role === 'switch' || role === 'checkbox')) return true;

  // Has aria-checked or aria-pressed (toggle semantics)
  if (attributes.has('aria-checked') || attributes.has('aria-pressed')) return true;

  return false;
}
