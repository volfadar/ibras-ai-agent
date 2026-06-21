# Mastra Evals API Reference

> The real, **current** Mastra evals API — verified against `/mastra-ai/mastra` (context7). The API evolves; when a project pins a specific version, re-check signatures against its `node_modules/@mastra/*`. Concepts live in [eval-methodology.md](eval-methodology.md); the decision tree in [scorer-selection.md](scorer-selection.md).

## Table of contents
1. Packages
2. The scorer lifecycle (prepareRun → preprocess → analyze → generateScore → generateReason)
3. `createScorer` — full options
4. Reading the trace
5. Prebuilt scorers (full list + signatures)
6. Registering scorers on the Mastra instance
7. Datasets (golden records)
8. Offline experiments — `dataset.startExperiment()`
9. CI scoring — `runEvals()`
10. Online scoring (sampling) on agents
11. The `.run()` result shape
12. Video-vs-current API delta

## 1. Packages
- `@mastra/core/evals` → `createScorer`, `runEvals`, scorer run/lifecycle types.
- `@mastra/evals/scorers/prebuilt` → `createToolCallAccuracyScorerCode`, `createToolCallAccuracyScorerLLM`, `createToxicityScorer`, `createAnswerRelevancyScorer`, `createRubricScorer`, plus faithfulness / hallucination scorers.
- `@mastra/evals/scorers/utils` → `getAssistantMessageFromRunOutput`, `filterRun`.

## 2. The scorer lifecycle
A scorer is a pipeline run against **one trace**. It never re-invokes the model to *produce* the trace — it only reads it.

**`prepareRun` → `preprocess` → `analyze` → `generateScore` → `generateReason`**

- `prepareRun` (optional, on the config): transform/trim the trace *before* the pipeline (drop messages, cap context). The `filterRun()` util builds one from declarative options.
- `preprocess` (chainable): pull what you need out of the run into a small object.
- `analyze` (chainable): the judgment step — usually an LLM call returning **structured** data via `outputSchema`, or a plain function for code scorers.
- `generateScore` (**required**): map the analysis to a number.
- `generateReason` (optional): map the analysis to an explanation string.

Code-based scorers implement steps as plain functions; judge scorers use prompt objects for the LLM-backed steps. Output: `{ score, reason }` (plus `runId`, `analyzeStepResult`).

## 3. `createScorer` — full options
```ts
import { createScorer } from '@mastra/core/evals'
import { getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils'
import { z } from 'zod'

const toneScorer = createScorer({
  id: 'tone-scorer',                        // required, unique
  name: 'Tone',                             // optional, defaults to id
  description: 'Judges whether the assistant matches the requested tone', // required
  type: 'agent',                            // optional: auto-types run.inputData/run.output for agent evals
  judge: {
    model: judgeModel,                      // REQUIRED — a model instance, or a gateway string (see below)
    instructions: 'You are a strict tone evaluator…', // required
    jsonPromptInjection: false,             // true = inject JSON schema into the prompt for models w/o native structured output (e.g. some Groq Llama) to avoid a 400
  },
  prepareRun: filterRun({ drop: ['memory'] }), // optional: trim the trace before scoring
})
  .preprocess(({ run }) => ({
    text: getAssistantMessageFromRunOutput(run.output) ?? '',
  }))
  .analyze({
    description: 'Judge tone of voice',
    outputSchema: z.object({                // structured judgment — read typed fields later, no text parsing
      matchesTone: z.boolean(),
      explanation: z.string(),
    }),
    createPrompt: ({ run }) => {            // build the judge prompt dynamically; interpolate the value under test
      const text = getAssistantMessageFromRunOutput(run.output) ?? ''
      return `Grade this reply for formal BBC-presenter tone:\n"""${text}"""`
    },
  })
  // `results` is the accumulated step output; each step's result is keyed `<stepName>StepResult`.
  .generateScore(({ results }) => (results?.analyzeStepResult?.matchesTone ? 1 : 0))
  .generateReason(({ results }) => results?.analyzeStepResult?.explanation ?? '')
```

**Model forms for `judge.model`** (type `MastraModelConfig` — accepts a model instance, a model-id string, or an `OpenAICompatibleConfig`):
- A **model instance** — `import { createOpenAI } from '@ai-sdk/openai'; const p = createOpenAI({ baseURL, apiKey }); const judge = p.chat('gpt-4o-mini')`.
- A **model-id string** resolved by the host — e.g. `'__GATEWAY_OPENAI_MODEL_MINI__'` on Mastra Cloud's gateway.

> **OpenAI-compatible gateway gotcha (seen in practice):** `createOpenAI(...)(model)` — the provider's callable default — routes to OpenAI's `/v1/responses` protocol, which most compatible gateways (litellm, Ollama-style, etc.) do **not** support; it 400s with `"no provider supports protocol '/responses'"`. Use `/v1/chat/completions` via **`provider.chat(model)`** when this happens. Separately, the judge must return **schema-valid JSON**; reasoning models often fail structured output because reasoning tokens exhaust the budget (`finish_reason: 'length'`) before the JSON completes. Pick a judge that supports `response_format: json_schema`, or set `judge.jsonPromptInjection: true`.

**Why `outputSchema`:** Mastra's structured-output support lets `analyze` return typed data (`results.analyzeStepResult.matchesTone`) instead of free text you'd parse. It's a general Mastra feature reused inside the eval system — prefer it for stable, low-variance judging.

## 4. Reading the trace
For `type: 'agent'`, a run exposes:
- `run.inputData.inputMessages` — the input message array (`[{ role, content, id }]`). The "input" is **not** only the user message — it can include the **system message** and prior **tool calls** (memory/history).
- `run.output` — the assistant output message array; an output message may carry `toolInvocations: [{ toolCallId, toolName, args, result, state }]`.
- `getAssistantMessageFromRunOutput(run.output)` — traverses the JSON output and returns the most recent assistant message text.

A scorer reads the trace (input, LLM spans, per-tool-call spans, output) — it never re-runs the agent. That is what makes scoring cheap, repeatable, and decoupled from model cost.

## 5. Prebuilt scorers
```ts
import {
  createToolCallAccuracyScorerCode,
  createToolCallAccuracyScorerLLM,
  createToxicityScorer,
  createToneScorer,
  createAnswerRelevancyScorer,
  createFaithfulnessScorer,
  createRubricScorer,
} from '@mastra/evals/scorers/prebuilt'

createToolCallAccuracyScorerCode({ expectedTool: 'weatherTool', strictMode: false })   // CODE, deterministic, free
createToolCallAccuracyScorerLLM({ model, availableTools: [{ name, description }] })    // light judge for arg/appropriateness
createToxicityScorer({ model })                                                        // judge
createToneScorer({ referenceTone?: 'calm, professional…' })                            // CODE (sentiment) — free, NO model
createAnswerRelevancyScorer({ model })                                                 // judge — is the answer on-topic?
createFaithfulnessScorer({ model, options?: { context } })                             // judge — grounded in context?
createRubricScorer({ model, criteria: ['- …', '- …'] })                                // binary: all criteria met → 1
```
- `createToolCallAccuracyScorerCode` also accepts `expectedToolOrder: string[]` to assert a tool-call **sequence** (and `strictMode` for exactly-once).
- **`createToneScorer` is code-based** (sentiment vs a `referenceTone`) — so tone can be scored for free in CI and at sampling rate `1.0` online. The tutorial hand-rolled an LLM-judge tone scorer; prefer the prebuilt where it fits.
- The full prebuilt set also includes: hallucination, bias, completeness, content-similarity, context-precision, context-relevance, keyword-coverage, noise-sensitivity, prompt-alignment, textual-difference, trajectory-accuracy, answer-similarity. Pick by the quality dimension.

**`strictMode` semantics** (tool-call accuracy):
- `strictMode: true` → scorer passes only when the tool is called **exactly once** (no extra tools).
- `strictMode: false` → passes as long as the expected tool is among the calls; other tools are allowed.

## 6. Registering scorers on the Mastra instance
Define scorers once and register them on the `Mastra` instance so Studio's *Evaluate Trace* list and experiments can reference them by ID:
```ts
import { Mastra } from '@mastra/core'
import { createToxicityScorer } from '@mastra/evals/scorers/prebuilt'
import { toneScorer, toolCallAppropriatenessScorer } from './scorers/weather-scorer'

export const mastra = new Mastra({
  agents: { weatherAgent },
  scorers: {
    'tool-call': toolCallAppropriatenessScorer,
    toxicity: createToxicityScorer({ model }),
    'formal-tone': toneScorer,
  },
})
```
Registered IDs are what `dataset.startExperiment({ scorers: ['toxicity', 'formal-tone'] })` and Studio reference.

## 7. Datasets (golden records)
A dataset is a collection of golden records. Each record carries an **input** plus a **groundTruth** object your scorers read to check the outcome:
```json
{
  "name": "weather-golden",
  "records": [
    {
      "input": "weather in London?",
      "groundTruth": { "expectedTool": "weatherTool", "rubric": ["Mentions London"], "shouldPass": true }
    }
  ]
}
```
Create datasets in Studio (Datasets tab) or via the datasets API; load one with `mastra.datasets.get({ id })`. Build records from **real production traces** where possible.

## 8. Offline experiments — `dataset.startExperiment()`
An experiment runs every record of a dataset through a target and a scorer set, producing a summary:
```ts
const dataset = await mastra.datasets.get({ id: 'weather-golden' })

const summary = await dataset.startExperiment({
  name: 'gpt-4o-baseline',
  targetType: 'agent',            // or 'workflow'
  targetId: 'weatherAgent',
  scorers: ['tool-call', 'toxicity', 'formal-tone'], // registered IDs …
  // scorers: [toneScorer],                            // … or scorer instances
})

summary.status        // 'completed' | 'failed'
summary.succeededCount
summary.failedCount
```
Interactive equivalent: Studio → Datasets → Run Experiment (pick target × dataset × scorers).

## 9. CI scoring — `runEvals()`
For a regression suite that runs in CI (vitest/tsx) **without** dataset registration, use `runEvals` with inline data:
```ts
import { runEvals } from '@mastra/core/evals'

const result = await runEvals({
  data: [
    { input: 'weather in Berlin', groundTruth: { expectedTool: 'weatherTool' } },
  ],
  target: weatherAgent,
  scorers: [toolCallScorer, toxicityScorer],
})

result.scores['weatherTool-tool-call-accuracy']   // per-scorer aggregate score
result.summary.totalItems
```
Assert thresholds in vitest: `expect(result.scores['<id>']).toBeGreaterThan(0.8)`.

## 10. Online scoring (sampling) on agents
Attach scorers to an agent so they run against **production** traces. Each scorer takes a **sampling** config controlling how often it fires:
```ts
import { Agent } from '@mastra/core/agent'

new Agent({
  scorers: {
    'tool-call': { scorer: toolCallScorer,        sampling: { type: 'ratio', rate: 1.0 } },  // cheap → every request
    toxicity:    { scorer: toxicityScorer,        sampling: { type: 'ratio', rate: 0.5 } },  // moderate judge
    'formal-tone': { scorer: toneScorer,          sampling: { type: 'ratio', rate: 0.25 } }, // expensive judge → sample
  },
})
```
> **Note:** the current key is `sampling: { type: 'ratio', rate }` — **not** `sampleRate`. Strategy: cheap/deterministic scorers → high rate (1.0); expensive LLM-judges → low (0.1–0.25). Scores flow to the Mastra Cloud Observability eval dashboard.

## 11. The `.run()` result shape
`await scorer.run(trace)` (and each experiment item) returns:
```ts
{ runId: string, score: number, reason: string, analyzeStepResult: { /* the structured analysis */ } }
```
`score` is what experiments average and CI asserts on; `reason` is what you read when a score fails.

## 12. Video-vs-current API delta
The "AI Evals 101" tutorial (recorded against a Mastra dev build) shows an **older** scorer shape: object-key steps (`evaluate`/`preprocess`/`analyze`/`createPrompt`) and `judge.model` as a **string** (`"openai/gpt-3.5-turbo"`). The **current** published API uses **chainable** step methods, a **model instance** (or gateway string) for `judge.model`, **structured `analyze({ outputSchema, createPrompt })`**, online **`sampling: { type: 'ratio', rate }`** (not `sampleRate`), and programmatic experiments via **`dataset.startExperiment()`** / **`runEvals()`**. The *concepts* (trace, code vs judge, offline vs online, sampling, datasets/experiments) are unchanged. When porting on-screen code, convert to these forms.
