import {useClient} from '@sanity/sdk-react'
import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {errorMessage, type Engine, type WorkflowInstance} from '@sanity/workflow-engine'
import {useWorkflowInstances} from '@sanity/workflow-sdk'
import {useEffect, useMemo, useState} from 'react'
import {DEFINITION, STAGES, ago, fieldMap, subjectDocumentId} from './ministry'

type SubmissionRow = {_id: string; title?: string; citizen?: string; serial?: number; kind?: string}

// The corridor: one column per stage, every instance as a card. useWorkflowInstances is live, so
// a form moves between columns the moment a clerk or the Minister acts, no polling.
export function Board({
  engine,
  selectedId,
  onSelect,
}: {
  engine: Engine
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const {instances, loading, error, unreadable} = useWorkflowInstances({
    engine,
    filter: {definition: DEFINITION, includeCompleted: true},
  })

  // Submission titles for the cards, fetched once per distinct set of subject ids. Kept out of
  // useQuery so a live instance update never suspends the whole board.
  const idKey = (instances ?? [])
    .map(subjectDocumentId)
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(',')
  const client = useClient({apiVersion: '2026-07-01'})
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  useEffect(() => {
    if (!idKey) return
    let cancelled = false
    client
      .fetch<SubmissionRow[]>(`*[_type == "submission" && _id in $ids]{_id, title, citizen, serial, kind}`, {ids: idKey.split(',')})
      .then((rows) => {
        if (!cancelled) setSubmissions(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [client, idKey])
  const byId = useMemo(() => new Map(submissions.map((row) => [row._id, row])), [submissions])

  if (error) {
    return (
      <Box padding={4}>
        <Text>Could not read the corridor: {errorMessage(error)}</Text>
      </Box>
    )
  }
  if (loading || !instances) {
    return (
      <Box padding={4}>
        <Text muted>Reading the corridor</Text>
      </Box>
    )
  }

  const grouped = new Map<string, WorkflowInstance[]>()
  for (const stage of STAGES) grouped.set(stage.key, [])
  for (const instance of instances) {
    const list = grouped.get(instance.currentStage) ?? []
    list.push(instance)
    grouped.set(instance.currentStage, list)
  }

  return (
    <Stack space={3} padding={3}>
      {unreadable.length > 0 ? (
        <Text muted size={1}>
          {unreadable.length} form(s) could not be read by this version of the back office.
        </Text>
      ) : null}
      <Flex gap={3} className="corridor">
        {STAGES.map((stage) => {
          const rows = (grouped.get(stage.key) ?? []).slice().sort((a, b) => {
            const la = latestEntry(a)
            const lb = latestEntry(b)
            return lb.localeCompare(la)
          })
          return (
            <Card key={stage.key} className="corridor-column" radius={2} tone={stage.tone} border>
              <Box padding={3} className="corridor-column-head">
                <Flex align="center" gap={2}>
                  <Text size={1} weight="semibold">
                    {stage.label}
                  </Text>
                  <Badge fontSize={0} mode="outline">
                    {rows.length}
                  </Badge>
                  {stage.human ? (
                    <Badge fontSize={0} tone="critical">
                      human
                    </Badge>
                  ) : null}
                </Flex>
              </Box>
              <Stack space={2} padding={2}>
                {rows.map((instance) => (
                  <FormCard
                    key={instance._id}
                    instance={instance}
                    submission={byId.get(subjectDocumentId(instance) ?? '')}
                    selected={instance._id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
                {rows.length === 0 ? (
                  <Box padding={2}>
                    <Text size={0} muted>
                      empty
                    </Text>
                  </Box>
                ) : null}
              </Stack>
            </Card>
          )
        })}
      </Flex>
    </Stack>
  )
}

function latestEntry(instance: WorkflowInstance): string {
  const stage = instance.stages[instance.stages.length - 1]
  return stage?.enteredAt ?? instance.startedAt ?? ''
}

function FormCard({
  instance,
  submission,
  selected,
  onSelect,
}: {
  instance: WorkflowInstance
  submission?: SubmissionRow
  selected: boolean
  onSelect: (id: string) => void
}) {
  const fields = fieldMap(instance)
  const lost = typeof fields.lostCount === 'number' ? fields.lostCount : 0
  const demand = typeof fields.demand === 'string' ? fields.demand : undefined
  const rejection = typeof fields.rejectionReason === 'string' ? fields.rejectionReason : undefined
  const entered = latestEntry(instance)
  return (
    <button type="button" className={`form-card${selected ? ' is-selected' : ''}`} onClick={() => onSelect(instance._id)}>
      <Card padding={3} radius={2} shadow={selected ? 2 : 1} tone={selected ? 'primary' : 'default'}>
      <Stack space={2}>
        <Text size={1} weight="medium" textOverflow="ellipsis">
          {submission?.serial ? `#${submission.serial} ` : ''}
          {submission?.title ?? 'Untitled form'}
        </Text>
        <Text size={0} muted>
          {submission?.citizen ?? 'unknown citizen'} · {submission?.kind ?? 'form'} · {entered ? `${ago(entered)} here` : ''}
        </Text>
        <Flex gap={1} wrap="wrap">
          {lost > 0 ? (
            <Badge fontSize={0} tone="caution">
              lost {lost}x
            </Badge>
          ) : null}
          {demand ? (
            <Badge fontSize={0} tone="critical">
              returned
            </Badge>
          ) : null}
          {rejection ? (
            <Badge fontSize={0} tone="critical">
              rejected
            </Badge>
          ) : null}
          {instance.completedAt ? (
            <Badge fontSize={0} mode="outline">
              done
            </Badge>
          ) : null}
        </Flex>
      </Stack>
      </Card>
    </button>
  )
}
