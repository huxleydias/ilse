/**
 * Design context — infers the standard a project actually follows.
 *
 * This is the layer that separates Ilse from a pointing device: Stagewise and
 * Agentation tell an agent WHERE an element is; Rams scores code against
 * universal rules. This module answers "how is it done *here*" by reading the
 * codebase itself.
 *
 * Ported out of `_legacy/` on 2026-08-25. It was written for the abandoned DS
 * linter, but the engine was never the problem — the linter product was. The
 * reporters, fixer, CLI and AI provider stayed behind.
 */

export { parseCode, walkAST, getSourceContext } from './ast.js';

// Extraction — what values does this codebase actually use?
export { indexTokens, type TokenFrequency } from './index-tokens.js';
export { findInconsistencies, type Inconsistency } from './find-inconsistencies.js';
export { findPatterns, type ImplicitComponent } from './find-patterns.js';

// Analysis — what is each component trying to be?
export { profileComponents, type ComponentProfile } from './profile-component.js';
export { compareFamilies, type FamilyComparison } from './compare-family.js';
export { classifyElement, type ElementRole, type ClassifyContext } from './classify-element.js';
