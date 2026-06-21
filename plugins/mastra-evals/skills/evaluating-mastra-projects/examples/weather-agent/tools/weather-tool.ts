// Minimal weatherTool for the worked example. (The real tool would call a
// weather API; this stub lets the example's imports resolve and scorers run.)
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const weatherTool = createTool({
  id: 'weatherTool',
  inputSchema: z.object({ city: z.string() }),
  description: 'Get the current weather for a city.',
  // Mastra 1.x: the execute callback receives the parsed INPUT as its first arg
  // (destructure fields directly); an optional second `context` arg holds framework
  // services. It is NOT `({ context })`.
  execute: async ({ city }) => {
    return { city, temperatureC: 14, condition: 'overcast' }
  },
})
