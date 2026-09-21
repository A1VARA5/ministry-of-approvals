import type {HandlerFactory} from './shared.ts'
import {fetchSubmission, subjectId} from './shared.ts'

// The external API call the brief asks about: a Discord webhook. Delivery is at least once, so
// the effect key goes into the message footer; a duplicate post is visible as a duplicate, not
// hidden. If no webhook is configured the effect still settles as done, the certificate is real
// either way.
export const announce: HandlerFactory =
  ({content, discordWebhookUrl, siteUrl}) =>
  async (params, ctx) => {
    const id = subjectId(params)
    const number = typeof params.certificateNumber === 'string' ? params.certificateNumber : '?'
    if (!discordWebhookUrl) {
      ctx.log(`announce: no DISCORD_WEBHOOK_URL, skipping the town crier for ${number}`)
      return
    }
    const row = await fetchSubmission(content, id)
    const base = siteUrl ? siteUrl.replace(/\/$/, '') : undefined
    const link = base ? `${base}/wall#${encodeURIComponent(number)}` : undefined
    // The site renders the certificate itself to PNG (satori + resvg), so the embed shows the
    // actual document, not a text summary of it.
    const image = base ? `${base}/api/certificate/${encodeURIComponent(number)}.png` : undefined
    const response = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        username: 'The Ministry of Approvals',
        embeds: [
          {
            title: `Certificate ${number} issued`,
            description: `"${row.title}" by ${row.citizen} has survived all three departments and the Minister.`,
            url: link,
            color: 0xb3261e,
            ...(image ? {image: {url: image}} : {}),
            footer: {text: `Kind: ${row.kind}. Serial ${row.serial ?? '?'}. Ref ${ctx.effectKey.slice(0, 24)}`},
          },
        ],
      }),
    })
    if (!response.ok) {
      throw new Error(`Discord webhook returned ${response.status}: ${await response.text()}`)
    }
    ctx.log(`announce: posted ${number} to Discord`)
  }
