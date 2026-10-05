"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Links are added as each stage lands, so the nav never points at a page that
 * does not exist yet.
 */
const LINKS = [
  { href: "/", label: "Translate" },
  { href: "/songs", label: "Songs" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-3 sm:px-6"
      >
        <Link
          href="/"
          className="mr-auto text-sm font-semibold tracking-tight hover:opacity-70"
        >
          Lyrics Translator
        </Link>

        {LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-surface font-medium text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
