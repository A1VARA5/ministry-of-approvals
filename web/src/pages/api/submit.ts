import type {APIRoute} from 'astro'
import {DEFINITION, content, engine, noDashes, subjectRef} from '../../lib/ministry'

export const prerender = false

// Creates a published submission (subjects must be published ids), assigns the next serial, and
// starts the workflow. Rate limited per IP so the clerks are not flooded with Agent Actions.
const KINDS = new Set(['meme', 'name', 'plan', 'idea', 'complaint', 'other'])
const recent = new Map<string, number[]>()

function limited(ip: string): boolean {
  const now = Date.now()
  const stamps = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  if (stamps.length >= 5) return true
  stamps.push(now)
  recent.set(ip, stamps)
  return false
}

export const POST: APIRoute = async ({request, clientAddress, redirect}) => {
  const form = await request.formData()
  const title = noDashes(String(form.get('title') ?? '').trim()).slice(0, 120)
  const body = noDashes(String(form.get('body') ?? '').trim()).slice(0, 2000)
  const citizen = noDashes(String(form.get('citizen') ?? '').trim()).slice(0, 40)
  const kindRaw = String(form.get('kind') ?? 'other')
  const kind = KINDS.has(kindRaw) ? kindRaw : 'other'
  if (!title || !body || !citizen) {
    return new Response('A form needs a title, a body and a citizen. This is a ministry, not a suggestion box.', {status: 400})
  }
  if (limited(clientAddress ?? 'unknown')) {
    return new Response('Five forms per ten minutes per citizen. The clerks are only human, except the ones that are not.', {status: 429})
  }

  // Exhibit A: an optional image, uploaded to the Content Lake as an asset before the document
  // is created so the reference is on the published document from the start.
  const upload = form.get('image')
  let image: {_type: 'image'; asset: {_type: 'reference'; _ref: string}} | undefined
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 4 * 1024 * 1024) return new Response('Exhibit A is over 4 MB. The scanner refuses.', {status: 400})
    if (!/^image\/(png|jpeg|gif|webp)$/.test(upload.type)) return new Response('Exhibit A must be an image.', {status: 400})
    const asset = await content.assets.upload('image', Buffer.from(await upload.arrayBuffer()), {
      filename: upload.name || 'exhibit-a',
      contentType: upload.type,
    })
    image = {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}
  }

  const max = await content.fetch<number | null>(`math::max(*[_type == "submission" && defined(serial)].serial)`)
  const serial = (max ?? 0) + 1
  const id = `submission.${serial}-${Math.random().toString(36).slice(2, 8)}`
  await content.create({
    _id: id,
    _type: 'submission',
    title,
    kind,
    body,
    citizen,
    serial,
    submittedAt: new Date().toISOString(),
    ...(image ? {image} : {}),
  })

  await engine.startInstance({
    definition: DEFINITION,
    initialFields: [{type: 'subject', name: 'subject', value: subjectRef(id)}],
  })

  return redirect(`/status/${encodeURIComponent(id)}`, 303)
}
