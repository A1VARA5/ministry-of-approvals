import {readFile} from 'node:fs/promises'
import path from 'node:path'
import satori from 'satori'
import {initWasm, Resvg} from '@resvg/resvg-wasm'
import type {CertificateData} from '../components/Certificate.astro'

// Renders the certificate to a 1200 x 800 PNG: satori lays the document out from a plain element
// tree (a subset of CSS, flexbox only), resvg rasterises it. Same content as Certificate.astro,
// so the image on Discord is the thing on the wall. Fonts and the wasm are read from disk; on
// Vercel they travel with the function through the adapter's includeFiles.

const root = process.cwd()
const fontFile = (name: string) => readFile(path.join(root, 'src/assets/fonts', name))

let fontsPromise: Promise<Array<{name: string; data: Buffer; weight: 400 | 600 | 700 | 900; style: 'normal'}>> | undefined
let wasmReady: Promise<void> | undefined

async function fonts() {
  fontsPromise ??= Promise.all([
    fontFile('fraunces-900.ttf').then((data) => ({name: 'Fraunces', data, weight: 900 as const, style: 'normal' as const})),
    fontFile('fraunces-700.ttf').then((data) => ({name: 'Fraunces', data, weight: 700 as const, style: 'normal' as const})),
    fontFile('special-elite.ttf').then((data) => ({name: 'Special Elite', data, weight: 400 as const, style: 'normal' as const})),
    fontFile('plex-400.ttf').then((data) => ({name: 'IBM Plex Sans', data, weight: 400 as const, style: 'normal' as const})),
    fontFile('plex-600.ttf').then((data) => ({name: 'IBM Plex Sans', data, weight: 600 as const, style: 'normal' as const})),
  ])
  return fontsPromise
}

async function resvg() {
  // initWasm may run once per process; keep the promise on globalThis so a dev server reload
  // (which re-evaluates this module) does not call it twice.
  const g = globalThis as {__resvgReady?: Promise<void>}
  g.__resvgReady ??= readFile(path.join(root, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')).then((bytes) =>
    initWasm(bytes).catch((error: unknown) => {
      if (!String(error).includes('Already initialized')) throw error
    }),
  )
  wasmReady = g.__resvgReady
  await wasmReady
}

const KIND: Record<string, string> = {meme: 'a meme', name: 'a name', plan: 'a plan', idea: 'an idea', complaint: 'a complaint', other: 'a form'}
const TILTS = [-4, 3, -2, 5]

type El = {type: string; props: Record<string, unknown>}
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El => ({
  type,
  props: {style, ...extra, ...(children === undefined ? {} : {children})},
})

// The rings are an SVG image; the lettering is satori text on top, so it uses our fonts.
const sealSvg = (colour: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="none" stroke="${colour}" stroke-width="3"/><circle cx="60" cy="60" r="48" fill="none" stroke="${colour}" stroke-width="1" stroke-dasharray="2 3"/><circle cx="60" cy="60" r="30" fill="none" stroke="${colour}" stroke-width="2"/></svg>`)}`

function seal(colour: string): El {
  return el('div', {display: 'flex', width: 150, height: 150, position: 'relative', transform: 'rotate(8deg)', opacity: 0.85}, [
    el('img', {position: 'absolute', top: 0, left: 0, width: 150, height: 150}, undefined, {src: sealSvg(colour)}),
    el('div', {position: 'absolute', top: 0, left: 0, width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces', fontWeight: 900, fontSize: 24, color: colour}, 'MoA'),
    el('div', {position: 'absolute', top: 18, left: 0, width: 150, display: 'flex', justifyContent: 'center', fontFamily: 'Special Elite', fontSize: 9, letterSpacing: 2, color: colour}, 'SUITABLE FOR FRAMING'),
  ])
}

function stamp(text: string, colour: string, tilt: number): El {
  return el(
    'div',
    {
      display: 'flex',
      padding: '5px 12px 3px',
      border: `3px solid ${colour}`,
      borderRadius: 4,
      color: colour,
      fontFamily: 'Fraunces',
      fontWeight: 900,
      fontSize: 13,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      transform: `rotate(${tilt}deg)`,
      opacity: 0.9,
    },
    text,
  )
}

export async function renderCertificatePng(c: CertificateData): Promise<Uint8Array> {
  const [fontList] = await Promise.all([fonts(), resvg()])
  const stamps = (c.stamps ?? []).slice(0, 4)
  const lost = c.timesLost ? `, having been lost ${c.timesLost} time${c.timesLost > 1 ? 's' : ''} on the way` : ''
  const delayed = c.delays ? ` and delayed ${c.delays} time${c.delays > 1 ? 's' : ''} by the Minister` : ''

  const tree = el(
    'div',
    {
      width: 1200,
      height: 800,
      display: 'flex',
      padding: 22,
      background: '#c9a227',
      backgroundImage: 'linear-gradient(135deg, #d9b54a 0%, #8a6d14 40%, #c9a227 60%, #7a5f10 100%)',
    },
    el(
      'div',
      {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#fbf7ec',
        border: '3px solid #8a6d14',
        padding: '30px 44px 26px',
        position: 'relative',
        fontFamily: 'IBM Plex Sans',
        color: '#1b1916',
      },
      [
        el('div', {fontFamily: 'Special Elite', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', color: '#5c554b'}, 'The Ministry of Approvals · Office of Certificates'),
        el('div', {fontFamily: 'Fraunces', fontWeight: 900, fontSize: 44, letterSpacing: 1, textTransform: 'uppercase', color: '#8a6d14', marginTop: 6}, 'Certificate of Approval'),
        el(
          'div',
          {fontFamily: 'Special Elite', fontSize: 16, color: '#5c554b', marginTop: 10, textAlign: 'center'},
          `This is to certify that ${KIND[c.submission?.kind ?? 'other'] ?? 'a form'} submitted by ${c.submission?.citizen ?? 'a citizen'}, serial No. ${String(c.submission?.serial ?? 0).padStart(4, '0')}, namely`,
        ),
        el('div', {fontFamily: 'Fraunces', fontWeight: 700, fontSize: 34, lineHeight: 1.15, textAlign: 'center', marginTop: 8, maxWidth: 1000}, c.submission?.title ?? 'A form'),
        el('div', {fontFamily: 'Special Elite', fontSize: 16, color: '#5c554b', marginTop: 8, textAlign: 'center', maxWidth: 1000}, `has passed through every department of this Ministry${lost}${delayed}, and is hereby APPROVED.`),
        el(
          'div',
          {display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 22, marginTop: 22, width: '100%'},
          stamps.map((s, i) =>
            el('div', {display: 'flex', flexDirection: 'column', width: 245}, [
              el('div', {display: 'flex'}, stamp(`${s.department?.name ?? 'Dept.'} · ${s.verdict}`, s.department?.stampColor ?? '#b3261e', TILTS[i % TILTS.length])),
              el('div', {fontFamily: 'Special Elite', fontSize: 13, color: '#5c554b', lineHeight: 1.35, marginTop: 8}, (s.remark ?? '').slice(0, 170)),
            ]),
          ),
        ),
        ...(c.submission?.imageUrl
          ? [
              el('img', {height: 230, marginTop: 18, border: '6px solid #ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transform: 'rotate(-1.5deg)', objectFit: 'contain'}, undefined, {
                src: `${c.submission.imageUrl}?h=460&fit=max&fm=jpg`,
              }),
            ]
          : []),
        el('div', {display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: 'auto'}, [
          el('div', {display: 'flex', flexDirection: 'column', maxWidth: 780}, [
            el('div', {fontFamily: 'Special Elite', fontSize: 17, color: '#3a4a7c', marginBottom: 20}, `"${c.ministerNote ?? 'Approved without comment, which is the highest praise.'}"`),
            el('div', {display: 'flex', flexDirection: 'column', width: 260, position: 'relative'}, [
              el('div', {fontFamily: 'Fraunces', fontWeight: 700, fontStyle: 'italic', fontSize: 30, color: '#3a4a7c', transform: 'rotate(-4deg)', marginLeft: 10}, 'Aivaras'),
              el('div', {borderTop: '2px solid #1b1916', paddingTop: 4, fontFamily: 'Special Elite', fontSize: 13}, 'The Minister'),
            ]),
          ]),
          seal('#b3261e'),
        ]),
        el('div', {position: 'absolute', right: -52, top: 330, width: 160, display: 'flex', justifyContent: 'center', fontFamily: 'Special Elite', fontSize: 14, letterSpacing: 4, color: '#5c554b', transform: 'rotate(90deg)'}, c.number),
      ],
    ),
  )

  const svg = await satori(tree as never, {width: 1200, height: 800, fonts: fontList})
  const png = new Resvg(svg, {fitTo: {mode: 'width', value: 1200}}).render().asPng()
  return png
}
