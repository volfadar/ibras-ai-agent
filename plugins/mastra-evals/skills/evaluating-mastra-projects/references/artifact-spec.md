# Artifact Spec & Plan-Validate-Execute

> Exact layout, naming, and schema for the generated eval set, plus the validation loop `scripts/validate-artifacts.ts` enforces. API shapes match current Mastra — see [mastra-evals-api.md](mastra-evals-api.md).

## Layout
```
evals/
├── project_profile.json          # output of analyze-project.ts (the "plan")
├── src/mastra.ts                 # Mastra instance: registers agents + scorers (so Studio/experiments can find them)
├── src/scorers/*.ts              # one or more scorers
├── datasets/*.dataset.json       # golden records
├── experiments/*.eval.ts         # offline run via dataset.startExperiment()
├── online-scoring/*.ts           # agent wired with sampled production scorers
└── tests/*.eval.test.ts          # CI regression via runEvals() (vitest)
```
All paths forward-slash. One artifact per file (scorers may be grouped per domain).

## Naming
- Scorers: `<domain>-scorer.ts`, e.g. `weather-scorer.ts`.
- Scorer `id`: kebab-case, stable, e.g. `weather-tool-call-accuracy`.
- Dataset: `<domain>-golden.dataset.json`.
- Experiment: `<domain>.eval.ts`.
- Tests: `<domain>.eval.test.ts`.

## Dataset schema
```json
{
  "name": "weather-golden",
  "records": [
    {
      "input": "What's the weather in London?",
      "groundTruth": {
        "expectedTool": "weatherTool",
        "rubric": ["Mentions London", "Gives a temperature", "Formal tone"],
        "shouldPass": true
      }
    }
  ]
}
```
Required per record: an **input** field (`input` | `messages` | `prompt`). Recommended: a **groundTruth** object (or a top-level expectation) your scorers read — `groundTruth.expectedTool`, `groundTruth.rubric`, `groundTruth.shouldPass`.

## Scorer file conventions
- Import from `@mastra/core/evals` and/or `@mastra/evals/scorers/prebuilt` (utils from `@mastra/evals/scorers/utils`).
- Export each scorer as a named const; register them on the Mastra instance (`new Mastra({ scorers: { ... } })`).
- LLM-judge scorers must reference a `model`.
- Balanced braces (no truncated template fills).
- Prefer binary scores (`1`/`0`) with a `reason`; normalize so `1` = good.

## Online-scoring conventions
- Sampling uses the **current** shape: `sampling: { type: 'ratio', rate }` (not `sampleRate`).
- Rates are numbers in `(0, 1]`. Cheap scorers → high (`1.0`); expensive judges → low (`0.25` and below).

## Plan → validate → execute
1. **Plan** — `analyze-project.ts` writes `project_profile.json`; reason about scorers/dataset from it.
2. **Generate** — write artifacts from templates using the profile + [mastra-evals-api.md](mastra-evals-api.md).
3. **Validate** — `bun run scripts/validate-artifacts.ts evals/`. It checks:
   - scorer imports + factory calls + balanced braces,
   - dataset JSON validity + an input field (and ideally `groundTruth`) per record,
   - online-scoring sampling rates within `(0,1]` and using the `sampling: { type:'ratio', rate }` shape,
   - experiment references dataset + scorers,
   - tests import vitest.
4. **Fix → re-validate** until 0 errors. Only then run (`mastra dev` / `vitest`).
5. **Execute** — offline: Studio → Datasets → Run Experiment, or `tsx experiments/*.eval.ts` (`dataset.startExperiment()`); CI: `vitest run` (`runEvals()`).

`validate-artifacts.ts` exits non-zero on any error and prints the exact file + problem. Never report success while it fails.
