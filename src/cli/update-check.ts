import { createRequire } from 'node:module';
import { loadUserConfig, saveUserConfig } from '../config/user-config.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const SEMVER_RE = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/;

export interface UpdateResult {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

/** Compare two semver strings (x.y.z). Returns true if b > a. */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pb[i] ?? 0) > (pa[i] ?? 0)) return true;
    if ((pb[i] ?? 0) < (pa[i] ?? 0)) return false;
  }
  return false;
}

/**
 * Check npm registry for a newer version of ilse-design.
 * - Returns cached result if checked within 24h.
 * - Fetch has a 3s timeout — never blocks startup.
 * - Returns null silently on any failure.
 */
export async function checkForUpdate(): Promise<UpdateResult | null> {
  try {
    const config = loadUserConfig();
    const current = pkg.version;

    // Use cache if fresh and valid
    if (
      config.lastUpdateCheck &&
      config.latestKnownVersion &&
      SEMVER_RE.test(config.latestKnownVersion) &&
      Date.now() - config.lastUpdateCheck < CHECK_INTERVAL_MS
    ) {
      return {
        current,
        latest: config.latestKnownVersion,
        hasUpdate: isNewer(current, config.latestKnownVersion),
      };
    }

    // Fetch latest version from npm registry
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    let latest: string;
    try {
      const res = await fetch('https://registry.npmjs.org/ilse-design/latest', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const data = (await res.json()) as { version?: string };
      if (!data.version || !SEMVER_RE.test(data.version)) return null;
      latest = data.version;
    } catch {
      clearTimeout(timeout);
      return null;
    }

    // Cache result
    saveUserConfig({ lastUpdateCheck: Date.now(), latestKnownVersion: latest });

    return { current, latest, hasUpdate: isNewer(current, latest) };
  } catch {
    return null;
  }
}
