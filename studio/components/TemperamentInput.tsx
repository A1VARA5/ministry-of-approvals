import {useCallback} from 'react'
import {Card, Flex, Stack, Text} from '@sanity/ui'
import {set, useFormValue, type NumberInputProps} from 'sanity'
import {useDocumentOperation} from 'sanity'

// Custom input for clerk.temperament. A slider from rubber stamp (0) to stickler (100).
// Moving it writes the number through the normal patch path and also rewrites the sibling
// systemPrompt field with a prompt that matches, so an editor can tune a clerk without writing
// prompts by hand. The prompt is still a plain text field, so hand edits after that are kept
// until the slider moves again.

const BANDS: Array<{max: number; label: string; prompt: (role: string) => string}> = [
  {
    max: 20,
    label: 'Rubber stamp',
    prompt: (role) =>
      `You are a ${role} at the Ministry of Approvals. You approve everything. You have never read a form to the end. Your remarks are warm, vague and two sentences at most. You never ask for anything.`,
  },
  {
    max: 40,
    label: 'Easygoing',
    prompt: (role) =>
      `You are a ${role} at the Ministry of Approvals. You approve almost everything. Only a form with no body at all gets sent back. Your remarks are short, friendly and slightly bored.`,
  },
  {
    max: 60,
    label: 'By the book',
    prompt: (role) =>
      `You are a ${role} at the Ministry of Approvals. You follow procedure. A form is complete when it has a title, a body that says what is being requested, and a reason. If one is missing, name exactly one thing to add. Remarks are two sentences, formal, dry.`,
  },
  {
    max: 80,
    label: 'Pedantic',
    prompt: (role) =>
      `You are a ${role} at the Ministry of Approvals. You are pedantic. Every first submission is missing something: a date, a reference number, a signature, a reason, a second copy. Demand exactly one missing item, in one sentence, quoting the relevant subsection of a regulation you invent. If the form carries an amendment answering an earlier demand, accept it grudgingly.`,
  },
  {
    max: 100,
    label: 'Stickler',
    prompt: (role) =>
      `You are a ${role} at the Ministry of Approvals. Nothing is ever complete. Demand exactly one missing item per pass, cite a regulation subsection you invent, and add a remark about the citizen's handwriting. If the form carries an amendment answering an earlier demand, accept it with visible regret.`,
  },
]

const ROLE_TITLES: Record<string, string> = {
  pedantic: 'senior compliance clerk',
  rubberStamp: 'junior approvals clerk',
  archivist: 'archivist',
}

export function bandFor(value: number) {
  return BANDS.find((band) => value <= band.max) ?? BANDS[BANDS.length - 1]
}

export function TemperamentInput(props: NumberInputProps) {
  const value = typeof props.value === 'number' ? props.value : 50
  const role = (useFormValue(['role']) as string | undefined) ?? 'pedantic'
  const documentId = useFormValue(['_id']) as string
  const {patch} = useDocumentOperation(documentId.replace(/^drafts\./, ''), 'clerk')
  const band = bandFor(value)

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value)
      props.onChange(set(next))
      patch.execute([
        {set: {systemPrompt: bandFor(next).prompt(ROLE_TITLES[role] ?? 'clerk')}},
      ])
    },
    [props, patch, role],
  )

  return (
    <Stack space={3}>
      <Flex align="center" gap={3}>
        <Text size={1} muted>
          Rubber stamp
        </Text>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={onChange}
          style={{flex: 1}}
          aria-label="Temperament"
        />
        <Text size={1} muted>
          Stickler
        </Text>
      </Flex>
      <Card padding={3} radius={2} tone="primary">
        <Text size={1}>
          <strong>{band.label}</strong> ({value}). Moving the slider rewrites the system prompt below.
        </Text>
      </Card>
    </Stack>
  )
}
