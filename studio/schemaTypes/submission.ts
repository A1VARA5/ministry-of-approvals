import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons/Document'

// A submission is the subject of one workflow run. It holds only what the citizen wrote.
// Where it is in the process is not stored here: that lives in the workflow instance document
// next to it, which is the point of Workflows. Serial numbers make the Archive deterministic.
export const submission = defineType({
  name: 'submission',
  title: 'Submission',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      description: 'What the citizen wants approved.',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: {
        list: [
          {title: 'Meme', value: 'meme'},
          {title: 'Name for something', value: 'name'},
          {title: 'Plan', value: 'plan'},
          {title: 'Idea', value: 'idea'},
          {title: 'Complaint', value: 'complaint'},
          {title: 'Other', value: 'other'},
        ],
      },
      initialValue: 'other',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      type: 'text',
      rows: 6,
      description: 'The submission itself. The clerks read this.',
      validation: (rule) => rule.required().max(2000),
    }),
    defineField({
      name: 'image',
      type: 'image',
      options: {hotspot: true},
      description: 'Optional. Memes usually have one.',
    }),
    defineField({
      name: 'citizen',
      type: 'string',
      description: 'A handle. No accounts here, this is a ministry, not a bank.',
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: 'serial',
      type: 'number',
      description: 'Assigned at the front desk. The Archive loses every third serial.',
      readOnly: true,
    }),
    defineField({
      name: 'submittedAt',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'amendments',
      type: 'array',
      description: 'What the citizen added after a department sent the form back.',
      of: [
        {
          type: 'object',
          name: 'amendment',
          fields: [
            defineField({name: 'text', type: 'text', rows: 3, validation: (rule) => rule.required()}),
            defineField({
              name: 'inReplyTo',
              type: 'string',
              description: 'The demand or reason being answered.',
            }),
            defineField({name: 'at', type: 'datetime'}),
          ],
          preview: {select: {title: 'text', subtitle: 'inReplyTo'}},
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title', citizen: 'citizen', media: 'image', serial: 'serial'},
    prepare({title, citizen, media, serial}) {
      return {
        title: serial ? `#${serial} ${title}` : title,
        subtitle: citizen ? `by ${citizen}` : undefined,
        media,
      }
    },
  },
})
