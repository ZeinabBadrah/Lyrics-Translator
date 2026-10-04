import "@testing-library/jest-dom/vitest";
// jsdom has no IndexedDB implementation, so the storage layer needs a stand-in.
import "fake-indexeddb/auto";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
