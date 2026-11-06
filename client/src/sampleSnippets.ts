import type { Language } from './types/analysis'

/** Local editor starters. These are not analysis results. */
export const SAMPLE_SNIPPETS: Record<Language, string> = {
  javascript: `// Local sample snippet. This is not an analysis result.
function total(items) {
  let sum = 0
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price
  }
  return sum
}
`,
  typescript: `// Local sample snippet. This is not an analysis result.
type LineItem = { price: number }

function total(items: LineItem[]): number {
  let sum = 0
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price
  }
  return sum
}
`,
}
