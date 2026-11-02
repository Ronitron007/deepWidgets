// Reader words for the WidgetInstall chart.
const code = { v1: 'v1', v2: 'v2', bad: 'bad (throws in host)', lint: 'lint-failing code', none: 'nothing' }
const regText = { live: 'live', failed: 'shown as failed (quarantined)', off: 'off (safe mode)', none: 'not running' }
const phase = (j) => {
  switch (j.pc) {
    case 'idle': return 'No tool call running'
    case 'gates': case 'reloadCheck': case 'checkInstalled': return `${j.op} ${j.s}: checking`
    case 'writeNext': case 'clearFolder': case 'renameNext': case 'backup': return `${j.op} ${j.s}: moving folders`
    case 'removeOld': return `${j.op} ${j.s}: removing the old bundle`
    case 'installNew': case 'waitLive': return `${j.op} ${j.s}: new bundle going in`
    case 'rmBackup': case 'readSeed': case 'setProgram': case 'writeSeed': return `${j.op} ${j.s}: new bundle in, seed step`
    case 'undoCheck': case 'undoRemove': case 'rmFolder': case 'restoreRename': case 'restoreInstall': case 'restoreDone': return `${j.op} ${j.s}: rolling back`
    case 'removeCheck': case 'removeBundle': case 'removeFolder': return `remove ${j.s}: removing`
    case 'ok': return `${j.op} ${j.s} answered ok`
    case 'err': return `${j.op} ${j.s} answered ${j.err}`
    default: return j.pc
  }
}
const slot = (v, s) => {
  const parts = []
  if (v.inst[s]) parts.push(`${s}: ${code[v.folder[s]] ?? v.folder[s]} installed${v.enabled[s] ? '' : ' but deselected'}, ${regText[v.reg[s]]}`)
  else parts.push(`${s}: no agent bundle${v.reg[s] !== 'none' ? `, ${regText[v.reg[s]]}` : ''}`)
  if (v.prog[s] !== 'none' && s !== 'sample') parts.push(`program ${v.prog[s]}`)
  if (v.seedRec[s] !== 'none' && s !== 'sample') parts.push(`seed record ${v.seedRec[s]}`)
  if (v.quar[s]) parts.push('quarantine item')
  return parts.join(', ')
}
export const state = (v) => {
  const bits = [phase(v.job), slot(v, 'a')]
  if (v.inst.sample) bits.push('agent bundle has the row id of the built-in sample')
  bits.push(v.sampleOn ? 'built-in sample on' : 'built-in sample off')
  if (v.safe) bits.push('safe mode')
  return bits.join(' | ')
}
export const group = (v) => (v.job.pc === 'err' ? 'failed' : v.job.pc === 'ok' ? 'ok' : v.job.pc === 'idle' ? 'idle' : 'running')
export const colors = { failed: 'pink', ok: 'teal', idle: 'tan', running: 'blue' }
export const title = 'widget_install, widget_reload, widget_remove at 38df710e'
export const step = (action, from, to) => {
  const j = to.job
  switch (action) {
    case 'AgentInstall': return `the agent calls widget_install for ${j.s} with ${code[j.c]}`
    case 'AgentReload': return `the agent edits the files to ${code[j.c]} and calls widget_reload ${j.s}`
    case 'AgentRemove': return `the agent calls widget_remove ${j.s}`
    case 'Gates': return to.job.pc === 'err' ? 'a gate refuses the code' : 'the gates pass'
    case 'ReloadCheck': return to.job.pc === 'err' ? 'reload finds no bundle' : 'reload finds the bundle'
    case 'CheckInstalled': return to.job.pc === 'err' ? 'the slug is in widget_list and has no agent bundle' : 'the slug check passes'
    case 'WriteNext': return 'the new bundle is written to <slug>.next'
    case 'RemoveOld': return to.job.pc === 'err' ? (to.enabled[j.s] ? 'removing the old bundle fails' : 'pnpm remove fails after the old bundle is deselected') : 'the old bundle is removed'
    case 'Backup': return 'the old folder moves to <slug>.previous'
    case 'ClearFolder': return 'the old folder is deleted'
    case 'RenameNext': return 'the new folder moves into place'
    case 'InstallNew': return !to.inst[j.s] ? 'the plugin manager does not install it' : `the plugin manager installs it (${to.job.app})`
    case 'WaitLive': return to.job.pc === 'rmBackup' ? 'the slug shows in widget_list' : 'the slug does not show, or the result is not applied'
    case 'RmBackup': return 'the backup is deleted'
    case 'ReadSeed': return 'the installer reads the seed record'
    case 'SetProgram': return to.job.pc === 'err' ? 'setProgram throws: the widget is not live' : 'the stored program is set to the new seed'
    case 'WriteSeed': return 'the seed record is written'
    case 'UndoCheck': return 'the installer checks for the failed bundle'
    case 'UndoRemove': return to.inst[j.s] ? 'removing the failed bundle fails' : 'the failed bundle is removed'
    case 'RmFolder': return 'the new folder is deleted'
    case 'RestoreRename': return 'the backup moves back into place'
    case 'RestoreInstall': return to.inst[j.s] ? `the old bundle is installed again (${to.job.app})` : 'installing the old bundle again fails'
    case 'RestoreDone': return 'the call fails with install-failed'
    case 'RemoveCheck': return to.job.pc === 'err' ? 'remove finds no agent bundle' : 'remove finds the bundle'
    case 'RemoveBundle': return to.job.pc === 'err' ? 'the plugin manager does not remove it' : 'the plugin manager removes it'
    case 'RemoveFolder': return 'the folder is deleted'
    case 'Return': return 'the tool answers'
    case 'UserCall': return 'you press a button that changes the state'
    case 'UserEdit': return 'a plugin edits the stored program'
    case 'ToggleSample': return to.sampleOn ? 'you turn the built-in sample on' : 'you turn the built-in sample off'
    case 'Crash': return to.safe ? 'the host crashes, no widget blamed, restarts in safe mode' : (Object.values(to.quar).some(Boolean) && !Object.values(from.quar).some(Boolean) ? 'live widget code crashes the host; it restarts' : 'the host crashes and restarts')
    default: return action
  }
}
