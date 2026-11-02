#!/usr/bin/env node
// Compares /statechart reports of the widget state models with the baseline at the sync commit.
//
//   node check.mjs                       list each model and its runs
//   node check.mjs <model>               list the runs of one model
//   node check.mjs <model> <out>         compare <out>/<run>/report.md with the baseline
//   node check.mjs <model> <out> --mutants   also compare the mutant runs
//
// Exit 0: every run matches the baseline. Exit 1: a run differs. Exit 2: a report is missing or the usage is wrong.
// This script does not run TLC. Run each listed config with /statechart first, with --out <out>/<run>.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const CRASH_HOLDS = ['TypeOK', 'BlamedCrashNeverCounts', 'SafeModeAfterTwo', 'GiveUpAtFour', 'NoRestartAfterGiveUp',
  'QuarantinedNeverRuns', 'RecordOnlyBlamesItsHost', 'ProvisionalGoneAfterBeat', 'NoDeadlock']
const CRASH_BREAKS = ['SampleNeverQuarantined', 'HashChangeLifts', 'ProvisionalOnlyOnAbort', 'InnocentNeverQuarantined',
  'SampleLiveInSafeMode']
const ACTION_HOLDS = ['TypeOK', 'ReplaySameResult', 'ReplayFlag', 'ConflictOnOtherArgs', 'FIFO', 'QueryNoQueue',
  'BusyNeverRuns', 'NoAdmitAfterStop', 'DrainBeforeClose', 'RevCountsWrites', 'NoDeadlock']
const INSTALL_HOLDS = ['TypeOK', 'GatesGuardHost', 'StateKept', 'BuiltInUntouched', 'OneBundlePerSlug', 'NoDeadlock']

const actionMutants = {
  any_turn: 'FIFO', dup_no_flag: 'ReplayFlag', no_cancel: 'BusyNeverRuns', no_drain: 'DrainBeforeClose',
  no_hash_check: 'ConflictOnOtherArgs', no_stop_check: 'NoAdmitAfterStop', query_queued: 'QueryNoQueue',
  stale_rev: 'RevCountsWrites',
}
const installMutants = {
  'M-builtinRow-BuiltInUntouched': 'BuiltInUntouched', 'M-builtinRow-OneBundlePerSlug': 'OneBundlePerSlug',
  'M-skipGate-GatesGuardHost': 'GatesGuardHost', 'M-stateReset-StateKept': 'StateKept',
}

// For each run: the config, the rules that must break, and the rules that must hold.
// A rule in neither list can be "not checked": the 100,000-state bound of /statechart after the first break.
const MODELS = {
  crash_lifecycle: {
    spec: 'crash_lifecycle.tla',
    runs: {
      all: { config: 'crash_lifecycle.cfg', breaks: CRASH_BREAKS, holds: [] },
      'one-launch': { config: 'crash_lifecycle-one-launch.cfg', breaks: CRASH_BREAKS, holds: [] },
      holds: { config: 'crash_lifecycle-holds.cfg', breaks: [], holds: CRASH_HOLDS },
    },
    mutants: {},
  },
  action_contract: {
    spec: 'ActionContract.tla',
    runs: {
      main: { config: 'cfg/chart.cfg', breaks: ['NoLateWrite', 'OneAtATime', 'AtMostOnce'], holds: ACTION_HOLDS },
      norestart: { config: 'cfg/norestart.cfg', breaks: ['AtMostOnce'], holds: ['NoDeadlock'] },
      'queue-hold': { config: 'cfg/queue-hold.cfg', breaks: [], holds: ACTION_HOLDS },
      'idem-hold': { config: 'cfg/idem-hold.cfg', breaks: [], holds: ACTION_HOLDS },
    },
    mutants: Object.fromEntries(Object.entries(actionMutants).flatMap(([m, rule]) => [
      [`mut-${m}`, { config: `cfg/mut/${m}.cfg`, breaks: [rule], holds: ['NoDeadlock'] }],
      [`mut-${m}-none`, { config: `cfg/mut/${m}-none.cfg`, breaks: [], holds: [rule, 'NoDeadlock'] }],
    ])),
  },
  widget_install: {
    spec: 'WidgetInstall.tla',
    runs: {
      all: { config: 'cfg/WidgetInstall.cfg', breaks: ['FailedReplaceKeepsOld', 'SlugTakenOnlyForBuiltIn'], holds: [] },
      'no-crash': { config: 'cfg/NoCrash.cfg', breaks: ['NewSeedSetsProgram', 'FailedReplaceKeepsOld'], holds: ['NoDeadlock'] },
      quarantine: { config: 'cfg/P-QuarantineHolds.cfg', breaks: ['QuarantineHolds'], holds: [] },
      'same-seed': { config: 'cfg/P-SameSeedKeepsProgram.cfg', breaks: ['SameSeedKeepsProgram'], holds: [] },
      holds: { config: 'cfg/Holds.cfg', breaks: [], holds: INSTALL_HOLDS },
      'two-slugs': { config: 'cfg/TwoSlugs.cfg', breaks: [], holds: INSTALL_HOLDS },
    },
    mutants: Object.fromEntries(Object.entries(installMutants).map(([m, rule]) => [
      `mut-${m}`, { config: `cfg/mut/${m}.cfg`, breaks: [rule], holds: [] },
    ])),
  },
}

/** The rules that a /statechart report says break, hold, or were not checked. */
function readReport(file) {
  const text = readFileSync(file, 'utf8')
  const breaks = [...text.matchAll(/^## (\S+) breaks$/gm)].map((m) => m[1])
  const listAfter = (heading) => {
    const m = text.match(new RegExp(`^## ${heading}\\n(.*)$`, 'm'))
    return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : []
  }
  return { breaks, holds: listAfter('Rules that hold'), notChecked: listAfter('Rules not checked') }
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

function list(name) {
  const model = MODELS[name]
  const runs = { ...model.runs, ...model.mutants }
  console.log(`${name}: spec ${join(HERE, name, model.spec)}, view ${join(HERE, name, 'view.mjs')}`)
  for (const [run, r] of Object.entries(runs)) {
    console.log(`  ${run.padEnd(34)} config ${r.config.padEnd(40)} breaks: ${r.breaks.join(' ') || '-'}`)
  }
}

const [name, out, flag] = process.argv.slice(2)
if (name === undefined) {
  for (const n of Object.keys(MODELS)) list(n)
  process.exit(0)
}
if (!(name in MODELS) || (flag !== undefined && flag !== '--mutants')) {
  console.error(`usage: node check.mjs [${Object.keys(MODELS).join('|')}] [<out> [--mutants]]`)
  process.exit(2)
}
if (out === undefined) {
  list(name)
  process.exit(0)
}

const model = MODELS[name]
const runs = flag === '--mutants' ? { ...model.runs, ...model.mutants } : model.runs
let worst = 0
for (const [run, want] of Object.entries(runs)) {
  const file = join(out, run, 'report.md')
  if (!existsSync(file)) {
    console.log(`MISSING ${run}: no ${file}`)
    worst = 2
    continue
  }
  const got = readReport(file)
  const problems = []
  if (!sameSet(got.breaks, want.breaks)) {
    problems.push(`breaks [${got.breaks.join(', ')}], baseline [${want.breaks.join(', ')}]`)
  }
  const notHeld = want.holds.filter((rule) => !got.holds.includes(rule))
  if (notHeld.length > 0) problems.push(`does not hold: ${notHeld.join(', ')}`)
  if (problems.length === 0) {
    console.log(`OK      ${run}: breaks [${got.breaks.join(', ')}]`)
  } else {
    console.log(`DIFF    ${run}: ${problems.join('; ')}`)
    worst = Math.max(worst, 1)
  }
}
process.exit(worst)
