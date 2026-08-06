# should-i-use

**The MCP that tells your agent what NOT to install.**

Most library docs MCP servers dump thousands of tokens of documentation into your context and let the model sort it out. This one answers the actual question: which library to pick, which to skip, and how to do the thing. Typical answers run 25 to 360 tokens. Every response is hard-clamped at 500.

**376 libraries indexed. Last updated: 2026-08-06.**

Data comes from a curated index of npm and PyPI libraries with hand-written honest guides: what a library is actually like to set up, when you should not use it, verified alternatives, 4-axis scorecards, and version-correct code snippets. If a library is not indexed, the tools say so plainly instead of guessing.

If you want a Context7 alternative that treats context as a budget rather than a bucket, this is it.

## Quickstart

No install, no API key, no database. The index ships inside the package.

### Claude Code

```
claude mcp add should-i-use -- npx -y should-i-use-mcp
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "should-i-use": {
      "command": "npx",
      "args": ["-y", "should-i-use-mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "should-i-use": {
      "command": "npx",
      "args": ["-y", "should-i-use-mcp"]
    }
  }
}
```

Any other MCP client: command `npx`, args `["-y", "should-i-use-mcp"]`. Running from a local checkout: command `node`, args `["/path/to/should-i-use/server.js"]`.

### Hosted endpoint (rolling out)

A hosted streamable-HTTP endpoint is rolling out at `https://mrkeyoor.com/mcp`. It serves the live index, so it can be a day fresher than the npm snapshot. The npx install above is the stable path today.

## Tools

| Tool | Example call | What you get back |
| --- | --- | --- |
| `pick_library` | `pick_library("parse CSV files in node")` | Top 1-3 picks with one-line reasoning, plus a skip warning for the winner |
| `should_i_use` | `should_i_use("moment")` | Verdict, 4-axis scores with reasons, top skip-if items, last push and download signals |
| `alternatives` | `alternatives("axios")` | Curated alternatives with "prefer it when" lines and verdicts |
| `how_do_i` | `how_do_i("got", "retry a failed request")` | The 1-2 best snippets for the task plus their gotchas, nothing else |
| `docs_link` | `docs_link("fastapi", "middleware")` | Docs URL and repo link, one line each |

## Token budget, measured

- Typical answer: 25 to 360 tokens, depending on the tool and how much the library page has to say.
- Hard cap: 500 tokens per response, enforced in `clamp.js`. Long answers are cut at sentence boundaries with a pointer to `docs_link`.
- The smoke test (`npm run smoke`) spawns the server, calls every tool against the bundled data, and fails if any response breaks the cap. The budget is a test, not a promise.

Compare that with a docs-dump server, where a single "how do I" answer routinely costs 2,000 to 10,000 tokens of pasted documentation.

## How the data is made

Every entry is a hand-written guide backed by registry and repo signals, not scraped docs:

- **Guides and verdicts**: what the library is, when to use it, when to skip it, written and reviewed at [mrkeyoor.com/libs](https://mrkeyoor.com/libs/) by [Keyoor](https://mrkeyoor.com/author/keyoor/).
- **Scores**: 4 axes (API stability, docs quality, maintenance, ecosystem), 1-5 each, with a one-line reason per score.
- **Signals**: last push, weekly downloads, and stars refreshed daily from the registries and GitHub.
- **Snippets**: checked against the indexed version, each with its gotcha.

The bundled snapshot (`data/libraries.json`) is exported daily from that index. Honest means the index will tell you to skip the popular option when the maintenance signals say so. No library has paid to be listed or to change a score.

Set `SHOULD_I_USE_DATA=/path/to/libraries.json` to point the server at your own snapshot (same shape: a JSON array of library docs).

## Requirements

- Node 20+
- Nothing else. No database, no network access at runtime.

## Contributing

- **Missing library or wrong verdict?** [Open an issue](https://github.com/mrkeyoor/should-i-use/issues). Challenges to verdicts are how the index gets better.
- **Code changes**: PRs welcome for the server (`server.js`, `tools.js`, `clamp.js`, `data.js`). Keep responses inside the 500 token cap; `npm run smoke` enforces it.
- **Data changes**: `data/libraries.json` is generated, so edits to it get overwritten by the next export. File an issue instead and the fix lands upstream.

## License

- Code: [MIT](LICENSE)
- Data (`data/libraries.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution to [mrkeyoor.com](https://mrkeyoor.com/libs/). See [data/LICENSE](data/LICENSE).
