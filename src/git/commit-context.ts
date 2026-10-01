/**
 * Tell the project's agent that Ilse's changes are meant to be committed.
 *
 * A short block in the file every coding agent already reads (AGENTS.md, or
 * CLAUDE.md), pointing at `ilse changes`. Added only with the designer's OK,
 * asked once per project; the answer is kept in .ilserc.json.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

export const COMMIT_MARKER = '<!-- ilse:commit-context -->';

export const COMMIT_BLOCK = `
${COMMIT_MARKER}
## Mudanças feitas pela Ilse

O designer ajusta a interface pela Ilse (toolbar no browser), e essas edições chegam aos arquivos por outro processo — não pela sua sessão. Elas são intencionais.
Antes de commitar, rode \`ilse changes\` (ou leia \`.git/ilse/changes.jsonl\`): lista o que a Ilse mudou e ainda não foi commitado, com a nota do designer e os arquivos. Inclua esses arquivos no commit e use as notas na mensagem.
`;

/** The agent-instructions file to write to: AGENTS.md, else CLAUDE.md, else a new CLAUDE.md */
export function instructionsFile(cwd: string): { path: string; exists: boolean } {
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const p = join(cwd, name);
    if (existsSync(p)) return { path: p, exists: true };
  }
  return { path: join(cwd, 'CLAUDE.md'), exists: false };
}

export function hasCommitContext(cwd: string): boolean {
  return ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md'].some(name => {
    try { return readFileSync(join(cwd, name), 'utf8').includes(COMMIT_MARKER); } catch { return false; }
  });
}

export function addCommitContext(cwd: string): string {
  const { path, exists } = instructionsFile(cwd);
  if (exists) appendFileSync(path, `\n${COMMIT_BLOCK}`, 'utf8');
  else writeFileSync(path, COMMIT_BLOCK.trimStart(), 'utf8');
  return path;
}

// ── The answer, per project ────────────────────────────────────────────────

function readRc(cwd: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(join(cwd, '.ilserc.json'), 'utf8')) as Record<string, unknown>; } catch { return {}; }
}

/** undefined = never asked */
export function commitContextChoice(cwd: string): boolean | undefined {
  const v = readRc(cwd).commitContext;
  return typeof v === 'boolean' ? v : undefined;
}

export function saveCommitContextChoice(cwd: string, value: boolean): void {
  const rc = { ...readRc(cwd), commitContext: value };
  try { writeFileSync(join(cwd, '.ilserc.json'), JSON.stringify(rc, null, 2) + '\n', 'utf8'); } catch { /* read-only project */ }
}
