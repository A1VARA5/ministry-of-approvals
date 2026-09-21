import {defineField, defineType} from 'sanity'
import {CheckmarkCircleIcon} from '@sanity/icons/CheckmarkCircle'

// A certificate is the durable public record that a submission survived the Ministry.
// It is created by the issue-certificate effect handler, never by hand, and it copies the
// clerks' remarks in as stamps so the wall keeps working even if the workflow instance is deleted.
export const certificate = defineType({
  name: 'certificate',
  title: 'Certificate',
  type: 'document',
  icon: CheckmarkCircleIcon,
  readOnly: true,
  fields: [
    defineField({name: 'number', type: 'string', description: 'MoA-2026-0007 style.'}),
    defineField({name: 'submission', type: 'reference', to: [{type: 'submission'}]}),
    defineField({name: 'issuedAt', type: 'datetime'}),
    defineField({name: 'ministerNote', type: 'text', rows: 3}),
    defineField({
      name: 'ministerId',
      type: 'string',
      description: 'Actor id from the workflow history.',
    }),
    defineField({name: 'timesLost', type: 'number'}),
    defineField({
      name: 'workflowInstanceId',
      type: 'string',
      description: 'The instance document that produced this certificate.',
    }),
    defineField({
      name: 'stamps',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'stamp',
          fields: [
            defineField({name: 'department', type: 'reference', to: [{type: 'department'}]}),
            defineField({
              name: 'verdict',
              type: 'string',
              options: {list: ['approved', 'returned', 'lost', 'filed']},
            }),
            defineField({name: 'remark', type: 'text', rows: 2}),
            defineField({name: 'stampedAt', type: 'datetime'}),
          ],
          preview: {select: {title: 'department.name', subtitle: 'remark'}},
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'number', subtitle: 'submission.title'},
  },
})
