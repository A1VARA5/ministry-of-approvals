import {useCurrentUser} from '@sanity/sdk-react'
import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {Suspense, useState} from 'react'
import {Board} from './Board'
import {FileView} from './FileView'
import {Staff} from './Staff'
import {ErrorBoundary} from './ErrorBoundary'
import {useMinistryEngine} from './ministry'

export function BackOffice() {
  const engine = useMinistryEngine()
  const user = useCurrentUser()
  const [selectedId, setSelectedId] = useState<string>()
  const [view, setView] = useState<'corridor' | 'staff'>('corridor')

  return (
    <Flex direction="column" height="fill" className="office">
      <Card padding={3} borderBottom tone="transparent" className="office-header">
        <Flex align="center" gap={4}>
          <Box flex={1}>
            <Stack space={2}>
              <Text size={2} weight="semibold">
                The Ministry of Approvals
              </Text>
              <Text size={1} muted>
                Back office. Every form in the corridor, live. Rulings are final until appealed.
              </Text>
            </Stack>
          </Box>
          <Flex gap={2}>
            <button
              className={`office-tab${view === 'corridor' ? ' is-active' : ''}`}
              onClick={() => setView('corridor')}
              type="button"
            >
              Corridor
            </button>
            <button
              className={`office-tab${view === 'staff' ? ' is-active' : ''}`}
              onClick={() => setView('staff')}
              type="button"
            >
              Staff
            </button>
          </Flex>
          <Text size={1} muted>
            Minister on duty: {user?.name ?? 'someone'}
          </Text>
        </Flex>
      </Card>

      {view === 'staff' ? (
        <Suspense fallback={<Box padding={4}><Text muted>Loading the staff register</Text></Box>}>
          <Staff />
        </Suspense>
      ) : (
        <Flex flex={1} className="office-body">
          <Box className="office-board">
            <ErrorBoundary label="Corridor">
              <Suspense fallback={<Box padding={4}><Text muted>Loading the corridor</Text></Box>}>
                <Board engine={engine} selectedId={selectedId} onSelect={setSelectedId} />
              </Suspense>
            </ErrorBoundary>
          </Box>
          <Card borderLeft className="office-file" tone="transparent">
            {selectedId ? (
              <ErrorBoundary label="File view" key={selectedId}>
                <Suspense fallback={<Box padding={4}><Text muted>Fetching the file</Text></Box>}>
                  <FileView engine={engine} instanceId={selectedId} onClose={() => setSelectedId(undefined)} />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <Flex align="center" justify="center" height="fill" padding={5}>
                <Text muted size={1} align="center">
                  Pick a form from the corridor. Files at the Minister's Desk are waiting for you.
                </Text>
              </Flex>
            )}
          </Card>
        </Flex>
      )}
    </Flex>
  )
}
