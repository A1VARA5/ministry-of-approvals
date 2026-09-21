import type {StructureResolver} from 'sanity/structure'

// Three shelves: what citizens send in, how the Ministry is staffed, and what it produces.
// Workflow definitions and instances (sanity.workflow.*) also live in this dataset; the
// Workflows tool from the plugin is the place to look at those, so they are hidden here.
export const structure: StructureResolver = (S) =>
  S.list()
    .title('The Ministry')
    .items([
      S.listItem()
        .title('Submissions')
        .schemaType('submission')
        .child(
          S.documentTypeList('submission')
            .title('Submissions')
            .defaultOrdering([{field: 'serial', direction: 'desc'}]),
        ),
      S.divider(),
      S.listItem()
        .title('Departments')
        .schemaType('department')
        .child(
          S.documentTypeList('department')
            .title('Departments (corridor order)')
            .defaultOrdering([{field: 'order', direction: 'asc'}]),
        ),
      S.listItem().title('Clerks').schemaType('clerk').child(S.documentTypeList('clerk')),
      S.divider(),
      S.listItem()
        .title('Certificates')
        .schemaType('certificate')
        .child(
          S.documentTypeList('certificate')
            .title('Certificates')
            .defaultOrdering([{field: 'issuedAt', direction: 'desc'}]),
        ),
      S.listItem()
        .title('Lost form receipts')
        .schemaType('receipt')
        .child(
          S.documentTypeList('receipt')
            .title('Lost form receipts')
            .defaultOrdering([{field: 'issuedAt', direction: 'desc'}]),
        ),
    ])
