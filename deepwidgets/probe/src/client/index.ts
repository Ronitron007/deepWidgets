/** Client half of the probe: one overlay entry that shows the host process id. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { Probe } from './Probe.tsx'

/** Services the overlay entry needs. */
export const inject = ['slots']

/**
 * Put the probe text in the shell overlay.
 * @param ctx - client plugin context carrying the slot registry.
 */
export function apply(ctx: Context): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'deepwidgets-probe',
  }, Probe))
}
