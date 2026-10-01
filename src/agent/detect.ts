/**
 * Which agent does this person actually use *here*?
 *
 * The old rule was "first CLI found in PATH", so someone with Claude and
 * Cursor installed always got Claude — even while working in Cursor. Ilse's
 * rule is that the AI is always the user's own agent, so we look for evidence
 * of use, strongest first, and only then fall back to what is installed.
 *
 *   1. explicit   ILSE_AGENT env, or "agent" in .ilserc.json
 *   2. terminal   env vars the agent's own terminal sets (ran `ilse` from inside it)
 *   3. project    files the agent keeps in the repo (.claude/, .cursor/, GEMINI.md…)
 *   4. history    the agent's session store on this machine, most recent wins
 *   5. installed  first CLI found in PATH (the old behaviour)
 *
 * Evidence for an agent whose CLI is not installed is not thrown away: it
 * becomes a hint ("you use Cursor — install cursor-agent or use the MCP").
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

export type AgentKind = 'claude' | 'codex' | 'cursor-agent' | 'gemini' | 'none';
export type DetectionSource = 'explicit' | 'terminal' | 'project' | 'history' | 'installed';

export interface AgentDetection {
  kind: AgentKind;
  command?: string;
  path?: string;
  source?: DetectionSource;
  reason?: string;
  /** Evidence pointed at an agent whose CLI is missing */
  missing?: { kind: AgentKind; reason: string };
}

export interface DetectEnv {
  cwd: string;
  home: string;
  env: Record<string, string | undefined>;
  which: (command: string) => string | null;
}

export const AGENTS: Array<{ kind: Exclude<AgentKind, 'none'>; command: string; label: string }> = [
  { kind: 'claude', command: 'claude', label: 'Claude Code' },
  { kind: 'codex', command: 'codex', label: 'Codex' },
  { kind: 'cursor-agent', command: 'cursor-agent', label: 'Cursor' },
  { kind: 'gemini', command: 'gemini', label: 'Gemini CLI' },
];

const ALIASES: Record<string, Exclude<AgentKind, 'none'>> = {
  claude: 'claude', 'claude-code': 'claude',
  codex: 'codex',
  cursor: 'cursor-agent', 'cursor-agent': 'cursor-agent',
  gemini: 'gemini', 'gemini-cli': 'gemini',
};

interface Evidence { kind: Exclude<AgentKind, 'none'>; source: DetectionSource; reason: string; score: number }

const SOURCE_WEIGHT: Record<DetectionSource, number> = {
  explicit: 1000, terminal: 100, project: 30, history: 10, installed: 0,
};

function which(command: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const full = join(dir, command);
    if (existsSync(full)) return full;
  }
  return null;
}

function mtime(path: string): number {
  try { return statSync(path).mtimeMs; } catch { return 0; }
}

function explicitEvidence(e: DetectEnv): Evidence[] {
  const out: Evidence[] = [];
  const fromEnv = e.env.ILSE_AGENT?.trim().toLowerCase();
  if (fromEnv && ALIASES[fromEnv]) {
    out.push({ kind: ALIASES[fromEnv], source: 'explicit', reason: `ILSE_AGENT=${fromEnv}`, score: 0 });
  }
  const rc = join(e.cwd, '.ilserc.json');
  if (existsSync(rc)) {
    try {
      const agent = String(JSON.parse(readFileSync(rc, 'utf8')).agent ?? '').toLowerCase();
      if (ALIASES[agent]) out.push({ kind: ALIASES[agent], source: 'explicit', reason: `.ilserc.json → "${agent}"`, score: 0 });
    } catch { /* malformed rc — ignore, other signals still apply */ }
  }
  return out;
}

function terminalEvidence(e: DetectEnv): Evidence[] {
  const out: Evidence[] = [];
  const env = e.env;
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) {
    out.push({ kind: 'claude', source: 'terminal', reason: 'rodando dentro do Claude Code', score: 0 });
  }
  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT) {
    out.push({ kind: 'cursor-agent', source: 'terminal', reason: 'rodando no terminal do Cursor', score: 0 });
  }
  if (Object.keys(env).some(k => k.startsWith('CODEX_') && env[k])) {
    out.push({ kind: 'codex', source: 'terminal', reason: 'rodando dentro do Codex', score: 0 });
  }
  if (env.GEMINI_CLI === '1') {
    out.push({ kind: 'gemini', source: 'terminal', reason: 'rodando dentro do Gemini CLI', score: 0 });
  }
  return out;
}

function projectEvidence(e: DetectEnv): Evidence[] {
  const out: Evidence[] = [];
  const has = (p: string) => existsSync(join(e.cwd, p));
  const add = (kind: Evidence['kind'], file: string, bonus = 0) =>
    out.push({ kind, source: 'project', reason: `${file} no projeto`, score: bonus });

  if (has('.claude')) add('claude', '.claude/', 2);
  else if (has('CLAUDE.md')) add('claude', 'CLAUDE.md');
  if (has('.cursor')) add('cursor-agent', '.cursor/', 2);
  else if (has('.cursorrules')) add('cursor-agent', '.cursorrules');
  if (has('.gemini')) add('gemini', '.gemini/', 2);
  else if (has('GEMINI.md')) add('gemini', 'GEMINI.md');
  if (has('.codex')) add('codex', '.codex/', 2);
  // AGENTS.md is read by nearly every agent — only a weak hint for Codex
  else if (has('AGENTS.md')) add('codex', 'AGENTS.md', -20);
  return out;
}

function historyEvidence(e: DetectEnv): Evidence[] {
  const out: Evidence[] = [];

  // Claude Code keeps one session folder per project: the path with / → -
  const claudeProject = join(e.home, '.claude', 'projects', e.cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  if (existsSync(claudeProject)) {
    out.push({ kind: 'claude', source: 'history', reason: 'sessões do Claude Code neste projeto', score: 15 });
  }

  // Otherwise: whichever agent's session store changed most recently, within a week
  const stores: Array<[Evidence['kind'], string]> = [
    ['claude', join(e.home, '.claude', 'projects')],
    ['codex', join(e.home, '.codex', 'sessions')],
    ['cursor-agent', join(e.home, '.cursor')],
    ['gemini', join(e.home, '.gemini')],
  ];
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = stores
    .map(([kind, dir]) => ({ kind, at: mtime(dir) }))
    .filter(s => s.at > weekAgo)
    .sort((a, b) => b.at - a.at)[0];
  if (recent) {
    out.push({ kind: recent.kind, source: 'history', reason: 'agente usado mais recentemente nesta máquina', score: 0 });
  }
  return out;
}

export function detectAgentIn(e: DetectEnv): AgentDetection {
  const evidence = [
    ...explicitEvidence(e),
    ...terminalEvidence(e),
    ...projectEvidence(e),
    ...historyEvidence(e),
  ];

  // Sum evidence per agent so two weak signals can beat one
  const totals = new Map<Evidence['kind'], { score: number; best: Evidence }>();
  for (const ev of evidence) {
    const score = SOURCE_WEIGHT[ev.source] + ev.score;
    const cur = totals.get(ev.kind);
    if (!cur) totals.set(ev.kind, { score, best: { ...ev, score } });
    else {
      cur.score += score;
      if (score > cur.best.score) cur.best = { ...ev, score };
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1].score - a[1].score);

  let missing: AgentDetection['missing'];
  for (const [kind, { best }] of ranked) {
    const agent = AGENTS.find(a => a.kind === kind)!;
    const path = e.which(agent.command);
    if (path) {
      return { kind, command: agent.command, path, source: best.source, reason: best.reason, missing };
    }
    missing ??= { kind, reason: best.reason };
  }

  for (const agent of AGENTS) {
    const path = e.which(agent.command);
    if (path) {
      return { kind: agent.kind, command: agent.command, path, source: 'installed', reason: `${agent.command} encontrado no PATH`, missing };
    }
  }
  return { kind: 'none', missing };
}

export function detectAgent(): AgentDetection {
  return detectAgentIn({ cwd: process.cwd(), home: homedir(), env: process.env, which });
}

export function agentLabel(kind: AgentKind): string {
  return AGENTS.find(a => a.kind === kind)?.label ?? kind;
}
