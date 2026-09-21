import type {APIRoute} from 'astro'
import {engine, fieldMap, loadStatus, stageTitle} from '../../../lib/ministry'

export const prerender = false

// Polled by the status page every few seconds. The instance document is the source of truth.
// While a file sits on the Minister's desk the poll also ticks it, so the Department of Delays
// fires the moment the deadline passes for anyone watching, not only on the hourly cron.
export const GET: APIRoute = async ({params}) => {
  const id = params.id ?? ''
  let {submission, instance, departments} = await loadStatus(id)
  if (!submission) return new Response('null', {status: 404, headers: {'content-type': 'application/json'}})
  if (instance && !instance.completedAt && instance.currentStage === 'minister-review') {
    try {
      const result = await engine.tick({instanceId: instance._id})
      if (result.cascaded > 0) instance = (await loadStatus(id)).instance
    } catch {
      // A failed tick is the cron's problem next hour; the status page still renders.
    }
  }
  const fields = fieldMap(instance)
  const body = {
    id,
    serial: submission.serial,
    stage: instance?.currentStage ?? null,
    stageTitle: instance ? stageTitle(instance.currentStage, departments) : 'Not started',
    completedAt: instance?.completedAt ?? null,
    lostCount: fields.lostCount ?? 0,
    demand: fields.demand ?? null,
    rejectionReason: fields.rejectionReason ?? null,
    remarks: {
      pedantry: fields.remarkPedantry ?? null,
      rubber: fields.remarkRubber ?? null,
      archive: fields.remarkArchive ?? null,
      minister: fields.ministerNote ?? null,
    },
    visits: (instance?.stages ?? []).map((s) => ({stage: s.name, title: stageTitle(s.name, departments), enteredAt: s.enteredAt, exitedAt: s.exitedAt ?? null})),
  }
  return new Response(JSON.stringify(body), {headers: {'content-type': 'application/json', 'cache-control': 'no-store'}})
}
