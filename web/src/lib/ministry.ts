import {createClient} from '@sanity/client'
import {createEngine, ENGINE_API_VERSION, refDataset} from '@sanity/workflow-engine'

// Server side only. The project denies anonymous reads (found on day one of Bot Lawyer), so
// even the public wall reads with a token. Nothing here is imported by client scripts.
export const PROJECT_ID = 'v6745vem'
export const DATASET = 'ministry'
export const TAG = 'prod'
export const DEFINITION = 'ministry-approval'

const token = import.meta.env.SANITY_API_TOKEN as string | undefined
if (!token) throw new Error('SANITY_API_TOKEN is not set')

export const content = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-07-01',
  token,
  useCdn: false,
})

const engineClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: ENGINE_API_VERSION,
  token,
  useCdn: false,
  perspective: 'raw',
})

// No effect handlers here: the site only starts runs and fires the citizen's actions. The
// clerks run in the Sanity Function. History records these commits as the site's server context.
export const engine = createEngine({
  client: engineClient,
  workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
  tag: TAG,
  executionContext: {kind: 'server', id: 'ministry-site'},
})

export function subjectRef(documentId: string) {
  return refDataset({projectId: PROJECT_ID, dataset: DATASET, documentId, type: 'submission'})
}

export function gdrFor(documentId: string) {
  return `dataset:${PROJECT_ID}:${DATASET}:${documentId}`
}

export type Department = {
  _id: string
  name: string
  stage: string
  motto?: string
  order: number
  stampColor?: string
  clerk?: {name: string; catchphrase?: string; role?: string; portraitUrl?: string}
}

export type Submission = {
  _id: string
  title: string
  kind: string
  body: string
  citizen: string
  serial?: number
  submittedAt?: string
  imageUrl?: string
  amendments?: Array<{_key: string; text: string; inReplyTo?: string; at?: string}>
}

export type InstanceRow = {
  _id: string
  currentStage: string
  startedAt?: string
  completedAt?: string | null
  fields: Array<{name: string; value: unknown}>
  stages: Array<{name: string; enteredAt: string; exitedAt?: string; fields?: Array<{name: string; value: unknown}>}>
  history: Array<{_type: string; at: string; stage?: string; action?: string; activity?: string; effect?: string; fromStage?: string}>
}

export const DEPARTMENTS_QUERY = `*[_type == "department"] | order(order asc){
  _id, name, stage, motto, order, stampColor, clerk->{name, catchphrase, role, "portraitUrl": portrait.asset->url}
}`

export const SUBMISSION_QUERY = `*[_type == "submission" && _id == $id][0]{
  _id, title, kind, body, citizen, serial, submittedAt, "imageUrl": image.asset->url, amendments[]{_key, text, inReplyTo, at}
}`

// The workflow instance is a document in the same dataset, so the status page is one GROQ query
// away from the engine's own record: no status field mirrored onto the submission.
export const INSTANCE_QUERY = `*[_type == "sanity.workflow.instance" && tag == $tag && definition == $definition
  && fields[name == "subject"][0].value.id == $gdr] | order(startedAt desc)[0]{
  _id, currentStage, startedAt, completedAt,
  "fields": fields[]{name, value},
  "stages": stages[]{name, enteredAt, exitedAt, "fields": fields[]{name, value}},
  "history": history[_type in ["stageEntered", "actionFired", "effectCompleted"]]{_type, at, stage, action, activity, effect, fromStage}
}`

export function fieldMap(instance: InstanceRow | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of instance?.fields ?? []) out[field.name] = field.value
  return out
}

export async function loadDepartments(): Promise<Department[]> {
  return content.fetch<Department[]>(DEPARTMENTS_QUERY)
}

export async function loadStatus(id: string) {
  const [submission, instance, departments] = await Promise.all([
    content.fetch<Submission | null>(SUBMISSION_QUERY, {id}),
    content.fetch<InstanceRow | null>(INSTANCE_QUERY, {tag: TAG, definition: DEFINITION, gdr: gdrFor(id)}),
    loadDepartments(),
  ])
  return {submission, instance, departments}
}

export function stageTitle(stage: string, departments: Department[]): string {
  const dept = departments.find((d) => d.stage === stage)
  if (dept) return dept.name
  return {'on-the-wall': 'On the Wall', shredded: 'The Shredder'}[stage] ?? stage
}

export const STAGE_ORDER = ['intake', 'department-a', 'department-b', 'department-c', 'minister-review', 'certified', 'on-the-wall']

export const KIND_LABELS: Record<string, string> = {meme: 'A meme', name: 'A name', plan: 'A plan', idea: 'An idea', complaint: 'A complaint', other: 'A form'}
export const kindLabel = (kind?: string) => KIND_LABELS[kind ?? 'other'] ?? 'A form'

export const CERTIFICATE_PROJECTION = `{
  _id, number, issuedAt, ministerNote, timesLost, delays,
  submission->{_id, title, citizen, kind, serial, "imageUrl": image.asset->url},
  stamps[]{_key, verdict, remark, department->{name, stampColor}}
}`

export function noDashes(text: string): string {
  return text.replace(/[–—]/g, ',')
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}
