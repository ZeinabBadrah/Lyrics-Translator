import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("renders React components into jsdom", () => {
    render(<h1>Lyrics Translator</h1>);

    expect(
      screen.getByRole("heading", { name: "Lyrics Translator" }),
    ).toBeInTheDocument();
  });

  it("exposes an IndexedDB implementation for the storage layer", () => {
    expect(globalThis.indexedDB).toBeDefined();
  });
});
