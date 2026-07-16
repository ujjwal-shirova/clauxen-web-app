// Content for the claude-api bundled skill.
// Each .md file is inlined as a string at build time via Bun's text loader.

import csharpClauxenApi from './claude-api/csharp/claude-api.md'
import curlExamples from './claude-api/curl/examples.md'
import goClauxenApi from './claude-api/go/claude-api.md'
import javaClauxenApi from './claude-api/java/claude-api.md'
import phpClauxenApi from './claude-api/php/claude-api.md'
import pythonAgentSdkPatterns from './claude-api/python/agent-sdk/patterns.md'
import pythonAgentSdkReadme from './claude-api/python/agent-sdk/README.md'
import pythonClauxenApiBatches from './claude-api/python/claude-api/batches.md'
import pythonClauxenApiFilesApi from './claude-api/python/claude-api/files-api.md'
import pythonClauxenApiReadme from './claude-api/python/claude-api/README.md'
import pythonClauxenApiStreaming from './claude-api/python/claude-api/streaming.md'
import pythonClauxenApiToolUse from './claude-api/python/claude-api/tool-use.md'
import rubyClauxenApi from './claude-api/ruby/claude-api.md'
import skillPrompt from './claude-api/SKILL.md'
import sharedErrorCodes from './claude-api/shared/error-codes.md'
import sharedLiveSources from './claude-api/shared/live-sources.md'
import sharedModels from './claude-api/shared/models.md'
import sharedPromptCaching from './claude-api/shared/prompt-caching.md'
import sharedToolUseConcepts from './claude-api/shared/tool-use-concepts.md'
import typescriptAgentSdkPatterns from './claude-api/typescript/agent-sdk/patterns.md'
import typescriptAgentSdkReadme from './claude-api/typescript/agent-sdk/README.md'
import typescriptClauxenApiBatches from './claude-api/typescript/claude-api/batches.md'
import typescriptClauxenApiFilesApi from './claude-api/typescript/claude-api/files-api.md'
import typescriptClauxenApiReadme from './claude-api/typescript/claude-api/README.md'
import typescriptClauxenApiStreaming from './claude-api/typescript/claude-api/streaming.md'
import typescriptClauxenApiToolUse from './claude-api/typescript/claude-api/tool-use.md'

// @[MODEL LAUNCH]: Update the model IDs/names below. These are substituted into {{VAR}}
// placeholders in the .md files at runtime before the skill prompt is sent.
// After updating these constants, manually update the two files that still hardcode models:
//   - claude-api/SKILL.md (Current Models pricing table)
//   - claude-api/shared/models.md (full model catalog with legacy versions and alias mappings)
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'claude-opus-4-6',
  OPUS_NAME: 'Clauxen Opus 4.6',
  SONNET_ID: 'claude-sonnet-4-6',
  SONNET_NAME: 'Clauxen Sonnet 4.6',
  HAIKU_ID: 'claude-haiku-4-5',
  HAIKU_NAME: 'Clauxen Haiku 4.5',
  // Previous Sonnet ID — used in "do not append date suffixes" example in SKILL.md.
  PREV_SONNET_ID: 'claude-sonnet-4-5',
} satisfies Record<string, string>

export const SKILL_PROMPT: string = skillPrompt

export const SKILL_FILES: Record<string, string> = {
  'csharp/claude-api.md': csharpClauxenApi,
  'curl/examples.md': curlExamples,
  'go/claude-api.md': goClauxenApi,
  'java/claude-api.md': javaClauxenApi,
  'php/claude-api.md': phpClauxenApi,
  'python/agent-sdk/README.md': pythonAgentSdkReadme,
  'python/agent-sdk/patterns.md': pythonAgentSdkPatterns,
  'python/claude-api/README.md': pythonClauxenApiReadme,
  'python/claude-api/batches.md': pythonClauxenApiBatches,
  'python/claude-api/files-api.md': pythonClauxenApiFilesApi,
  'python/claude-api/streaming.md': pythonClauxenApiStreaming,
  'python/claude-api/tool-use.md': pythonClauxenApiToolUse,
  'ruby/claude-api.md': rubyClauxenApi,
  'shared/error-codes.md': sharedErrorCodes,
  'shared/live-sources.md': sharedLiveSources,
  'shared/models.md': sharedModels,
  'shared/prompt-caching.md': sharedPromptCaching,
  'shared/tool-use-concepts.md': sharedToolUseConcepts,
  'typescript/agent-sdk/README.md': typescriptAgentSdkReadme,
  'typescript/agent-sdk/patterns.md': typescriptAgentSdkPatterns,
  'typescript/claude-api/README.md': typescriptClauxenApiReadme,
  'typescript/claude-api/batches.md': typescriptClauxenApiBatches,
  'typescript/claude-api/files-api.md': typescriptClauxenApiFilesApi,
  'typescript/claude-api/streaming.md': typescriptClauxenApiStreaming,
  'typescript/claude-api/tool-use.md': typescriptClauxenApiToolUse,
}
