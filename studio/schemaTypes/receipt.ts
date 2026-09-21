import {defineField, defineType} from 'sanity'
import {TrashIcon} from '@sanity/icons/Trash'

// A receipt is what the Archive hands you when it loses your form. Written by the clerk-archive
// effect handler with the effect key in its id, so a retried effect cannot issue two receipts.
export const receipt = defineType({
  name: 'receipt',
  title: 'Lost form receipt',
  type: 'document',
  icon: TrashIcon,
  readOnly: true,
  fields: [
    defineField({name: 'number', type: 'string'}),
    defineField({name: 'submission', type: 'reference', to: [{type: 'submission'}]}),
    defineField({name: 'issuedAt', type: 'datetime'}),
    defineField({name: 'excuse', type: 'text', rows: 3, description: 'The Archive explains itself.'}),
    defineField({
      name: 'lostCount',
      type: 'number',
      description: 'How many times this form has been lost so far.',
    }),
    defineField({name: 'effectKey', type: 'string'}),
  ],
  preview: {
    select: {title: 'number', subtitle: 'excuse'},
  },
})
