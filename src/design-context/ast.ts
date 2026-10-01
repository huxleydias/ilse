import { parse, ParserPlugin } from '@babel/parser';
import type { File } from '@babel/types';
import type { Result } from '../types.js';

export type AST = File;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TraverseFunction = (ast: AST, visitors: Record<string, (path: any) => void>) => void;

let traverseFn: TraverseFunction | null = null;

/**
 * Get the traverse function, handling ESM/CJS interop.
 */
async function getTraverse(): Promise<TraverseFunction> {
  if (traverseFn) return traverseFn;

  const mod = await import('@babel/traverse');
  // Handle both ESM default export and CJS module.exports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = (mod as any).default?.default || (mod as any).default || mod;
  traverseFn = traverse as TraverseFunction;
  return traverseFn;
}

/**
 * Parse code string into an AST.
 */
export function parseCode(code: string, filePath: string = 'anonymous.tsx'): Result<AST> {
  const isTypeScript = filePath.endsWith('.tsx') || filePath.endsWith('.ts');

  const plugins: ParserPlugin[] = ['jsx'];
  if (isTypeScript) {
    plugins.push('typescript');
  }

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins,
      errorRecovery: true,
    });

    return { ok: true, value: ast };
  } catch (err) {
    return { ok: false, error: `Failed to parse file: ${(err as Error).message}` };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TraverseVisitor = Record<string, (path: any) => void>;

/**
 * Walk an AST with visitors.
 */
export async function walkAST(ast: AST, visitors: TraverseVisitor): Promise<void> {
  const traverse = await getTraverse();
  traverse(ast, visitors);
}

/**
 * Get the source code for a specific location.
 */
export function getSourceContext(
  code: string,
  line: number,
  column: number,
  contextLength: number = 50
): string {
  const lines = code.split('\n');
  if (line < 1 || line > lines.length) {
    return '';
  }

  const targetLine = lines[line - 1];
  const start = Math.max(0, column - contextLength / 2);
  const end = Math.min(targetLine.length, column + contextLength / 2);

  return targetLine.slice(start, end).trim();
}
