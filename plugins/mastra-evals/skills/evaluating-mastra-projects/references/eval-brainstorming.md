# Eval Brainstorming

> Use this when the user's goal is **broad, vague, or they don't yet know what to evaluate** — "add evals to my agent", "make sure it's good/reliable", "what should I eval?", a new project with no evals yet, or a large surface area (many agents/tools) with unclear priority. When the user *already names* the behavior ("make sure it always calls X", "check it's not toxic", "assert field Y exists"), skip this and go straight to [scorer-selection.md](scorer-selection.md) + the [workflow](../SKILL.md). Brainstorming is high-freedom synthesis: **investigate deeply, then recommend with reasons the user can pick from.**

## When to brainstorm (and when not to)
- **Brainstorm** if: open-ended request; "quality"/"good"/"reliable" with no specifics; greenfield project; user asks "what should I eval?"; priority unclear across a big surface.
- **Skip** if: the user names a specific behavior/score. Don't brainstorm what's already specified.

## Step 1 — Investigate the codebase (don't guess)
Run `analyze-project.ts` and read its output, then **read the actual code** for each agent/tool it found. A recommendation ungrounded in the real system prompt/tools is hallucination.
- **Agents**: system prompt (the *promises* it makes — tone, scope, refusal policy, output format), model, tools, memory, user-facing vs internal.
- **Tools**: what each does, **side effects** (writes? charges money? sends email? deletes?), idempotency, external-API dependence, known failure modes.
- **Workflows**: branches, steps that must run in order, human-in-the-loop gates.
- **Data & domain**: PII / PHI / financial data? regulated (HIPAA, PCI, GDPR)? multi-tenant? content-moderation surface?
- **I/O contract**: is the output parsed by downstream code (→ needs **schema conformance**) or shown to humans (→ needs **tone/safety**)?

> The **system prompt is a goldmine**: every constraint it states is a candidate eval. "be concise" → conciseness; "always cite the policy" → grounding/faithfulness; "never reveal PII" → a guardrail scorer; "respond in JSON with field X" → schema-conformance scorer.

## Step 2 — Understand use cases, scale, and stakes
Ask (or infer) only what you can't read from code:
- **Stakes**: cost of a wrong/toxic/hallucinated answer? (annoyance → financial loss → safety/legal). Higher stakes → more scorers, tighter thresholds.
- **Scale**: requests/day? In production with real users, or pre-launch? → drives offline-vs-online + sampling rates.
- **What the user actually cares about**: correctness? safety? cost? latency? brand voice? staying on-scope? **Rank these** — they decide which scorers matter most.
- **Known failures**: past incidents, bug reports, complaints? Those are priority evals.

Prefer to **investigate first, then present recommendations** — don't interrogate. Ask 1–3 sharp questions only when the answer changes the recommendation.

## Step 3 — Enumerate candidate evals across the spectrum
For each agent/tool, list candidates in **cheap-first** order. Not everything is a soft judge — prefer the hard check whenever the behavior is controllable from the trace.

**Hard / deterministic (CODE scorers — free, deterministic, CI-friendly):**
- Did it call the right tool? → `createToolCallAccuracyScorerCode`
- In the right *order*? → `expectedToolOrder`
- Tool args valid / in an allowed set? → custom code scorer
- Output conforms to schema / required fields / valid JSON? → custom code scorer on `run.output`
- Guardrails held? (refused a disallowed request, redacted PII, stayed in scope) → custom code scorer
- Latency / cost / token budget within limit? → code scorer over trace metadata
- Multi-step path matched? → `createTrajectoryScorerCode`

**Subjective / judgment (LLM-JUDGE — use a cheap json_schema-capable judge; reasoning models often fail structured output):**
- Tone / brand voice → `createToneScorer` (**free**, code/sentiment) or a custom judge
- Toxicity / safety → `createToxicityScorer`
- Grounded in context (no hallucination) → `createFaithfulnessScorer`
- Answers the actual question → `createAnswerRelevancyScorer`
- Instruction adherence / helpfulness → custom judge
- Bias → `createBiasScorer`

**Task completion (RUBRIC — binary, all-criteria-met → 1):**
- "Is the task done?" checklist of required outputs → `createRubricScorer`

## Step 4 — Rank and build the recommendation set
Score each candidate by **risk × likelihood × (1 / cost-to-eval)**. Assemble a small set (3–6) that covers both *did it work* (≥1 hard scorer) and *was it good* (≥1 judge/rubric), weighted by the user's priorities from Step 2. **Don't recommend 12 scorers** — recommend the few that move the needle.

## Step 5 — Present recommendations (pickable, with reasons)
Present a numbered list. Mark a default with ★. Each item states: **what · why it matters for THIS project (tie to a concrete risk) · scorer type + factory · cost · where it runs (CI / online rate)**. Example shape:

> For `supportAgent` I'd evaluate (pick any; ★ = my default):
> 1. ★ **Tool-call accuracy** (CODE) — it *must* call `kbSearch`, else it invents policy; a lazy miss = a wrong refund answer. Free + deterministic + CI. `createToolCallAccuracyScorerCode`
> 2. ★ **Toxicity** (JUDGE) — user-facing, hostile inputs likely; the risk is a viral "your bot was rude" post. Low-rate online. `createToxicityScorer`
> 3. **Faithfulness** (JUDGE) — it answers from the KB; a hallucinated return window is real harm. `createFaithfulnessScorer`
> 4. **Reply < 80 words** (CODE) — your prompt promises conciseness; cheap to assert. custom code scorer

**If nothing fits:** say so plainly, name the single closest match, adapt it, and offer 1–2 alternatives. Let the user pick one and refine. Never silently emit a generic set.

## Worked example (a user-facing support agent)
Profile: a support agent with a knowledge-base tool, a policy tool, and a ticketing tool; user-facing. Stakes: a wrong refund/policy answer = CS/financial cost; a toxic reply = reputational. Scale: production. Priorities: correctness → safety. → Recommendations: tool-call accuracy on the KB tool + ticket-on-actionable (both **CODE**, top priority), toxicity (JUDGE, online low-rate), faithfulness (JUDGE), conciseness (CODE). Notice the hard/code scorers come **first** — they're cheap and they catch the expensive failures; the judges are the safety net.

## Anti-patterns
- **Judge everything / eval everything** — expensive and slow; lead with code scorers for the controllable parts.
- **Recommending without reading the code** — the system prompt and tool side-effects are where the real evals live.
- **Ignoring scale/stakes** — online sampling on a pre-launch toy wastes money; *no* online scoring on a 10k/day prod agent flies blind.
- **Soft-only recommendations** — tone/toxicity demo well, but the high-value, cheap wins are almost always the **hard** checks (did it call the tool? is the JSON valid? did the guardrail hold?).
