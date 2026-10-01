/**
 * Tooltips in Ilse's look, for everything Ilse draws.
 *
 * The toolbar, the property panel and the card label their controls with plain
 * `title` attributes — the browser renders those in its own grey box, off-brand
 * and slow. This layer takes them over: hovering anything with a `title` inside
 * Ilse's UI moves the text to `data-ilse-tip` (so the native one never shows) and
 * draws a small bubble instead. New controls get it for free by setting `title`.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, shadow } from './tokens.js';

const DELAY_MS = 350;
const GAP = 8;

interface Tip { text: string; rect: DOMRect }

/** The labelled element under the pointer, inside Ilse's UI — its title taken over */
function claim(target: EventTarget | null): HTMLElement | null {
  const el = (target as Element | null)?.closest?.('[title], [data-ilse-tip]') as HTMLElement | null;
  if (!el || !el.closest('[data-ilse-toolbar]')) return null;
  const title = el.getAttribute('title');
  if (title) {
    el.setAttribute('data-ilse-tip', title);
    el.removeAttribute('title');
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', title);
  }
  return el.getAttribute('data-ilse-tip') ? el : null;
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    const onOver = (e: MouseEvent) => {
      const el = claim(e.target);
      if (el === current.current) return;
      current.current = el;
      clear();
      setTip(null);
      if (!el) return;
      timer.current = setTimeout(() => {
        const text = el.getAttribute('data-ilse-tip');
        if (text && el.isConnected) setTip({ text, rect: el.getBoundingClientRect() });
      }, DELAY_MS);
    };
    const hide = () => { clear(); current.current = null; setTip(null); };
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      clear();
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip || typeof document === 'undefined') return null;
  // Above the control, or below when there's no room; kept inside the viewport
  const above = tip.rect.top > 48;
  const cx = Math.min(Math.max(tip.rect.left + tip.rect.width / 2, 130), window.innerWidth - 130);
  return createPortal(
    <div
      data-ilse-toolbar
      role="tooltip"
      style={{
        position: 'fixed', left: cx, zIndex: 100001, pointerEvents: 'none',
        ...(above ? { bottom: window.innerHeight - tip.rect.top + GAP } : { top: tip.rect.bottom + GAP }),
        transform: 'translateX(-50%)',
        maxWidth: 240, padding: '5px 9px', borderRadius: radius.sm - 2,
        backgroundColor: color.foreground, color: '#fafafa', boxShadow: shadow.md,
        fontFamily: font.sans, fontSize: 11, lineHeight: 1.4, fontWeight: 500,
        whiteSpace: 'pre-line', textAlign: 'center',
        animation: 'ilse-tip-in 120ms ease-out',
      }}
    >
      <style>{'@keyframes ilse-tip-in{from{opacity:0;transform:translateX(-50%) translateY(2px)}to{opacity:1;transform:translateX(-50%)}}'}</style>
      {tip.text}
    </div>,
    document.body,
  );
}
