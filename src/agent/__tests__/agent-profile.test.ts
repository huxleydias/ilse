import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pickTier, escalateTier, resolveModel, modelTiers, expectsEdit, isolatedEnv, projectInstructions } from '../agent-profile.js';
import type { Annotation } from '../../types.js';

const ann = (intent: string, located = true, extra: Partial<Annotation> = {}): Annotation => ({
  id: intent, note: '', element: 'div', styles: {}, status: 'pending', timestamp: '',
  intent: intent as Annotation['intent'],
  source: located ? [{ kind: 'element', file: 'a.tsx', line: 1, score: 10 } as never] : undefined,
  ...extra,
});

describe('tiers', () => {
  it('mechanical edits on a located element go fast', () => {
    expect(pickTier([ann('style')])).toBe('fast');
    expect(pickTier([ann('resize'), ann('style')])).toBe('fast');
  });
  it('judgement calls, unlocated work and big batches go strong', () => {
    expect(pickTier([ann('fix')])).toBe('strong');
    expect(pickTier([ann('style', false)])).toBe('strong');
    expect(pickTier([ann('style'), ann('style'), ann('style'), ann('style')])).toBe('strong');
  });
  it('open-ended work stays on the agent\'s own model', () => {
    expect(pickTier([ann('create')])).toBe('default');
    expect(pickTier([ann('fix', true, { imageRefs: ['data:'] })])).toBe('default');
  });
  it('escalates one tier at a time; only edits count as falling short', () => {
    expect(escalateTier('fast')).toBe('strong');
    expect(escalateTier('strong')).toBe('default');
    expect(escalateTier('default')).toBeNull();
    expect(expectsEdit([ann('analyze')])).toBe(false);
    expect(expectsEdit([ann('fix')])).toBe(true);
  });
});

describe('models per agent', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'ilse-tiers-'));
  it('ships Claude\'s pair; other agents keep their own model until configured', () => {
    const d = dir();
    expect(modelTiers(d, 'claude')).toEqual({ fast: 'haiku', strong: 'sonnet' });
    expect(modelTiers(d, 'codex')).toEqual({});
    expect(resolveModel('fast', modelTiers(d, 'codex'), {})).toBeUndefined();
  });
  it('.ilserc.json sets one pair for any agent, or a pair per agent (wins)', () => {
    const d = dir();
    writeFileSync(join(d, '.ilserc.json'), JSON.stringify({ models: { strong: 'opus', codex: { fast: 'gpt-mini', strong: 'gpt-big' } } }));
    expect(modelTiers(d, 'claude')).toEqual({ fast: 'haiku', strong: 'opus' });
    expect(modelTiers(d, 'codex')).toEqual({ fast: 'gpt-mini', strong: 'gpt-big' });
  });
  it('ILSE_MODEL wins; the default tier is the agent\'s own model', () => {
    const t = { fast: 'haiku', strong: 'sonnet' };
    expect(resolveModel('fast', t, {})).toBe('haiku');
    expect(resolveModel('default', t, {})).toBeUndefined();
    expect(resolveModel('fast', t, { ILSE_MODEL: 'opus' })).toBe('opus');
    expect(resolveModel('strong', t, { ILSE_MODEL: 'default' })).toBeUndefined();
  });
});

describe('isolation', () => {
  it('switches off user CLAUDE.md and memory, unless asked not to', () => {
    expect(isolatedEnv({})).toMatchObject({ CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' });
    expect(isolatedEnv({ ILSE_AGENT_USER_CONTEXT: '1' }).CLAUDE_CODE_DISABLE_CLAUDE_MDS).toBeUndefined();
  });
  it('hands the project\'s own instructions back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ilse-prof-'));
    expect(projectInstructions(dir)).toBeUndefined();
    writeFileSync(join(dir, 'CLAUDE.md'), 'Use pnpm.');
    writeFileSync(join(dir, 'AGENTS.md'), 'Tokens only.');
    const text = projectInstructions(dir)!;
    expect(text).toContain('# CLAUDE.md\n\nUse pnpm.');
    expect(text).toContain('# AGENTS.md\n\nTokens only.');
  });
});
