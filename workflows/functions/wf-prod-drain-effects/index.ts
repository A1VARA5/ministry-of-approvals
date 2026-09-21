import {documentEventHandler} from '@sanity/functions'
import {errorMessage} from '@sanity/workflow-engine'
import {createRuntime} from '../../src/engine.ts'

// Effect drainer. Fires when an instance gains unclaimed pending effects (see the GROQ delta
// filter in sanity.blueprint.ts), claims them, runs the clerk handlers and reports back. The
// engine re-evaluates transitions after each completion, so one call walks a form through every
// automated department until it reaches a human or the wall.
interface WorkflowEvent {
  _id: string
}

export const handler = documentEventHandler<WorkflowEvent>(async ({context, event}) => {
  const {token, apiHost} = context.clientOptions
  if (!token) throw new Error('The Function has no token; check the robot token resource')

  const {engine} = createRuntime({
    token,
    apiHost,
    executionContext: {kind: 'drainer', id: 'wf-prod-drain-effects'},
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    siteUrl: process.env.MINISTRY_SITE_URL,
  })

  try {
    const result = await engine.drainEffects({instanceId: event.data._id})
    console.log(
      `drained ${result.drained.length}, failed ${result.failed.length}, skipped ${result.skipped.length}, lost ${result.lost.length} for ${event.data._id}`,
    )
    for (const entry of result.failed) console.error('failed effect', JSON.stringify(entry))
  } catch (error) {
    console.error(`drain threw for ${event.data._id}: ${errorMessage(error)}`)
    throw error
  }
})
