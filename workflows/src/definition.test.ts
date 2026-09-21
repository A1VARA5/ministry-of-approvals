import {createBench, GuardDeniedError, subjectField} from '@sanity/workflow-engine-test'
import {describe, expect, test} from 'vitest'
import {ministryApproval, WORKFLOW_NAME} from './definition.ts'

// The real engine, in memory, with a clock we control. The clerks are played by the test:
// each pending effect is completed by name with the outputs and ops the handlers would return.

const T0 = '2026-09-21T09:00:00.000Z'
const HOUR = 60 * 60 * 1000

const form = {
  _id: 'submission.1',
  _type: 'submission',
  title: 'Rename the office cat to Deputy Minister',
  kind: 'name',
  body: 'The cat attends every meeting.',
  citizen: 'aivaras',
  serial: 1,
}

async function file(serial = 1, options: {wallClock?: boolean} = {}) {
  const doc = {...form, _id: `submission.${serial}`, serial}
  // The Minister's deadline is a GROQ query value (now() + 1h) resolved by the in-memory lake on
  // the wall clock, so the Delays test runs on the wall clock and advances from there.
  const bench = createBench({...(options.wallClock ? {} : {now: T0}), documents: [doc, {...doc, _id: `drafts.${doc._id}`}]})
  await bench.deployDefinitions({expectedMinReaderModel: 10, definitions: [ministryApproval]})
  const {instance} = await bench.startInstance({
    definition: WORKFLOW_NAME,
    initialFields: [subjectField(doc._id, {type: 'submission'})],
  })
  return {bench, id: instance._id, docId: doc._id}
}

const remark = (field: string, value: string) => ({
  type: 'field.set' as const,
  target: {scope: 'workflow' as const, field},
  value: {type: 'literal' as const, value},
})

// What the clerk-pedantic handler reports.
async function pedantry(bench: Awaited<ReturnType<typeof file>>['bench'], id: string, complete: boolean) {
  return bench.completePendingEffect({
    instanceId: id,
    effect: 'clerk-pedantic',
    status: 'done',
    outputs: {complete, remark: complete ? 'Fine.' : 'Missing a date.'},
    ops: complete
      ? [remark('remarkPedantry', 'Fine.'), {type: 'field.set', target: {scope: 'workflow', field: 'pedanticApproved'}, value: {type: 'literal', value: true}}]
      : [remark('remarkPedantry', 'Missing a date.'), remark('demand', 'Add the date, subsection 4.2.')],
  })
}

async function rubber(bench: Awaited<ReturnType<typeof file>>['bench'], id: string) {
  return bench.completePendingEffect({
    instanceId: id,
    effect: 'clerk-rubber',
    status: 'done',
    outputs: {remark: 'Approved. Next.'},
    ops: [remark('remarkRubber', 'Approved. Next.')],
  })
}

async function archive(bench: Awaited<ReturnType<typeof file>>['bench'], id: string, lost: boolean) {
  return bench.completePendingEffect({
    instanceId: id,
    effect: 'clerk-archive',
    status: 'done',
    outputs: {lost, remark: lost ? 'It was here a minute ago.' : 'Filed.'},
    ops: lost
      ? [remark('remarkArchive', 'It was here a minute ago.'), {type: 'field.inc', target: {scope: 'workflow', field: 'lostCount'}}, {type: 'field.unset', target: {scope: 'workflow', field: 'overdue'}}]
      : [remark('remarkArchive', 'Filed.')],
  })
}

describe('the corridor', () => {
  test('a new form is stamped in and walks straight to Pedantry', async () => {
    const {bench, id} = await file()
    expect(await bench.currentStage(id)).toBe('department-a')
    const pending = await bench.listPendingEffects({instanceId: id})
    expect(pending.map((e) => e.name)).toEqual(['clerk-pedantic'])
    expect(pending[0].params).toMatchObject({previouslyApproved: false, lostCount: 0})
  })

  test('Pedantry returns an incomplete form to the desk, and a resubmission carries the amendment', async () => {
    const {bench, id} = await file()
    await pedantry(bench, id, false)
    expect(await bench.currentStage(id)).toBe('intake')
    const view = await bench.evaluate({instanceId: id})
    const fields = Object.fromEntries(view.instance.fields.map((f) => [f.name, f.value]))
    expect(fields.demand).toBe('Add the date, subsection 4.2.')

    const {instance} = await bench.fireAction({instanceId: id, activity: 'receive', action: 'resubmit', params: {amendment: 'Dated today.'}})
    expect(instance.currentStage).toBe('department-a')
    const pending = await bench.listPendingEffects({instanceId: id})
    expect(pending[0].params).toMatchObject({amendment: 'Dated today.', answeredDemand: 'Add the date, subsection 4.2.'})
  })

  test('a complete form goes Pedantry, Rubber Stamps, Archive, Minister', async () => {
    const {bench, id} = await file()
    await pedantry(bench, id, true)
    expect(await bench.currentStage(id)).toBe('department-b')
    await rubber(bench, id)
    expect(await bench.currentStage(id)).toBe('department-c')
    await archive(bench, id, false)
    expect(await bench.currentStage(id)).toBe('minister-review')
  })

  test('the Archive loses a form, it walks the corridor again, and Pedantry is told it was approved before', async () => {
    const {bench, id} = await file(3)
    await pedantry(bench, id, true)
    await rubber(bench, id)
    await archive(bench, id, true)
    // Back at the desk, stamped in by itself, straight to Pedantry with the flag set.
    expect(await bench.currentStage(id)).toBe('department-a')
    const pending = await bench.listPendingEffects({instanceId: id})
    expect(pending[0].params).toMatchObject({previouslyApproved: true, lostCount: 1})
  })

  test('a withdrawn form ends in the shredder', async () => {
    const {bench, id} = await file()
    await pedantry(bench, id, false)
    const {instance} = await bench.fireAction({instanceId: id, activity: 'receive', action: 'withdraw'})
    expect(instance.currentStage).toBe('shredded')
    expect(instance.completedAt).toBeTruthy()
  })

  test('a clerk that breaks sends the file to the Minister instead of stalling', async () => {
    const {bench, id} = await file()
    await bench.completePendingEffect({instanceId: id, effect: 'clerk-pedantic', status: 'failed'})
    expect(await bench.currentStage(id)).toBe('minister-review')
  })
})

describe("the Minister's desk", () => {
  async function atTheDesk(serial = 1, options: {wallClock?: boolean} = {}) {
    const ctx = await file(serial, options)
    await pedantry(ctx.bench, ctx.id, true)
    await rubber(ctx.bench, ctx.id)
    await archive(ctx.bench, ctx.id, false)
    expect(await ctx.bench.currentStage(ctx.id)).toBe('minister-review')
    return ctx
  }

  test('approve issues a certificate, announces it, and hangs it on the wall', async () => {
    const {bench, id} = await atTheDesk()
    await bench.fireAction({instanceId: id, activity: 'rule', action: 'approve', params: {note: 'Splendid.'}})
    expect(await bench.currentStage(id)).toBe('certified')
    let pending = await bench.listPendingEffects({instanceId: id})
    expect(pending.map((e) => e.name)).toEqual(['issue-certificate'])
    expect(pending[0].params).toMatchObject({ministerNote: 'Splendid.', lostCount: 0, delays: 0})

    await bench.completePendingEffect({instanceId: id, effect: 'issue-certificate', status: 'done', outputs: {certificateNumber: 'MoA-2026-0001'}})
    pending = await bench.listPendingEffects({instanceId: id})
    expect(pending.map((e) => e.name)).toEqual(['announce'])
    expect(pending[0].params).toMatchObject({certificateNumber: 'MoA-2026-0001'})

    await bench.completePendingEffect({instanceId: id, effect: 'announce', status: 'done'})
    expect(await bench.currentStage(id)).toBe('on-the-wall')
  })

  test('the certificate goes on the wall even if the town crier fails', async () => {
    const {bench, id} = await atTheDesk()
    await bench.fireAction({instanceId: id, activity: 'rule', action: 'approve', params: {note: 'Fine.'}})
    await bench.completePendingEffect({instanceId: id, effect: 'issue-certificate', status: 'done', outputs: {certificateNumber: 'MoA-2026-0001'}})
    await bench.completePendingEffect({instanceId: id, effect: 'announce', status: 'failed'})
    expect(await bench.currentStage(id)).toBe('on-the-wall')
  })

  test('reject sends the form back with the reason on it', async () => {
    const {bench, id} = await atTheDesk()
    const {instance} = await bench.fireAction({instanceId: id, activity: 'rule', action: 'reject', params: {reason: 'Cats cannot hold office.'}})
    expect(instance.currentStage).toBe('intake')
    const fields = Object.fromEntries(instance.fields.map((f) => [f.name, f.value]))
    expect(fields.rejectionReason).toBe('Cats cannot hold office.')
  })

  test('refer sends the form to the chosen department and Pedantry inspects for real again', async () => {
    const {bench, id} = await atTheDesk()
    const {instance} = await bench.fireAction({instanceId: id, activity: 'rule', action: 'refer', params: {department: 'department-a'}})
    expect(instance.currentStage).toBe('department-a')
    const pending = await bench.listPendingEffects({instanceId: id})
    expect(pending[0].params).toMatchObject({previouslyApproved: false})
  })

  test('approve without a note is refused: a certificate deserves a word', async () => {
    const {bench, id} = await atTheDesk()
    await expect(bench.fireAction({instanceId: id, activity: 'rule', action: 'approve'})).rejects.toThrow()
    expect(await bench.currentStage(id)).toBe('minister-review')
  })

  test('the Department of Delays: a Minister who sits on a file past the deadline loses it to the Archive', async () => {
    const {bench, id} = await atTheDesk(1, {wallClock: true})
    const view = await bench.evaluate({instanceId: id})
    const deadline = view.instance.stages.at(-1)?.fields.find((f) => f.name === 'deadline')?.value
    expect(typeof deadline).toBe('string')
    expect(Date.parse(String(deadline))).toBeGreaterThan(Date.now() + 50 * 60 * 1000)
    const before = await bench.tick({instanceId: id})
    expect(before.instance.currentStage).toBe('minister-review')

    bench.advance(2 * HOUR)
    const after = await bench.tick({instanceId: id})
    expect(after.instance.currentStage).toBe('department-c')
    const pending = await bench.listPendingEffects({instanceId: id})
    expect(pending[0].params).toMatchObject({overdue: true})

    await archive(bench, id, true)
    expect(await bench.currentStage(id)).toBe('department-a')
    const fields = Object.fromEntries((await bench.evaluate({instanceId: id})).instance.fields.map((f) => [f.name, f.value]))
    expect(fields.delays).toBe(1)
    expect(fields.lostCount).toBe(1)
    expect(fields.overdue).toBeFalsy()
  })
})

describe('guards', () => {
  test('the form cannot be edited or deleted while a department holds it', async () => {
    const {bench, docId} = await file()
    await expect(bench.editDocument({documentId: `drafts.${docId}`, patch: {set: {body: 'Changed my mind.'}}})).rejects.toBeInstanceOf(GuardDeniedError)
    await expect(bench.editDocument({documentId: docId, action: 'delete'})).rejects.toBeInstanceOf(GuardDeniedError)
    // An amendment is not a change to what the form says.
    await expect(bench.editDocument({documentId: `drafts.${docId}`, patch: {set: {amendments: [{_key: 'a', text: 'Dated.'}]}}})).resolves.toBeTruthy()
  })

  test('the guards lift at the Front Desk', async () => {
    const {bench, id, docId} = await file()
    await pedantry(bench, id, false)
    expect(await bench.currentStage(id)).toBe('intake')
    await expect(bench.editDocument({documentId: `drafts.${docId}`, patch: {set: {body: 'Changed my mind.'}}})).resolves.toBeTruthy()
  })
})
