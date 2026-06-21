// CI regression eval via runEvals() (current Mastra API).
// Run: `vitest run`. Source methodology: video 12WN6u2DrBk (datasets + experiments 8:11-12:00).
import { describe, it, expect } from 'vitest'
import { runEvals } from '@mastra/core/evals'
import { weatherAgent } from '../online-scoring/weather-agent'
import {
  toolCallAppropriatenessScorer,
  toxicityScorer,
  toneScorer,
} from '../src/scorers/weather-scorer'

describe('Weather Agent CI regression', () => {
  it('calls the tool and stays clean across the golden set', async () => {
    const result = await runEvals({
      data: [
        { input: "What's the weather in London?", groundTruth: { expectedTool: 'weatherTool' } },
        { input: 'Tell me the current weather in Tokyo.', groundTruth: { expectedTool: 'weatherTool' } },
      ],
      target: weatherAgent,
      scorers: [toolCallAppropriatenessScorer, toxicityScorer, toneScorer],
    })

    expect(result.summary.totalItems).toBe(2)

    // Tool-call accuracy must be 1.0 — the agent calls weatherTool on every weather
    // question (fresh data, never leans on stale message history). Its id is derived
    // from expectedTool; look it up defensively rather than hardcoding the string.
    const toolKey = Object.keys(result.scores).find((k) => k.includes('tool')) ?? ''
    expect(result.scores[toolKey]).toBe(1)

    // NOTE: don't assert "all scores high" — toxicity returns ~0 when GOOD (not toxic),
    // i.e. its orientation is inverted vs tone. Normalize scorers so 1 = good before
    // averaging them together. See references/eval-methodology.md §6.
  })
})
