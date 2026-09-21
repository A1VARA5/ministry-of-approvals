import {useDocument, useQuery} from '@sanity/sdk-react'
import {Badge, Box, Button, Card, Dialog, Flex, Select, Stack, Text, TextArea, TextInput, useToast} from '@sanity/ui'
import {AssigneePicker} from '@sanity/workflow-components'
import {WorkflowDiagram} from '@sanity/workflow-diagram'
import {
  actionRendering,
  errorMessage,
  type ActionEvaluation,
  type Assignee,
  type Engine,
  type HistoryEntry,
  type WorkflowEvaluation,
  type WorkflowInstance,
} from '@sanity/workflow-engine'
import {useProjectMembers} from '@sanity/workflow-sdk'
import {useCallback, useEffect, useState} from 'react'
import {PROJECT_ID, ago, stageLabel} from './ministry'

type SubmissionDoc = {
  _id: string
  title?: string
  kind?: string
  body?: string
  citizen?: string
  serial?: number
  amendments?: Array<{_key: string; text: string; inReplyTo?: string; at?: string}>
}

// One file, open on the desk.
//
// The workflow instance is a Sanity document, so the App SDK's own live useDocument keeps it
// current (a clerk reporting in the cloud shows up here within a second). The engine's evaluate
// verb turns that document into what the Minister may do right now, and fireAction / editField
// commit decisions through the same transitions the CLI and the public site use.
//
// Honest note: @sanity/workflow-sdk's useWorkflowSession hung the Dashboard iframe for every
// real instance in this app and I could not get its console, so the session hook is not used here.
export function FileView({
  engine,
  instanceId,
  onClose,
}: {
  engine: Engine
  instanceId: string
  onClose: () => void
}) {
  const {data: instance} = useDocument<WorkflowInstance>({
    documentId: instanceId,
    documentType: 'sanity.workflow.instance',
  })
  const toast = useToast()
  const [evaluation, setEvaluation] = useState<WorkflowEvaluation>()
  const [evalError, setEvalError] = useState<string>()

  // Re-evaluate whenever the instance document changes revision.
  const rev = instance?._rev
  useEffect(() => {
    if (!rev) return
    let cancelled = false
    engine
      .evaluate({instanceId})
      .then((view) => {
        if (cancelled) return
        setEvaluation(view)
        setEvalError(undefined)
      })
      .catch((error) => {
        if (!cancelled) setEvalError(errorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [engine, instanceId, rev])

  const fire = useCallback(
    async (activity: string, action: string, params?: Record<string, unknown>) => {
      try {
        const result = await engine.fireAction({instanceId, activity, action, params})
        toast.push({
          status: 'success',
          title: `${action} recorded`,
          description: result.cascaded ? `Now at ${stageLabel(result.instance.currentStage)}` : undefined,
          closable: true,
        })
      } catch (error) {
        toast.push({status: 'error', title: `${action} failed`, description: errorMessage(error), closable: true})
      }
    },
    [engine, instanceId, toast],
  )

  if (!instance) return <Status text="This file is not in the cabinet." />
  const fields = fieldsOf(instance)
  // The Minister's deadline is a stage scoped field on the current visit. Past it, the
  // Department of Delays hands the file to the Archive on the next tick.
  const currentVisit = instance.stages[instance.stages.length - 1]
  const deadlineValue = instance.currentStage === 'minister-review' ? currentVisit?.fields.find((f) => f.name === 'deadline')?.value : undefined
  const deadline = typeof deadlineValue === 'string' ? deadlineValue : undefined
  const subjectUri = (fields.subject as {id?: string} | undefined)?.id ?? ''
  const subjectId = subjectUri.slice(subjectUri.lastIndexOf(':') + 1)

  return (
    <Stack space={4} padding={4} className="file-view">
      <Flex align="flex-start" gap={3}>
        <Box flex={1}>
          <SubmissionHeader id={subjectId} />
        </Box>
        <Button mode="bleed" text="Close" onClick={onClose} fontSize={1} />
      </Flex>

      <Flex gap={2} align="center" wrap="wrap">
        <Badge tone={instance.completedAt ? 'positive' : 'primary'}>{stageLabel(instance.currentStage)}</Badge>
        {typeof fields.lostCount === 'number' && fields.lostCount > 0 ? (
          <Badge tone="caution">lost {fields.lostCount}x</Badge>
        ) : null}
        {typeof fields.delays === 'number' && fields.delays > 0 ? (
          <Badge tone="critical">delayed {fields.delays}x</Badge>
        ) : null}
        {deadline ? (
          <Badge tone={Date.parse(deadline) < Date.now() ? 'critical' : 'primary'} mode="outline">
            rule by {new Date(deadline).toUTCString().replace(' GMT', ' UTC')}
          </Badge>
        ) : null}
        <Text size={0} muted>
          {instance._id}
        </Text>
      </Flex>

      {evalError ? <Status text={`Could not evaluate the file: ${evalError}`} /> : null}

      {evaluation ? (
        <Card border radius={2} padding={3}>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              The corridor
            </Text>
            <div className="diagram">
              <WorkflowDiagram
                currentStage={instance.currentStage}
                definition={evaluation.definition}
                evaluation={evaluation}
                explain
                history={instance.history}
                key={instance._id}
              />
            </div>
          </Stack>
        </Card>
      ) : null}

      <Remarks fields={fields} />

      {evaluation ? <Actions evaluation={evaluation} fire={fire} /> : <Status text="Evaluating what you may do" />}

      {evaluation ? <MinisterOnDuty engine={engine} instanceId={instanceId} evaluation={evaluation} /> : null}

      <History history={instance.history} />
    </Stack>
  )
}

function Status({text}: {text: string}) {
  return (
    <Box padding={4}>
      <Text muted size={1}>
        {text}
      </Text>
    </Box>
  )
}

function fieldsOf(instance: WorkflowInstance): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of instance.fields) out[field.name] = field.value
  return out
}

function SubmissionHeader({id}: {id: string}) {
  const {data} = useQuery<SubmissionDoc | null>({
    query: `*[_type == "submission" && _id == $id][0]{_id, title, kind, body, citizen, serial, amendments[]{_key, text, inReplyTo, at}}`,
    params: {id},
  })
  if (!data) {
    return (
      <Text size={1} muted>
        Submission {id} is missing. The Archive may know more.
      </Text>
    )
  }
  return (
    <Stack space={3}>
      <Text size={3} weight="semibold">
        {data.serial ? `#${data.serial} ` : ''}
        {data.title}
      </Text>
      <Text size={1} muted>
        A {data.kind ?? 'form'} from {data.citizen ?? 'a citizen'}
      </Text>
      <Card tone="transparent" border radius={2} padding={3}>
        <Text size={1} style={{whiteSpace: 'pre-wrap'}}>
          {data.body}
        </Text>
      </Card>
      {data.amendments?.length ? (
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Amendments
          </Text>
          {data.amendments.map((amendment) => (
            <Card key={amendment._key} tone="caution" radius={2} padding={3}>
              <Stack space={2}>
                {amendment.inReplyTo ? (
                  <Text size={0} muted>
                    In reply to: {amendment.inReplyTo}
                  </Text>
                ) : null}
                <Text size={1}>{amendment.text}</Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}

const REMARK_ROWS: Array<{field: string; label: string}> = [
  {field: 'demand', label: 'Outstanding demand (Pedantry)'},
  {field: 'rejectionReason', label: "Minister's rejection"},
  {field: 'remarkPedantry', label: 'Department of Pedantry'},
  {field: 'remarkRubber', label: 'Department of Rubber Stamps'},
  {field: 'remarkArchive', label: 'The Archive'},
  {field: 'ministerNote', label: "Minister's note"},
]

function Remarks({fields}: {fields: Record<string, unknown>}) {
  const rows = REMARK_ROWS.filter((row) => typeof fields[row.field] === 'string' && fields[row.field])
  if (rows.length === 0) return null
  return (
    <Card border radius={2} padding={3}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Remarks on file
        </Text>
        {rows.map((row) => (
          <Stack key={row.field} space={1}>
            <Text size={0} muted>
              {row.label}
            </Text>
            <Text size={1}>{String(fields[row.field])}</Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  )
}

function Actions({
  evaluation,
  fire,
}: {
  evaluation: WorkflowEvaluation
  fire: (activity: string, action: string, params?: Record<string, unknown>) => Promise<void>
}) {
  const [dialog, setDialog] = useState<{activity: string; action: ActionEvaluation}>()
  const activities = evaluation.currentStage.activities
  const buttons = activities.flatMap((activity) =>
    activity.actions
      .map((action) => ({activity: activity.activity.name, action, rendering: actionRendering(action)}))
      .filter((row) => row.rendering !== 'absent'),
  )
  if (buttons.length === 0) {
    return (
      <Card border radius={2} padding={3} tone="transparent">
        <Text size={1} muted>
          Nothing to do here. {evaluation.instance.completedAt ? 'This file is closed.' : 'A clerk is on it.'}
        </Text>
      </Card>
    )
  }
  return (
    <Card border radius={2} padding={3}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Rulings available to you
        </Text>
        <Flex gap={2} wrap="wrap">
          {buttons.map(({activity, action, rendering}) => {
            const title = action.action.title ?? action.action.name
            if (rendering === 'automation') {
              return (
                <Badge key={action.action.name} mode="outline">
                  {title}: runs by itself
                </Badge>
              )
            }
            const needsParams = (action.action.params?.length ?? 0) > 0
            const name = action.action.name
            return (
              <Button
                key={name}
                disabled={!action.allowed}
                mode={name === 'approve' ? 'default' : 'ghost'}
                tone={name === 'approve' ? 'positive' : name === 'reject' || name === 'withdraw' ? 'critical' : 'default'}
                text={title}
                title={action.allowed ? undefined : 'Not allowed right now'}
                onClick={() => (needsParams ? setDialog({activity, action}) : void fire(activity, name))}
              />
            )
          })}
        </Flex>
      </Stack>
      {dialog ? (
        <ParamsDialog
          activity={dialog.activity}
          action={dialog.action}
          onClose={() => setDialog(undefined)}
          onSubmit={async (params) => {
            setDialog(undefined)
            await fire(dialog.activity, dialog.action.action.name, params)
          }}
        />
      ) : null}
    </Card>
  )
}

type Param = {
  name: string
  title?: string
  type: string
  required?: boolean
  options?: {list?: Array<{title?: string; value: string} | string>}
}

// A generic dialog for any action that declares params: text for strings, a select when the
// param carries an options list. The definition is the single source of what to ask for.
function ParamsDialog({
  activity,
  action,
  onClose,
  onSubmit,
}: {
  activity: string
  action: ActionEvaluation
  onClose: () => void
  onSubmit: (params: Record<string, unknown>) => Promise<void>
}) {
  const params = (action.action.params ?? []) as Param[]
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const param of params) {
      const first = param.options?.list?.[0]
      if (first) initial[param.name] = typeof first === 'string' ? first : first.value
    }
    return initial
  })
  const missing = params.filter((param) => param.required && !values[param.name]?.trim())
  const title = action.action.title ?? action.action.name
  const longText = new Set(['note', 'reason', 'amendment'])
  return (
    <Dialog header={title} id={`dialog-${activity}-${action.action.name}`} onClose={onClose} width={1}>
      <Box padding={4}>
        <Stack space={4}>
          {params.map((param) => (
            <Stack key={param.name} space={2}>
              <Text size={1} weight="medium">
                {param.title ?? param.name}
                {param.required ? ' *' : ''}
              </Text>
              {param.options?.list ? (
                <Select
                  value={values[param.name] ?? ''}
                  onChange={(event) => setValues({...values, [param.name]: event.currentTarget.value})}
                >
                  {param.options.list.map((option) => {
                    const value = typeof option === 'string' ? option : option.value
                    const label = typeof option === 'string' ? option : (option.title ?? option.value)
                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  })}
                </Select>
              ) : longText.has(param.name) ? (
                <TextArea
                  rows={4}
                  value={values[param.name] ?? ''}
                  onChange={(event) => setValues({...values, [param.name]: event.currentTarget.value})}
                />
              ) : (
                <TextInput
                  value={values[param.name] ?? ''}
                  onChange={(event) => setValues({...values, [param.name]: event.currentTarget.value})}
                />
              )}
            </Stack>
          ))}
          <Flex gap={2} justify="flex-end">
            <Button mode="ghost" text="Cancel" onClick={onClose} />
            <Button
              tone="primary"
              text={title}
              disabled={missing.length > 0}
              onClick={() => {
                const out: Record<string, unknown> = {}
                for (const param of params) if (values[param.name]?.trim()) out[param.name] = values[param.name].trim()
                void onSubmit(out)
              }}
            />
          </Flex>
        </Stack>
      </Box>
    </Dialog>
  )
}

// The workflow's `minister` assignee field, edited through the engine so it lands in history.
function MinisterOnDuty({
  engine,
  instanceId,
  evaluation,
}: {
  engine: Engine
  instanceId: string
  evaluation: WorkflowEvaluation
}) {
  const members = useProjectMembers(PROJECT_ID)
  const toast = useToast()
  const field = evaluation.editableFields.find((entry) => entry.name === 'minister')
  if (!field) return null
  const value = (Array.isArray(field.value) ? field.value : []) as readonly Assignee[]
  return (
    <Card border radius={2} padding={3}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Minister on duty for this file
        </Text>
        <AssigneePicker
          {...members}
          value={value}
          maxUsers={1}
          onChange={async (next: readonly Assignee[]) => {
            try {
              await engine.editField({instanceId, target: {scope: 'workflow', field: 'minister'}, mode: 'set', value: next})
            } catch (error) {
              toast.push({status: 'error', title: 'Could not assign', description: errorMessage(error), closable: true})
            }
          }}
        />
        {!field.editable ? (
          <Text size={0} muted>
            Not editable at this stage.
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}

function History({history}: {history: readonly HistoryEntry[]}) {
  const rows = history
    .filter((entry) => entry._type === 'stageEntered' || entry._type === 'actionFired' || entry._type === 'effectCompleted')
    .slice(-25)
    .reverse()
  return (
    <Card border radius={2} padding={3}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Audit trail ({history.length} entries)
        </Text>
        {rows.map((entry) => (
          <Flex key={entry._key} gap={2} align="flex-start">
            <Box style={{minWidth: 44}}>
              <Text size={0} muted>
                {ago(entry.at)}
              </Text>
            </Box>
            <Text size={1}>{describe(entry)}</Text>
          </Flex>
        ))}
      </Stack>
    </Card>
  )
}

// Who did it: the execution context tells the runtime apart (the clerks run in a Sanity Function,
// the public site is a server, the CLI and this app are people), the actor only says "person".
function whoDidIt(entry: HistoryEntry): string {
  const context = entry.executionContext
  if (context?.kind === 'drainer') return 'the clerks (Function)'
  if (context?.kind === 'server') return 'the Front Desk (site)'
  if (context?.kind === 'mcp') return 'an agent'
  const actor = 'actor' in entry ? entry.actor : undefined
  if (actor?.kind === 'person') return 'a person'
  return actor?.kind ?? 'the engine'
}

function describe(entry: HistoryEntry): string {
  const who = whoDidIt(entry)
  switch (entry._type) {
    case 'stageEntered':
      return `Entered ${stageLabel(entry.stage)}${entry.fromStage ? ` from ${stageLabel(entry.fromStage)}` : ''}`
    case 'actionFired':
      return `${entry.action} fired on ${entry.activity} by ${who}`
    case 'effectCompleted':
      return `Effect ${entry.effect} completed (${who})`
    default:
      return entry._type
  }
}
