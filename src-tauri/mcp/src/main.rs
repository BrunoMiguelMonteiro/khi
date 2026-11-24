use khi_mcp::guard::{library_file, resolve_data_dir, GuardError};
use khi_mcp::server::KhiServer;
use rmcp::ServiceExt;
use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str = "usage: khi-mcp [--dev] [--reader <id>]";

struct Args {
    dev: bool,
    reader: Option<u32>,
}

fn parse_args(mut args: impl Iterator<Item = String>) -> Result<Args, String> {
    let mut parsed = Args { dev: false, reader: None };
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--dev" => parsed.dev = true,
            "--reader" => {
                let id = args.next().ok_or("--reader needs a Reader id")?;
                parsed.reader = Some(id.parse().map_err(|_| format!("--reader needs a number, not {id:?}"))?);
            }
            other => return Err(format!("unknown argument {other:?}")),
        }
    }
    Ok(parsed)
}

fn main() -> ExitCode {
    // stderr only: stdout is the protocol. Never the app's own logger.
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn"))
        .target(env_logger::Target::Stderr)
        .init();

    let args = match parse_args(std::env::args().skip(1)) {
        Ok(args) => args,
        Err(why) => {
            eprintln!("khi-mcp: {why}\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    let identifier = if args.dev { "com.bruno.khi.dev" } else { "com.bruno.khi" };
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        eprintln!("khi-mcp: HOME is not set");
        return ExitCode::FAILURE;
    };
    // A Library that is not there yet is fine: every tool call checks again.
    let data_dir = match resolve_data_dir(&home, identifier, cfg!(debug_assertions)).and_then(|dir| {
        match library_file(&dir) {
            Ok(_) | Err(GuardError::Missing) => Ok(dir),
            Err(why) => Err(why),
        }
    }) {
        Ok(dir) => dir,
        Err(why) => {
            eprintln!("khi-mcp: {why}");
            return ExitCode::FAILURE;
        }
    };
    log::info!("khi-mcp starting");

    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("tokio runtime");
    let result = runtime.block_on(async {
        let server = KhiServer::new(data_dir, args.reader);
        let running = server.serve((tokio::io::stdin(), tokio::io::stdout())).await?;
        running.waiting().await?;
        Ok::<_, Box<dyn std::error::Error>>(())
    });
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(why) => {
            log::error!("khi-mcp stopped: {why}");
            ExitCode::FAILURE
        }
    }
}
