# Ask an AI agent about your highlights

**Before you turn this on:** an AI agent connected to Khi reads the highlights and notes of every Reader in your Library. It sends that text to the AI model it uses. If the agent is Claude, the text goes to Anthropic. Khi itself sends nothing anywhere, and it never changes your Library.

Khi includes a small helper, `khi-mcp`, that lets AI agents such as Claude Code and Claude Desktop read your Library. The agent starts it when it needs it, so the Khi app does not have to be open. It uses MCP, the Model Context Protocol, a standard way for agents to use tools on your Mac.

You don't need to export to Markdown first. The agent reads the Library directly, including books you have never exported.

## What you can ask

- "What did I highlight about trust?"
- "Which highlights are new since I last opened Khi?"
- "What reached my Library since 1 November?"
- "Where did I write 'review' in a note?"
- "How many highlights does Ana have for each author?"
- "Show me my highlights from *Sapiens*, in book order."
- "Which highlights did I remove from my Kobo that Khi still keeps?"

Search matches words, not meaning. Accents and capitals don't matter: "coracao" finds "coração". Each word you search for matches the start of a word, so "liberdade" also finds "liberdades".

## Turn it on

1. Open Khi, then **Settings › Agents**.
2. Turn on **Allow agents**. It is off until you turn it on. While it is off, every tool answers "Turned off in Khi Settings › Agents".
3. Copy the command or the configuration that the pane shows, as below. The pane fills in the real location of `khi-mcp` on your Mac.

The switch is stored in your Library. If you delete your Library or start a new one, agents are off again until you turn them back on.

### Claude Code

```bash
claude mcp add --scope user khi -- "/Applications/Khi.app/Contents/MacOS/khi-mcp"
```

Check it with `claude mcp list`.

### Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`. If the file already lists other servers, add the `khi` entry to `mcpServers` next to them:

```json
{
  "mcpServers": {
    "khi": {
      "command": "/Applications/Khi.app/Contents/MacOS/khi-mcp",
      "args": []
    }
  }
}
```

Then quit and reopen Claude Desktop.

### Other agents

Any agent that runs MCP servers over standard input and output can use Khi. Point it at `Khi.app/Contents/MacOS/khi-mcp`, with no arguments.

**If you move Khi to another folder,** the old command stops working. Copy it again from Settings › Agents.

## Only one Reader

If several people share your Library and you want the agent to see one Reader only, add `--reader` and that Reader's number:

```bash
claude mcp add --scope user khi -- "/Applications/Khi.app/Contents/MacOS/khi-mcp" --reader 1
```

`--reader` limits what the agent sees by default. It is not a privacy barrier: anyone who uses your Mac account can change the configuration, or open the Library some other way. To keep Libraries apart, use separate macOS accounts.

## What the agent can and can't do

| It can | It can't |
| --- | --- |
| List Readers and books, with highlight, note and new counts | Change, delete or add anything in your Library |
| Read a book's highlights and notes, in book order | Mark a book as opened, so it never clears "new" |
| Search highlights and notes by word | Export to Markdown |
| List new highlights, as the app counts them or since a date | Read your Kobo, or connect to the internet |

Highlights removed from your Kobo are included and marked as removed.

**"New" works as in the app:** a highlight is new until you open its book in Khi. Agents can't open books, so if you mostly ask the agent, ask for highlights "since" a date instead.

**Long answers come in pages.** Each answer stays under about 16 KB, so a long book arrives in several parts, and the agent asks for the next part itself. A single highlight longer than that is cut and marked as truncated.

## The tools

For agent developers, these are the five read-only tools:

- `list_readers`
- `list_books`
- `get_book`
- `search_highlights`
- `new_highlights`

Each one describes its parameters and the shape of its answer to the agent.

## Troubleshooting

| The agent says | What to do |
| --- | --- |
| Turned off in Khi Settings › Agents | Turn on Allow agents in Khi's Settings › Agents. |
| No Library found in the Khi data folder | Open Khi and sync your Kobo once, so the Library exists. |
| The Library is at version … but this tool needs … | Open the Khi app once, so it updates the Library. |
| The Library is at version …, newer than the … this tool knows | Update Khi. `khi-mcp` updates with the app. |
| The Library cannot be read: its folder is read-only | Check the permissions of `~/Library/Application Support/KoboHighlightsExporter`. |
| The server fails to start, or the command is not found | Khi was moved or removed. Copy the command again from Settings › Agents. |
