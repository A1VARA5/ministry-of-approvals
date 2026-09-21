import {useClient} from '@sanity/sdk-react'
import {createEngine, type Engine, type WorkflowInstance} from '@sanity/workflow-engine'
import {useMemo} from 'react'

export const PROJECT_ID = 'v6745vem'
export const DATASET = 'ministry'
export const TAG = 'prod'
export const DEFINITION = 'ministry-approval'
export const WORKFLOW_RESOURCE = {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`} as const

// The corridor, in order. Stage keys come from the workflow definition; the labels here are the
// back office's own. The public names of the departments are content (department documents).
export const STAGES: Array<{key: string; label: string; tone: 'default' | 'primary' | 'positive' | 'caution' | 'critical'; human?: boolean; terminal?: boolean}> = [
  {key: 'intake', label: 'Front Desk', tone: 'default'},
  {key: 'department-a', label: 'Pedantry', tone: 'caution'},
  {key: 'department-b', label: 'Rubber Stamps', tone: 'primary'},
  {key: 'department-c', label: 'The Archive', tone: 'caution'},
  {key: 'minister-review', label: "Minister's Desk", tone: 'critical', human: true},
  {key: 'certified', label: 'Certifying', tone: 'positive'},
  {key: 'on-the-wall', label: 'On the Wall', tone: 'positive', terminal: true},
  {key: 'shredded', label: 'Shredded', tone: 'critical', terminal: true},
]

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key
}

// One engine for the whole app. The App SDK client carries the signed in user's token, so every
// commit made here is recorded in the instance history as that person.
export function useMinistryEngine(): Engine {
  const client = useClient({apiVersion: '2026-07-01'})
  return useMemo(
    () =>
      createEngine({
        client: client.withConfig({dataset: DATASET}),
        workflowResource: WORKFLOW_RESOURCE,
        tag: TAG,
      }),
    [client],
  )
}

// Instance fields are stored as an array of {name, value}. This flattens them for display.
export function fieldMap(instance: WorkflowInstance): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of instance.fields) out[field.name] = field.value
  return out
}

export function subjectDocumentId(instance: WorkflowInstance): string | undefined {
  const subject = fieldMap(instance).subject as {id?: string} | undefined
  const uri = subject?.id
  if (!uri) return undefined
  return uri.slice(uri.lastIndexOf(':') + 1)
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}
