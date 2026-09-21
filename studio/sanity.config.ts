import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {workflowDefaultDocumentNode, workflowStudioPlugin} from '@sanity/workflow-studio-plugin'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {StageBadge} from './components/StageBadge'
import {GeneratePortraitAction} from './components/GeneratePortraitAction'
import {DATASET, PROJECT_ID, WORKFLOW_TAG} from './constants'

export default defineConfig({
  name: 'default',
  title: 'The Ministry of Approvals',

  projectId: PROJECT_ID,
  dataset: DATASET,

  plugins: [
    structureTool({
      structure,
      // Adds the Workflows view to every document, the plugin works out which ones apply.
      defaultDocumentNode: workflowDefaultDocumentNode(),
    }),
    workflowStudioPlugin({
      tag: WORKFLOW_TAG,
      // Definitions and instances live in this same dataset, so no workflowDataset needed.
      mappings: [
        {
          docType: 'submission',
          definition: 'ministry-approval',
          label: 'Ministry approval',
          // A submission created in Studio enters the corridor at once. Submissions created by
          // the public site are started by the API route instead (writes outside Studio bypass this).
          autoStart: true,
        },
      ],
    }),
  ],

  document: {
    badges: (previous, context) =>
      context.schemaType === 'submission' ? [StageBadge, ...previous] : previous,
    actions: (previous, context) =>
      context.schemaType === 'clerk' ? [...previous, GeneratePortraitAction] : previous,
  },

  schema: {
    types: schemaTypes,
  },
})
