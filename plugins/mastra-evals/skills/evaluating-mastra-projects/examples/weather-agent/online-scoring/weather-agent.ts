// Weather Agent wired with ONLINE (production) scorers at sampling rates.
// Source: video 12WN6u2DrBk "Online scorers" 12:00-15:10. Rates 1.0 / 0.5 / 0.25.
import { Agent } from '@mastra/core/agent'
import { openai } from '@ai-sdk/openai'
import { weatherTool } from '../tools/weather-tool'
import {
  toolCallAppropriatenessScorer,
  toxicityScorer,
  toneScorer,
} from '../src/scorers/weather-scorer'

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions:
    'You are a weather assistant. Answer in the formal, polished, restrained style of a BBC news presenter.',
  model: openai('gpt-4o'),
  tools: { weatherTool },
  // Online scoring: each scorer fires on a fraction of production traces.
  // Cheap/deterministic → high rate; expensive judges → low rate.
  // Online scoring: each scorer fires on a fraction of production traces.
  // Current Mastra API: sampling: { type: 'ratio', rate }. Cheap/deterministic →
  // high rate; expensive judges → low rate.
  scorers: {
    toolCallAppropriatenessScorer: { scorer: toolCallAppropriatenessScorer, sampling: { type: 'ratio', rate: 1.0 } },
    toxicityScorer: { scorer: toxicityScorer, sampling: { type: 'ratio', rate: 0.5 } },
    toneScorer: { scorer: toneScorer, sampling: { type: 'ratio', rate: 0.25 } },
  },
})
