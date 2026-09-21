import {type SanityConfig} from '@sanity/sdk'
import {SanityApp} from '@sanity/sdk-react'
import {Card, Flex, Spinner, ThemeProvider, ToastProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {BackOffice} from './BackOffice'
import {DATASET, PROJECT_ID} from './ministry'
import './App.css'

const theme = buildTheme()

// Ministry Back Office: a custom App SDK app that runs inside the Sanity Dashboard. It shows every
// form in the corridor live, and it is where the Minister (a human) rules on files through the
// same workflow transitions the AI clerks use.
function App() {
  const sanityConfigs: SanityConfig[] = [{projectId: PROJECT_ID, dataset: DATASET}]

  return (
    <ThemeProvider theme={theme} scheme="light">
      <ToastProvider>
        <SanityApp
          config={sanityConfigs}
          fallback={
            <Card height="fill">
              <Flex align="center" justify="center" height="fill" padding={6}>
                <Spinner muted />
              </Flex>
            </Card>
          }
        >
          <BackOffice />
        </SanityApp>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
