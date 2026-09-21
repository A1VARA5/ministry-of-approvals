import {useState} from 'react'
import {useClient, type DocumentActionComponent} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'

// Document action on clerk documents: paint the clerk from its own system prompt with Agent
// Actions image generation (Generate, targeting portrait.asset). One AI credit per portrait.
// Generation is asynchronous: the Studio shows the image as "uploading" until it lands.
export const SCHEMA_ID = '_.schemas.default'

export function portraitInstruction(name: string, role: string, systemPrompt: string): string {
  const desk: Record<string, string> = {
    pedantic: 'a compliance desk stacked with forms, a red pen in hand',
    rubberStamp: 'a desk with one enormous rubber stamp and nothing else',
    archivist: 'a basement archive, shelves receding into the dark, one desk lamp',
  }
  return (
    `A staff identity portrait for ${name}, a clerk at the Ministry of Approvals. ` +
    `Painted in the style of a 1970s Eastern European civil service ID photograph turned into a small oil portrait: ` +
    `muted ochre and green, flat lighting, deadpan expression, head and shoulders, looking at the camera, ` +
    `${desk[role] ?? 'a plain desk'} behind. No text, no logos. ` +
    `Their personality, which should show in the face: ${systemPrompt.slice(0, 500)}`
  )
}

export const GeneratePortraitAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: 'vX'})
  const [busy, setBusy] = useState(false)
  const doc = (props.draft ?? props.published) as
    | {name?: string; role?: string; systemPrompt?: string}
    | null
  const ready = Boolean(doc?.name && doc?.role && doc?.systemPrompt)

  return {
    label: busy ? 'Painting…' : 'Generate portrait',
    icon: ImageIcon,
    disabled: busy || !ready,
    title: ready ? 'Paints the clerk from its system prompt. One AI credit.' : 'Needs a name, a role and a system prompt first',
    onHandle: async () => {
      if (!doc) return
      setBusy(true)
      try {
        await client.agent.action.generate({
          schemaId: SCHEMA_ID,
          documentId: props.id,
          instruction: portraitInstruction(doc.name ?? 'a clerk', doc.role ?? 'pedantic', doc.systemPrompt ?? ''),
          target: {path: ['portrait', 'asset']},
          // The clerk documents are published and read by the effect handlers as published.
          forcePublishedWrite: true,
        })
      } finally {
        setBusy(false)
        props.onComplete()
      }
    },
  }
}
