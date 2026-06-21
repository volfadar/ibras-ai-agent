// The Mastra instance: registers the Weather Agent and its scorers so Studio's
// "Evaluate Trace" list and dataset.startExperiment() can reference them by ID.
// Source: video 12WN6u2DrBk ("we have defined and added a bunch of scorers on the
// mastra instance"). See references/mastra-evals-api.md §6.
import { Mastra } from '@mastra/core'
import { weatherAgent } from '../online-scoring/weather-agent'
import {
  toolCallAppropriatenessScorer,
  toxicityScorer,
  toneScorer,
} from './scorers/weather-scorer'

export const mastra = new Mastra({
  agents: { weatherAgent },
  scorers: {
    'weather-tool-call': toolCallAppropriatenessScorer,
    toxicity: toxicityScorer,
    'formal-tone': toneScorer,
  },
})
