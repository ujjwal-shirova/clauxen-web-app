import { getInitialSettings } from '../utils/settings/settings.js'

export function getSpinnerVerbs(): string[] {
  const settings = getInitialSettings()
  const config = settings.spinnerVerbs
  if (!config) {
    return SPINNER_VERBS
  }
  if (config.mode === 'replace') {
    return config.verbs.length > 0 ? config.verbs : SPINNER_VERBS
  }
  return [...SPINNER_VERBS, ...config.verbs]
}

/**
 * Clauxen spinner verbs — short, precise, developer-facing.
 * Distinct from Clauxen's whimsical word salad.
 */
export const SPINNER_VERBS = [
  'Aligning',
  'Analyzing',
  'Assembling',
  'Building',
  'Checking',
  'Compiling',
  'Composing',
  'Computing',
  'Connecting',
  'Crafting',
  'Decoding',
  'Drafting',
  'Examining',
  'Executing',
  'Exploring',
  'Fetching',
  'Focusing',
  'Forging',
  'Gathering',
  'Generating',
  'Indexing',
  'Inferring',
  'Inspecting',
  'Mapping',
  'Merging',
  'Optimizing',
  'Parsing',
  'Planning',
  'Polishing',
  'Preparing',
  'Processing',
  'Querying',
  'Reading',
  'Refining',
  'Resolving',
  'Reviewing',
  'Scanning',
  'Shaping',
  'Solving',
  'Sorting',
  'Structuring',
  'Synthesizing',
  'Tracing',
  'Transforming',
  'Twisting',
  'Updating',
  'Validating',
  'Wiring',
  'Writing',
]
