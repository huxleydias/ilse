import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { takeSnapshot, diffSnapshot, discardChangeSet, summarizeChangeSet, pushUndo, popUndo, undoState } from '../changeset.js';

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ilse-cs-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(dir, 'src/Card.tsx'), 'const a = 1;\nconst b = 2;\n');
  writeFileSync(join(dir, 'src/old.css'), '.x{}\n');
  writeFileSync(join(dir, 'node_modules/x/index.js'), 'ignored');
  return dir;
}

describe('change sets', () => {
  it('captures modified, created and deleted files — and restores them', () => {
    const cwd = project();
    const snap = takeSnapshot(cwd);
    expect(snap.files.has('node_modules/x/index.js')).toBe(false);

    // "agent" run
    writeFileSync(join(cwd, 'src/Card.tsx'), 'const a = 1;\nconst b = 3;\n');
    writeFileSync(join(cwd, 'src/New.tsx'), 'export {};\n');
    unlinkSync(join(cwd, 'src/old.css'));

    const cs = diffSnapshot(snap, ['a1'])!;
    expect(cs.files.map(f => f.path).sort()).toEqual(['src/Card.tsx', 'src/New.tsx', 'src/old.css']);
    expect(summarizeChangeSet(cs).find(f => f.path === 'src/Card.tsx')).toMatchObject({ added: 1, removed: 1, status: 'modified' });

    const res = discardChangeSet(cs, cwd);
    expect(res.conflicts).toEqual([]);
    expect(readFileSync(join(cwd, 'src/Card.tsx'), 'utf8')).toBe('const a = 1;\nconst b = 2;\n');
    expect(existsSync(join(cwd, 'src/New.tsx'))).toBe(false);
    expect(readFileSync(join(cwd, 'src/old.css'), 'utf8')).toBe('.x{}\n');
  });

  it('returns null when nothing changed', () => {
    const cwd = project();
    expect(diffSnapshot(takeSnapshot(cwd), [])).toBeNull();
  });

  it('leaves files edited after the batch alone', () => {
    const cwd = project();
    const snap = takeSnapshot(cwd);
    writeFileSync(join(cwd, 'src/Card.tsx'), 'agent edit\n');
    const cs = diffSnapshot(snap, ['a1'])!;
    writeFileSync(join(cwd, 'src/Card.tsx'), 'designer edit afterwards\n');

    expect(discardChangeSet(cs, cwd)).toEqual({ restored: [], conflicts: ['src/Card.tsx'] });
    expect(readFileSync(join(cwd, 'src/Card.tsx'), 'utf8')).toBe('designer edit afterwards\n');
  });
});

describe('undo stack', () => {
  it('pops newest first and reports the next label', () => {
    pushUndo({ id: 'a', annotationIds: ['1'], label: 'primeiro', files: [], createdAt: 1 });
    pushUndo({ id: 'b', annotationIds: ['2'], label: 'segundo', files: [], createdAt: 2 });
    expect(undoState()).toMatchObject({ count: 2, label: 'segundo' });
    expect(popUndo()?.id).toBe('b');
    expect(undoState()).toMatchObject({ count: 1, label: 'primeiro' });
    popUndo();
    expect(undoState()).toMatchObject({ count: 0 }); expect(undoState().label).toBeUndefined();
  });
});

import { reapplyChangeSet, pushUndo, popUndo, pushRedo, popRedo, undoState } from '../changeset.js';

describe('redo', () => {
  it('puts an undone batch back, leaving files edited since alone', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ilse-redo-'));
    writeFileSync(join(cwd, 'a.tsx'), 'before');
    writeFileSync(join(cwd, 'b.tsx'), 'edited by hand');
    const cs = { id: 'r1', annotationIds: ['x'], createdAt: 0, files: [
      { path: 'a.tsx', before: 'before', after: 'after' },
      { path: 'b.tsx', before: 'before', after: 'after' },
    ] };
    const res = reapplyChangeSet(cs, cwd);
    expect(res).toEqual({ restored: ['a.tsx'], conflicts: ['b.tsx'] });
    expect(readFileSync(join(cwd, 'a.tsx'), 'utf8')).toBe('after');
    expect(readFileSync(join(cwd, 'b.tsx'), 'utf8')).toBe('edited by hand');
  });

  it('a new batch clears what could be redone; a redo does not', () => {
    while (popUndo()) { /* empty */ }
    while (popRedo()) { /* empty */ }
    const cs = (id: string) => ({ id, annotationIds: [], files: [], createdAt: 0, label: id });
    pushRedo(cs('old'));
    pushUndo(cs('from-redo'), true);
    expect(undoState().redoCount).toBe(1);
    pushUndo(cs('new-batch'));
    expect(undoState()).toMatchObject({ count: 2, redoCount: 0 });
  });
});
