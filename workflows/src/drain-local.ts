import {errorMessage, instancesQuery, sweepStaleClaims} from '@sanity/workflow-engine'
import {createRuntime, TAG} from './engine.ts'

// Local effect drainer for development. The deployed version is the Sanity Function in
// functions/wf-prod-drain-effects; this one does the same job from a laptop: listen for instances
// that gain unclaimed effects, drain them. Run with: npm run drain (needs SANITY_API_TOKEN).

const token = process.env.SANITY_API_TOKEN
if (!token) throw new Error('SANITY_API_TOKEN is required')

const {engine, content} = createRuntime({
  token,
  executionContext: {kind: 'drainer', id: 'local-drainer'},
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  siteUrl: process.env.MINISTRY_SITE_URL,
})

const inFlight = new Set<string>()
const queued = new Set<string>()

async function drain(instanceId: string) {
  if (inFlight.has(instanceId)) {
    queued.add(instanceId)
    return
  }
  inFlight.add(instanceId)
  try {
    const result = await engine.drainEffects({instanceId})
    const counts = `drained ${result.drained.length}, failed ${result.failed.length}, skipped ${result.skipped.length}, lost ${result.lost.length}`
    console.log(`[drain] ${instanceId}: ${counts}`)
    for (const entry of result.failed) console.log(`[drain]   failed:`, JSON.stringify(entry))
  } catch (error) {
    console.error(`[drain] ${instanceId} threw: ${errorMessage(error)}`)
  } finally {
    inFlight.delete(instanceId)
    if (queued.delete(instanceId)) void drain(instanceId)
  }
}

async function sweep() {
  const {query, params} = instancesQuery({tag: TAG, filter: {includeCompleted: true}})
  const rows = await content.fetch<Array<{_id: string}>>(
    `${query}[count(pendingEffects) > 0]{_id}`,
    params,
  )
  for (const {_id} of rows) {
    await sweepStaleClaims({client: engine.client, tag: TAG, instanceId: _id, executionContext: {kind: 'drainer', id: 'local-drainer'}})
    await drain(_id)
  }
  console.log(`[sweep] ${rows.length} instance(s) had pending effects`)
}

await sweep()

const listenQuery = `*[_type == "sanity.workflow.instance" && tag == $tag && count(pendingEffects[!defined(claim)]) > 0]`
content
  .listen<{_id: string}>(listenQuery, {tag: TAG}, {includeResult: false, visibility: 'transaction'})
  .subscribe({
    next: (event) => {
      if (event.type !== 'mutation') return
      void drain(event.documentId)
    },
    error: (error) => {
      console.error('[listen] error', errorMessage(error))
      process.exit(1)
    },
  })
console.log('[listen] waiting for pending effects on tag', TAG)
