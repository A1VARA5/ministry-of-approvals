import {
  publishDocument,
  useApplyDocumentActions,
  useDocument,
  useDocumentSyncStatus,
  useDocuments,
  useEditDocument,
  useQuery,
  type DocumentHandle,
} from '@sanity/sdk-react'
import {Badge, Box, Button, Card, Flex, Grid, Stack, Text, TextArea, useToast} from '@sanity/ui'
import {errorMessage} from '@sanity/workflow-engine'
import {Suspense} from 'react'

// The staff register: the three AI clerks, editable live. Their system prompts are content, so
// changing one here changes how the next form is treated, once it is published (the effect
// handlers read the published clerk documents, never drafts).
export function Staff() {
  const {data: clerks} = useDocuments({documentType: 'clerk', orderings: [{field: 'role', direction: 'asc'}]})
  return (
    <Box padding={4}>
      <Stack space={4}>
        <Text size={1} muted>
          Edits are drafts until you publish. The clerks act on the published prompt.
        </Text>
        <Grid columns={[1, 1, 3]} gap={3}>
          {clerks.map((handle) => (
            <Suspense key={handle.documentId} fallback={<Card border padding={3}><Text muted size={1}>Loading clerk</Text></Card>}>
              <ClerkCard handle={handle} />
            </Suspense>
          ))}
        </Grid>
      </Stack>
    </Box>
  )
}

const BANDS = [
  {max: 20, label: 'Rubber stamp'},
  {max: 40, label: 'Easygoing'},
  {max: 60, label: 'By the book'},
  {max: 80, label: 'Pedantic'},
  {max: 100, label: 'Stickler'},
]

function ClerkCard({handle}: {handle: DocumentHandle}) {
  const {data: name} = useDocument({...handle, path: 'name'})
  const {data: role} = useDocument({...handle, path: 'role'})
  const {data: catchphrase} = useDocument({...handle, path: 'catchphrase'})
  const {data: temperament} = useDocument({...handle, path: 'temperament'})
  const {data: systemPrompt} = useDocument({...handle, path: 'systemPrompt'})
  const editTemperament = useEditDocument({...handle, path: 'temperament'})
  const editPrompt = useEditDocument({...handle, path: 'systemPrompt'})
  const synced = useDocumentSyncStatus(handle)
  const apply = useApplyDocumentActions()
  const toast = useToast()
  // The portrait is painted by Agent Actions from the system prompt (Studio action on the clerk).
  const {data: portrait} = useQuery<string | null>({
    query: `*[_id == $id][0].portrait.asset->url`,
    params: {id: handle.documentId},
  })

  const value = typeof temperament === 'number' ? temperament : 50
  const band = BANDS.find((b) => value <= b.max) ?? BANDS[BANDS.length - 1]

  return (
    <Card border radius={2} padding={4}>
      <Stack space={4}>
        <Flex align="center" gap={3}>
          {portrait ? (
            <img src={`${portrait}?w=128&h=128&fit=crop&auto=format`} alt="" width={64} height={64} style={{borderRadius: 4, objectFit: 'cover', flex: 'none'}} />
          ) : null}
          <Box flex={1}>
            <Stack space={2}>
              <Text size={2} weight="semibold">
                {String(name ?? 'Clerk')}
              </Text>
              <Text size={0} muted>
                {String(role ?? '')} · {String(catchphrase ?? '')}
              </Text>
            </Stack>
          </Box>
          <Badge tone={synced ? 'positive' : 'caution'} fontSize={0}>
            {synced ? 'synced' : 'saving'}
          </Badge>
        </Flex>

        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Text size={1} weight="medium">
              Temperament
            </Text>
            <Badge fontSize={0} mode="outline">
              {band.label} ({value})
            </Badge>
          </Flex>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(event) => editTemperament(Number(event.currentTarget.value))}
            aria-label="Temperament"
          />
        </Stack>

        <Stack space={2}>
          <Text size={1} weight="medium">
            System prompt
          </Text>
          <TextArea
            rows={9}
            fontSize={1}
            value={typeof systemPrompt === 'string' ? systemPrompt : ''}
            onChange={(event) => editPrompt(event.currentTarget.value)}
          />
        </Stack>

        <Flex justify="flex-end">
          <Button
            text="Publish this clerk"
            tone="primary"
            onClick={async () => {
              try {
                await apply(publishDocument(handle))
                toast.push({status: 'success', title: `${String(name)} published`, closable: true})
              } catch (error) {
                toast.push({status: 'error', title: 'Publish failed', description: errorMessage(error), closable: true})
              }
            }}
          />
        </Flex>
      </Stack>
    </Card>
  )
}
