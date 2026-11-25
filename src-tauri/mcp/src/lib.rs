//! khi-mcp: a read-only MCP server over the Khi Library, on stdio.
//! stdout carries the protocol and nothing else: this crate never calls the
//! app's logger, which writes to stdout.

pub mod guard;
pub mod server;
pub mod tools;
