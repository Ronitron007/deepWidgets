// Reader words for the WidgetInstall chart.
const code = { v1: 'v1', v2: 'v2', bad: 'bad (throws in host)', lint: 'lint-failing code', none: 'nothing' }
const regText = { live: 'live', failed: 'shown as failed (quarantined)', off: 'off (safe mode)', none: 'not running' }
const nameText = { A: 'name A', B: 'name B' }
const phase = (j) => {
  switch (j.pc) {
    case 'idle': return 'No tool call running'
    case 'gates': case 'reloadCheck': case 'checkInstalled': case 'decide': return `${j.op} ${j.s}: checking`
    case 'writeNew': case 'snapshot': case 'installNew': case 'waitReg': return `${j.op} ${j.s}: new bundle going in under ${nameText[j.name] ?? j.name}`
    case 'removeOld': case 'rmOld': return `${j.op} ${j.s}: removing the old bundle`
    case 'live': case 'adopt': case 'writeSeed': return `${j.op} ${j.s}: new bundle in, seed step`
    case 'undoCheck': case 'undoRemove': case 'rmFolder': case 'restoreProgram': return `${j.op} ${j.s}: rolling back the new bundle`
    case 'removeCheck': case 'removeBundle': case 'removeFolder': return `remove ${j.s}: removing`
    case 'ok': return `${j.op} ${j.s} answered ok`
    case 'err': return `${j.op} ${j.s} answered ${j.err}`
    default: return j.pc
  }
}
const slot = (v, s) => {
  const parts = []
  const names = ['A', 'B'].filter((n) => v.inst[s][n])
  if (names.length === 0) parts.push(`${s}: no agent bundle`)
  for (const n of names) parts.push(`${s} ${nameText[n]}: ${code[v.folder[s][n]] ?? v.folder[s][n]} installed${v.enabled[s][n] ? '' : ' but deselected'}`)
  parts.push(v.reg[s] === 'none' ? 'not running' : `${regText[v.reg[s]]}${v.row[s] !== 'none' ? ` from ${nameText[v.row[s]]}` : ''}`)
  if (v.sby[s] !== 'none') parts.push(`${nameText[v.sby[s]]} waits as the standby`)
  if (v.prog[s] !== 'none' && s !== 'sample') parts.push(`program ${v.prog[s]}`)
  if (v.pseed[s] !== 'none' && s !== 'sample') parts.push(`seed hash ${v.pseed[s]}`)
  for (const n of ['A', 'B']) if (v.quar[s][n]) parts.push(`quarantine item on ${nameText[n]}`)
  return parts.join(', ')
}
const installed = (v, s) => v.inst[s].A || v.inst[s].B
export const state = (v) => {
  const bits = [phase(v.job), slot(v, 'a')]
  if (installed(v, 'sample')) bits.push('agent bundle has the slug of the built-in sample')
  bits.push(v.sampleOn ? 'built-in sample on' : 'built-in sample off')
  if (v.safe) bits.push('safe mode')
  return bits.join(' | ')
}
export const group = (v) => (v.job.pc === 'err' ? 'failed' : v.job.pc === 'ok' ? 'ok' : v.job.pc === 'idle' ? 'idle' : 'running')
export const colors = { failed: 'pink', ok: 'teal', idle: 'tan', running: 'blue' }
export const title = 'widget_install, widget_reload, widget_remove'
export const step = (action, from, to) => {
  const j = to.job
  const s = j.s
  switch (action) {
    case 'AgentInstall': return `the agent calls widget_install for ${s} with ${code[j.c]}`
    case 'AgentReload': return `the agent edits the files to ${code[j.c]} and calls widget_reload ${s}`
    case 'AgentRemove': return `the agent calls widget_remove ${s}`
    case 'Gates': return to.job.pc === 'err' ? 'a gate refuses the code' : 'the gates pass'
    case 'ReloadCheck': return to.job.pc === 'err' ? 'reload finds no bundle' : 'reload finds the bundle'
    case 'CheckInstalled': return to.job.pc === 'err' ? 'the slug is taken' : 'the slug check passes'
    case 'Decide': return to.job.pc === 'err' ? 'removing the leftover bundle fails'
      : to.job.pc === 'removeOld' ? 'the installer removes the old bundle first'
        : `the installer picks ${nameText[j.name]} for the new bundle`
    case 'WriteNew': return 'the new bundle is written to its folder'
    case 'Snapshot': return 'the installer reads the program record before the load'
    case 'InstallNew': return !to.inst[s][j.name] ? 'the plugin manager does not install it'
      : `the plugin manager installs it (${to.job.app})${to.sby[s] === j.name ? '; it waits as the standby' : ''}${to.prog[s] !== from.prog[s] ? '; the load stores its seed' : ''}`
    case 'WaitReg': return to.job.pc === 'undoCheck' ? 'the new bundle does not register within 5 s, or the result is not applied' : 'the new bundle registered'
    case 'RemoveOld': return to.job.pc === 'rmOld' ? `the old bundle is removed${to.reg[s] === 'live' && to.row[s] === j.name ? '; the new one takes over' : ''}`
      : to.job.pc === 'live' ? 'pnpm remove of the old bundle fails, and the new one is live' : 'removing the old bundle fails'
    case 'RmOld': return 'the old folder is deleted'
    case 'LiveCheck': return to.job.pc === 'adopt' ? `the slug shows in widget_list${Object.values(from.quar[s]).some(Boolean) && !Object.values(to.quar[s]).some(Boolean) ? '; the quarantine ends' : ''}` : 'the slug does not show in widget_list'
    case 'Adopt': return to.prog[s] !== from.prog[s] ? 'the old installer sets the stored program to the new seed' : to.pseed[s] !== from.pseed[s] ? 'the record with no seed hash takes the hash of this seed' : 'the installer reads the program record'
    case 'WriteSeed': return 'the old installer writes the seed file last'
    case 'UndoCheck': return 'the installer checks for the failed bundle'
    case 'UndoRemove': return to.inst[s][j.name] ? 'removing the failed bundle fails' : 'the failed bundle is removed'
    case 'RmFolder': return 'the new folder is deleted'
    case 'RestoreProgram': return to.prog[s] === from.prog[s] && to.pseed[s] === from.pseed[s] ? 'the call fails with install-failed; the record stays' : 'the program record before the load is put back; the call fails'
    case 'RemoveCheck': return to.job.pc === 'err' ? 'remove finds no agent bundle' : 'remove finds the bundle'
    case 'RemoveBundle': return to.job.pc === 'err' ? 'the plugin manager does not remove it' : 'the plugin manager removes it'
    case 'RemoveFolder': return 'the folders are deleted'
    case 'Return': return 'the tool answers'
    case 'UserCall': return 'you press a button that changes the state'
    case 'UserEdit': return 'a plugin edits the stored program'
    case 'ToggleSample': return to.sampleOn ? 'you turn the built-in sample on' : 'you turn the built-in sample off'
    case 'Crash': {
      const blamed = (q) => Object.values(q).some((item) => Object.values(item).some(Boolean))
      return to.safe ? 'the host crashes, no widget blamed, restarts in safe mode'
        : Object.keys(to.quar).some((k) => Object.keys(to.quar[k]).some((n) => to.quar[k][n] && !from.quar[k][n])) || (blamed(to.quar) && !blamed(from.quar)) ? 'widget code crashes the host; it restarts' : 'the host crashes and restarts'
    }
    default: return action
  }
}
