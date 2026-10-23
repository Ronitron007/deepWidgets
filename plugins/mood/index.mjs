export const name = 'mood'

export function apply(ctx) {
  ctx.widget.setMood('awake')
  ctx.widget.pushStat({ id: 'mood', label: 'Mood', value: 'awake' })
}
