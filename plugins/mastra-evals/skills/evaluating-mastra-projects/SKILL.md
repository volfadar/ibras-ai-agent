---
name: evaluating-mastra-projects
description: Designs and generates a complete evaluation system for Mastra AI agents and workflows — scorers (code-based and LLM-as-judge), golden datasets, offline experiments/regression suites, online scoring with sampling, and eval tests — tailored to the project being evaluated, to maximize AI output quality. Use when you have a Mastra agent or workflow (TypeScript, @mastra/core) and want to add or improve its evals, build a golden dataset, set up CI regression evals, add production scoring, choose the right scorer type, or scaffold scorer/dataset/experiment/test files. Grounded in the Mastra evals methodology and the @mastra/core/evals + @mastra/evals/scorers/prebuilt APIs.
---

# Evaluating Mastra Projects

Build a complete **eval system** for a Mastra AI agent or workflow so you can measure and improve its output quality. The skill profiles the target project, picks the right scorers for *that* agent's behavior, generates a golden dataset, an offline experiment (regression suite for CI), online scoring with sampling, and eval tests — all using the real Mastra evals API.

**The unit of evaluation is a *trace*** — the receipt of one agent/workflow run (input, tool calls, output). Scorers read traces and return scores. An **eval** is the discipline of running scorers over many traces; a **scorer** is one tactic.

## When to use

- "Add evals to my Mastra agent" / "I need to evaluate this workflow."
- Building a golden dataset or regression suite for a Mastra project.
- Choosing between a code-based scorer, LLM-as-judge, or rubric scorer.
- Adding production/online scoring with cost control (sampling).
- Scaffolding `createScorer` / dataset / experiment / eval-test files for `@mastra/core`.

## What you produce

For the target project (under a chosen output dir, default `./evals/`):

| Artifact | Purpose | Template |
|---|---|---|
| `src/mastra.ts` | Mastra instance registering agents + scorers (so Studio/experiments find them) | *(hand-written)* |
| `src/scorers/*.ts` | One scorer per controllable behavior | `scorer-code.ts.tmpl`, `scorer-llm-judge.ts.tmpl`, `scorer-rubric.ts.tmpl` |
| `datasets/*.dataset.json` | Golden records: `input` + `groundTruth` | `dataset.json.tmpl` |
| `experiments/*.eval.ts` | Offline run via `dataset.startExperiment()` | `experiment.ts.tmpl` |
| `online-scoring/*.ts` | Agent wired with sampled (`sampling: {type,rate}`) production scorers | `online-scoring.ts.tmpl` |
| `tests/*.eval.test.ts` | CI regression via `runEvals()` (vitest) | `eval-harness.test.ts.tmpl` |

## How to run the scripts
Scripts are TypeScript (the Mastra ecosystem is TS) and use only `node:` built-ins. Run them with the project's existing TS runtime:
```bash
bun run scripts/analyze-project.ts <project-root>      # or: npx tsx scripts/analyze-project.ts <root>
bun run scripts/validate-artifacts.ts evals/            # or: npx tsx scripts/validate-artifacts.ts evals/
```

## First: is the goal specific or broad?

- **Specific** (user names the behavior: "make sure it calls X", "check it's not toxic", "assert field Y exists") → go straight to the **Workflow** below and [scorer-selection.md](references/scorer-selection.md).
- **Broad / vague** ("add evals", "make it good", "what should I eval?", greenfield, big surface with unclear priority) → **brainstorm first**: investigate the codebase + use cases + scale + stakes, then present a *pickable* recommendation set with reasons. See [references/eval-brainstorming.md](references/eval-brainstorming.md).

The skill is **adaptive across the whole eval spectrum** — **hard/deterministic** checks (tool-call accuracy, tool order, schema/JSON conformance, guardrails, latency/cost — cheap, CI-first) → **soft/subjective** LLM-judges (tone, toxicity, faithfulness, relevancy) → **rubric** completion gates. Lead with hard scorers; reserve judges for what code can't express.

## Workflow: build an eval system for a Mastra project

Copy this checklist into your response and tick items off. Stop after each fragile step to validate before continuing (plan → validate → execute).

1. **Profile the project.** Run `bun run scripts/analyze-project.ts <project-root> -o evals/project_profile.json`. Read the produced profile (agents, tools, system prompts, models). If it finds nothing, the project isn't a recognizable Mastra app — confirm paths with the user.
2. **Choose scorers** by reading `references/scorer-selection.md`. Rule of thumb:
   - One **code-based** scorer per tool the agent calls (tool-call accuracy). Cheap, deterministic, CI-friendly.
   - One **LLM-as-judge** scorer per *subjective* behavior promised in the system prompt (tone, safety/toxicity, faithfulness, answer-relevancy). Use a small/cheap judge model.
   - A **rubric** scorer when "done" is a checklist of required criteria (task completion).
3. **Generate scorers** from `templates/` using the profile (target tool names, judge model, criteria). Follow `references/mastra-evals-api.md` for the exact current API (`createScorer` chainable steps, prebuilt factories, `analyze({ outputSchema, createPrompt })`).
4. **Register scorers on the Mastra instance** (`new Mastra({ agents, scorers: {…} })`) — see `references/mastra-evals-api.md §6`. This is what Studio's *Evaluate Trace* list and `dataset.startExperiment()` reference.
5. **Generate the golden dataset** (`dataset.json.tmpl`): records of `input` + `groundTruth` (expected tool, rubric, shouldPass), seeded from tool descriptions/system prompt. Cover **distinct scenarios** (e.g. empty-chat vs follow-up), not just distinct phrasings. Ask the user for real production examples; never ship a synthetic-only dataset to CI without flagging it.
6. **Generate the offline experiment** (`experiment.ts.tmpl`) via `dataset.startExperiment({ targetType, targetId, scorers })`.
7. **Add online scoring** (`online-scoring.ts.tmpl`) with `sampling: { type: 'ratio', rate }` per `references/eval-methodology.md §9`: expensive LLM-judges at low rates (0.1–0.25), cheap code scorers higher (0.5–1.0).
8. **Generate CI eval tests** (`eval-harness.test.ts.tmpl`) using `runEvals({ data, target, scorers })`.
9. **Validate.** Run `bun run scripts/validate-artifacts.ts evals/`. Fix every reported error, then re-run. Do **not** declare done with validation errors.
10. **Run.** Offline: `tsx experiments/*.eval.ts` or Studio → Datasets → Run Experiment. CI: `vitest run`. Offer to run them.

## References (read only the one you need)

- [references/eval-brainstorming.md](references/eval-brainstorming.md) — when the user's goal is broad/vague: investigate codebase + use cases + scale + stakes, then present a *pickable* recommendation set (what to eval, why, scorer type, cost) with a default and a closest-match fallback. **Read this first if the user doesn't yet know what to evaluate.**
- [references/eval-methodology.md](references/eval-methodology.md) — the methodology distilled from the Mastra evals tutorial: eval vs test, scorer types, offline vs online evals, datasets & experiments, sampling & cost. Read this first if unsure *what* to build.
- [references/scorer-selection.md](references/scorer-selection.md) — decision tree: which scorer type for which behavior, with worked picks.
- [references/mastra-evals-api.md](references/mastra-evals-api.md) — the real Mastra evals API (`createScorer`, prebuilt scorers, datasets, experiments, online scoring) and how to read traces.
- [references/artifact-spec.md](references/artifact-spec.md) — exact file/schema spec, naming conventions, and the plan-validate-execute loop the scripts enforce.

## Worked example

[examples/weather-agent/](examples/weather-agent/) — a full eval system for the Weather Agent demo reconstructed from the Mastra "AI Evals 101" tutorial (video `12WN6u2DrBk`): a code-based tool-call scorer, a toxicity LLM-judge, a "Formal British Tone" LLM-judge, a golden dataset, an experiment, online scoring with sampling, and eval tests. Use it as the reference for what "done" looks like.

## Key principles

- **Defaults, not dogma.** Every scorer pick, threshold, sampling rate, and convention here is a *starting-point recommendation with reasoning* — adapt or override anything to fit the project, its scale, and the user's priorities. The skill adapts to whatever `project_profile.json` + the user's goals call for; it isn't tied to any specific project, provider, or model (all model/provider names shown are examples). Expand freely: custom `createScorer`s, custom `groundTruth` fields, any judge provider/model.
- **Degrees of freedom.** Scanning a project and validating artifacts are fragile/consistency-critical → use the **scripts** (low freedom). Choosing scorers, writing prompts/criteria, and synthesizing datasets are open-ended → use judgment (high freedom).
- **Plan → validate → execute.** Generate a `project_profile.json`, reason about it, generate artifacts, then run `validate_artifacts.py` before claiming success.
- **Cheap-first.** Prefer code-based scorers (deterministic, free) over LLM-judges; reserve judges for subjective criteria; sample aggressively in production.
- **Mastra API is the source of truth.** Confirm imports/signatures against `references/mastra-evals-api.md` before writing scorer code — the API has both `createScorer` (custom) and prebuilt factories in `@mastra/evals/scorers/prebuilt`.
- **Forward-slash paths** in every file. Fully-qualified names if you call MCP tools.
