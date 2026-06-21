# mastra-evals — a Claude Code skill for evaluating any Mastra AI project

> A Claude Code **plugin marketplace** hosting one skill: `evaluating-mastra-projects`.
> Point it at any [Mastra](https://mastra.ai) agent/workflow and it designs + generates a complete **evaluation system** — scorers, golden dataset, offline experiment, CI regression, online scoring, and eval tests.

[![claude-code-plugin](https://img.shields.io/badge/claude--code-plugin-mastra--evals-blue)](https://code.claude.com/docs/en/plugins)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![mastra](https://img.shields.io/badge/tested%20against-@mastra/core%201.45-orange)](https://www.npmjs.com/package/@mastra/core)

## What it does

Given a Mastra project, the skill:

1. **Profiles** it (`analyze-project.ts` — finds agents, tools, system prompts, models).
2. **Picks scorers** for *that* agent's behavior across the full spectrum — **hard/deterministic** code scorers (tool-call accuracy/order, schema conformance, guardrails) → **soft** LLM-judges (tone, toxicity, faithfulness, relevancy) → **rubric** completion gates. Cheap-first.
3. **Generates** a golden dataset, an offline experiment (`dataset.startExperiment`), CI regression (`runEvals`), online scoring (`sampling: { type: 'ratio', rate }`), and vitest eval tests — using the **current** Mastra evals API.
4. **Validates** the generated set (`validate-artifacts.ts`), then tells you how to run it.

When the goal is broad/vague ("add evals", "make it good", "what should I eval?"), it **brainstorms** first: investigates the codebase + use cases + scale + stakes, then presents a *pickable* recommendation set with reasons.

Battle-tested against `@mastra/core@1.45.0` / `@mastra/evals@1.4.0` across 5 gateway models — every API shape verified, not assumed. Knowledge base distilled from the Mastra *"AI Evals 101"* tutorial.

## Install (global, default)

In Claude Code:

```
/plugin marketplace add volfadar/mastra-evals
/plugin install mastra-evals@mastra-eval-marketplace
```

`marketplace add` accepts `owner/repo`, a full git URL, or a local path. Install defaults to **user scope** (= available across all your projects). Add `--scope project` via the CLI to share with a team through the repo.

Or from the terminal:

```bash
claude plugin marketplace add volfadar/mastra-evals
claude plugin install mastra-evals@mastra-eval-marketplace
```

## Use

The skill auto-invokes when you ask to add/improve evals on a Mastra project, or call it directly:

```
/mastra-evals:evaluating-mastra-projects
```

Then just describe the goal — specific ("make sure my agent always calls the kb tool") or broad ("add evals, I'm not sure what to test"). It profiles the project, recommends scorers with reasons you can pick from, generates the artifacts, validates, and tells you how to run them.

## Requirements

- A Mastra project (TypeScript, `@mastra/core`) with at least one agent or tool.
- A TS runtime for the two scripts: `bun` or `npx tsx` (a Mastra project already has one). Scripts use only `node:` built-ins.
- For running the generated evals: the Mastra evals packages (`@mastra/core`, `@mastra/evals`) and a model provider/judge.

## For maintainers

- Validate locally: `claude plugin validate .` (marketplace) and `claude plugin validate ./plugins/mastra-evals` (plugin).
- Versioning, updates, and submitting to the official **community marketplace**: see [PUBLISHING.md](./PUBLISHING.md).

## Credits

Knowledge base distilled from the Mastra *"AI Evals 101"* tutorial (YouTube [`12WN6u2DrBk`](https://www.youtube.com/watch?v=12WN6u2DrBk)) and reconciled with the current Mastra evals API. Mastra is a trademark of its owners; this skill is an independent community contribution.

## License

MIT — see [LICENSE](./LICENSE).
