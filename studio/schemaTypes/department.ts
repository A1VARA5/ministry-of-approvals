import {defineField, defineType} from 'sanity'
import {HomeIcon} from '@sanity/icons/Home'

// A department is one stage of the workflow, described as content: its name, motto, clerk and stamp.
// The workflow definition only knows stage keys (department-a, department-b, department-c).
// Everything a citizen sees about a department comes from here, so renaming the Department of
// Pedantry is an edit, not a redeploy.
export const department = defineType({
  name: 'department',
  title: 'Department',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'name'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'stage',
      title: 'Workflow stage',
      type: 'string',
      description: 'The stage key in the ministry-approval workflow this department handles.',
      options: {
        list: [
          {title: 'intake (Front Desk)', value: 'intake'},
          {title: 'department-a', value: 'department-a'},
          {title: 'department-b', value: 'department-b'},
          {title: 'department-c', value: 'department-c'},
          {title: 'minister-review', value: 'minister-review'},
          {title: 'certified', value: 'certified'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'motto',
      type: 'string',
      description: 'Shown under the department name on the status page.',
    }),
    defineField({
      name: 'clerk',
      type: 'reference',
      to: [{type: 'clerk'}],
      description: 'Empty for human stages.',
    }),
    defineField({
      name: 'order',
      type: 'number',
      description: 'Position along the corridor.',
      validation: (rule) => rule.required().integer(),
    }),
    defineField({
      name: 'stampColor',
      type: 'string',
      description: 'Ink colour of the stamp, as a CSS colour.',
      initialValue: '#b3261e',
    }),
  ],
  orderings: [{title: 'Corridor order', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'name', subtitle: 'motto'},
  },
})
