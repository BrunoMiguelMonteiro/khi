#!/usr/bin/env python3
"""Smoke test of a built khi-mcp, with no model: JSON-RPC over stdio.

Checks the binary that ships, by default the one inside the release Khi.app:

1. With an empty HOME it finds no Library: it reads $HOME, never the real one.
2. On the evaluation Library it starts, lists the five read-only tools and answers list_readers.
3. The calls leave library.sqlite byte for byte as it was.
4. The switch in Settings › Agents (meta `allow_agents`) is read on every call:
   turned off it refuses, turned on again it answers, in the same server process.

Everything happens in a temporary HOME. The real Library and any Kobo are never opened.

    npm run build:release            # or any build that stages the sidecar
    python3 src-tauri/mcp/eval/smoke.py [path/to/khi-mcp]
"""

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT = ROOT / "src-tauri/target/release/bundle/macos/Khi.app/Contents/MacOS/khi-mcp"
TOOLS = {"list_readers", "list_books", "get_book", "search_highlights", "new_highlights"}
TURNED_OFF = "Turned off in Khi Settings › Agents"

failures = []


def check(ok, what):
    print(("  ok    " if ok else "  FAIL  ") + what)
    if not ok:
        failures.append(what)


class Server:
    """One khi-mcp process, spoken to one request at a time."""

    def __init__(self, binary, home, *args):
        env = {"HOME": str(home), "PATH": os.environ.get("PATH", "/usr/bin:/bin")}
        self.proc = subprocess.Popen(
            [str(binary), *args], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, env=env, text=True,
        )
        self.next_id = 0
        self.info = self.request("initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "khi-smoke", "version": "1"},
        })
        self.send({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def send(self, message):
        self.proc.stdin.write(json.dumps(message) + "\n")
        self.proc.stdin.flush()

    def request(self, method, params=None):
        self.next_id += 1
        self.send({"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params or {}})
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError(f"khi-mcp closed stdout; stderr: {self.proc.stderr.read()}")
            message = json.loads(line)
            if message.get("id") == self.next_id:
                if "error" in message:
                    raise RuntimeError(f"{method}: {message['error']}")
                return message["result"]

    def call(self, tool, arguments=None):
        return self.request("tools/call", {"name": tool, "arguments": arguments or {}})

    def close(self):
        self.proc.stdin.close()
        self.proc.wait(timeout=10)


def text_of(result):
    return " ".join(part.get("text", "") for part in result.get("content", []))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def set_switch(library, on):
    """What Settings › Agents writes: the meta key `allow_agents`."""
    with sqlite3.connect(library) as db:
        db.execute("UPDATE meta SET value = ? WHERE key = 'allow_agents'", ("true" if on else "false",))


def main():
    binary = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not binary.is_file():
        sys.exit(f"no khi-mcp at {binary}: build it first (npm run build:release)")
    print(f"khi-mcp: {binary}")

    home = Path(tempfile.mkdtemp(prefix="khi-smoke-"))
    try:
        print("1. Empty HOME")
        server = Server(binary, home)
        result = server.call("list_readers")
        check(result.get("isError") is True and "No Library found" in text_of(result),
              "finds no Library in the temporary HOME, so it never falls back to the real one")
        server.close()

        dev = home / "Library/Application Support/KoboHighlightsExporter Dev"
        subprocess.run(
            ["cargo", "run", "-q", "-p", "khi-mcp", "--example", "build_eval", "--", str(dev)],
            cwd=ROOT / "src-tauri", env={**os.environ, "HOME": str(home)}, check=True,
        )
        library = dev / "library.sqlite"
        # The evaluation Library leaves the WAL open: fold it in, so the bytes are the whole state.
        with sqlite3.connect(library) as db:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE)")

        print("2. Evaluation Library, switch on")
        before = sha(library)
        server = Server(binary, home, "--dev")
        check(server.info.get("serverInfo", {}).get("name") == "khi-mcp",
              f"initialize answers as khi-mcp {server.info.get('serverInfo', {}).get('version', '?')}")
        tools = {tool["name"]: tool for tool in server.request("tools/list")["tools"]}
        check(set(tools) == TOOLS, f"lists the five tools: {sorted(tools)}")
        check(all(t.get("annotations", {}).get("readOnlyHint") is True for t in tools.values()),
              "every tool is marked readOnlyHint")
        result = server.call("list_readers")
        names = sorted(r["name"] for r in result.get("structuredContent", {}).get("readers", []))
        check(not result.get("isError") and names == ["Ana", "Bruno", "Rui"], f"list_readers answers {names}")
        result = server.call("search_highlights", {"query": "coracao"})
        ids = [r["highlight"]["id"] for r in result.get("structuredContent", {}).get("results", [])]
        check(not result.get("isError") and ids == ["conf-03"], f"search_highlights coracao finds {ids}")

        print("3. Read only")
        check(sha(library) == before, "library.sqlite is byte for byte the same after the calls")

        print("4. The switch, in the same server process")
        set_switch(library, False)
        result = server.call("list_readers")
        check(result.get("isError") is True and TURNED_OFF in text_of(result),
              f"turned off, it answers «{TURNED_OFF}»")
        set_switch(library, True)
        result = server.call("list_readers")
        check(not result.get("isError"), "turned on again, it answers with no restart")
        server.close()
    finally:
        shutil.rmtree(home, ignore_errors=True)

    print("PASS" if not failures else f"FAIL: {len(failures)} check(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
