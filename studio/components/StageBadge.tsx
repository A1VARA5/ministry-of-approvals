import {useMemo} from 'react'
import {gdrUri} from '@sanity/workflow-engine'
import {useDocumentWorkflows, useWorkflowEngine} from '@sanity/workflow-studio'
import {useClient, type DocumentBadgeComponent} from 'sanity'
import {DATASET, PROJECT_ID, WORKFLOW_TAG} from '../constants'

// Document badge on submissions: which department the form is sitting in right now.
// Reads the live workflow instance through the Studio adapter, no status field on the document.
const workflowResource = {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`} as const

const STAGE_LABELS: Record<string, {label: string; color: 'primary' | 'success' | 'warning' | 'danger'}> = {
  intake: {label: 'Front Desk', color: 'primary'},
  'department-a': {label: 'Dept. of Pedantry', color: 'warning'},
  'department-b': {label: 'Dept. of Rubber Stamps', color: 'primary'},
  'department-c': {label: 'The Archive', color: 'warning'},
  'minister-review': {label: "Minister's Desk", color: 'danger'},
  certified: {label: 'Certifying', color: 'success'},
  'on-the-wall': {label: 'On the Wall', color: 'success'},
  shredded: {label: 'Shredded', color: 'danger'},
}

export const StageBadge: DocumentBadgeComponent = (props) => {
  const engine = useWorkflowEngine({workflowResource, tag: WORKFLOW_TAG})
  const client = useClient({apiVersion: '2026-07-01'})
  const {projectId, dataset} = client.config()
  const document = useMemo(
    () =>
      gdrUri({
        scheme: 'dataset',
        projectId: projectId ?? PROJECT_ID,
        dataset: dataset ?? DATASET,
        documentId: props.id,
      }),
    [dataset, projectId, props.id],
  )
  const {instances, loading} = useDocumentWorkflows({engine, document})
  const instance = instances?.find((candidate) => candidate.definition === 'ministry-approval')

  if (loading || !instance) return null
  const stage = STAGE_LABELS[instance.currentStage] ?? {label: instance.currentStage, color: 'primary' as const}
  return {label: stage.label, title: `Workflow stage: ${instance.currentStage}`, color: stage.color}
}
