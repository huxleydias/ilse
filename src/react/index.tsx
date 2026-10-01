'use client';

import { useEffect, useState } from 'react';
import { IlseToolbar } from './toolbar.js';

declare global {
  interface Window { __ilseToolbar?: 'component' | 'standalone' }
}

/**
 * Safe to include in any layout — renders nothing in production.
 * No env vars, no wrappers, no conditions needed from the user.
 *
 * Optional since `npx ilse` injects a standalone toolbar through its proxy.
 * When both are present, whichever mounts first keeps the page.
 *
 * Props:
 * - demo: force render in production + use HTTP endpoint for annotations
 * - demoEndpoint: URL for the demo API (default: "/api/demo")
 */
export function Ilse({ demo, demoEndpoint }: { demo?: boolean; demoEndpoint?: string } = {}) {
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    if (window.__ilseToolbar === 'standalone') return;
    window.__ilseToolbar = 'component';
    setOwner(true);
  }, []);

  if (!demo && process.env.NODE_ENV === 'production') return null;
  if (!owner) return null;
  return <IlseToolbar demoMode={demo} demoEndpoint={demoEndpoint ?? '/api/demo'} />;
}
