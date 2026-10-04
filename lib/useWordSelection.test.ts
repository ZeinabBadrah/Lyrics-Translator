import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWordSelection } from "@/lib/useWordSelection";

const LINES = ["hold the line,", "and wait for me", "", "another verse here"];

function setup(lines: string[] = LINES) {
  return renderHook(() => useWordSelection(lines));
}

describe("useWordSelection", () => {
  it("starts with nothing selected", () => {
    const { result } = setup();

    expect(result.current.selection).toBeNull();
    expect(result.current.text).toBe("");
    expect(result.current.dragging).toBe(false);
  });

  it("selects one word from a press and release in the same place", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 1 }));
    act(() => result.current.finish());

    expect(result.current.text).toBe("the");
    expect(result.current.dragging).toBe(false);
    expect(result.current.isSelected({ lineIndex: 0, wordIndex: 1 })).toBe(true);
    expect(result.current.isSelected({ lineIndex: 0, wordIndex: 0 })).toBe(false);
  });

  it("reports dragging while the gesture is live", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));

    expect(result.current.dragging).toBe(true);

    act(() => result.current.finish());

    expect(result.current.dragging).toBe(false);
  });

  it("grows the selection as the pointer moves", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));
    act(() => result.current.extend({ lineIndex: 0, wordIndex: 2 }));

    expect(result.current.text).toBe("hold the line");
  });

  it("spans consecutive lines", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 2 }));
    act(() => result.current.extend({ lineIndex: 1, wordIndex: 1 }));
    act(() => result.current.finish());

    expect(result.current.text).toBe("line, and wait");
  });

  it("keeps the selection after the gesture ends, so it can be confirmed", () => {
    // The user highlights first and presses Save second; finish() must not
    // throw the selection away.
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 1, wordIndex: 0 }));
    act(() => result.current.extend({ lineIndex: 1, wordIndex: 1 }));
    act(() => result.current.finish());

    expect(result.current.selection).toEqual({
      start: { lineIndex: 1, wordIndex: 0 },
      end: { lineIndex: 1, wordIndex: 1 },
    });
  });

  it("handles a backwards drag", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 1, wordIndex: 1 }));
    act(() => result.current.extend({ lineIndex: 0, wordIndex: 2 }));

    expect(result.current.text).toBe("line, and wait");
  });

  it("will not drag past a verse break", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));
    act(() => result.current.extend({ lineIndex: 3, wordIndex: 2 }));

    expect(result.current.text).toBe("hold the line, and wait for me");
  });

  it("ignores movement when no gesture is in progress", () => {
    const { result } = setup();

    act(() => result.current.extend({ lineIndex: 0, wordIndex: 2 }));

    expect(result.current.selection).toBeNull();
  });

  it("ignores movement after the gesture has ended", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));
    act(() => result.current.finish());
    act(() => result.current.extend({ lineIndex: 0, wordIndex: 2 }));

    expect(result.current.text).toBe("hold");
  });

  it("replaces the old selection when a new gesture starts", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));
    act(() => result.current.finish());
    act(() => result.current.begin({ lineIndex: 1, wordIndex: 2 }));
    act(() => result.current.finish());

    expect(result.current.text).toBe("for");
  });

  it("clears everything", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 0 }));
    act(() => result.current.finish());
    act(() => result.current.clear());

    expect(result.current.selection).toBeNull();
    expect(result.current.text).toBe("");
  });

  it("exposes the surrounding lines as translation context", () => {
    const { result } = setup();

    act(() => result.current.begin({ lineIndex: 0, wordIndex: 1 }));
    act(() => result.current.finish());

    expect(result.current.context).toBe("hold the line,");
  });
});
