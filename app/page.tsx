import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Lyrics Translator
      </h1>
      <p className="text-base/7 text-muted">
        Paste the lyrics of a song, read the translation line by line, and
        collect the words you want to remember. Everything stays in your
        browser.
      </p>
      <p className="text-sm text-muted">
        The translation view arrives in the next stage. For now, add your DeepL
        API key in{" "}
        <Link
          href="/settings"
          className="text-accent underline underline-offset-2"
        >
          Settings
        </Link>
        .
      </p>
    </main>
  );
}
