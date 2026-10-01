// HMR-resilient freeze: state lives on `window` so it survives module reloads
// and React remounts. Without this, clicking pause → HMR → clicking again
// would leave orphan <style> elements in the DOM and wrappers stuck on
// globalThis referencing dead module closures.

type TimerOriginals = {
  setTimeout: typeof globalThis.setTimeout;
  setInterval: typeof globalThis.setInterval;
  requestAnimationFrame: typeof globalThis.requestAnimationFrame;
};

type FreezeState = {
  frozen: boolean;
  originals: TimerOriginals;
  queuedTimeouts: Array<{ fn: Function; delay: number }>;
  queuedRAFs: Array<Function>;
  intercepted: boolean;
};

declare global {
  interface Window {
    __ilseFreezeState?: FreezeState;
  }
}

const FREEZE_CSS = `
*:not([data-ilse-toolbar] *) {
  animation-play-state: paused !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
`;

function getState(): FreezeState | null {
  if (typeof window === 'undefined') return null;
  if (!window.__ilseFreezeState) {
    // Capture natives on first module load in this window. If another copy
    // of this module already wrapped globalThis, we'd capture the wrapper —
    // but that only happens if someone created this state then deleted it,
    // which we never do.
    window.__ilseFreezeState = {
      frozen: false,
      originals: {
        setTimeout: globalThis.setTimeout.bind(globalThis),
        setInterval: globalThis.setInterval.bind(globalThis),
        requestAnimationFrame: globalThis.requestAnimationFrame.bind(globalThis),
      },
      queuedTimeouts: [],
      queuedRAFs: [],
      intercepted: false,
    };
  }
  return window.__ilseFreezeState;
}

function hasInjectedStyle(): boolean {
  return !!document.querySelector('style[data-ilse-freeze]');
}

function injectCSS() {
  // Idempotent: checks DOM, not a module-level ref, so HMR orphans don't
  // cause double-injection.
  if (hasInjectedStyle()) return;
  const el = document.createElement('style');
  el.setAttribute('data-ilse-freeze', '');
  el.textContent = FREEZE_CSS;
  document.head.appendChild(el);
}

function removeCSS() {
  // Remove ALL tagged elements — fixes the orphan case where a previous
  // module reload left a style behind.
  document.querySelectorAll('style[data-ilse-freeze]').forEach(el => el.remove());
}

function interceptTimers(state: FreezeState) {
  if (state.intercepted) return;
  state.intercepted = true;

  globalThis.setTimeout = ((fn: Function, delay?: number, ...args: unknown[]) => {
    if (state.frozen) {
      state.queuedTimeouts.push({ fn: () => (fn as (...a: unknown[]) => unknown)(...args), delay: delay ?? 0 });
      return -1 as unknown as ReturnType<typeof setTimeout>;
    }
    return state.originals.setTimeout(fn as Parameters<typeof state.originals.setTimeout>[0], delay, ...args);
  }) as typeof globalThis.setTimeout;

  globalThis.setInterval = ((fn: Function, delay?: number, ...args: unknown[]) => {
    if (state.frozen) {
      return -1 as unknown as ReturnType<typeof setInterval>;
    }
    return state.originals.setInterval(fn as Parameters<typeof state.originals.setInterval>[0], delay, ...args);
  }) as typeof globalThis.setInterval;

  globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
    if (state.frozen) {
      state.queuedRAFs.push(fn);
      return -1;
    }
    return state.originals.requestAnimationFrame(fn);
  }) as typeof globalThis.requestAnimationFrame;
}

function restoreTimers(state: FreezeState) {
  if (!state.intercepted) return;
  state.intercepted = false;
  globalThis.setTimeout = state.originals.setTimeout;
  globalThis.setInterval = state.originals.setInterval;
  globalThis.requestAnimationFrame = state.originals.requestAnimationFrame;
}

function flushQueued(state: FreezeState) {
  for (const { fn, delay } of state.queuedTimeouts) {
    state.originals.setTimeout(fn as Parameters<typeof state.originals.setTimeout>[0], delay);
  }
  state.queuedTimeouts.length = 0;

  for (const fn of state.queuedRAFs) {
    state.originals.requestAnimationFrame(fn as FrameRequestCallback);
  }
  state.queuedRAFs.length = 0;
}

export function freeze() {
  const state = getState();
  if (!state) return;
  state.frozen = true;
  injectCSS();
  interceptTimers(state);
}

export function unfreeze() {
  const state = getState();
  if (!state) return;
  state.frozen = false;
  removeCSS();
  restoreTimers(state);
  flushQueued(state);
}

export function toggleFreeze(): boolean {
  // Source of truth is the DOM + state flag. If they disagree (HMR left a
  // style behind while state thinks it's not frozen), trust the DOM.
  if (isFrozen()) {
    unfreeze();
  } else {
    freeze();
  }
  return isFrozen();
}

export function isFrozen(): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.__ilseFreezeState;
  // Consider the app frozen if either the flag says so OR there's an orphan
  // style injected (e.g. from a previous module instance after HMR).
  return !!state?.frozen || hasInjectedStyle();
}
