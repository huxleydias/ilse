const BASE_PORT = 4747;
const MAX_PORT = 4757;
const RECONNECT_DELAY = 2000;

type MessageHandler = (msg: Record<string, unknown>) => void;
type StatusHandler = (connected: boolean) => void;

let ws: WebSocket | null = null;
let listeners: MessageHandler[] = [];
let statusListeners: StatusHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = true;
let confirmedPort: number | null = null; // port that accepted our origin

function emitStatus(connected: boolean) {
  for (const l of statusListeners) l(connected);
}

export function connect(startPort = BASE_PORT) {
  // Revive auto-reconnect in case a previous disconnect disabled it
  // (React Strict Mode double-mount runs cleanup then effect again).
  shouldReconnect = true;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  tryPort(startPort);
}

function tryPort(port: number) {
  if (!shouldReconnect) return;
  if (port > MAX_PORT) {
    // All ports tried — wait and retry from the beginning
    scheduleReconnect(BASE_PORT);
    return;
  }

  let sock: WebSocket;
  try {
    sock = new WebSocket(`ws://localhost:${port}`);
  } catch {
    tryPort(port + 1);
    return;
  }

  // After open, wait up to 1.5s for the ilse-cli handshake.
  // Any process that doesn't send {type:'connected', service:'ilse-cli'}
  // within that window is skipped — prevents zombie processes from
  // silently eating annotations.
  let helloTimer: ReturnType<typeof setTimeout> | null = null;
  let handshakeDone = false;

  sock.onopen = () => {
    helloTimer = setTimeout(() => {
      if (!handshakeDone) {
        sock.close();
        if (ws === sock) ws = null;
        tryPort(port + 1);
      }
    }, 1500);
  };

  sock.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);

      // Validate handshake on first message from server
      if (!handshakeDone) {
        if (msg.type === 'connected' && msg.service === 'ilse-cli') {
          handshakeDone = true;
          if (helloTimer) { clearTimeout(helloTimer); helloTimer = null; }
          if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
          ws = sock;
          confirmedPort = port;
          emitStatus(true);
        } else {
          // Wrong server — skip to next port
          if (helloTimer) { clearTimeout(helloTimer); helloTimer = null; }
          sock.close();
          if (ws === sock) ws = null;
          tryPort(port + 1);
          return;
        }
      }

      for (const listener of listeners) listener(msg);
    } catch { /* ignore malformed */ }
  };

  sock.onclose = (e) => {
    if (e.code === 4003) {
      // Server rejected us — wrong project. Try next port immediately.
      tryPort(port + 1);
      return;
    }
    // Only clear module-level ws if it still points at THIS instance.
    // Strict-mode double-mount can schedule a stale onclose after a new
    // connect() has replaced the reference — guard prevents clobbering.
    if (ws === sock) {
      ws = null;
      emitStatus(false);
      if (shouldReconnect) scheduleReconnect(confirmedPort ?? BASE_PORT);
    }
  };

  sock.onerror = () => {
    // Connection refused or error — try next port without waiting
    sock.close();
    if (ws === sock) ws = null;
    tryPort(port + 1);
  };
}

function scheduleReconnect(port: number) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    tryPort(port);
  }, RECONNECT_DELAY);
}

export function disconnect() {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
}

export function send(data: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

export function onMessage(handler: MessageHandler) {
  listeners.push(handler);
  return () => { listeners = listeners.filter(l => l !== handler); };
}

/**
 * Subscribe to connection status changes. Handler is called with `true`
 * when the WS opens and `false` when it closes. Use this for reactive
 * UI — faster and more reliable than polling isConnected().
 */
export function onStatus(handler: StatusHandler) {
  statusListeners.push(handler);
  return () => { statusListeners = statusListeners.filter(l => l !== handler); };
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
