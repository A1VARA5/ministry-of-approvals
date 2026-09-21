import {createClient, type SanityClient} from '@sanity/client'
import {createEngine, ENGINE_API_VERSION, type Engine} from '@sanity/workflow-engine'
import {createEffectHandlers} from './effects/index.ts'

export const PROJECT_ID = 'v6745vem'
export const DATASET = 'ministry'
export const TAG = 'prod'
export const WORKFLOW_RESOURCE = {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`} as const

export type RuntimeOptions = {
  token: string
  executionContext: {kind: 'drainer' | 'server'; id: string}
  discordWebhookUrl?: string
  siteUrl?: string
  apiHost?: string
}

// One engine with the effect handlers registered. The content client and the engine client are
// the same dataset here, the content client just speaks apiVersion vX for Agent Actions.
export function createRuntime(options: RuntimeOptions): {engine: Engine; content: SanityClient} {
  const base = {
    projectId: PROJECT_ID,
    dataset: DATASET,
    token: options.token,
    useCdn: false,
    ...(options.apiHost ? {apiHost: options.apiHost} : {}),
  }
  const client = createClient({...base, apiVersion: ENGINE_API_VERSION, perspective: 'raw'})
  const content = createClient({...base, apiVersion: 'vX'})
  const engine = createEngine({
    client,
    workflowResource: WORKFLOW_RESOURCE,
    tag: TAG,
    executionContext: options.executionContext,
    effects: {
      handlers: createEffectHandlers({
        content,
        discordWebhookUrl: options.discordWebhookUrl,
        siteUrl: options.siteUrl,
      }),
      missingHandler: 'skip',
      // The slowest handler is one Agent Actions prompt, well under a minute.
      leaseMs: 120_000,
    },
  })
  return {engine, content}
}
