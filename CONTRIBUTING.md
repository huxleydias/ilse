# Contributing to Ilse

Thanks for helping. Issues, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an issue first for anything bigger than a small fix, so we can agree on the approach.
- **Security problems:** don't open a public issue — see [SECURITY.md](SECURITY.md).
- **How the code is laid out:** [AGENTS.md](AGENTS.md) has the map, the principles and the conventions. Read the principles before changing how Ilse calls agents or what leaves the machine.

## Setup

```bash
git clone https://github.com/idantas/ilse.git
cd ilse
npm install
npm run build
npm test
```

To try your change, start any React app's dev server, then in that app's folder run:

```bash
node /path/to/ilse/dist/cli/index.js
```

## Pull requests

- One topic per PR, with a short description of **why** and how you tested it.
- `npm run build` and `npm test` pass.
- New logic comes with tests. For UI changes, say what you checked by hand (and what you couldn't).
- New user-facing text in both English and Portuguese (`src/i18n/messages.ts`).
- Code, comments and docs in English.

## Reporting a bug

Include your OS, Node version, framework (Next, Vite…), agent (Claude Code, Codex…) and what you expected vs. what happened. The session journal helps a lot: toolbar → Settings → **Logs** → copy. It contains timings and counts only, never your notes, prompts, code or file paths.
