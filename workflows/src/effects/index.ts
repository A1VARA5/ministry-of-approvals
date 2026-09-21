import type {EffectHandler} from '@sanity/workflow-engine'
import {announce} from './announce.ts'
import {issueCertificate} from './certificate.ts'
import {clerkArchive, clerkPedantic, clerkRubber} from './clerks.ts'
import type {HandlerDeps} from './shared.ts'

export type {HandlerDeps} from './shared.ts'

// Effect name (as written in the definition) to handler. Built per runtime so the Sanity
// Function can pass in the client made from its robot token and the local drainer its own.
export function createEffectHandlers(deps: HandlerDeps): Record<string, EffectHandler> {
  return {
    'clerk-pedantic': clerkPedantic(deps),
    'clerk-rubber': clerkRubber(deps),
    'clerk-archive': clerkArchive(deps),
    'issue-certificate': issueCertificate(deps),
    announce: announce(deps),
  }
}
