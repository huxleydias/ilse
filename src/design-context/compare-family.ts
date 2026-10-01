import type { ComponentProfile } from './profile-component.js';

export interface FamilyComparison {
  family: string;
  members: Array<{
    name: string;
    file: string;
  }>;
  divergences: Array<{
    property: string;     // "radius", "padding", "hover"
    values: Array<{ component: string; value: string }>;
    mostCommon: string;
    suggestion: string;
  }>;
}

/**
 * Compare components within the same family and find divergences.
 */
export function compareFamilies(profiles: ComponentProfile[]): FamilyComparison[] {
  // Group by family
  const families = new Map<string, ComponentProfile[]>();
  for (const profile of profiles) {
    if (!profile.family) continue;
    const existing = families.get(profile.family) || [];
    existing.push(profile);
    families.set(profile.family, existing);
  }

  const comparisons: FamilyComparison[] = [];

  for (const [family, members] of families) {
    if (members.length < 2) continue; // Need 2+ to compare

    const divergences: FamilyComparison['divergences'] = [];

    // Compare each style property
    const properties: Array<{ key: keyof ComponentProfile['styles']; label: string }> = [
      { key: 'radius', label: 'border-radius' },
      { key: 'padding', label: 'padding' },
      { key: 'gap', label: 'gap' },
      { key: 'bg', label: 'background' },
      { key: 'hover', label: 'hover state' },
    ];

    for (const { key, label } of properties) {
      const values = members
        .map((m) => ({
          component: m.name,
          value: m.styles[key].join(' ') || '(nenhum)',
        }))
        .filter((v) => v.value !== '(nenhum)');

      if (values.length < 2) continue;

      // Check if values diverge
      const uniqueValues = new Set(values.map((v) => v.value));
      if (uniqueValues.size <= 1) continue; // All the same — no divergence

      // Find most common value
      const valueCounts = new Map<string, number>();
      for (const v of values) {
        valueCounts.set(v.value, (valueCounts.get(v.value) || 0) + 1);
      }
      const mostCommon = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      divergences.push({
        property: label,
        values,
        mostCommon,
        suggestion: `normalizar para ${mostCommon} (padrão mais comum na família)`,
      });
    }

    // Compare a11y
    const interactiveMembers = members.filter((m) => m.isInteractive);
    if (interactiveMembers.length >= 2) {
      const withRole = interactiveMembers.filter((m) => m.a11y.hasRole);
      const withoutRole = interactiveMembers.filter((m) => !m.a11y.hasRole);

      if (withRole.length > 0 && withoutRole.length > 0) {
        divergences.push({
          property: 'acessibilidade',
          values: interactiveMembers.map((m) => ({
            component: m.name,
            value: m.a11y.hasRole ? 'tem role' : 'sem role',
          })),
          mostCommon: 'tem role',
          suggestion: `${withoutRole.map((m) => m.name).join(', ')} sem role — adicionar para consistência`,
        });
      }
    }

    if (divergences.length > 0) {
      comparisons.push({
        family,
        members: members.map((m) => ({ name: m.name, file: m.file })),
        divergences,
      });
    }
  }

  // Sort by number of divergences
  return comparisons.sort((a, b) => b.divergences.length - a.divergences.length);
}
