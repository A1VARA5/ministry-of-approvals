# The Ministry of Approvals

Kafka as a service. You submit anything (a meme, a name for your cat, a plan) and it walks a corridor of three departments staffed by AI clerks with opinions, then lands on a human Minister's desk, then goes on a public wall as a certificate. The Archive loses every third form. The Minister has one hour to rule or the Archive gets the file back. Every step is a Sanity Workflows transition, and the workflow is stored in the same dataset as the forms.

Live: https://ministry-of-approvals.vercel.app
Studio: https://ministry-of-approvals.sanity.studio
Sanity project `v6745vem`, dataset `ministry`.

Built for the Sanity Challenge on DEV (Path Two), September 2026. The honest build log is in the post; this file is the map.

## What is where

```
studio/      Sanity Studio 6.9 with the Workflows plugin, a temperament slider that rewrites a
             clerk's system prompt, a stage badge on submissions, a "Generate portrait" action
             that paints a clerk from its prompt with Agent Actions.
workflows/   The workflow definition (defineWorkflow), the effect handlers (the three AI clerks,
             the certificate printer, the Discord announcer), the Sanity Functions runtime
             (Blueprint with a drainer and an hourly ticker), a local drainer, and 14 bench tests.
app/         The back office: an App SDK app that runs inside the Sanity Dashboard. The corridor
             as a live board, one file open at a time, the Minister's buttons, the staff register.
web/         Astro 7 site on Vercel: Front Desk (submit, with an image), live status page,
             Wall of Certificates, Hall of Lost Forms, and a certificate PNG renderer.
DESIGN.md    The visual spec: surfaces, type, stamps, doors, certificate.
```

## The corridor

```
intake (Front Desk)
  -> department-a  Department of Pedantry   AI clerk: demands the one thing missing, or accepts
  -> department-b  Department of Rubber Stamps   AI clerk: approves everything
  -> department-c  The Archive   AI clerk: loses every third serial once, and every overdue form
  -> minister-review  a human: approve / reject / refer, one hour deadline
  -> certified  effects: write the certificate document, POST the Discord webhook
  -> on-the-wall (terminal)         shredded (terminal, via withdraw at the desk)
```

Definition: `workflows/src/definition.ts`. Each AI clerk is an effect with typed outputs the transitions read. Each human decision is an action with params. Guards freeze the form and block deletion while a department holds it. The Minister's deadline is a stage field seeded by a GROQ query value and a trigger with `when: '$fields.deadline <= $now'`.

## Run it

You need a Sanity project with a dataset, and a token with the editor role.

```
# studio
cd studio && npm i && npm run dev

# workflow definition
cd workflows && npm i
npx sanity-workflows deploy --check      # validate offline
npx sanity-workflows deploy              # deploy to the dataset
npm test                                 # 14 bench tests, real engine, in memory

# runtime, either
SANITY_API_TOKEN=... DISCORD_WEBHOOK_URL=... npm run drain      # on a laptop
npx sanity blueprints deploy                                    # or as Sanity Functions

# site
cd web && npm i && cp .env.example .env  # SANITY_API_TOKEN
npm run dev

# back office
cd app && npm i && npm run dev           # opens inside the Sanity Dashboard
```

Ids in `workflows/src/engine.ts`, `web/src/lib/ministry.ts` and `app/src/ministry.ts` point at my project. Change them.

## Things that broke, in short

- Workflows 0.33 peers on `@sanity/ui` 3; every Studio from 6.10 up ships ui 4. The Studio is pinned to 6.9.2 with auto updates off.
- `@sanity/workflow-components` 0.33.0 declares types it does not ship. There is a 20 line local declaration.
- `useWorkflowSession` from `@sanity/workflow-sdk` hung the Dashboard iframe for every real instance. The Studio plugin's session works on the same instances. The back office reads the instance document with `useDocument` and calls `engine.evaluate` and `engine.fireAction` directly instead.
- Approving without a note threw, because `field.set` refuses an undefined param. The bench test caught it; the note is now required.
- This project denies anonymous reads even on a public dataset, so the site reads with a token.

The full log with timestamps is in the DEV post.

## Credits

Sanity Workflows, App SDK, Agent Actions and Functions docs, and the AI content pipeline cookbook recipe, which the effect handler shape follows. Fonts: Fraunces, Special Elite, IBM Plex Sans (Google Fonts). satori and resvg for the certificate PNG.

MIT.
