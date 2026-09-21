import type {APIRoute} from 'astro'
import {errorMessage} from '@sanity/workflow-engine'
import {DEFINITION, TAG, content, engine, gdrFor, noDashes} from '../../lib/ministry'

export const prerender = false

// The citizen's two actions at the Front Desk: resubmit with an amendment, or withdraw. Both go
// through the same engine verb the Minister and the CLI use, so the audit trail is one list.
export const POST: APIRoute = async ({request, redirect}) => {
  const form = await request.formData()
  const id = String(form.get('id') ?? '')
  const action = String(form.get('action') ?? '')
  if (!id || !['resubmit', 'withdraw'].includes(action)) return new Response('Unknown action', {status: 400})

  const instanceId = await content.fetch<string | null>(
    `*[_type == "sanity.workflow.instance" && tag == $tag && definition == $definition && fields[name == "subject"][0].value.id == $gdr && !defined(completedAt)] | order(startedAt desc)[0]._id`,
    {tag: TAG, definition: DEFINITION, gdr: gdrFor(id)},
  )
  if (!instanceId) return new Response('No open file for that submission', {status: 404})

  const params =
    action === 'resubmit'
      ? {amendment: noDashes(String(form.get('amendment') ?? '').trim()).slice(0, 1000)}
      : undefined
  if (action === 'resubmit' && !params?.amendment) return new Response('An amendment needs words', {status: 400})

  try {
    await engine.fireAction({instanceId, activity: 'receive', action, params})
  } catch (error) {
    return new Response(`The Front Desk refused: ${errorMessage(error)}`, {status: 409})
  }
  return redirect(`/status/${encodeURIComponent(id)}`, 303)
}
