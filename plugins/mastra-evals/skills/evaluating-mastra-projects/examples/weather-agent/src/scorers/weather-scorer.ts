// Weather Agent scorers — reconstructed from the Mastra "AI Evals 101" tutorial
// (video 12WN6u2DrBk, "Code behind the scorers" 5:08–8:11) and converted to the
// CURRENT Mastra API (chainable steps + model instance). The on-screen code used
// an older shape (object-key steps: evaluate/preprocess/analyze/createPrompt,
// judge.model as a string). See references/mastra-evals-api.md §9 for the delta.
import { createScorer } from '@mastra/core/evals'
import { createToolCallAccuracyScorerCode, createToxicityScorer } from '@mastra/evals/scorers/prebuilt'
import { getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils'
import { z } from 'zod'
// Judge model: a small/cheap model is enough for grading. Resolve per your provider.
import { openai } from '@ai-sdk/openai'
const judge = openai('gpt-4o-mini')

// 1) CODE-BASED — deterministic, free, CI-friendly.
//    Did the agent call weatherTool for a weather question?
export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weatherTool',
  strictMode: false, // partial credit rather than exact-match only
})

// 2) LLM-JUDGE (prebuilt) — subjective safety.
export const toxicityScorer = createToxicityScorer({ model: judge })

// 3) LLM-JUDGE (custom) — subjective tone promised by the system prompt
//    ("BBC news presenter" persona). Returns score + reason.
export const toneScorer = createScorer({
  id: 'formal-british-tone-scorer',
  name: 'Formal British Tone',
  description:
    'Checks that the assistant sounds formal, polished, and restrained in the style of a BBC news presenter',
  type: 'agent',
  judge: {
    model: judge,
    instructions:
      'You grade whether the assistant response sounds formal, British, calm, polished, and restrained, similar to a BBC news presenter.',
  },
})
  .preprocess(({ run }) => ({
    text: getAssistantMessageFromRunOutput(run.output) ?? '',
  }))
  .analyze({
    description: 'Judge whether the response matches the requested tone of voice',
    outputSchema: z.object({
      matchesTone: z.boolean(),
      explanation: z.string().default(''),
    }),
    // Construct the judge prompt dynamically, interpolating the reply under test.
    createPrompt: ({ run }) => {
      const text = getAssistantMessageFromRunOutput(run.output) ?? ''
      return `Does this reply read like a formal, calm, restrained BBC news weather presenter?\n\nReply under test:\n"""${text}"""`
    },
  })
  .generateScore(({ results }) => (results?.analyzeStepResult?.matchesTone ? 1 : 0))
  .generateReason(({ results }) => results?.analyzeStepResult?.explanation ?? '')
