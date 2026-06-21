# mastra-evals — changelog

## 0.1.0

- Initial release of the `evaluating-mastra-projects` skill.
- Project-driven: profiles any Mastra project (`analyze-project.ts`) and generates a tailored eval system.
- Scorer taxonomy: code-based (`createToolCallAccuracyScorerCode`, custom), LLM-as-judge (`createScorer`, `createToxicityScorer`, `createFaithfulnessScorer`, `createToneScorer`, …), rubric (`createRubricScorer`).
- Artifacts: golden dataset (`input` + `groundTruth`), offline experiment (`dataset.startExperiment`), CI regression (`runEvals`), online scoring (`sampling: { type: 'ratio', rate }`), eval tests.
- Brainstorming entry point for broad/vague goals.
- API verified against current Mastra via context7 and battle-tested against `@mastra/core@1.45.0` / `@mastra/evals@1.4.0` across 5 gateway models.
- Knowledge base distilled from the Mastra "AI Evals 101" tutorial (YouTube `12WN6u2DrBk`).
