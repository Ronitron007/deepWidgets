/** Host half of a CRUD widget. Do not edit: the row config and program.oui define the widget. */
import { fileURLToPath } from 'node:url'

export const inject = ['widgets']

export function apply(ctx, config) {
  ctx.effect(() => ctx.widgets.define({
    kind: 'crud',
    slug: config.slug,
    title: config.title,
    table: config.table,
    program: fileURLToPath(new URL('./program.oui', import.meta.url)),
  }), `widget ${config.slug}`)
}
