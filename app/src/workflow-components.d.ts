// @sanity/workflow-components 0.33.0 declares "types": "./dist/index.d.ts" but the file is not in
// the published package, so the whole module is `any`. Minimal typing for what the back office
// uses, plus the ProjectMembersState shape that @sanity/workflow-sdk re-imports from here.
declare module '@sanity/workflow-components' {
  import type {Assignee} from '@sanity/workflow-engine'
  import type {ReactElement} from 'react'

  export interface ProjectMembersState {
    members: readonly unknown[]
    roles: readonly unknown[]
    loading: boolean
    error: unknown
  }

  export function AssigneePicker(
    props: ProjectMembersState & {
      value: readonly Assignee[]
      onChange: (next: readonly Assignee[]) => void
      maxUsers?: number
    },
  ): ReactElement
}
