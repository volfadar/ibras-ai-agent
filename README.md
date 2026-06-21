# ibras-ai-agent — a Claude Code plugin marketplace

A growing collection of [Claude Code](https://code.claude.com) plugins/skills for **building and evaluating AI agents**. Add the marketplace once, then install any plugin from it.

## Plugins

| Plugin | What it does | Invoke |
|---|---|---|
| [**mastra-evals**](./plugins/mastra-evals) | Profiles any [Mastra](https://mastra.ai) agent/workflow and generates a complete eval system — scorers (code + LLM-judge + rubric), golden dataset, offline experiment, CI regression (`runEvals`), online sampling, eval tests. Includes a brainstorming entry point for broad goals. Battle-tested against `@mastra/core@1.45`. | `/mastra-evals:evaluating-mastra-projects` |

_More plugins can live alongside it under `plugins/<name>/` — see [PUBLISHING.md → Adding a plugin](./PUBLISHING.md#adding-a-plugin)._

## Install

In Claude Code:

```
/plugin marketplace add volfadar/ibras-ai-agent
/plugin install mastra-evals@ibras-ai-agent
```

- `marketplace add` accepts `owner/repo`, a full git URL, a local path, or a raw `marketplace.json` URL.
- Install defaults to **user scope** (global — all your projects). Add `--scope project` (CLI) to share with a team through their repo.
- After installing: `/reload-plugins`.

Or from the terminal:

```bash
claude plugin marketplace add volfadar/ibras-ai-agent
claude plugin install mastra-evals@ibras-ai-agent
```

## Requirements

- A TS runtime (`bun` or `npx tsx`) for plugin scripts (scripts use only `node:` built-ins).
- Per-plugin requirements — `mastra-evals` needs a Mastra project (`@mastra/core`) and the evals packages (`@mastra/evals`).

## License

MIT — see [LICENSE](./LICENSE). Individual plugins may carry their own notice in their directory.
