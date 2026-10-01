# Security

## Reporting a vulnerability

Please report it privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue. You'll get an answer within a few days.

## Supported versions

Ilse is in beta (0.5.x). Fixes go into the latest version.

## How Ilse is meant to run

What to keep in mind when reviewing or reporting:

- The proxy (`localhost:4700`), the WebSocket server (`4747`–`4757`) and the MCP endpoint bind to **loopback only**. The WebSocket rejects connections without the expected `Origin`.
- The MCP endpoint requires a bearer token stored in `~/.ilse/token` (file mode `0600`).
- Ilse holds no API keys. It runs the agent CLI the user already has, with that CLI's own login.
- Ilse writes to the user's project only to apply a requested change (always undoable) and, with consent, a short note in `AGENTS.md`/`CLAUDE.md`. Its own state lives in `~/.ilse/` and `.git/ilse/`.
- The session journal never records note text, prompts, code or file paths.

Anything that breaks one of these is a security issue.
