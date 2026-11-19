import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const capability = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src-tauri/capabilities/${name}.json`),
      "utf8",
    ),
  );

describe("window config", () => {
  it("default_capability_allows_start_dragging", () => {
    const main = capability("default");
    // Without it, data-tauri-drag-region fails silently.
    expect(main.permissions).toContain("core:window:allow-start-dragging");
    expect(main.windows).toContain("main");
  });
});
