import type {HandlerFactory} from './shared.ts'
import {clean, ensureSerial, fetchSubmission, subjectId} from './shared.ts'

// Writes the certificate document. One per submission (id derived from the submission id), so a
// retried effect or a second trip through the Minister's desk updates rather than duplicates.
// The stamps copy the departments' remarks off the instance, so the wall does not depend on the
// workflow instance still existing.
export const issueCertificate: HandlerFactory =
  ({content}) =>
  async (params, ctx) => {
    const id = subjectId(params)
    const row = await fetchSubmission(content, id)
    const serial = await ensureSerial(content, row)
    const number = `MoA-${new Date().getUTCFullYear()}-${String(serial).padStart(4, '0')}`

    const departments = await content.fetch<Array<{_id: string; stage: string}>>(
      `*[_type == "department" && defined(stage)]{_id, stage}`,
    )
    const deptFor = (stage: string) => departments.find((d) => d.stage === stage)?._id
    const now = new Date().toISOString()
    const stamp = (stage: string, verdict: string, remark: unknown, key: string) => {
      const department = deptFor(stage)
      const text = typeof remark === 'string' ? remark : ''
      if (!department || !text) return null
      return {
        _key: key,
        _type: 'stamp',
        department: {_type: 'reference', _ref: department},
        verdict,
        remark: text,
        stampedAt: now,
      }
    }
    const lostCount = typeof params.lostCount === 'number' ? params.lostCount : 0
    // A lost form gets its own stamp with the Archivist's excuse from the receipt, then the
    // filing stamp from the second visit. Two stamps, two moods.
    const excuse =
      lostCount > 0
        ? await content.fetch<string | null>(
            `*[_type == "receipt" && submission._ref == $id] | order(issuedAt desc)[0].excuse`,
            {id},
          )
        : null
    const stamps = [
      stamp('department-a', 'approved', params.remarkPedantry, 'pedantry'),
      stamp('department-b', 'approved', params.remarkRubber, 'rubber'),
      excuse ? stamp('department-c', 'lost', excuse, 'archive-lost') : null,
      stamp('department-c', 'filed', params.remarkArchive, 'archive'),
    ].filter((s): s is NonNullable<typeof s> => s !== null)

    await content.createOrReplace({
      _id: `certificate.${id}`,
      _type: 'certificate',
      number,
      submission: {_type: 'reference', _ref: id},
      issuedAt: now,
      ministerNote: clean(params.ministerNote, 'Approved without comment, which is the highest praise.'),
      timesLost: lostCount,
      delays: typeof params.delays === 'number' ? params.delays : 0,
      workflowInstanceId: typeof params.instanceId === 'string' ? params.instanceId : undefined,
      stamps,
    })
    ctx.log(`certificate ${number} issued for ${id}`)
    return {outputs: {certificateNumber: number}}
  }
