/**
 * Local access token + running-server info, in ~/.ilse/.
 *
 * The WebSocket only accepts loopback browser origins, but an HTTP MCP endpoint
 * is called by non-browser clients that send no Origin at all. The token is
 * what keeps other local programs out: "whoever holds the token is the agent".
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const DIR = join(homedir(), '.ilse');
const TOKEN_FILE = join(DIR, 'token');
const SERVER_FILE = join(DIR, 'server.json');

function ensureDir(): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

export function getLocalToken(): string {
  ensureDir();
  if (existsSync(TOKEN_FILE)) {
    const saved = readFileSync(TOKEN_FILE, 'utf8').trim();
    if (saved) return saved;
  }
  const token = `ilse_${randomBytes(24).toString('hex')}`;
  writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 });
  try { chmodSync(TOKEN_FILE, 0o600); } catch { /* best effort on non-POSIX */ }
  return token;
}

export function checkBearer(header: string | undefined, token: string): boolean {
  const got = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  const a = Buffer.from(got);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ServerInfo { port: number; pid: number; cwd: string; startedAt: string }

/** The most recently started `ilse` — the stdio bridge (ilse-mcp) connects to it. */
export function writeServerInfo(port: number): void {
  ensureDir();
  const info: ServerInfo = { port, pid: process.pid, cwd: process.cwd(), startedAt: new Date().toISOString() };
  writeFileSync(SERVER_FILE, JSON.stringify(info, null, 2) + '\n');
}

export function readServerInfo(): ServerInfo | null {
  try { return JSON.parse(readFileSync(SERVER_FILE, 'utf8')) as ServerInfo; } catch { return null; }
}
