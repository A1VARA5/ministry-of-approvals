import type {WorkflowDeploymentInput} from '@sanity/workflow-engine'
import {defineWorkflowConfig} from '@sanity/workflow-engine/define'
import {ministryApproval} from './src/definition.ts'

// One deployment. Definitions and instances live in the ministry dataset next to the content,
// so the subject references need no alias.
export const production = {
  name: 'production',
  tag: 'prod',
  expectedMinReaderModel: 10,
  workflowResource: {type: 'dataset', id: 'v6745vem.ministry'},
  definitions: [ministryApproval],
} satisfies WorkflowDeploymentInput

export default defineWorkflowConfig({deployments: [production]})
