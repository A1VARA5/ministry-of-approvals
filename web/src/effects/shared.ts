// GENERATED from workflows/src/effects/shared.ts. Do not edit here; run npm run sync-effects.
import type {SanityClient} from '@sanity/client'
import {extractDocumentId, type EffectHandler} from '@sanity/workflow-engine'

// Everything a handler needs that is not in its params: a content client with a write token
// (Agent Actions need apiVersion vX) and the Discord webhook for the announcement.
export type HandlerDeps = {
  content: SanityClient
  discordWebhookUrl?: string
  siteUrl?: string
}

export type HandlerFactory = (deps: HandlerDeps) => EffectHandler

export function subjectId(params: Record<string, unknown>): string {
  if (typeof params.subject !== 'string') throw new Error('subject must be a GDR URI')
  return extractDocumentId(params.subject)
}

export type SubmissionRow = {
  _id: string
  title: string
  kind: string
  body: string
  citizen: string
  serial?: number
  amendments?: Array<{text: string; inReplyTo?: string; at?: string}>
}

export const SUBMISSION_PROJECTION = `{_id, title, kind, body, citizen, serial, amendments[]{text, inReplyTo, at}}`

export async function fetchSubmission(content: SanityClient, id: string): Promise<SubmissionRow> {
  const row = await content.fetch<SubmissionRow | null>(
    `*[_type == "submission" && _id == $id][0]${SUBMISSION_PROJECTION}`,
    {id},
  )
  if (!row) throw new Error(`submission ${id} not found`)
  return row
}

// Serial numbers are assigned by the site on submit. A form created in Studio has none, so the
// first department assigns the next one. setIfMissing keeps a retry from handing out two.
export async function ensureSerial(content: SanityClient, row: SubmissionRow): Promise<number> {
  if (typeof row.serial === 'number') return row.serial
  const max = await content.fetch<number | null>(
    `math::max(*[_type == "submission" && defined(serial)].serial)`,
  )
  const next = (max ?? 0) + 1
  await content.patch(row._id).setIfMissing({serial: next}).commit()
  const after = await content.fetch<number>(`*[_id == $id][0].serial`, {id: row._id})
  return after ?? next
}

export function clean(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  // No em or en dashes anywhere in the Ministry, including what the clerks say.
  return (text || fallback).replace(/[–—]/g, ',').slice(0, 400)
}

// Ids in the Content Lake allow letters, digits, dots, dashes and underscores.
export function safeId(prefix: string, key: string): string {
  return `${prefix}.${key.replace(/[^a-zA-Z0-9._-]/g, '-')}`
}
