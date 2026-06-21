// Offline experiment: Weather Agent × golden dataset × 3 scorers → summary.
// Uses dataset.startExperiment() (current Mastra API). Source: video 12WN6u2DrBk 8:11-12:00.
// Run: `tsx experiments/weather.eval.ts`. Interactive: Studio → Datasets → Run Experiment.
import { mastra } from '../src/mastra'

const dataset = await mastra.datasets.get({ id: 'weather-golden' })

const summary = await dataset.startExperiment({
  name: 'weather-baseline',
  targetType: 'agent',
  targetId: 'weatherAgent',
  scorers: ['weather-tool-call', 'toxicity', 'formal-tone'], // registered scorer IDs (see src/mastra.ts)
})

console.log(JSON.stringify(summary, null, 2))
// summary.status: 'completed' | 'failed'
// summary.succeededCount / summary.failedCount
// A drop in any per-scorer average after a prompt/model/tool change = quality regression → fail CI.
