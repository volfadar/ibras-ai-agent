# Scorer Selection

> Decision guide: given a behavior you want to enforce, which scorer type and factory? Pair with [mastra-evals-api.md](mastra-evals-api.md) for signatures.

## Decision tree

```
Is the behavior checkable from the trace alone (no judgment)?
├─ YES → CODE-BASED scorer
│        ├─ "Did it call the right tool?"        → createToolCallAccuracyScorerCode({ expectedTool, strictMode })
│        ├─ "Were the tool args appropriate?"    → createToolCallAccuracyScorerLLM({ availableTools }) (light judge)
│        └─ "Is the output valid JSON / shape?"  → custom createScorer with a code generateScore()
└─ NO (subjective) → LLM JUDGE / RUBRIC
         ├─ "Is the tone correct?"               → createScorer (LLM-as-judge) or createToxicityScorer
         ├─ "Is it toxic / unsafe?"              → createToxicityScorer({ model })
         ├─ "Is the answer grounded in context?" → faithfulness scorer (prebuilt)
         ├─ "Does it answer the question?"       → answer-relevancy scorer (prebuilt)
         └─ "Is the task done? (checklist)"      → createRubricScorer({ model, criteria })
```

## Pick by source signal

| Signal in the project | Build |
|---|---|
| A tool the agent must call for its job | code-based tool-call-accuracy scorer per tool |
| System prompt specifies a tone/voice | LLM-judge tone scorer |
| User-facing output that must stay safe | `createToxicityScorer` (+ safety judge) |
| "Answer must use only provided context" | faithfulness / hallucination prebuilt scorer |
| Multi-step task with required outputs | `createRubricScorer` with required criteria |
| Structured output contract | code scorer validating the JSON schema |

## Judge model guidance
- Use the **smallest model that grades reliably** (e.g. `gpt-4o-mini`, `claude-haiku`). Upgrading the judge is a last resort, not a default.
- Set `judge.instructions` to an explicit rubric; vague instructions → noisy scores.
- Every judge scorer should return a `reason`, not just a score.
- The judge must return **schema-valid JSON** (Mastra uses structured output for the `analyze` step). Reasoning models can fail this — reasoning tokens exhaust the budget and the JSON never completes (`finish_reason: 'length'`). Prefer a judge that supports `response_format: json_schema`, or set `judge.jsonPromptInjection: true`.
- Prefer **binary scores (`1`/`0`)** and normalize so `1` = good everywhere (e.g. flip toxicity into a "non-toxicity" scorer). A continuous `[0,1]` is only worth it for online trend monitoring. See [eval-methodology.md §6](eval-methodology.md).

## Ground-truth vs similarity
For **deterministic** behavior, assert specifics in `groundTruth` (the expected tool, required fields) and check it with a **code** scorer. For **non-deterministic** output (weather varies daily; prose varies), don't assert exact text — define a ground truth and measure **similarity**: that's what the **faithfulness** and **answer-relevancy** prebuilt scorers are for. See [eval-methodology.md §8](eval-methodology.md).

## Coverage target
Aim for at least: **one code scorer per tool** + **one judge per subjective promise in the system prompt**. That covers both "did it work" (deterministic) and "was it good" (subjective) without over-spending.

See [examples/weather-agent/](../examples/weather-agent/) for a worked set (3 scorers: 1 code + 2 judges).
