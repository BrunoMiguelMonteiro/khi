//! The macOS accent colour, for the «Sistema» accent (redesign Task 21; DECISIONS, Cor 2).
//!
//! Modelled on Cmdr's `system_look/platform/macos/accent_color.rs`: `NSColor.controlAccentColor`
//! in sRGB, plus the `AppleAccentColor` default from the global domain, which tells Multicolor
//! (absent) from Blue (4); both give `#007AFF`. The colour is resolved under Aqua and Dark Aqua,
//! because graphite, red, yellow and purple differ between them (Task 20).
//! `NSSystemColorsDidChangeNotification`, delivered on the main queue, re-reads and emits
//! `system-accent-changed`; it also fires on light/dark switches, so a value equal to the
//! previous one is not emitted again.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_specta::Event;

/// The System Settings accent, named as in `design/accent-tones.json` (`sistema`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum AccentName {
    Multicolor,
    Grafite,
    Vermelho,
    Laranja,
    Amarelo,
    Verde,
    Azul,
    Roxo,
    Rosa,
}

/// The system accent: its name and `controlAccentColor` in sRGB under Aqua (`light`) and Dark
/// Aqua (`dark`), as `#RRGGBB`. Returned by `get_system_accent` and sent with the change event.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type, Event)]
#[tauri_specta(event_name = "system-accent-changed")]
pub struct SystemAccent {
    pub name: AccentName,
    pub light: String,
    pub dark: String,
}

/// What macOS gives for Multicolor and Blue, in both appearances (Task 20).
const SYSTEM_BLUE: &str = "#007AFF";

impl SystemAccent {
    fn multicolor() -> Self {
        Self {
            name: AccentName::Multicolor,
            light: SYSTEM_BLUE.to_owned(),
            dark: SYSTEM_BLUE.to_owned(),
        }
    }
}

/// `AppleAccentColor` from the global domain: absent is Multicolor. An unknown value is treated
/// as Multicolor too, so the app keeps its own accent rather than guessing a colour.
pub fn accent_name(apple_accent_color: Option<i64>) -> AccentName {
    match apple_accent_color {
        Some(-1) => AccentName::Grafite,
        Some(0) => AccentName::Vermelho,
        Some(1) => AccentName::Laranja,
        Some(2) => AccentName::Amarelo,
        Some(3) => AccentName::Verde,
        Some(4) => AccentName::Azul,
        Some(5) => AccentName::Roxo,
        Some(6) => AccentName::Rosa,
        _ => AccentName::Multicolor,
    }
}

/// sRGB components in 0…1 as `#RRGGBB`.
pub fn hex(r: f64, g: f64, b: f64) -> String {
    let byte = |c: f64| (c.clamp(0.0, 1.0) * 255.0).round() as u8;
    format!("#{:02X}{:02X}{:02X}", byte(r), byte(g), byte(b))
}

/// The last accent sent, so a notification that changes nothing (a light/dark switch, another
/// system colour) is not sent again.
#[derive(Debug, Default)]
pub struct LastAccent(Option<SystemAccent>);

impl LastAccent {
    pub fn new(initial: SystemAccent) -> Self {
        Self(Some(initial))
    }

    /// Records `next` and says whether it differs from the last one.
    pub fn changed(&mut self, next: &SystemAccent) -> bool {
        if self.0.as_ref() == Some(next) {
            return false;
        }
        self.0 = Some(next.clone());
        true
    }
}

/// Reads the system accent. AppKit is main-thread only, so the read hops to the main thread.
#[tauri::command]
#[specta::specta]
pub async fn get_system_accent(app_handle: AppHandle) -> SystemAccent {
    tauri::async_runtime::spawn_blocking(move || read_on_main_thread(&app_handle))
        .await
        .unwrap_or_else(|e| {
            log::warn!("[SystemAccent] Reading stopped ({e}); using Multicolor");
            SystemAccent::multicolor()
        })
}

#[cfg(target_os = "macos")]
fn read_on_main_thread(app_handle: &AppHandle) -> SystemAccent {
    let (tx, rx) = std::sync::mpsc::channel();
    let hop = app_handle.run_on_main_thread(move || {
        if let Some(mtm) = objc2::MainThreadMarker::new() {
            let _ = tx.send(macos::read(mtm));
        }
    });
    if let Err(e) = hop {
        log::warn!("[SystemAccent] Couldn't reach the main thread ({e}); using Multicolor");
        return SystemAccent::multicolor();
    }
    rx.recv().unwrap_or_else(|e| {
        log::warn!("[SystemAccent] No answer from the main thread ({e}); using Multicolor");
        SystemAccent::multicolor()
    })
}

#[cfg(not(target_os = "macos"))]
fn read_on_main_thread(_app_handle: &AppHandle) -> SystemAccent {
    SystemAccent::multicolor()
}

/// Starts watching for accent changes and emits `system-accent-changed` for each new value.
/// Call from the setup hook, which runs on the main thread.
#[cfg(target_os = "macos")]
pub fn observe(app_handle: AppHandle) {
    let Some(mtm) = objc2::MainThreadMarker::new() else {
        log::warn!("[SystemAccent] Not on the main thread; accent changes are not observed");
        return;
    };
    macos::observe(mtm, app_handle);
}

#[cfg(not(target_os = "macos"))]
pub fn observe(_app_handle: AppHandle) {}

#[cfg(target_os = "macos")]
mod macos {
    use std::cell::RefCell;
    use std::ptr::NonNull;
    use std::sync::{Arc, Mutex};

    use block2::{RcBlock, StackBlock};
    use objc2::MainThreadMarker;
    use objc2_app_kit::{
        NSAppearance, NSAppearanceName, NSAppearanceNameAqua, NSAppearanceNameDarkAqua, NSColor,
        NSColorSpace, NSSystemColorsDidChangeNotification,
    };
    use objc2_foundation::{
        ns_string, NSGlobalDomain, NSNotification, NSNotificationCenter, NSNumber,
        NSOperationQueue, NSString, NSUserDefaults,
    };
    use tauri::AppHandle;
    use tauri_specta::Event;

    use super::{accent_name, hex, LastAccent, SystemAccent, SYSTEM_BLUE};

    /// `controlAccentColor` in sRGB, with `appearance` as the drawing appearance.
    fn accent_under(appearance: &NSAppearanceName, _mtm: MainThreadMarker) -> String {
        let Some(appearance) = NSAppearance::appearanceNamed(appearance) else {
            return SYSTEM_BLUE.to_owned();
        };
        let out = RefCell::new(None);
        let block = StackBlock::new(|| {
            let srgb = NSColorSpace::sRGBColorSpace();
            *out.borrow_mut() = NSColor::controlAccentColor()
                .colorUsingColorSpace(&srgb)
                .map(|c| hex(c.redComponent(), c.greenComponent(), c.blueComponent()));
        });
        appearance.performAsCurrentDrawingAppearance(&block);
        out.into_inner().unwrap_or_else(|| SYSTEM_BLUE.to_owned())
    }

    /// `AppleAccentColor` from the global domain only, as `defaults read -g` gives it. The
    /// standard search list would let the argument domain (`-AppleAccentColor 4`) or an
    /// app-local default shadow the System Settings value. The domain is read through cfprefsd,
    /// so a running app sees changes without a restart.
    pub(super) fn apple_accent_color() -> Option<i64> {
        // SAFETY: a Foundation constant, valid for the life of the app.
        let global = unsafe { NSGlobalDomain };
        let value = NSUserDefaults::standardUserDefaults()
            .persistentDomainForName(global)?
            .objectForKey(ns_string!("AppleAccentColor"))?;
        if let Some(number) = value.downcast_ref::<NSNumber>() {
            return Some(number.integerValue() as i64);
        }
        value.downcast_ref::<NSString>()?.to_string().trim().parse().ok()
    }

    pub(super) fn read(mtm: MainThreadMarker) -> SystemAccent {
        // SAFETY: the appearance names are AppKit constants, valid for the life of the app.
        let (aqua, dark_aqua) = unsafe { (NSAppearanceNameAqua, NSAppearanceNameDarkAqua) };
        SystemAccent {
            name: accent_name(apple_accent_color()),
            light: accent_under(aqua, mtm),
            dark: accent_under(dark_aqua, mtm),
        }
    }

    /// Re-reads the accent and emits it if it differs from the last one sent.
    fn reread(mtm: MainThreadMarker, last: &Mutex<LastAccent>, app_handle: &AppHandle) {
        let next = read(mtm);
        let mut last = last.lock().unwrap_or_else(|e| e.into_inner());
        if !last.changed(&next) {
            return;
        }
        log::info!("[SystemAccent] Changed: {next:?}");
        if let Err(e) = next.emit(app_handle) {
            log::error!("[SystemAccent] Failed to emit system-accent-changed: {e}");
        }
    }

    pub(super) fn observe(mtm: MainThreadMarker, app_handle: AppHandle) {
        let last = Arc::new(Mutex::new(LastAccent::new(read(mtm))));
        let handler = move |_: NonNull<NSNotification>| {
            // Delivered on the main queue; should that ever not hold, hop there rather than drop it.
            if let Some(mtm) = MainThreadMarker::new() {
                reread(mtm, &last, &app_handle);
                return;
            }
            let (last, app) = (Arc::clone(&last), app_handle.clone());
            let hop = app_handle.run_on_main_thread(move || {
                if let Some(mtm) = MainThreadMarker::new() {
                    reread(mtm, &last, &app);
                }
            });
            if let Err(e) = hop {
                log::warn!("[SystemAccent] Couldn't reach the main thread ({e}); change ignored");
            }
        };
        fn sendable<F: Send + Sync>(_: &F) {}
        sendable(&handler);
        let block = RcBlock::new(handler);
        let main_queue = NSOperationQueue::mainQueue();
        // SAFETY: a valid AppKit notification name and no object; the block is `Send + Sync`
        // (checked above), as the binding requires.
        let token = unsafe {
            NSNotificationCenter::defaultCenter().addObserverForName_object_queue_usingBlock(
                Some(NSSystemColorsDidChangeNotification),
                None,
                Some(&main_queue),
                &block,
            )
        };
        // Observed for the whole session: the registration is never removed.
        std::mem::forget(token);
    }

    #[cfg(test)]
    mod tests {
        use objc2::runtime::AnyObject;
        use objc2_foundation::{
            ns_string, NSArgumentDomain, NSDictionary, NSNumber, NSUserDefaults,
        };

        use super::apple_accent_color;

        #[test]
        fn argument_domain_does_not_shadow_the_global_accent() {
            let defaults = NSUserDefaults::standardUserDefaults();
            // SAFETY: an AppKit constant, valid for the life of the process.
            let args_name = unsafe { NSArgumentDomain };
            let saved = defaults.volatileDomainForName(args_name);
            let sentinel = NSNumber::numberWithInteger(99);
            let args = NSDictionary::<_, AnyObject>::from_slices(
                &[ns_string!("AppleAccentColor")],
                &[&**sentinel],
            );
            // SAFETY: string keys, a number value, as `-AppleAccentColor 99` would give.
            unsafe { defaults.setVolatileDomain_forName(&args, args_name) };
            let read = apple_accent_color();
            unsafe { defaults.setVolatileDomain_forName(&saved, args_name) };
            assert_ne!(read, Some(99), "the argument domain shadowed the global domain");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn accent(name: AccentName, light: &str, dark: &str) -> SystemAccent {
        SystemAccent {
            name,
            light: light.to_owned(),
            dark: dark.to_owned(),
        }
    }

    #[test]
    fn apple_accent_color_maps_to_name() {
        let cases = [
            (None, AccentName::Multicolor),
            (Some(-1), AccentName::Grafite),
            (Some(0), AccentName::Vermelho),
            (Some(1), AccentName::Laranja),
            (Some(2), AccentName::Amarelo),
            (Some(3), AccentName::Verde),
            (Some(4), AccentName::Azul),
            (Some(5), AccentName::Roxo),
            (Some(6), AccentName::Rosa),
            (Some(7), AccentName::Multicolor),
            (Some(-2), AccentName::Multicolor),
        ];
        for (value, name) in cases {
            assert_eq!(accent_name(value), name, "AppleAccentColor {value:?}");
        }
    }

    #[test]
    fn names_serialize_as_tone_table_keys() {
        let json = serde_json::to_string(&accent(AccentName::Grafite, "#989898", "#8C8C8C")).unwrap();
        assert_eq!(json, r##"{"name":"grafite","light":"#989898","dark":"#8C8C8C"}"##);
    }

    #[test]
    fn hex_is_uppercase_rounded_and_clamped() {
        assert_eq!(hex(0.0, 122.0 / 255.0, 1.0), "#007AFF");
        assert_eq!(hex(0.878, 0.2196, 0.2431), "#E0383E");
        assert_eq!(hex(-0.1, 1.2, 0.5), "#00FF80");
    }

    #[test]
    fn unchanged_accent_is_not_sent_again() {
        let blue = accent(AccentName::Azul, SYSTEM_BLUE, SYSTEM_BLUE);
        let mut last = LastAccent::new(accent(AccentName::Multicolor, SYSTEM_BLUE, SYSTEM_BLUE));
        // Multicolor → Blue: same colour, different name.
        assert!(last.changed(&blue));
        // A light/dark switch re-reads the same value.
        assert!(!last.changed(&blue));
        assert!(last.changed(&accent(AccentName::Rosa, "#F74F9E", "#F74F9E")));
        assert!(!last.changed(&accent(AccentName::Rosa, "#F74F9E", "#F74F9E")));
        // Same name, another colour (e.g. Increase contrast): sent.
        assert!(last.changed(&accent(AccentName::Rosa, "#F74F9E", "#FF6AB0")));
        assert!(LastAccent::default().changed(&blue));
    }
}
