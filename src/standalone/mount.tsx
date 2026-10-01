/**
 * Standalone toolbar — the script the proxy injects into the page.
 *
 * Bundled with its own React (esbuild IIFE), so the project needs no install,
 * no import and no <Ilse /> in the layout. It still reads the *page's* React
 * fibers from the DOM, so component names and the source locator keep working.
 */

import { createRoot } from 'react-dom/client';
import { IlseToolbar } from '../react/toolbar.js';

declare global {
  interface Window { __ilseToolbar?: 'component' | 'standalone' }
}

function mount(): void {
  // <Ilse /> in the layout wins — never render two toolbars
  if (window.__ilseToolbar) return;
  window.__ilseToolbar = 'standalone';

  const host = document.createElement('div');
  host.id = 'ilse-standalone-root';
  document.body.appendChild(host);
  createRoot(host).render(<IlseToolbar />);
}

// Wait for the app to hydrate first: a layout that already renders <Ilse />
// claims the flag during its own mount.
function schedule(): void {
  setTimeout(mount, 300);
}

if (document.readyState === 'complete') schedule();
else window.addEventListener('load', schedule, { once: true });
