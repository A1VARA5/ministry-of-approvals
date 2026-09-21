import type {SanityClient} from '@sanity/client'
import type {HandlerFactory} from './shared.ts'
import {clean, ensureSerial, fetchSubmission, safeId, subjectId} from './shared.ts'

// The three AI clerks. Each one reads its personality from a clerk document in the dataset,
// so the prompt is content. Each returns typed outputs the transitions read, plus field ops
// that leave a remark on the instance for the status page and the certificate.

type ClerkDoc = {name: string; systemPrompt: string; catchphrase?: string}

async function loadClerk(content: SanityClient, role: string): Promise<ClerkDoc> {
  const clerk = await content.fetch<ClerkDoc | null>(
    `*[_type == "clerk" && role == $role][0]{name, systemPrompt, catchphrase}`,
    {role},
  )
  if (!clerk) throw new Error(`no clerk document with role ${role}`)
  return clerk
}

// One Agent Actions Prompt call. The form is passed as a GROQ param so the model sees only the
// fields that matter, and format json means we get an object back, not prose to parse.
async function ask<T>(
  content: SanityClient,
  clerk: ClerkDoc,
  task: string,
  submissionId: string,
  shape: string,
): Promise<T> {
  const response = await content.agent.action.prompt({
    instruction:
      `${clerk.systemPrompt}\n\n${task}\n\n` +
      `The form, as filed: $form\n\n` +
      `Respond only with JSON of this shape: ${shape}. Two sentences at most per string. No dashes.`,
    instructionParams: {
      form: {
        type: 'groq',
        query: `*[_id == $id][0]{title, kind, body, citizen, serial, amendments[]{text, inReplyTo}}`,
        params: {id: submissionId},
      },
    },
    format: 'json',
    temperature: 0.7,
  })
  return response as T
}

const remarkOp = (field: string, value: string) => ({
  type: 'field.set' as const,
  target: {scope: 'workflow' as const, field},
  value: {type: 'literal' as const, value},
})

// Files a parked amendment onto the submission document. The array key is derived from the
// effect key, so a retried handler appends once.
async function fileAmendment(
  content: SanityClient,
  id: string,
  params: Record<string, unknown>,
  effectKey: string,
): Promise<boolean> {
  if (typeof params.amendment !== 'string' || !params.amendment.trim()) return false
  const inReplyTo =
    (typeof params.answeredDemand === 'string' && params.answeredDemand) ||
    (typeof params.answeredRejection === 'string' && params.answeredRejection) ||
    undefined
  const key = `am-${effectKey.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`
  await content
    .patch(id)
    .setIfMissing({amendments: []})
    .insert('after', 'amendments[-1]', [
      {_key: key, _type: 'amendment', text: params.amendment.trim(), inReplyTo, at: new Date().toISOString()},
    ])
    .commit()
  return true
}

const clearAmendmentOps = [
  {type: 'field.unset' as const, target: {scope: 'workflow' as const, field: 'amendment'}},
  {type: 'field.unset' as const, target: {scope: 'workflow' as const, field: 'answeredDemand'}},
  {type: 'field.unset' as const, target: {scope: 'workflow' as const, field: 'answeredRejection'}},
]

export const clerkPedantic: HandlerFactory =
  ({content}) =>
  async (params, ctx) => {
    const id = subjectId(params)
    const row = await fetchSubmission(content, id)
    await ensureSerial(content, row)
    if (await fileAmendment(content, id, params, ctx.effectKey)) ctx.log(`pedantic: filed amendment on ${id}`)

    // A form the Archive lost after Pedantry had already accepted it is not inspected twice.
    if (params.previouslyApproved === true) {
      const remark = 'Previously inspected. Stamped again for good measure. Do not lose it this time.'
      ctx.log(`pedantic: ${id} previously approved, waving through`)
      return {outputs: {complete: true, remark}, ops: [remarkOp('remarkPedantry', remark), ...clearAmendmentOps]}
    }

    const clerk = await loadClerk(content, 'pedantic')
    const verdict = await ask<{complete: boolean; demand?: string; remark: string}>(
      content,
      clerk,
      'Decide whether this form is complete. If it is not, state exactly one thing the citizen must add. ' +
        'If the form carries amendments, treat them as answers to earlier demands.',
      id,
      '{"complete": boolean, "demand": string, "remark": string}',
    )
    const complete = verdict?.complete === true
    const remark = clean(verdict?.remark, clerk.catchphrase ?? 'Noted.')
    ctx.log(`pedantic: ${id} complete=${complete}`)

    if (complete) {
      return {
        outputs: {complete: true, remark},
        ops: [
          remarkOp('remarkPedantry', remark),
          {
            type: 'field.set',
            target: {scope: 'workflow', field: 'pedanticApproved'},
            value: {type: 'literal', value: true},
          },
          ...clearAmendmentOps,
        ],
      }
    }
    const demand = clean(verdict?.demand, 'The form is missing a form.')
    return {
      outputs: {complete: false, remark},
      ops: [remarkOp('remarkPedantry', remark), remarkOp('demand', demand), ...clearAmendmentOps],
    }
  }

export const clerkRubber: HandlerFactory =
  ({content}) =>
  async (params, ctx) => {
    const id = subjectId(params)
    const clerk = await loadClerk(content, 'rubberStamp')
    let remark: string
    try {
      const verdict = await ask<{remark: string}>(
        content,
        clerk,
        'Approve this form and say something about it that shows you did not read it.',
        id,
        '{"remark": string}',
      )
      remark = clean(verdict?.remark, clerk.catchphrase ?? 'Approved.')
    } catch (error) {
      // The rubber stamp never fails. If the model is down, the stamp still comes down.
      ctx.log(`rubber: model unavailable (${String(error)}), stamping anyway`)
      remark = clerk.catchphrase ?? 'Approved. Next.'
    }
    return {outputs: {remark}, ops: [remarkOp('remarkRubber', remark)]}
  }

export const clerkArchive: HandlerFactory =
  ({content}) =>
  async (params, ctx) => {
    const id = subjectId(params)
    const row = await fetchSubmission(content, id)
    const serial = await ensureSerial(content, row)
    const lostCount = typeof params.lostCount === 'number' ? params.lostCount : 0

    // Deterministic on purpose: every third serial is lost, exactly once. The demo has to be
    // reproducible and the joke has to end. A form the Minister sat on too long is lost as well,
    // every time, and the Archivist says so.
    const overdue = params.overdue === true
    const lost = overdue || (serial % 3 === 0 && lostCount === 0)
    const clerk = await loadClerk(content, 'archivist')

    let remark: string
    try {
      const verdict = await ask<{remark: string}>(
        content,
        clerk,
        overdue
          ? 'The Minister let this form sit past the deadline, so it came back down to you and you have lost it. Explain, without apologising, where it might be, and let the Minister hear about it.'
          : lost
            ? 'You have lost this form. Explain, without apologising, where it might be.'
            : 'You have filed this form. Describe the shelf, briefly.',
        id,
        '{"remark": string}',
      )
      remark = clean(verdict?.remark, lost ? 'It was here a minute ago.' : 'Filed.')
    } catch (error) {
      ctx.log(`archive: model unavailable (${String(error)}), filing without a remark`)
      remark = lost ? 'It was here a minute ago.' : 'Filed.'
    }

    if (lost) {
      // One receipt per effect key, so a retried handler cannot issue two.
      const number = `LOST-${String(serial).padStart(4, '0')}-${lostCount + 1}`
      await content.createIfNotExists({
        _id: safeId('receipt', ctx.effectKey),
        _type: 'receipt',
        number,
        submission: {_type: 'reference', _ref: id},
        issuedAt: new Date().toISOString(),
        excuse: remark,
        lostCount: lostCount + 1,
        effectKey: ctx.effectKey,
      })
      ctx.log(`archive: lost ${id} (serial ${serial}), receipt ${number}`)
      return {
        outputs: {lost: true, remark},
        ops: [
          remarkOp('remarkArchive', remark),
          {type: 'field.inc', target: {scope: 'workflow', field: 'lostCount'}},
          {type: 'field.unset', target: {scope: 'workflow', field: 'overdue'}},
        ],
      }
    }
    ctx.log(`archive: filed ${id} (serial ${serial})`)
    return {outputs: {lost: false, remark}, ops: [remarkOp('remarkArchive', remark)]}
  }
