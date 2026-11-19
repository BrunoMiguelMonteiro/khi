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

  it("settings_capability_is_minimal", () => {
    const settings = capability("settings");
    expect(settings.windows).toEqual(["settings"]);
    // Esc ends in close(), onCloseRequested in destroy(), a saved language in setTitle()
    expect([...settings.permissions].sort()).toEqual(
      [
        "core:default",
        "core:event:default",
        "core:window:allow-set-theme",
        "core:window:allow-set-title",
        "core:window:allow-close",
        "core:window:allow-destroy",
        "dialog:default",
      ].sort(),
    );
  });
});
