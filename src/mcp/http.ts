/**
 * MCP over HTTP, served by the running `ilse` itself (localhost only).
 *
 * One process holds the toolbar connection, the annotations, the undo stack and
 * the MCP endpoint — so an agent connected here sees exactly what the designer
 * sent. Stateless transport: a fresh server per request, the state lives in the
 * store. Every request needs `Authorization: Bearer <token from ~/.ilse/token>`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createIlseMcpServer, type ToolHooks } from './tools.js';
import { checkBearer } from '../config/local-token.js';

export const MCP_PATH = '/mcp';

export function createMcpHttpHandler(opts: { version: string; token: string; hooks?: ToolHooks }) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!req.url || new URL(req.url, 'http://localhost').pathname !== MCP_PATH) return false;

    if (!checkBearer(req.headers.authorization, opts.token)) {
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'Missing or invalid Ilse token (see ~/.ilse/token)' }));
      return true;
    }

    const server = createIlseMcpServer(opts.version, opts.hooks);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    }
    return true;
  };
}
