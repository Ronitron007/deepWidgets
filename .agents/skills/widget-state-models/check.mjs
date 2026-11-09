#!/usr/bin/env node
// Runs the widget state models with /statechart, and compares the reports with the baseline at the sync commit.
//
//   node check.mjs                                  list each model and its runs
//   node check.mjs <model> [--mutants] [--full]              list the runs of one model
//   node check.mjs <model> <out> [--mutants] [--full]        compare <out>/<run>/report.md with the baseline
//   node check.mjs run <model> <out> [--mutants] [--full]    run each listed run with /statechart, then compare
//
// A config path is relative to the model folder, for example crash_lifecycle/cfg/mut/keep_prov.cfg.
// Without --mutants, a command uses the main runs only. With --mutants, it also uses the mutant runs.
// A run marked `slow` is in the full set only: add --full to use it. The default set checks each rule at least once.
//
// `run` needs the environment variable STATECHART_RUN: the command line of one /statechart run, as the
// /statechart skill gives it, with the placeholders {spec}, {config}, {view}, and {out}. This script fills in
// absolute paths. It does not keep a copy of the /statechart command line, because that changes between releases.
//
// Exit 0: every run matches the baseline. Exit 1: a run differs. Exit 2: a report is missing or the usage is wrong.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// widget.crash_records fixed HashChangeLifts, ProvisionalOnlyOnAbort, and InnocentNeverQuarantined (widget_fv.crash).
const CRASH_HOLDS = ['TypeOK', 'BlamedCrashNeverCounts', 'SafeModeAfterTwo', 'GiveUpAtFour', 'NoRestartAfterGiveUp',
  'QuarantinedNeverRuns', 'HashChangeLifts', 'ProvisionalOnlyOnAbort', 'InnocentNeverQuarantined',
  'RecordOnlyBlamesItsHost', 'ProvisionalGoneAfterBeat', 'NoDeadlock']
// The known breaks of widget_fv.open (built-in widgets).
const CRASH_BREAKS = ['SampleNeverQuarantined', 'SampleLiveInSafeMode']
const ACTION_HOLDS = ['TypeOK', 'AtMostOnce', 'ReplaySameResult', 'ReplayFlag', 'ConflictOnOtherArgs', 'NoLateWrite', 'OneAtATime', 'FIFO',
  'QueryNoQueue', 'BusyNeverRuns', 'NoAdmitAfterStop', 'DrainBeforeClose', 'RevCountsWrites', 'NoDeadlock']
const INSTALL_HOLDS = ['TypeOK', 'GatesGuardHost', 'FailedReplaceKeepsOld', 'NeverRemoveLastGood', 'CommittedNotStandby', 'StateKept', 'BuiltInUntouched', 'OneBundlePerSlug', 'NewSeedSetsProgram',
  'SameSeedKeepsProgram', 'SlugTakenOnlyForBuiltIn', 'QuarantineHolds', 'RollbackKeepsRecord', 'BuiltInSlugReserved', 'NoDeadlock']

const actionMutants = {
  any_turn: 'FIFO', dup_no_flag: 'ReplayFlag', no_cancel: 'BusyNeverRuns', no_drain: 'DrainBeforeClose',
  no_hash_check: 'ConflictOnOtherArgs', no_stop_check: 'NoAdmitAfterStop', query_queued: 'QueryNoQueue',
  rev_on_refuse: 'RevCountsWrites', replay_live_rev: 'ReplaySameResult', slot_at_timeout: 'OneAtATime',
  no_slot_abort_check: 'NoLateWrite', no_mark: 'AtMostOnce',
}
const crashMutants = {
  no_blame_skip: 'BlamedCrashNeverCounts', safe_off_by_one: 'SafeModeAfterTwo', give_up_late: 'GiveUpAtFour',
  no_dispose: 'NoRestartAfterGiveUp', no_quarantine: 'QuarantinedNeverRuns', no_pid_check: 'RecordOnlyBlamesItsHost',
  keep_prov: 'ProvisionalGoneAfterBeat',
  // widget.crash_records: each mutant is the code before that unit.
  no_row_root: 'HashChangeLifts', prov_outlives_call: 'InnocentNeverQuarantined', keep_prov_unarmed: 'ProvisionalOnlyOnAbort',
  // host.hmr_guards: the code at 5a47dd3d kept an agent row in the running slot across an await.
  slot_spans_awaits: 'InnocentNeverQuarantined',
}
const installMutants = {
  'M-builtinRow-BuiltInUntouched': 'BuiltInUntouched', 'M-builtinRow-OneBundlePerSlug': 'OneBundlePerSlug',
  'M-skipGate-GatesGuardHost': 'GatesGuardHost', 'M-stateReset-StateKept': 'StateKept',
  'M-seedFile-SameSeedKeepsProgram': 'SameSeedKeepsProgram', 'M-noRestore-RollbackKeepsRecord': 'RollbackKeepsRecord',
  'M-oneName-QuarantineHolds': 'QuarantineHolds', 'M-offAllowed-BuiltInSlugReserved': 'BuiltInSlugReserved',
  'M-removeFirst-FailedReplaceKeepsOld': 'FailedReplaceKeepsOld', 'M-noLiveCheck-NeverRemoveLastGood': 'NeverRemoveLastGood',
  'M-noDefer-CommittedNotStandby': 'CommittedNotStandby',
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
    mutants: Object.fromEntries(Object.entries(crashMutants).map(([m, rule]) => [
      `mut-${m}`, { config: `cfg/mut/${m}.cfg`, breaks: [rule], holds: [] },
    ])),
  },
  action_contract: {
    spec: 'ActionContract.tla',
    runs: {
      main: { config: 'cfg/chart.cfg', breaks: [], holds: ACTION_HOLDS },
      norestart: { config: 'cfg/norestart.cfg', breaks: [], holds: ['AtMostOnce', 'NoDeadlock'] },
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
      // The default set: one crash, and no DeselectFails in `all`. The full set adds DeselectFails, two crashes, and two slugs.
      all: { config: 'cfg/WidgetInstall.cfg', breaks: [], holds: INSTALL_HOLDS },
      'no-crash': { config: 'cfg/NoCrash.cfg', breaks: [], holds: ['FailedReplaceKeepsOld', 'NewSeedSetsProgram', 'NoDeadlock'] },
      quarantine: { config: 'cfg/P-QuarantineHolds.cfg', breaks: [], holds: ['QuarantineHolds', 'NoDeadlock'], slow: true },
      'same-seed': { config: 'cfg/P-SameSeedKeepsProgram.cfg', breaks: [], holds: ['SameSeedKeepsProgram', 'NoDeadlock'], slow: true },
      holds: { config: 'cfg/Holds.cfg', breaks: [], holds: INSTALL_HOLDS, slow: true },
      'two-slugs': { config: 'cfg/TwoSlugs.cfg', breaks: [], holds: INSTALL_HOLDS, slow: true },
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

function list(name, runs = { ...MODELS[name].runs, ...MODELS[name].mutants }) {
  const model = MODELS[name]
  console.log(`${name}: folder ${join(HERE, name)}, spec ${model.spec}, view view.mjs, configs relative to the folder`)
  for (const [run, r] of Object.entries(runs)) {
    console.log(`  ${run.padEnd(34)} config ${r.config.padEnd(40)} breaks: ${r.breaks.join(' ') || '-'}`)
  }
}

const args = process.argv.slice(2)
const withMutants = args.includes('--mutants')
const full = args.includes('--full')
const words = args.filter((a) => a !== '--mutants' && a !== '--full')
const running = words[0] === 'run'
const [name, out] = running ? words.slice(1) : words
const usage = () => {
  console.error(`usage: node check.mjs [run] [${Object.keys(MODELS).join('|')}] [<out>] [--mutants]`)
  process.exit(2)
}
if (name === undefined && !running && !withMutants) {
  for (const n of Object.keys(MODELS)) list(n)
  process.exit(0)
}
if (!(name in MODELS) || words.length > (running ? 3 : 2) || (running && out === undefined)) usage()

const model = MODELS[name]
const runs = Object.fromEntries(Object.entries(withMutants ? { ...model.runs, ...model.mutants } : model.runs).filter(([, r]) => full || r.slow !== true))
if (out === undefined) {
  list(name, runs)
  process.exit(0)
}

if (running) {
  const template = process.env.STATECHART_RUN
  if (template === undefined || !['{spec}', '{config}', '{view}', '{out}'].every((p) => template.includes(p))) {
    console.error('set STATECHART_RUN to the /statechart command line of one run, with {spec}, {config}, {view}, and {out}')
    process.exit(2)
  }
  const dir = join(HERE, name)
  const quote = (path) => `'${path.replaceAll("'", "'\\''")}'`
  for (const [run, r] of Object.entries(runs)) {
    const target = join(out, run)
    if (existsSync(target)) {
      console.error(`${target} exists. Give a new out folder.`)
      process.exit(2)
    }
    mkdirSync(out, { recursive: true })
    const line = template.replaceAll('{spec}', quote(join(dir, model.spec))).replaceAll('{config}', quote(join(dir, r.config)))
      .replaceAll('{view}', quote(join(dir, 'view.mjs'))).replaceAll('{out}', quote(target))
    const started = Date.now()
    const result = spawnSync('sh', ['-c', line], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] })
    console.log(`ran     ${run}: exit ${String(result.status)}, ${String(Math.round((Date.now() - started) / 1000))} s`)
  }
}

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
  const unchecked = notHeld.filter((rule) => got.notChecked.includes(rule))
  const otherNotHeld = notHeld.filter((rule) => !unchecked.includes(rule))
  if (otherNotHeld.length > 0) problems.push(`does not hold: ${otherNotHeld.join(', ')}`)
  if (unchecked.length > 0) problems.push(`not checked after the first break: ${unchecked.join(', ')}`)
  if (problems.length === 0) {
    console.log(`OK      ${run}: breaks [${got.breaks.join(', ')}]`)
  } else {
    console.log(`DIFF    ${run}: ${problems.join('; ')}`)
    worst = Math.max(worst, 1)
  }
}
process.exit(worst)
