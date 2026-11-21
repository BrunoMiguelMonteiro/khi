use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager};

pub fn setup_window_show(app: &tauri::App) {
    let window = app
        .get_webview_window("main")
        .expect("main window not found");

    let shown = Arc::new(AtomicBool::new(false));
    let shown_clone = shown.clone();
    let window_clone = window.clone();

    // Listen for app-ready event from frontend
    app.listen("app-ready", move |_| {
        if !shown_clone.swap(true, Ordering::SeqCst) {
            log::info!("[Window] Showing window (app-ready received)");
            if let Err(e) = window_clone.show() {
                log::error!("[Window] Failed to show window: {}", e);
            }
        } else {
            log::info!("[Window] Window already shown, ignoring duplicate show");
        }
    });

    // Fallback: show after 3 seconds if frontend doesn't emit event
    let shown_fallback = shown.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if !shown_fallback.swap(true, Ordering::SeqCst) {
            log::warn!("[Window] Showing window via fallback timer (3s)");
            if let Err(e) = window.show() {
                log::error!("[Window] Failed to show window via fallback: {}", e);
            }
        }
    });

    log::info!("[Window] Window show listener registered, fallback timer started (3s)");
}

/// How the Settings window is built: one window, opened from the menu (⌘,).
#[derive(Debug, Clone, PartialEq)]
pub struct SettingsWindowSpec {
    pub label: &'static str,
    /// The SvelteKit route, served through the adapter-static fallback.
    pub url_path: &'static str,
    /// Translated by the frontend: Rust has no i18n.
    pub title: String,
    pub resizable: bool,
    pub width: f64,
    pub height: f64,
    pub title_bar_style: tauri::TitleBarStyle,
    /// The native title is hidden: the page draws the bar. `setTitle` still names the window (Window menu, Mission Control).
    pub hidden_title: bool,
    /// Where the traffic lights go, in points from the window's top left corner.
    pub traffic_light_position: (f64, f64),
    pub minimizable: bool,
    pub maximizable: bool,
    /// Built hidden and shown by the page once its theme is applied (no
    /// white flash), or by `show_when_ready`'s fallback.
    pub visible: bool,
}

/// 540 wide, as in the Figma (Task 45). The page measures its pane and sets the height with
/// `setSize` before showing the window; 382 is the first pane's, Exportação.
pub fn settings_window_spec(title: String) -> SettingsWindowSpec {
    SettingsWindowSpec {
        label: "settings",
        url_path: "definicoes",
        title,
        resizable: false,
        width: 540.0,
        height: 382.0,
        // The page draws the bar under the traffic lights
        title_bar_style: tauri::TitleBarStyle::Overlay,
        hidden_title: true,
        // The Figma has the lights at (20, 10), but tao does not take y as the distance from the
        // top: it grows the bar by y and leaves the buttons where they were. Measured on the main
        // window, config y 28 gives the button at AX top 18, so y = the Figma's y + 8. Not 10.
        traffic_light_position: (20.0, 18.0),
        minimizable: false,
        maximizable: false,
        visible: false,
    }
}

/// Held from looking the Settings window up until it is built: two quick ⌘,
/// would otherwise both find no window and both build one. An async lock,
/// awaited by the async command: a sync lock held on the main thread would
/// block the event loop that `build()` waits on.
#[derive(Default)]
pub struct SettingsWindowLock(tauri::async_runtime::Mutex<()>);

/// The Reader the main window had open when it last opened Settings, read by
/// the page with `settings_reader` (never through the URL).
#[derive(Default)]
pub struct SettingsReader(std::sync::Mutex<Option<u32>>);

impl SettingsReader {
    pub fn set(&self, reader_id: Option<u32>) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = reader_id;
    }

    pub fn get(&self) -> Option<u32> {
        *self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// The Reader to show in Settings; `None` means the last one opened (R5).
#[tauri::command]
#[specta::specta]
pub fn settings_reader(app: tauri::AppHandle) -> Option<u32> {
    app.state::<SettingsReader>().get()
}

/// Closing the main window (⌘W or the red button) quits Khi, Settings
/// included; closing Settings closes only Settings.
pub fn exits_app(label: &str, event: &tauri::WindowEvent) -> bool {
    label == "main" && matches!(event, tauri::WindowEvent::Destroyed)
}

/// The page shows its window once its theme is applied; if it has not after
/// 3 s, it is shown anyway, as the main window is.
fn show_when_ready(app: tauri::AppHandle, label: &'static str) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        // Closed meanwhile: nothing to show
        let Some(window) = app.get_webview_window(label) else { return };
        if !window.is_visible().unwrap_or(true) {
            log::warn!("[Window] Showing {} via fallback timer (3s)", label);
            if let Err(e) = window.show() {
                log::error!("[Window] Failed to show {} via fallback: {}", label, e);
            }
        }
    });
}

/// Brings the Settings window forward, or opens it: there is only ever one.
/// `reader_id` is the Reader the main window has open; an open Settings
/// window gets it as `settings-reader`.
/// Async, because a sync command that builds a window can deadlock.
#[tauri::command]
#[specta::specta]
pub async fn open_settings(
    app: tauri::AppHandle,
    title: String,
    reader_id: Option<u32>,
) -> Result<(), String> {
    let lock = app.state::<SettingsWindowLock>();
    let _opening = lock.0.lock().await;
    app.state::<SettingsReader>().set(reader_id);

    let spec = settings_window_spec(title);
    if let Some(window) = app.get_webview_window(spec.label) {
        if let Some(id) = reader_id {
            if let Err(e) = app.emit_to(spec.label, "settings-reader", id) {
                log::error!("[Window] Failed to send the Reader to Settings: {}", e);
            }
        }
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }

    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        spec.label,
        tauri::WebviewUrl::App(spec.url_path.into()),
    )
    .title(spec.title)
    .resizable(spec.resizable)
    .minimizable(spec.minimizable)
    .maximizable(spec.maximizable)
    .inner_size(spec.width, spec.height)
    .visible(spec.visible)
    .center();
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(spec.title_bar_style)
        .hidden_title(spec.hidden_title)
        .traffic_light_position(tauri::LogicalPosition::new(
            spec.traffic_light_position.0,
            spec.traffic_light_position.1,
        ));
    builder.build().map_err(|e| e.to_string())?;
    show_when_ready(app.clone(), spec.label);
    Ok(())
}

/// Where the traffic lights end, in points from the window's left edge: the
/// WindowBar leaves this much, less its own `px-4`, for them (redesign Task
/// 36b). Their size and spacing change between macOS versions, so they are
/// measured, never assumed. `None` without the buttons or a native window,
/// and off macOS.
/// Async: it runs off the main thread, so waiting there for AppKit never
/// blocks the event loop.
#[tauri::command]
#[specta::specta]
pub async fn traffic_lights_max_x(window: tauri::WebviewWindow) -> Option<f64> {
    let inset_x = configured_inset_x(window.config(), window.label());
    tauri::async_runtime::spawn_blocking(move || {
        traffic_lights::edges_on_main_thread(&window)
            .map(|edges| traffic_lights_right_edge(inset_x, edges))
    })
    .await
    .unwrap_or_else(|e| {
        log::warn!("[Window] Measuring the traffic lights stopped ({e})");
        None
    })
}

/// The `trafficLightPosition.x` of this window in `tauri.conf.json`, if any.
pub fn configured_inset_x(config: &tauri::Config, label: &str) -> Option<f64> {
    config
        .app
        .windows
        .iter()
        .find(|w| w.label == label)
        .and_then(|w| w.traffic_light_position.as_ref())
        .map(|position| position.x)
}

/// The buttons as AppKit has them now, in window points.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ButtonEdges {
    /// Where the buttons' superview starts.
    pub superview_x: f64,
    /// The close button's left edge.
    pub close_min_x: f64,
    /// The zoom button's right edge.
    pub zoom_max_x: f64,
}

/// Where tao leaves the lights' right edge, whether it has moved them yet or
/// not. tao's `inset_traffic_lights` (tao 0.37.2, `view.rs:1017-1047`) puts
/// button `i` at `x + i * space_between` in its superview, with
/// `space_between` read from AppKit's own spacing, and leaves the sizes
/// alone. It runs on `drawRect:` (`view.rs:197`), so before the hidden
/// window's first draw the buttons are still where AppKit put them. The span
/// from close.minX to zoom.maxX is the same either way.
pub fn traffic_lights_right_edge(inset_x: Option<f64>, edges: ButtonEdges) -> f64 {
    match inset_x {
        Some(x) => edges.superview_x + x + (edges.zoom_max_x - edges.close_min_x),
        // No inset: AppKit's place is the place
        None => edges.zoom_max_x,
    }
}

#[cfg(target_os = "macos")]
mod traffic_lights {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSButton, NSWindow, NSWindowButton};

    use super::ButtonEdges;

    /// AppKit is main-thread only, so the read hops there and this waits for
    /// the answer. The command calls it from the blocking pool; were it ever
    /// called on the main thread, Tauri would run the task in place
    /// (tauri-runtime-wry `send_user_message`), and the answer would already
    /// be waiting.
    pub(super) fn edges_on_main_thread(window: &tauri::WebviewWindow) -> Option<ButtonEdges> {
        let (tx, rx) = std::sync::mpsc::channel();
        let target = window.clone();
        let hop = window.run_on_main_thread(move || {
            let _ = tx.send(MainThreadMarker::new().and_then(|mtm| read(&target, mtm)));
        });
        if let Err(e) = hop {
            log::warn!("[Window] Couldn't reach the main thread ({e}); traffic lights not measured");
            return None;
        }
        // A task the event loop drops unrun drops `tx`, and this gives `None`.
        // If the event loop stops with the task still queued, this waits until
        // the process exits: it holds a pool thread, never the main thread.
        rx.recv().ok().flatten()
    }

    /// `bounds`, to window coordinates (`toView: nil`).
    fn in_window(button: &NSButton) -> (f64, f64) {
        let rect = button.convertRect_toView(button.bounds(), None);
        (rect.origin.x, rect.origin.x + rect.size.width)
    }

    fn read(window: &tauri::WebviewWindow, _mtm: MainThreadMarker) -> Option<ButtonEdges> {
        // On the main thread Tauri answers this getter in place
        let ptr = window.ns_window().ok()?.cast::<NSWindow>();
        // SAFETY: Tauri's NSWindow pointer, not retained for us: the
        // `WebviewWindow` handle does not keep it alive. It is used at once,
        // on the main thread, in the task that read it; a window only closes
        // on the main thread, so it cannot go away in between. A null pointer
        // gives `None`.
        let ns_window = unsafe { ptr.as_ref() }?;
        let close = ns_window.standardWindowButton(NSWindowButton::CloseButton)?;
        let zoom = ns_window.standardWindowButton(NSWindowButton::ZoomButton)?;
        let (close_min_x, _) = in_window(&close);
        let (_, zoom_max_x) = in_window(&zoom);
        Some(ButtonEdges {
            // `frame` is in the superview, where tao's x applies
            superview_x: close_min_x - close.frame().origin.x,
            close_min_x,
            zoom_max_x,
        })
    }
}

#[cfg(not(target_os = "macos"))]
mod traffic_lights {
    pub(super) fn edges_on_main_thread(_window: &tauri::WebviewWindow) -> Option<super::ButtonEdges> {
        None
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn settings_window_spec() {
        let spec = super::settings_window_spec("Definições".to_string());
        assert_eq!(spec.label, "settings");
        assert_eq!(spec.url_path, "definicoes");
        assert_eq!(spec.title, "Definições");
        assert!(!spec.resizable);
        // 540 wide; the page sets the height to its pane (`setSize`) before showing the window,
        // and this is the first pane's (Exportação, 382)
        assert_eq!((spec.width, spec.height), (540.0, 382.0));
        // The page draws the bar under the traffic lights (Task 45)
        assert_eq!(spec.title_bar_style, tauri::TitleBarStyle::Overlay);
        assert!(spec.hidden_title, "the native title is hidden; the pane's name is only the window's name");
        // The Figma has the lights at (20, 10); tao's y is not the distance from the top, so the
        // config is the Figma's y + 8 (measured on the main window: y 28 puts the button at AX top 18)
        assert_eq!(spec.traffic_light_position, (20.0, 18.0));
        assert!(!spec.minimizable);
        assert!(!spec.maximizable);
        // Shown by the page once its theme is applied
        assert!(!spec.visible);
    }

    #[test]
    fn closing_main_exits_app() {
        use tauri::WindowEvent;
        assert!(super::exits_app("main", &WindowEvent::Destroyed));
        // Closing Settings closes only Settings
        assert!(!super::exits_app("settings", &WindowEvent::Destroyed));
        assert!(!super::exits_app("main", &WindowEvent::Focused(false)));
    }

    #[test]
    fn traffic_lights_edge_is_the_same_before_and_after_the_inset() {
        use super::{traffic_lights_right_edge, ButtonEdges};
        // Darwin 27: 14 pt lights, 23 pt apart, so close.minX to zoom.maxX is 60.
        // Before tao's first draw AppKit has them at its own x (here 9)...
        let before = ButtonEdges { superview_x: 0.0, close_min_x: 9.0, zoom_max_x: 69.0 };
        // ...and after it, at `trafficLightPosition.x` (16).
        let after = ButtonEdges { superview_x: 0.0, close_min_x: 16.0, zoom_max_x: 76.0 };
        assert_eq!(traffic_lights_right_edge(Some(16.0), before), 76.0);
        assert_eq!(traffic_lights_right_edge(Some(16.0), after), 76.0);
        // tao's x is in the buttons' superview: its own offset in the window counts
        let offset = ButtonEdges { superview_x: 2.0, close_min_x: 11.0, zoom_max_x: 71.0 };
        assert_eq!(traffic_lights_right_edge(Some(16.0), offset), 78.0);
        // No inset configured: AppKit's place is the place, as measured
        assert_eq!(traffic_lights_right_edge(None, before), 69.0);
    }

    #[test]
    fn traffic_light_inset_comes_from_the_window_config() {
        let config: tauri::Config =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
        assert_eq!(super::configured_inset_x(&config, "main"), Some(16.0));
        // Settings is built in code (`settings_window_spec`), not in tauri.conf.json
        assert_eq!(super::configured_inset_x(&config, "settings"), None);
    }

    #[test]
    fn settings_reader_keeps_the_last_reader_sent() {
        let reader = super::SettingsReader::default();
        assert_eq!(reader.get(), None);
        reader.set(Some(2));
        assert_eq!(reader.get(), Some(2));
        reader.set(None);
        assert_eq!(reader.get(), None);
    }
}
