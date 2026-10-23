export const name = 'hello'

export function apply(ctx) {
  ctx.widget.setStatus('ready')
  ctx.widget.pushStat({ id: 'hello', label: 'Hello', value: 'on' })
}
