//! A tool call runs off the protocol thread, and a panic in it becomes an
//! error result instead of a dropped answer.

use khi_mcp::server::run_blocking;
use khi_mcp::tools::Outcome;
use std::time::Duration;

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap()
}

#[test]
fn a_panicking_call_becomes_an_error_result() {
    let outcome = runtime().block_on(run_blocking(|| -> Outcome { panic!("boom: a secret title") }));
    match outcome {
        Outcome::Failed(why) => {
            assert_eq!(why, "khi-mcp hit an internal error");
            assert!(!why.contains("secret"), "the panic message must not reach the model");
        }
        _ => panic!("a panic must come back as Outcome::Failed"),
    }
}

#[test]
fn a_normal_call_passes_through() {
    let outcome = runtime().block_on(run_blocking(|| Outcome::Answer(serde_json::json!({"ok": true}))));
    assert!(matches!(outcome, Outcome::Answer(v) if v["ok"] == true));
}

#[test]
fn a_slow_call_does_not_freeze_the_runtime() {
    // The runtime has one thread: a call that sleeps on it would hold the timer back.
    let ticks = runtime().block_on(async {
        let slow = tokio::spawn(run_blocking(|| {
            std::thread::sleep(Duration::from_millis(300));
            Outcome::Answer(serde_json::json!(null))
        }));
        let mut ticks = 0;
        while !slow.is_finished() {
            tokio::time::sleep(Duration::from_millis(20)).await;
            ticks += 1;
        }
        slow.await.unwrap();
        ticks
    });
    assert!(ticks >= 5, "the runtime only ticked {ticks} times while a call was blocked");
}

#[test]
fn at_most_three_calls_run_at_once_and_all_complete() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    let (running, most) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
    let answers = runtime().block_on(async {
        let calls: Vec<_> = (0..10)
            .map(|i| {
                let (running, most) = (running.clone(), most.clone());
                tokio::spawn(run_blocking(move || {
                    let now = running.fetch_add(1, Ordering::SeqCst) + 1;
                    most.fetch_max(now, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(60));
                    running.fetch_sub(1, Ordering::SeqCst);
                    Outcome::Answer(serde_json::json!(i))
                }))
            })
            .collect();
        let mut answers = Vec::new();
        for call in calls {
            match call.await.unwrap() {
                Outcome::Answer(v) => answers.push(v.as_i64().unwrap()),
                _ => panic!("every call must complete with its answer"),
            }
        }
        answers
    });
    assert_eq!(answers, (0..10).collect::<Vec<_>>());
    let most = most.load(Ordering::SeqCst);
    assert!((1..=3).contains(&most), "{most} calls ran at once");
}
