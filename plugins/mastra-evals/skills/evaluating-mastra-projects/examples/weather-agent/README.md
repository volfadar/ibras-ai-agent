# Weather Agent — Worked Example

A complete eval system for the **Weather Agent** demo from the Mastra *"AI Evals 101"* tutorial (YouTube [`12WN6u2DrBk`](https://www.youtube.com/watch?v=12WN6u2DrBk)). This is what "done" looks like when the skill runs on a real project.

## What it evaluates

A weather agent that must (a) call `weatherTool` for weather questions, (b) stay non-toxic, and (c) speak in a "formal BBC presenter" tone — exactly the 3 scorers shown on screen.

## Artifact → video map

| Artifact | Role | Source chapter |
|---|---|---|
| `src/mastra.ts` | Mastra instance registering agent + scorers | "added scorers on the mastra instance" (5:22) |
| `src/scorers/weather-scorer.ts` | 1 code + 2 LLM-judge scorers | "Code behind the scorers" (5:08–8:11) |
| `datasets/weather-golden.dataset.json` | golden records (`input` + `groundTruth`) | "Offline scorers" (8:11–12:00) |
| `experiments/weather.eval.ts` | offline run — `dataset.startExperiment()` | "Offline scorers" (8:11–12:00) |
| `online-scoring/weather-agent.ts` | agent w/ sampled scorers (1.0/0.5/0.25) | "Online scorers" (12:00–15:10) |
| `tests/weather-eval.test.ts` | CI regression — `runEvals()` | methodology (8:11–12:00) |
| `project_profile.json` | inferred profile | (what `analyze-project.ts` would emit) |

## Run

```bash
# 1) validate structure (no model calls)
bun run ../../scripts/validate-artifacts.ts .     # or: npx tsx ../../scripts/validate-artifacts.ts .

# 2) offline experiment (needs the weather-golden dataset registered in Studio/Datasets)
tsx experiments/weather.eval.ts
#    …or interactively: mastra dev  → Studio → Datasets → Run Experiment

# 3) CI regression (needs OPENAI_API_KEY for the agent + judge)
vitest run
```

## Faithfulness note

The on-screen scorer code used an older Mastra shape (object-key steps, `judge.model` as a string, `sampleRate`). This example is converted to the **current** API — chainable steps, a model instance, `analyze({ outputSchema, createPrompt })`, `sampling: { type: 'ratio', rate }`, and programmatic `dataset.startExperiment()` / `runEvals()`. Concepts and scorer intent are unchanged. See `references/mastra-evals-api.md §12`.
