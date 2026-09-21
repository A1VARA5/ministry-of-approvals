import {defineBlueprint, defineDocumentFunction, defineRobotToken, defineScheduledFunction} from '@sanity/blueprints'

// The production runtime for the Ministry's workflow: a Document Function that wakes when a
// workflow instance gains unclaimed effects and drains them, and a Scheduled Function that ticks
// every in-flight instance once an hour for the Department of Delays (the Minister's deadline).
// Scheduled Functions need an organization scoped stack; this one was promoted. The robot token
// is what the clerks act as.
const projectId = 'v6745vem'
const dataset = 'ministry'

export default defineBlueprint({
  resources: [
    defineRobotToken({
      name: 'wf-prod-runtime',
      label: 'Ministry workflows runtime',
      memberships: [{resourceType: 'project', resourceId: projectId, roleNames: ['editor']}],
    }),
    defineDocumentFunction({
      name: 'wf-prod-drain-effects',
      src: './functions/wf-prod-drain-effects',
      project: projectId,
      robotToken: '$.resources.wf-prod-runtime.token',
      // One drain runs up to five Agent Actions prompts plus a webhook; give it room.
      timeout: 120,
      event: {
        on: ['create', 'update'],
        filter:
          '_type == "sanity.workflow.instance" && tag == "prod" && ' +
          'count(after().pendingEffects[!defined(claim)]) > ' +
          'coalesce(count(before().pendingEffects[!defined(claim)]), 0)',
        projection: '{_id}',
        resource: {type: 'dataset', id: `${projectId}.${dataset}`},
      },
    }),
    defineScheduledFunction({
      name: 'wf-prod-tick-instances',
      src: './functions/wf-prod-tick-instances',
      // Hourly is the fastest the Growth plan runs. The site also ticks a file while someone
      // is watching its status page, so a demo does not have to wait for the clock.
      event: {expression: '0 * * * *'},
      robotToken: '$.resources.wf-prod-runtime.token',
      timeout: 120,
    }),
  ],
})
