import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavBar } from "@/components/NavBar";

const usePathname = vi.hoisted(() => vi.fn(() => "/"));
vi.mock("next/navigation", () => ({ usePathname }));

describe("NavBar", () => {
  it("links to every page that exists", () => {
    usePathname.mockReturnValue("/");
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Translate" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Songs" })).toHaveAttribute(
      "href",
      "/songs",
    );
    expect(screen.getByRole("link", { name: "Vocabulary" })).toHaveAttribute(
      "href",
      "/vocabulary",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("marks the current page", () => {
    usePathname.mockReturnValue("/songs");
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Songs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Translate" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not treat a song's reading page as the library", () => {
    // `/song/abc`.startsWith(`/songs`) is false, but a sloppy prefix check
    // against `/song` would light up Songs on every lyrics page.
    usePathname.mockReturnValue("/song/seeded-test-song");
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Songs" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
