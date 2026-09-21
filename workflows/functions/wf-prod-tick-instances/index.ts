import {createClient} from '@sanity/client'
import {scheduledEventHandler} from '@sanity/functions'
import {createEngine, ENGINE_API_VERSION, errorMessage, instancesQuery, sweepStaleClaims} from '@sanity/workflow-engine'

// The Department of Delays, on the clock. Once an hour (the Growth plan's fastest cron) every
// in-flight instance is re-evaluated: a Minister who sat on a file past the deadline loses it to
// the Archive. Also releases expired effect claims so a crashed drain can be picked up again.
const PROJECT_ID = 'v6745vem'
const DATASET = 'ministry'
const TAG = 'prod'

export const handler = scheduledEventHandler(async ({context}) => {
  const client = createClient({
    ...context.clientOptions,
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: ENGINE_API_VERSION,
    perspective: 'raw',
    useCdn: false,
  })
  const executionContext = {kind: 'server', id: 'wf-prod-tick-instances'} as const
  const engine = createEngine({
    client,
    workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
    tag: TAG,
    executionContext,
  })

  const {query, params} = instancesQuery({tag: TAG, filter: {includeCompleted: true}})
  const instances = await client.fetch<Array<{_id: string; completedAt: string | null}>>(
    `${query}[!defined(completedAt) || count(pendingEffects) > 0]{_id, completedAt}`,
    params,
  )

  let failed = 0
  let moved = 0
  for (const {_id, completedAt} of instances) {
    try {
      await sweepStaleClaims({client, tag: TAG, instanceId: _id, executionContext})
      if (completedAt === null) {
        const result = await engine.tick({instanceId: _id})
        if (result.cascaded > 0) moved += 1
      }
    } catch (error) {
      failed += 1
      console.error(`tick failed for ${_id}: ${errorMessage(error)}`)
    }
  }
  console.log(`ticked ${instances.length} instance(s), ${moved} moved, ${failed} failed`)
  if (instances.length > 0 && failed === instances.length) {
    throw new Error('Scheduled tick failed for every instance')
  }
})
