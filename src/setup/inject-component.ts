import { readFileSync, writeFileSync } from 'node:fs';
import type { Framework } from './framework-detect.js';

export interface InjectResult {
  ok: boolean;
  error?: string;
  diff?: string;
}

const IMPORT_STATEMENT = `import { Ilse } from "ilse-design/react";`;
const COMPONENT_TAG = `<Ilse />`;

/**
 * Inject <Ilse /> into a layout file.
 * Strategy: add import at top, add <Ilse /> before closing </body> (or equivalent).
 */
export function injectIlseComponent(filePath: string, framework: Framework): InjectResult {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { ok: false, error: `Não foi possível ler ${filePath}: ${(err as Error).message}` };
  }

  // Already installed?
  if (content.includes('ilse-design/react') || content.includes('<Ilse')) {
    return { ok: true, diff: '(já instalado)' };
  }

  const lines = content.split('\n');
  const original = [...lines];

  // 1. Insert import after the last import statement
  const lastImportIdx = findLastImportIndex(lines);
  if (lastImportIdx === -1) {
    lines.unshift(IMPORT_STATEMENT, '');
  } else {
    lines.splice(lastImportIdx + 1, 0, IMPORT_STATEMENT);
  }

  // 2. Insert <Ilse /> in the right place based on framework
  const injectPoint = findInjectPoint(lines, framework);
  if (injectPoint === -1) {
    return { ok: false, error: 'Não achei onde inserir <Ilse /> neste arquivo. Adicione manualmente.' };
  }

  // Insert before closing tag
  const indent = detectIndent(lines[injectPoint]);
  lines.splice(injectPoint, 0, `${indent}${COMPONENT_TAG}`);

  // Write back
  try {
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
  } catch (err) {
    return { ok: false, error: `Não foi possível escrever ${filePath}: ${(err as Error).message}` };
  }

  return { ok: true, diff: buildDiff(original, lines) };
}

function findLastImportIndex(lines: string[]): number {
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) last = i;
  }
  return last;
}

function findInjectPoint(lines: string[], framework: Framework): number {
  // Priority 1: </body> closing tag (Next.js App Router, Remix)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/<\/body>/.test(lines[i])) return i;
  }

  // Priority 2: Closing fragment after <Component /> or {children} (Pages Router)
  if (framework === 'next-pages') {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/<Component\s*\{\.\.\.pageProps\}\s*\/>/.test(lines[i])) return i + 1;
    }
  }

  // Priority 3 (Vite/CRA): Find the FIRST return statement's closing tag.
  // This targets the root component's return, not nested components.
  if (framework === 'vite-react' || framework === 'cra') {
    const firstReturn = findFirstReturnClosingTag(lines);
    if (firstReturn !== -1) return firstReturn;
  }

  // Priority 4: Find </> or </Fragment> or last closing JSX tag before return end
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*<\/>\s*$/.test(lines[i])) return i;
    if (/^\s*<\/React\.Fragment>/.test(lines[i])) return i;
  }

  // Fallback: before last closing tag in a return statement
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*<\/[A-Za-z]+>\s*\);?\s*$/.test(lines[i])) return i;
  }

  return -1;
}

/**
 * Find the closing tag of the FIRST return statement in the file.
 * For Vite/CRA, the first `return (` belongs to the default-exported root component.
 * We track parens/brackets to find the matching `)` and then look for the
 * last closing JSX tag before it.
 */
function findFirstReturnClosingTag(lines: string[]): number {
  // Find the first `return (` or `return <`
  let returnLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/\breturn\s*[\(<]/.test(lines[i])) {
      returnLine = i;
      break;
    }
  }
  if (returnLine === -1) return -1;

  // Find the closing `)` or the end of the return block by tracking paren depth
  let depth = 0;
  let returnEnd = -1;
  for (let i = returnLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) {
          returnEnd = i;
          break;
        }
      }
    }
    if (returnEnd !== -1) break;
  }
  if (returnEnd === -1) returnEnd = lines.length - 1;

  // Scan backwards from returnEnd to find the last closing JSX tag: </Tag>, </>, </Fragment>
  for (let i = returnEnd; i >= returnLine; i--) {
    if (/^\s*<\/[A-Za-z]*>\s*\)?\s*;?\s*$/.test(lines[i])) return i;
  }

  return -1;
}

function detectIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  const base = match ? match[1] : '';
  // Add 2 spaces for nesting inside the closing tag's parent
  return base + '  ';
}

function buildDiff(original: string[], modified: string[]): string {
  const diff: string[] = [];
  const importLine = modified.find(l => l.includes('ilse-design/react'));
  const ilseTag = modified.find(l => l.includes('<Ilse />'));
  if (importLine) diff.push(`+ ${importLine.trim()}`);
  if (ilseTag) diff.push(`+ ${ilseTag.trim()}`);
  return diff.join('\n');
}
