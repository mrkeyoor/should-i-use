# should-i-use

**The MCP that tells your agent what NOT to install.**

Most library docs MCP servers dump thousands of tokens of documentation into your context and let the model sort it out. This one answers the actual question: which library to pick, which to skip, and how to do the thing. Typical answers run 25 to 360 tokens. Every response is hard-clamped at 500.

**992 libraries indexed. Last updated: 2026-08-10.**

The index grows daily. Data comes from a curated set of npm and PyPI libraries with hand-written honest guides: what a library is actually like to set up, when you should not use it, verified alternatives, 4-axis scorecards, and version-correct code snippets. If a library is not indexed, the tools say so plainly instead of guessing.

If you want a Context7 alternative that treats context as a budget rather than a bucket, this is it.

## Quickstart

No API key, no database. The index ships inside the package.

```
npx should-i-use-mcp install
```

That writes the server entry into whichever agent configs already exist on your machine: Claude Code, Claude Desktop, Cursor, Windsurf, Cline, VS Code, Zed, Codex, Gemini CLI. Each file it touches is backed up as `.bak` first. Restart your agent afterwards.

For a repo-local config instead of your home directory:

```
npx should-i-use-mcp install --project
```

That writes `.mcp.json` and `.cursor/mcp.json` in the current directory, so everyone who clones the repo gets the server.

### Claude Code, one line

```
claude mcp add should-i-use -- npx -y should-i-use-mcp
```

### By hand

If you would rather edit the JSON yourself, add this to your client's MCP config (`~/.cursor/mcp.json` for Cursor, `~/.codeium/windsurf/mcp_config.json` for Windsurf, the Claude Desktop config on macOS or Windows, and so on):

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

Any other MCP client: command `npx`, args `["-y", "should-i-use-mcp"]`. Running from a local checkout: command `node`, args `["/path/to/should-i-use/server.js"]`. VS Code puts the same object under `servers` instead of `mcpServers`, and Zed under `context_servers`; the installer handles both.

### Hosted endpoint (rolling out)

A hosted streamable-HTTP endpoint is rolling out at `https://mrkeyoor.com/mcp`. It serves the live index, so it can be a day fresher than the npm snapshot. The npx install above is the stable path today.

## Tools

| Tool | Example call | What you get back |
| --- | --- | --- |
| `pick_library` | `pick_library("parse CSV files in node")` | Top 1-3 picks with one-line reasoning, plus a skip warning for the winner |
| `should_i_use` | `should_i_use("moment")` | Verdict, 4-axis scores with reasons, top skip-if items, last push and download signals |
| `audit_dependencies` | `audit_dependencies(<contents of package.json>)` | Only the dependencies worth a decision: unmaintained, unstable, or worth swapping |
| `alternatives` | `alternatives("axios")` | Curated alternatives with "prefer it when" lines and verdicts |
| `how_do_i` | `how_do_i("got", "retry a failed request")` | The 1-2 best snippets for the task plus their gotchas, nothing else |
| `docs_link` | `docs_link("fastapi", "middleware")` | Docs URL and repo link, one line each |

## audit_dependencies

The pitch is "ask before you npm install". This is the tool for the codebase you did not write, where the installing already happened.

Pass it the contents of `package.json`, `requirements.txt`, `pyproject.toml`, or just a newline-separated list of names. It returns only the dependencies that need a human decision, sorted into REPLACE (unmaintained), WATCH (unstable API or thin maintenance), and WORTH RECONSIDERING (a documented reason to skip plus a named alternative). It stays quiet about the boring majority, and it says nothing at all about packages that are not in the index rather than inventing an opinion.

Real output, unedited:

```
REPLACE (1 unmaintained):
- crypto-js: last push 2.0y ago, still 19.3M/wk. Nineteen million weekly
  downloads of pure inertia behind a library whose own README tells you to
  stop using it. Consider @noble/hashes or @noble/ciphers.
```

```
REPLACE (1 unmaintained):
- python-jose: last push 4mo ago, still 10.6M/wk. It works, it is widely
  deployed, and the API is pleasant, but a cryptography library with a
  three-and-a-half-year release gap and a ten-month turnaround on two
  critical advisories is not where new code should start. Consider pyjwt
  or joserfc.
```

Both of those are popular packages in current use. Download count is not a maintenance signal, and that is the gap this tool is for.

A good first prompt after installing: *"audit my dependencies"*.

## Token budget, measured

- Typical answer: 25 to 360 tokens, depending on the tool and how much the library page has to say.
- Hard cap: 500 tokens per response, enforced in `clamp.js`. Long answers are cut at sentence boundaries with a pointer to `docs_link`.
- The smoke test (`npm run smoke`) spawns the server, calls every tool against the bundled data, and fails if any response breaks the cap. The budget is a test, not a promise.

Measured against Context7 on 20 real coding questions, tokens estimated as chars/4. Ours is one `how_do_i` call; theirs is the two calls an agent actually makes, `resolve-library-id` plus the docs call at its default budget.

| | Median tokens per answer |
| --- | --- |
| should-i-use | **185** |
| Context7 | **1157** |
| Ratio | **6.3x** |

Every number there is a measured MCP response, not a vendor claim. See the limitations below for what that ratio does and does not prove.

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

## Limitations

Worth knowing before you rely on it:

- **Coverage is curated, not complete.** A few hundred libraries, not every package on npm and PyPI. `audit_dependencies` therefore stays quiet on anything unindexed, and a clean audit means "nothing flagged in what I know", not "your dependencies are fine".
- **Guides are research, not test drives.** Each guide is grounded in the library's documentation, release notes, changelog, and issue history on a fixed rubric, not a hands-on install of every release. The 50 most-downloaded entries are additionally install-verified in clean containers (latest run: 49/50 clean; the one timeout was sglang's CUDA wheel tree, which its own guide warns about).
- **Guides are point-in-time.** Signals refresh daily and guides are reviewed on a pipeline, so a library that shipped a big release or found a new maintainer this week can be ahead of what the guide says. Check `docs_link` when the answer looks stale.
- **`pick_library` ranks on keywords, not embeddings.** Plain phrasing works well; unusual or metaphorical phrasing can miss entirely. If nothing matches, it says so instead of returning a shrug, but you may need to reword.
- **The benchmark is indicative, not definitive.** 20 queries, measured on one day, and Context7's free tier rate-limits partway through, so some of their rows came from an earlier run the same day. The 6.3x ratio is a real measurement of a small sample, not a general law. Rerun it yourself if the number matters to you.
- **Verdicts are opinions.** Informed, sourced, and argued, but still one person's judgment call. Disagreeing with one is a valid bug report.

## Contributing

- **Missing library or wrong verdict?** [Open an issue](https://github.com/mrkeyoor/should-i-use/issues). Challenges to verdicts are how the index gets better.
- **Code changes**: PRs welcome for the server (`server.js`, `tools.js`, `clamp.js`, `data.js`, `install.js`). Keep responses inside the 500 token cap; `npm run smoke` enforces it.
- **Data changes**: `data/libraries.json` is generated, so edits to it get overwritten by the next export. File an issue instead and the fix lands upstream.

## License

- Code: [MIT](LICENSE)
- Data (`data/libraries.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution to [mrkeyoor.com](https://mrkeyoor.com/libs/). See [data/LICENSE](data/LICENSE).
