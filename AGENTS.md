# Ilse — guide for contributors and coding agents

Ilse is a visual feedback tool for code agents. A designer points at the running app in the browser (click, select text, draw an area, drag, resize, edit in a property panel), and Ilse turns that into a precise change request that the user's own agent applies to the code — or applies it itself when no AI is needed.

The flow, end to end: [`.github/assets/ilse-architecture.svg`](.github/assets/ilse-architecture.svg).

## Principles (don't break these)

- **The AI is always the user's.** Ilse runs the agent the user already has (Claude Code, Codex, Cursor CLI, Gemini CLI) or lets it pull work over MCP. No API keys, accounts or servers of Ilse's own.
- **Nothing leaves the machine.** The proxy, the WebSocket server and the MCP endpoint listen on loopback only. The journal records timings and counts, never note text, prompts, code or paths.
- **Cheapest step that works.** Deterministic first (class swap), then one call to a fast model (quick path), then the full agent. Each step falls back to the next when unsure.
- **Conservative edits.** When a deterministic edit is ambiguous (dynamic `className`, two candidate nodes), it returns a reason and hands over to the agent instead of guessing.
- **The project stays untouched.** The toolbar is injected by a local proxy; nothing is added to the user's repo unless they ask (`--inject`, the commit note in `AGENTS.md`/`CLAUDE.md`).

## Map

```
src/
├── cli/            entry (`ilse`), the default command: setup, proxy, WS server, batching,
│                   the cost ladder (swap → quick → agent), undo/redo, usage-limit pause
├── proxy/          HTTP proxy that injects the toolbar into the dev server's HTML; finds the dev server
├── bridge/         WebSocket server (loopback, origin check), annotation store, prompt context (augment)
├── context/
│   ├── locate.ts       browser element → file:line, from the AST plus React's dev stack; component card
│   └── token-swap.ts   panel edits / class edits applied to the JSX className, no AI
├── agent/
│   ├── executor.ts     spawns the agent CLI, parses its stream, failure reasons
│   ├── agent-profile   model tier per task, isolated env, Claude account, project instructions
│   ├── quick-edit.ts   the quick path: fast model → JSON of classes → applied by token-swap
│   ├── claude-accounts discovers Claude logins (CLAUDE_CONFIG_DIR) to pick one per project
│   └── changeset.ts    file snapshots before a batch → diff → undo / redo
├── git/            .git/ilse/changes.jsonl ledger (`ilse changes`), commit note for the project's agent
├── mcp/            MCP tools served by the running `ilse` (`/mcp`), and the stdio bridge `ilse-mcp`
├── telemetry/      session journal (Settings → Logs)
├── design-context/ codebase analysis (token frequency, repeated patterns) — groundwork, not wired yet
├── react/          the toolbar (React): capture, live layout, property panel, card, tooltips
└── standalone/     entry of the toolbar bundle the proxy serves
```

## Develop

```bash
npm install
npm run build        # tsc + toolbar bundle (esbuild)
npm test             # vitest
npm run dev          # tsc --watch (rebuild the toolbar with `npm run build:toolbar`)
```

Try it on a real React app: `npm run build`, then in that app's folder (with its dev server running) run `node /path/to/ilse/dist/cli/index.js`. The proxy reads the toolbar bundle on every request, so `npm run build:toolbar` + a page reload is enough for toolbar changes.

## Conventions

- TypeScript strict, ES modules, imports with the `.js` extension.
- Comments say **why**, not what. Keep them next to the code they explain.
- Pure logic lives in small modules with tests (`__tests__/` next to the code). UI is verified by hand — say so in the PR when you couldn't.
- User-facing strings go through `src/i18n/messages.ts` (English and Portuguese).
- Every way to skip a step has a switch, so runs can be compared in the journal: `ILSE_QUICK=0`, `ILSE_HISTORY=0`, `ILSE_COMPONENT_CARD=0`, `ILSE_RESUME=1`, `ILSE_MODEL=…`, `ILSE_DEBUG=1`.
