<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lyrics Translator

## Hard rules

- **Never commit, tag, or push without being asked.** At the end of each stage, offer to commit and wait for an answer. Never run `git push` at all.
- **Never fetch, scrape, embed, or commit song lyrics.** The app only processes lyrics the user pastes in at runtime. Test fixtures must use invented text, not real song lyrics.
- **Never hardcode or log a DeepL API key.** Keys are entered by the user, stored in their browser, and forwarded per-request to DeepL. The server must not persist or log them.
- **No server-side database.** All user data lives in the browser's IndexedDB.

## Toolchain

Node is managed by nvm and pinned to 24 in `.nvmrc`. If a shell reports Node 20
(the Debian system install at `/usr/bin/node`), run `nvm use` from the project
root before installing or testing.

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
