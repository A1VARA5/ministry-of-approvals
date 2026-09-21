import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons/User'
import {TemperamentInput} from '../components/TemperamentInput'

// A clerk is an AI personality stored as content. The workflow effect handler reads the clerk's
// systemPrompt at run time, so an editor can make a department stricter or lazier without a deploy.
// The temperament slider rewrites the prompt; the prompt stays editable by hand afterwards.
export const clerk = defineType({
  name: 'clerk',
  title: 'Clerk',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Kind of clerk',
      type: 'string',
      description: 'Which effect handler this clerk drives. One clerk per kind is enough.',
      options: {
        list: [
          {title: 'Pedantic (demands what is missing)', value: 'pedantic'},
          {title: 'Rubber stamp (approves everything)', value: 'rubberStamp'},
          {title: 'Archivist (loses every third form)', value: 'archivist'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'temperament',
      type: 'number',
      description: '0 is a rubber stamp, 100 is a stickler. Moving it rewrites the system prompt below.',
      initialValue: 50,
      validation: (rule) => rule.min(0).max(100),
      components: {input: TemperamentInput},
    }),
    defineField({
      name: 'systemPrompt',
      type: 'text',
      rows: 8,
      description:
        'Sent verbatim to the model as the clerk. Keep it under 1200 characters, Agent Actions cap the whole instruction at 2000 once the form is added.',
      validation: (rule) => rule.required().max(1200),
    }),
    defineField({
      name: 'catchphrase',
      type: 'string',
      description: 'Printed on the stamp.',
    }),
    defineField({
      name: 'portrait',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'role', media: 'portrait'},
  },
})
