import type { TokenFrequency } from './index-tokens.js';

export interface Inconsistency {
  category: string;
  values: Array<{ value: string; count: number; files: number }>;
  total: number;
  suggestion: string;
}

/**
 * Find inconsistencies in token usage.
 * An inconsistency is when a category has too many variations.
 */
export function findInconsistencies(tokens: TokenFrequency[]): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  // Group by category
  const byCategory = new Map<string, TokenFrequency[]>();
  for (const token of tokens) {
    const existing = byCategory.get(token.category) || [];
    existing.push(token);
    byCategory.set(token.category, existing);
  }

  // Check each category for too many variations
  for (const [category, values] of byCategory) {
    // Sub-group within category for more specific analysis
    const subGroups = groupByPrefix(values, category);

    for (const [subKey, subValues] of subGroups) {
      if (subValues.length <= 2) continue; // 2 or fewer is fine

      const total = subValues.reduce((s, v) => s + v.count, 0);
      const sorted = [...subValues].sort((a, b) => b.count - a.count);
      const mostCommon = sorted[0];

      let suggestion: string;
      if (category === 'radius') {
        suggestion = `consolide em ${Math.min(sorted.length, 3)} valores — ${mostCommon.value} é o mais usado (${mostCommon.count}x)`;
      } else if (category === 'color') {
        const uniqueColors = sorted.filter((v) => v.value.includes('[#'));
        if (uniqueColors.length > 3) {
          suggestion = `${uniqueColors.length} cores arbitrárias — extraia como tokens`;
        } else {
          suggestion = `${sorted.length} variações — ${mostCommon.value} é o mais usado`;
        }
      } else if (category === 'spacing') {
        suggestion = `${sorted.length} valores de spacing — verifique se seguem uma escala (4px base)`;
      } else {
        suggestion = `${sorted.length} variações — consolide os menos usados`;
      }

      inconsistencies.push({
        category: subKey || category,
        values: sorted.map((v) => ({
          value: v.value,
          count: v.count,
          files: v.files.size,
        })),
        total,
        suggestion,
      });
    }
  }

  // Sort by total count (biggest inconsistencies first)
  return inconsistencies.sort((a, b) => b.total - a.total);
}

/**
 * Group tokens by meaningful sub-prefix within a category.
 * E.g. radius values together, bg-colors together, text-colors together.
 */
function groupByPrefix(
  tokens: TokenFrequency[],
  category: string,
): Map<string, TokenFrequency[]> {
  const groups = new Map<string, TokenFrequency[]>();

  if (category === 'radius') {
    // All radius together
    groups.set('border-radius', tokens);
    return groups;
  }

  if (category === 'color') {
    // Group by prefix (bg, text, border)
    for (const token of tokens) {
      const prefix = token.value.split('-')[0]; // bg, text, border
      const key = `${prefix} colors`;
      const existing = groups.get(key) || [];
      existing.push(token);
      groups.set(key, existing);
    }
    // Also check for arbitrary colors across all prefixes
    const arbitrary = tokens.filter((t) => t.value.includes('[#'));
    if (arbitrary.length > 3) {
      groups.set('cores arbitrárias', arbitrary);
    }
    return groups;
  }

  if (category === 'shadow') {
    groups.set('shadow', tokens);
    return groups;
  }

  // Default: all together
  groups.set(category, tokens);
  return groups;
}
