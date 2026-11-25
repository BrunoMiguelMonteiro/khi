//! The protocol side: tools/list and tools/call over rmcp.

use crate::tools::{self, Outcome, SERVER_INSTRUCTIONS};
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool, ToolAnnotations,
};
use rmcp::service::{RequestContext, RoleServer};
use rmcp::{ErrorData, ServerHandler};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct KhiServer {
    data_dir: PathBuf,
    only_reader: Option<u32>,
}

impl KhiServer {
    pub fn new(data_dir: PathBuf, only_reader: Option<u32>) -> Self {
        KhiServer { data_dir, only_reader }
    }
}

fn schema_object(value: Value) -> Arc<serde_json::Map<String, Value>> {
    match value {
        Value::Object(map) => Arc::new(map),
        _ => Arc::new(serde_json::Map::new()),
    }
}

fn tool_list() -> Vec<Tool> {
    tools::definitions()
        .into_iter()
        .map(|d| {
            Tool::new(d.name, d.description, schema_object(d.input_schema))
                .with_raw_output_schema(schema_object(d.output_schema))
                .with_annotations(
                    ToolAnnotations::new().read_only(true).destructive(false).idempotent(true).open_world(false),
                )
        })
        .collect()
}

/// Tool calls that may run at once: each opens the Library and can scan it,
/// so a client firing many must not start them all; the rest wait here.
const MAX_CALLS: usize = 3;
static CALLS: Semaphore = Semaphore::const_new(MAX_CALLS);

/// Runs a tool call on a blocking thread: a busy Library (the 2 s timeout)
/// must not hold up the one-thread runtime that speaks the protocol. A panic
/// in the call comes back as an error result, not as a dropped answer. At
/// most `MAX_CALLS` calls run at once.
pub async fn run_blocking(call: impl FnOnce() -> Outcome + Send + 'static) -> Outcome {
    // The semaphore is never closed, so acquiring cannot fail. The permit
    // moves into the blocking thread: if the caller gives up, the call still
    // counts until it ends.
    let permit = CALLS.acquire().await.ok();
    let counted = move || {
        let _permit = permit;
        call()
    };
    match tokio::task::spawn_blocking(counted).await {
        Ok(outcome) => outcome,
        Err(why) => {
            log::error!("tool call failed: {why}");
            Outcome::Failed("khi-mcp hit an internal error".into())
        }
    }
}

impl ServerHandler for KhiServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("khi-mcp", env!("CARGO_PKG_VERSION")))
            .with_instructions(SERVER_INSTRUCTIONS)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult::with_all_items(tool_list()))
    }

    fn get_tool(&self, name: &str) -> Option<Tool> {
        tool_list().into_iter().find(|t| t.name == name)
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        // Only the tool's name is logged: never its arguments or its answer.
        log::info!("tools/call {}", request.name);
        let args = request.arguments.unwrap_or_default();
        let (data_dir, only_reader, name) = (self.data_dir.clone(), self.only_reader, request.name.to_string());
        match run_blocking(move || tools::call(&data_dir, only_reader, &name, args)).await {
            Outcome::Answer(value) => Ok(CallToolResult::structured(value).into()),
            Outcome::Failed(why) => Ok(CallToolResult::error(vec![ContentBlock::text(why)]).into()),
            Outcome::UnknownTool => Err(ErrorData::method_not_found::<rmcp::model::CallToolRequestMethod>()),
        }
    }
}
