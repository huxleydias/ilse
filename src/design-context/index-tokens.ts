import { parseCode, walkAST } from './ast.js';
import type { Result } from '../types.js';

export interface TokenFrequency {
  value: string;
  category: 'radius' | 'color' | 'spacing' | 'font' | 'shadow' | 'sizing' | 'other';
  count: number;
  files: Set<string>;
}

// Categorize a Tailwind class
function categorize(cls: string): { category: TokenFrequency['category']; value: string } | null {
  // Border radius
  if (/^rounded(-\w+)?$/.test(cls)) return { category: 'radius', value: cls };

  // Font size must be settled before colour: `text-*` is ambiguous, and the
  // colour rule below would otherwise swallow `text-sm` and the whole type
  // scale, filing typography under colours.
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(cls)) {
    return { category: 'font', value: cls };
  }

  // Colors (bg, text, border with named values, not arbitrary)
  if (/^(bg|text|border|ring|fill|stroke)-([\w-]+)$/.test(cls) && !cls.includes('[')) {
    return { category: 'color', value: cls };
  }

  // Spacing (padding, margin, gap)
  if (/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-[\w.]+$/.test(cls) && !cls.includes('[')) {
    return { category: 'spacing', value: cls };
  }

  // Sizing (w, h, min-w, max-w, etc)
  if (/^(w|h|min-w|min-h|max-w|max-h|size)-[\w.]+$/.test(cls) && !cls.includes('[')) {
    return { category: 'sizing', value: cls };
  }

  // Font
  if (/^(font|text|leading|tracking)-[\w.]+$/.test(cls) && !cls.includes('[') && !cls.match(/^text-([\w-]+)$/)) {
    return { category: 'font', value: cls };
  }
  if (/^(font-\w+|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl))$/.test(cls)) {
    return { category: 'font', value: cls };
  }

  // Shadow
  if (/^shadow(-\w+)?$/.test(cls)) return { category: 'shadow', value: cls };

  // Arbitrary values — these are interesting for DS extraction
  if (cls.includes('[') && cls.includes(']')) {
    const prefix = cls.split('-[')[0];
    if (/^(bg|text|border|ring)$/.test(prefix)) return { category: 'color', value: cls };
    if (/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap)$/.test(prefix)) return { category: 'spacing', value: cls };
    if (/^(w|h|min-w|min-h|max-w|max-h|size)$/.test(prefix)) return { category: 'sizing', value: cls };
    if (/^rounded$/.test(prefix)) return { category: 'radius', value: cls };
    return { category: 'other', value: cls };
  }

  return null;
}

/**
 * Index all design token usage across files.
 * Returns frequency map of every Tailwind class used, categorized.
 */
export async function indexTokens(
  files: Array<{ path: string; code: string }>,
): Promise<Result<TokenFrequency[]>> {
  const freqMap = new Map<string, TokenFrequency>();

  for (const file of files) {
    const parseResult = parseCode(file.code, file.path);
    if (!parseResult.ok) continue;

    await walkAST(parseResult.value, {
      JSXAttribute(path) {
        const node = path.node;
        if (
          node.name.type === 'JSXIdentifier' &&
          (node.name.name === 'className' || node.name.name === 'class')
        ) {
          let classValue = '';

          if (node.value?.type === 'StringLiteral') {
            classValue = node.value.value;
          } else if (
            node.value?.type === 'JSXExpressionContainer' &&
            node.value.expression.type === 'StringLiteral'
          ) {
            classValue = node.value.expression.value;
          } else if (
            node.value?.type === 'JSXExpressionContainer' &&
            node.value.expression.type === 'TemplateLiteral'
          ) {
            for (const quasi of node.value.expression.quasis) {
              classValue += ' ' + quasi.value.raw;
            }
          }

          if (!classValue) return;

          const classes = classValue.split(/\s+/).filter(Boolean);
          for (const cls of classes) {
            // Strip responsive/state prefixes
            const baseCls = cls.replace(/^(?:\w+:)+/, '');
            const cat = categorize(baseCls);
            if (!cat) continue;

            const existing = freqMap.get(cat.value);
            if (existing) {
              existing.count++;
              existing.files.add(file.path);
            } else {
              freqMap.set(cat.value, {
                value: cat.value,
                category: cat.category,
                count: 1,
                files: new Set([file.path]),
              });
            }
          }
        }
      },
    });
  }

  const result = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
  return { ok: true, value: result };
}
