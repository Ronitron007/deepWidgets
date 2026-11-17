// Reader words for the BuiltInSeed chart.
const program = (p) => (p.startsWith('e') ? `an edit made under ${p === 'eN' ? 'no seed hash' : `the seed hash of p${p.slice(1)}`}` : `the seed program ${p}`)
const hash = (h) => (h === 'none' ? 'no seed hash' : `the seed hash of ${h}`)
export const state = (v) => [
  v.up ? `the host runs code with the seed program ${v.bcode}` : 'the host is stopped',
  v.sampleOn ? 'sample on' : 'sample off',
  `the record has ${program(v.prog)} with ${hash(v.pseed)}`,
].join(' | ')
export const group = (v) => (!v.up ? 'stopped' : v.sampleOn ? 'on' : 'off')
export const colors = { on: 'teal', off: 'tan', stopped: 'pink' }
export const title = 'The seed program of a built-in widget'
export const step = (action, from, to) => {
  const stored = to.prog !== from.prog || to.pseed !== from.pseed ? '; sample stores its seed program' : ''
  switch (action) {
    case 'Boot': return `${to.bcode !== from.bcode ? 'the host starts with an app update that has a new seed program of sample' : 'the host starts'}${stored}`
    case 'Stop': return 'the host stops'
    case 'ToggleSample': return to.sampleOn ? `you turn sample on${stored}` : 'you turn sample off'
    case 'UserEdit': return 'a plugin edits the stored program of sample'
    default: return action
  }
}
