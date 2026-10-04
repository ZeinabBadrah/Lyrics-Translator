# Lyrics Translator

Paste the lyrics of a song you're listening to, get a line-by-line translation next to the original, and build a personal vocabulary list by tapping the words and phrases you want to remember.

Built for language learners who already learn from music and want the words they collect to stay theirs.

> **Status:** early development. The scaffold is in place; features land stage by stage.

## How it works

You paste lyrics yourself. The app never fetches, scrapes, or ships song lyrics — it only ever processes text you provide at runtime, which keeps it clear of copyright issues.

Translation goes through [DeepL](https://www.deepl.com/pro-api) using **your own API key**, which you enter on the Settings page. The free DeepL tier covers 500,000 characters a month, which is a lot of songs.

## Local-first storage

There is no backend database, and there never will be. Everything the app knows about you — your songs, your translations, your vocabulary list, and your DeepL API key — lives in your browser's IndexedDB, on your device.

The practical consequences are worth understanding:

- Your data does not sync between devices or browsers. The library you build in Chrome on your laptop is not the library you see in Safari on your phone.
- Clearing your browser's site data deletes everything. The vocabulary export (planned) exists so you can keep your own backup.
- Your DeepL API key is stored in plain text in IndexedDB, like any other browser-stored credential. Anything that can run JavaScript on the page — a browser extension, for instance — can read it. That's an acceptable trade for a single-user local app, but don't use a key you'd be upset to lose. You can revoke and regenerate it from your DeepL account at any time.

The only network requests the app makes are to DeepL, and the only reason they pass through this app's own `/api/translate` route is that DeepL's API can't be called directly from a browser. Your key is forwarded on each request and never stored or logged on the server.

## Getting a DeepL API key

1. Sign up for **DeepL API Free** at [deepl.com/pro-api](https://www.deepl.com/pro-api).
2. Open your account settings and copy the authentication key.
3. Paste it into the app's Settings page and hit "Test connection".

Free keys end in `:fx` and use a different endpoint than Pro keys — the app works this out from the key itself.

## Running it locally

Requires Node.js 22.22 or newer. The version is pinned in `.nvmrc`, so if you use [nvm](https://github.com/nvm-sh/nvm) you can just run `nvm use`.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other useful commands:

```bash
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
npm test           # Vitest, single run
npm run test:watch # Vitest, watch mode
```

## Project structure

```
app/         routes and API route handlers (App Router)
components/  reusable UI components
lib/         data layer, DeepL client, utilities
types/       shared TypeScript types
tests/       test-harness checks; feature tests sit next to their source
```

## Built with

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · IndexedDB via [`idb`](https://github.com/jakearchibald/idb) · Vitest

## License

MIT — see [LICENSE](./LICENSE).
