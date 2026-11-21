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
  it("main_window_is_overlay", () => {
    const conf = JSON.parse(
      readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
    );
    const main = conf.app.windows[0];
    // The title bar is the WindowBar's; the Settings window is built in Rust and does not inherit this
    expect(main.titleBarStyle).toBe("Overlay");
    expect(main.hiddenTitle).toBe(true);
    expect(main.trafficLightPosition).toEqual({ x: 16, y: 28 });
  });

  it("default_capability_allows_start_dragging", () => {
    const main = capability("default");
    // Without it, data-tauri-drag-region fails silently.
    expect(main.permissions).toContain("core:window:allow-start-dragging");
    expect(main.windows).toContain("main");
  });

  it("default_capability_allows_set_focus", () => {
    // Settings' «Check Now» brings the main window, with the dialog, forward
    expect(capability("default").permissions).toContain("core:window:allow-set-focus");
  });

  it("default_capability_allows_set_title", () => {
    // The book on screen names the window
    expect(capability("default").permissions).toContain("core:window:allow-set-title");
  });

  it("settings_capability_is_minimal", () => {
    const settings = capability("settings");
    expect(settings.windows).toEqual(["settings"]);
    // Esc ends in close(), the close request (held to save a name half-typed) in destroy(), the pane's name in
    // setTitle(), its height in setSize(); the Overlay bar is dragged by its
    // drag region (start-dragging, as the main window); built hidden, the page
    // show()s it once its theme and height are applied
    expect([...settings.permissions].sort()).toEqual(
      [
        "core:default",
        "core:event:default",
        "core:window:allow-set-size",
        "core:window:allow-start-dragging",
        "core:window:allow-set-theme",
        "core:window:allow-set-title",
        "core:window:allow-close",
        "core:window:allow-destroy",
        "core:window:allow-show",
        "dialog:default",
      ].sort(),
    );
  });
});
