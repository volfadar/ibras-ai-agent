# Eval Methodology (Mastra)

> The conceptual core of the Mastra "AI Evals 101" tutorial (YouTube `12WN6u2DrBk`). Every claim cites a timestamp so you can re-check it against the source. The *why* lives here; the *how* (exact APIs) lives in [mastra-evals-api.md](mastra-evals-api.md); the *which* in [scorer-selection.md](scorer-selection.md).

## Table of contents
1. Evals is a real discipline (don't underestimate it)
2. You're already doing evals — manual vs automatic
3. The trace is the unit of evaluation
4. Two scorer families (code-based vs LLM-as-judge)
5. The *why* behind each scorer
6. Score shape: prefer binary; normalize so 1 = good
7. Offline evals: datasets + experiments = regression in CI
8. Building a good golden dataset
9. Online evals: production scoring + observability + sampling
10. The eval loop (how evals compound)
11. Where it runs: Studio vs Cloud Observability
12. Anti-patterns

## 1. Evals is a real discipline *(0:00–1:15)*
Evals is often **underestimated**. Whole books are dedicated to testing; evals is the same *kind* of discipline for probabilistic systems — there are schools of thought, advanced techniques, and it's still an emerging field people are figuring out. The trap: because it's underestimated, people skip fundamentals and jump to advanced ideas (like "building an eval loop"). Get the fundamentals first: a crisp definition of **eval**, **scorer**, and **trace**, and how a scorer differs from a test.

## 2. You're already doing evals — manual vs automatic *(1:15–2:05)*
Opening your agent in Studio and typing a test input ("weather in London?") **is** an eval — a *manual* one. You eyeball the output and judge correctness. That doesn't scale. **Automatic evals** codify that judgment into **scorers** and run them across many inputs. Heuristic: if you can describe *in words* why an output was good or bad, you can usually turn that into a scorer.
- **Evals** = the *discipline*. **Scorer** = the *tactic* this skill generates — "a function that runs against a trace to evaluate whether the agent behaved correctly, automatically." *(1:33)*

## 3. The trace is the unit of evaluation *(2:05–2:51)*
A **trace** is the receipt of one run: input messages, the LLM call (with full context — message history + system instruction), a **span per tool call**, and the final output. Scorers **read traces** — they don't re-run the agent. That is what makes scoring cheap, repeatable, and independent of model cost.
- Don't assume "output" is all there is to judge. A scorer can also inspect the **spans** — e.g. "was this particular tool called?" — not just the text. *(2:35)*

## 4. Two scorer families *(2:49–5:08)*
| Family | Answers | Cost | Deterministic? |
|---|---|---|---|
| **Code-based** | Did it call the right tool? Right args? Valid JSON/schema? | Free, fast | Yes |
| **LLM-as-judge** | Is the tone right? Toxic? Faithful? Relevant? | $$ (judge call) | No (probabilistic) |

A **rubric** scorer is the judge variant for "is the task done?" — binary, all-criteria-met → 1.

## 5. The *why* behind each scorer *(3:10–5:08)*
- **Tool-call accuracy (code-based).** *Why it matters:* without it, the agent can get lazy. Asked about London's weather yesterday, then again today, it may skip the tool, lean on message history, and relay **yesterday's stale answer** — completely inaccurate. The scorer reads the trace JSON and asserts the tool **was** called, guaranteeing fresh data. *(3:24)*
- **Tone (LLM-judge).** *Why a judge:* "I want it to sound like a formal BBC weather presenter." You cannot express that in TypeScript. So you ask another LLM to grade the tone and return pass/fail + a reason. *(4:04–4:37)*
- **Toxicity (LLM-judge).** *Why it matters in production:* if your guardrails slip, a user can post on X/Facebook claiming your agent is hateful. You need to **know in production**, fast. *(4:37–5:08)*

## 6. Score shape: prefer binary; normalize so 1 = good *(7:08–7:52; 9:48–10:12)*
- A scorer ultimately returns a **number**. The video deliberately returns **1 or 0** ("a very good idea because it's simple"). Fine-grained `[0,1]` ranges have **gone out of fashion** — the difference between 0.5 and 0.6 is unclear, and clever formulas can become a distraction. Prefer binary pass/fail; reserve a continuous score for when you need a *trend signal* over time (see §9).
- **Normalize orientation (optional, but kind to future-you).** Toxicity returning `0` = good (not toxic) while tone returns `0.87` = good is confusing *when read together*. If you aggregate or dashboard multiple scorers, consider flipping so `1` = good everywhere (e.g. a "non-toxicity" scorer). Not mandatory — a single scorer read on its own is fine either way. *(10:12)*
- Always emit a **reason** (in custom/judge scorers) — a score with no reason can't guide a fix. Prebuilt *code* scorers may omit one; that's fine since they're deterministic.

## 7. Offline evals: datasets + experiments = regression in CI *(8:01–12:00)*
There are two places scorers run: **offline** (here) and **online** (§9).
Clicking *Evaluate Trace* per trace doesn't scale, so you:
1. Save representative traces into a **golden dataset**.
2. **Run an experiment**: target (agent/workflow) × dataset × scorers → per-scorer **average scores**. *(8:47–9:40)*

An experiment is fundamentally a **regression test**: after every prompt/model/tool change, re-run and compare results to see what moved. *(9:30)* Run them in **CI** as part of your dev process. *(10:12)*

Caveat: evals (esp. LLM-judge) are **slow and expensive** — they belong in CI, not as background unit tests. *(10:40–11:19)*

## 8. Building a good golden dataset *(8:26–9:20; 15:33–15:56)*
- Cover **distinct scenarios**, not just distinct phrasings. The demo deliberately includes two different *scenarios* for the same intent: asking about weather in an **empty chat** vs as a **follow-up** — they stress different behavior. *(8:47)*
- Build from **real production traces** where possible; synthetic-only datasets test your imagination, not your agent.
- For **non-deterministic** outputs (weather changes daily; a poem varies), don't assert exact text. Define a **ground truth** and measure **similarity** — you're checking the answer is *directionally correct*, not verbatim. (This is exactly what Mastra's faithfulness / answer-relevancy prebuilt scorers do.) *(15:33–15:56)*
- **Watch scorer/dataset interaction:** a tool-call-accuracy scorer returns `0` when the tool is *not* called — which is *correct* for an out-of-scope record that shouldn't call the tool. So a dataset that mixes should-call and should-not-call cases caps the scorer's max below `1.0`. Split positive/negative scenarios, or assert per-record expectations (`groundTruth.shouldPass`), rather than averaging one scorer across both.

## 9. Online evals: production scoring + observability + sampling *(12:00–15:10)*
**Online** scorers run against **live production traces, near real-time**. This is where scorers stop feeling like testing and start feeling like **monitoring** — a dashboard of eval scores over time catches **drift** (e.g. a creeping change in your system prompt or context engineering). *(12:11–12:50)*

You **cannot** score every request (cost + latency), so **sample** — each scorer gets a rate in `[0,1]`:
- Cheap/deterministic scorers → high rate (1.0 — run every request).
- Expensive LLM-judges → low (0.1–0.25). With thousands of users, judging every trace burns a ton of tokens even with a cheap model. *(13:08–13:38)*

Here a **continuous score is useful**: the *trend* (slipping from 0.9 → 0.7) is the signal, even if a single 0.86 is hard to interpret. *(12:27)*

## 10. The eval loop (how evals compound) *(15:02–16:42)*
Evals get powerful when they **loop**:
1. A user breaks the agent in an unexpected way → **add that broken trace to a dataset** and submit it for review. *(15:02)*
2. Iterate on the agent until those traces pass.
3. Sometimes a scorer **passes but you know the output is bad** → the *scorer* is wrong, not the agent. Refine the scorer — the video describes taking a bad score result into your coding agent and asking it to *improve the scorer*. *(15:56)*

This creates a compounding loop: more traces → better dataset → better agent → tighter scorers.

## 11. Where it runs: Studio vs Cloud Observability *(11:19–11:46; 14:27–15:02)*
- **Mastra Studio** (`mastra dev`, local): the interactive surface — Traces, Datasets, Run Experiment, and the **Agent Editor** that lets **non-technical** people edit prompts/tools. Datasets in Studio are "part of the product, available to everybody," not just code.
- **Mastra Cloud Observability**: the **sink for production traces**. Stream all traces there, then run scorers online, see the monitoring dashboard, and create datasets from real usage.

A realistic setup: develop + run offline evals in Studio; ship and monitor with Cloud Observability.

## 12. Anti-patterns
- Asserting exact LLM output strings → use a scorer (code for deterministic, judge for subjective).
- One LLM-judge for everything → expensive/slow; add code scorers for the controllable parts.
- Shipping a synthetic-only golden dataset to CI → tests imagination, not the agent.
- Online scoring every request → sample, or pay the bill.
- No `reason` field → a score that can't guide a fix.
- Mixing score orientations → normalize so 1 = good everywhere.
