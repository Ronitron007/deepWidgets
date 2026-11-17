// Reader words for the BuiltInSeed chart.
const program = (p) => (p === 'edit' ? 'an edit' : `the seed program ${p}`)
const hash = (h) => (h === 'none' ? 'no seed hash' : `the seed hash of ${h}`)
export const state = (v) => [
  v.sampleOn ? 'sample on' : 'sample off',
  `the code has the seed program ${v.bcode}`,
  `the record has ${program(v.prog)} with ${hash(v.pseed)}`,
].join(' | ')
export const group = (v) => (v.sampleOn ? 'on' : 'off')
export const colors = { on: 'teal', off: 'tan' }
export const title = 'The seed program of a built-in widget'
export const step = (action, from, to) => {
  const stored = to.prog !== from.prog || to.pseed !== from.pseed ? '; sample stores its seed program' : ''
  switch (action) {
    case 'ToggleSample': return to.sampleOn ? `you turn sample on${stored}` : 'you turn sample off'
    case 'Restart': return `${to.bcode !== from.bcode ? 'an app update with a new seed program of sample starts' : 'the host starts again'}${stored}`
    case 'UserEdit': return 'a plugin edits the stored program of sample'
    default: return action
  }
}
