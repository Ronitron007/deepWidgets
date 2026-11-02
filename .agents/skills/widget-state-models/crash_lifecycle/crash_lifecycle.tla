--------------------------- MODULE crash_lifecycle ---------------------------
(***************************************************************************)
(* crash_lifecycle: the outermost state machine of deepWidgets at aa7cd518. *)
(* Host process + crash.json/provisional.json + quarantine.json + the       *)
(* watchdog thread + the Electron-main supervisor (HostCrashPolicy).        *)
(* Code refs (path:line at aa7cd518):                                       *)
(*   SUP  = apps/desktop/src/deepwidgets-supervisor.ts                      *)
(*   POL  = apps/desktop/src/deepwidgets-crash-policy.ts                    *)
(*   ISO  = deepwidgets/widgets/src/isolation.ts                            *)
(*   WD   = deepwidgets/widgets/src/watchdog.ts                             *)
(*   WDW  = deepwidgets/widgets/src/watchdog-worker.ts                      *)
(*   IDX  = deepwidgets/widgets/src/index.ts                                *)
(*   HP   = apps/desktop/src/host-process.ts                                *)
(*   SPEC = docs/specs/widget-phase2.md                                     *)
(* Time is abstract ticks. One watchdog poll step = a quarter threshold.    *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS
  Agents,     \* agent widget rows, e.g. {"a1","a2"}
  Sample,     \* the built-in row deepwidgets-widget-sample
  MaxHosts,   \* bound on host pids (one pid per spawned host, pids never reused)
  MaxLaunch,  \* bound on app launches (the user starts the app again after a dialog)
  MaxHash,    \* bound on package-hash versions per agent widget
  T,          \* watchdog threshold, in poll steps (WD:25 WATCHDOG_THRESHOLD_MS)
  Q,          \* provisional point, in poll steps (WDW:166 thresholdMs / 4)
  WIN,        \* crash window, in ticks (POL:12 CRASH_WINDOW_MS)
  Mutant      \* "none", or one broken variant of the code (see `Mutants` below)

Widgets == Agents \cup {Sample}
None == "none"   \* no widget row: record row null, empty slot, host code
\* Sentinels with the same fields as the real values, so TLC compares like with like.
NoRec == [kind |-> "nil", pid |-> 0, row |-> None, hash |-> -1, trueHash |-> -1,
          applied |-> TRUE, death |-> "none", running |-> None]
NoQ == [kind |-> "nil", hash |-> -1, trueHash |-> -1, src |-> "none", pid |-> 0,
        death |-> "none", running |-> None]
NoHost == [kind |-> "nil", pid |-> 0, phase |-> "none", safe |-> FALSE, death |-> "none", running |-> None]
Backoff == <<1, 2, 3>>  \* POL:10 BACKOFF_MS 500, 2000, 8000 ms, as ticks (order kept)
Min(a, b) == IF a < b THEN a ELSE b

VARIABLES
  sup,        \* Electron main: "run" | "fatal" (DSH fatal dialog) | "gaveUp"
  armed,      \* SUP:111 a Host was ready in this app launch
  safeMode,   \* SUP:110
  timer,      \* SUP:112 restart timer: ticks left, or -1 for none
  policy,     \* POL:28 times, as ages in ticks
  launches,   \* app launches so far
  host,       \* [pid, phase: spawned|booting|ready|dead, safe, ghost death and running]
  nextPid,
  run,        \* ghost: whose code the main thread runs (None = host code or idle)
  slot,       \* WD:43 the running-widget slot (set only inside runAs/inSlot)
  beat,       \* WD:123 the main thread bumped the heartbeat since the last poll
  stall,      \* WDW:165 poll steps since the last beat
  provAt,     \* WDW:143 provisionalAt !== undefined
  registered, \* ISO:290 track(): agent rows whose package folder the Host knows
  loaded,     \* per row: "absent" | "live" | "held" (quarantined) | "off" (safe mode)
  crash,      \* $DSH_HOME/deepwidgets/crash.json (+ ghost death/running of its Host)
  prov,       \* $DSH_HOME/deepwidgets/provisional.json (+ ghost death/running)
  quar,       \* $DSH_HOME/deepwidgets/quarantine.json, per row
  hash,       \* current package-hash version of each row's files
  unbl,       \* ghost: ages of the crashes the supervisor decided were unblamed
  lastCount,  \* ghost: |unbl| at the last decision
  last,       \* ghost: the last decision of supervisor.failed()
  ghostQ      \* ghost: per row, the true files version at its last quarantine (-1 none)

vars == <<sup, armed, safeMode, timer, policy, launches, host, nextPid, run, slot,
          beat, stall, provAt, registered, loaded, crash, prov, quar, hash, unbl,
          lastCount, last, ghostQ>>
mainVars == <<run, slot, beat, stall, provAt, registered, loaded>>
supVars == <<sup, armed, safeMode, timer, policy, launches, unbl, lastCount, last>>

Alive == host.phase \in {"spawned", "booting", "ready"}
Started == host.phase \in {"booting", "ready"}  \* the isolation ran (ISO:167)

\* A record as ISO:259-270 (claimer) and WDW:108-122 (watchdog) write it.
\* hash is -1 (null) when the Host does not know the row's package folder:
\* root comes only from track() (ISO:257-258, WD:113,141).
Record(row) == [kind |-> "rec", pid |-> host.pid, row |-> row,
                hash |-> IF row # None /\ (row \in registered \/ row = Sample) THEN hash[row] ELSE -1,
                trueHash |-> IF row = None THEN -1 ELSE hash[row],
                applied |-> FALSE, death |-> "alive", running |-> None]
QEntry(r, src) == [kind |-> "q", hash |-> r.hash, trueHash |-> r.trueHash, src |-> src,
                   pid |-> r.pid, death |-> r.death, running |-> r.running]
NoDecision == [blamed |-> FALSE, src |-> "none", pid |-> 0, srcPid |-> 0, death |-> "none", added |-> FALSE]

NewHost(p, safe) ==
  /\ host' = [kind |-> "host", pid |-> p, phase |-> "spawned", safe |-> safe, death |-> "alive", running |-> None]
  /\ nextPid' = p + 1
  /\ run' = None /\ slot' = None /\ beat' = FALSE /\ stall' = 0 /\ provAt' = FALSE
  /\ registered' = {}
  /\ loaded' = [w \in Widgets |-> "absent"]

Init ==
  /\ sup = "run" /\ armed = FALSE /\ safeMode = FALSE /\ timer = -1 /\ policy = {}
  /\ launches = 1
  /\ host = [kind |-> "host", pid |-> 1, phase |-> "spawned", safe |-> FALSE, death |-> "alive", running |-> None]
  /\ nextPid = 2
  /\ run = None /\ slot = None /\ beat = FALSE /\ stall = 0 /\ provAt = FALSE
  /\ registered = {} /\ loaded = [w \in Widgets |-> "absent"]
  /\ crash = NoRec /\ prov = NoRec /\ quar = [w \in Widgets |-> NoQ]
  /\ hash = [w \in Widgets |-> 0]
  /\ unbl = {} /\ lastCount = 0 /\ last = NoDecision
  /\ ghostQ = [w \in Widgets |-> -1]

(***************************************************************************)
(* Host boot: the widgets runtime row creates the isolation (ISO:167-209).   *)
(***************************************************************************)
IsolationStart ==
  /\ host.phase = "spawned"
  /\ LET c == crash
         applyC == c # NoRec /\ ~c.applied                                \* ISO:185-186
         q1 == IF applyC /\ c.row # None /\ Mutant # "no_quarantine" THEN [quar EXCEPT ![c.row] = QEntry(c, "crash")] ELSE quar
         c1 == IF applyC THEN [c EXCEPT !.applied = TRUE] ELSE c          \* ISO:183
         p == prov
         applyP == p # NoRec /\ ~p.applied /\ p.pid # host.pid           \* ISO:192-193
         sameHost == c # NoRec /\ c.pid = p.pid                           \* ISO:194
         q2 == IF applyP /\ ~sameHost /\ p.row # None THEN [q1 EXCEPT ![p.row] = QEntry(p, "prov")] ELSE q1
         p1 == IF applyP THEN [p EXCEPT !.applied = TRUE] ELSE p          \* ISO:183,194
         \* ISO:199-209 held(): a changed hash lifts the row, only when root and hash are known
         lifted(w) == q2[w] # NoQ /\ q2[w].hash # -1 /\ q2[w].hash # hash[w]
         q3 == [w \in Widgets |-> IF lifted(w) THEN NoQ ELSE q2[w]]
         \* ISO:224-229 a held row loads as failed; IDX:876 safe mode turns agent rows off
         status(w) == IF q3[w] # NoQ THEN "held"
                      ELSE IF host.safe /\ w \in Agents THEN "off" ELSE "live"
         newQ(w) == IF applyP /\ ~sameHost /\ p.row = w THEN p.trueHash
                    ELSE IF applyC /\ c.row = w THEN c.trueHash
                    ELSE ghostQ[w]
     IN /\ crash' = c1 /\ prov' = p1 /\ quar' = q3
        /\ loaded' = [w \in Widgets |-> status(w)]
        /\ ghostQ' = [w \in Widgets |-> newQ(w)]
  /\ host' = [host EXCEPT !.phase = "booting"]
  /\ UNCHANGED <<supVars, nextPid, run, slot, beat, stall, provAt, registered, hash>>

\* The Host sends 'ready'; Electron main calls supervisor.ready() (SUP:142, main.ts:630).
HostReady ==
  /\ host.phase = "booting" /\ run = None
  /\ host' = [host EXCEPT !.phase = "ready"]
  /\ armed' = TRUE
  /\ UNCHANGED <<sup, safeMode, timer, policy, launches, unbl, lastCount, last, nextPid, mainVars,
                 crash, prov, quar, hash, ghostQ>>

(***************************************************************************)
(* Main thread.                                                            *)
(***************************************************************************)
\* Widget code starts: inside runAs (slot set: ISO:81, WD:40-48) or as an async
\* continuation that keeps the blame store but not the slot (WD:11-12).
RunWidget(w, slotted) ==
  /\ Started /\ run = None /\ loaded[w] = "live"
  /\ run' = w /\ slot' = IF slotted THEN w ELSE None
  /\ UNCHANGED <<supVars, host, nextPid, beat, stall, provAt, registered, loaded,
                 crash, prov, quar, hash, ghostQ>>

\* The agent widget registers a slug: track() gives the Host its package folder (ISO:290-296).
Register(w) ==
  /\ Started /\ run = w /\ w \notin registered
  /\ registered' = registered \cup {w}
  /\ UNCHANGED <<supVars, host, nextPid, run, slot, beat, stall, provAt, loaded,
                 crash, prov, quar, hash, ghostQ>>

\* The widget code returns (WD:47). The next code can run before the beat timer.
FinishWidget ==
  /\ Started /\ run # None
  /\ run' = None /\ slot' = None
  /\ UNCHANGED <<supVars, host, nextPid, beat, stall, provAt, registered, loaded,
                 crash, prov, quar, hash, ghostQ>>

\* WD:123 the heartbeat timer runs (only when the main thread is free).
Beat ==
  /\ Started /\ run = None /\ ~beat
  /\ beat' = TRUE
  /\ UNCHANGED <<supVars, host, nextPid, run, slot, stall, provAt, registered, loaded,
                 crash, prov, quar, hash, ghostQ>>

(***************************************************************************)
(* Watchdog thread (WDW:145-200).                                          *)
(***************************************************************************)
OwnProv == prov # NoRec /\ prov.pid = host.pid /\ ~prov.applied

\* WDW:150-157: the heartbeat came back; remove our provisional record (WDW:125-130).
PollBeat ==
  /\ Started /\ beat
  /\ beat' = FALSE /\ stall' = 0 /\ provAt' = FALSE
  /\ prov' = IF provAt /\ OwnProv /\ Mutant # "keep_prov" THEN NoRec ELSE prov
  /\ UNCHANGED <<supVars, host, nextPid, run, slot, registered, loaded, crash, quar, hash, ghostQ>>

\* WDW:165-180: no beat while code runs. At Q steps, a provisional record that
\* names the slot only (WDW:167-169). (An idle main thread beats within a step.)
PollStall ==
  /\ Started /\ ~beat /\ run # None /\ stall + 1 < T
  /\ stall' = stall + 1
  /\ IF stall + 1 >= Q /\ ~provAt /\ slot # None
       THEN prov' = Record(slot) /\ provAt' = TRUE
       ELSE UNCHANGED <<prov, provAt>>
  /\ UNCHANGED <<supVars, host, nextPid, run, slot, beat, registered, loaded, crash, quar, hash, ghostQ>>

\* WDW:159-164: this thread did not run for half the threshold (sleep, SIGSTOP):
\* the stall clock starts again. provisionalAt stays.
Suspend ==
  /\ Started /\ ~beat /\ stall > 0
  /\ stall' = 0
  /\ UNCHANGED <<supVars, host, nextPid, run, slot, beat, provAt, registered, loaded,
                 crash, prov, quar, hash, ghostQ>>

(***************************************************************************)
(* Host deaths. Ghost: each record of the dying Host learns how it died.    *)
(***************************************************************************)
Mark(r, kind) == IF r # NoRec /\ r.pid = host.pid THEN [r EXCEPT !.death = kind, !.running = run] ELSE r
Die(kind) ==
  /\ host' = [host EXCEPT !.phase = "dead", !.death = kind, !.running = run]
  /\ run' = None /\ slot' = None /\ beat' = FALSE /\ stall' = 0 /\ provAt' = FALSE

\* WDW:181-199: the stall reaches the threshold: crash record by the slot, remove
\* the provisional record, SIGKILL. (No native module under Electron: WD:10-12.)
WatchdogKill ==
  /\ Started /\ ~beat /\ run # None /\ stall + 1 >= T
  /\ crash' = Mark(Record(slot), "wdkill")
  /\ prov' = IF ~provAt /\ slot # None THEN NoRec   \* written and removed in this poll
             ELSE IF provAt /\ OwnProv THEN NoRec ELSE prov
  /\ Die("wdkill")
  /\ UNCHANGED <<supVars, nextPid, registered, loaded, quar, hash, ghostQ>>

\* ISO:251-278 claimer: uncaught exception or unhandled rejection; the store
\* names the row whose code runs (sync or async); crash.json; exit(1).
Throw ==
  /\ Started
  /\ crash' = Mark(Record(run), "exit1")
  /\ prov' = Mark(prov, "exit1")
  /\ Die("exit1")
  /\ UNCHANGED <<supVars, nextPid, registered, loaded, quar, hash, ghostQ>>

\* V8 out-of-memory or fatal error: SIGABRT/SIGTRAP/SIGILL or code 134. No JS runs.
Abort ==
  /\ Alive
  /\ crash' = Mark(crash, "abort") /\ prov' = Mark(prov, "abort")
  /\ Die("abort")
  /\ UNCHANGED <<supVars, nextPid, registered, loaded, quar, hash, ghostQ>>

\* Another end with no record: SIGKILL by the OS or the user, or a plain exit code.
OtherExit ==
  /\ Alive
  /\ crash' = Mark(crash, "kill") /\ prov' = Mark(prov, "kill")
  /\ Die("kill")
  /\ UNCHANGED <<supVars, nextPid, registered, loaded, quar, hash, ghostQ>>

\* Boot fails: main() rejects and sends IPC 'fatal' first (apps/desktop-host/src/index.ts:154-166);
\* that failure carries no hostPid (HP:254, SUP:47-50).
BootFail ==
  /\ host.phase \in {"spawned", "booting"} /\ run = None
  /\ crash' = Mark(crash, "bootfail") /\ prov' = Mark(prov, "bootfail")
  /\ Die("bootfail")
  /\ UNCHANGED <<supVars, nextPid, registered, loaded, quar, hash, ghostQ>>

(***************************************************************************)
(* Electron main: supervisor.failed() (SUP:152-184) with HostCrashPolicy.   *)
(***************************************************************************)
HostFails ==
  /\ host.phase = "dead"
  /\ LET pid == IF host.death = "bootfail" THEN 0 ELSE host.pid            \* SUP:47-50
         aborted == host.death = "abort"                                  \* SUP:71-79
         own == pid # 0 /\ crash # NoRec /\ (crash.pid = pid \/ Mutant = "no_pid_check")   \* SUP:93
         crow == IF own /\ crash.row # None /\ ~crash.applied THEN crash.row ELSE None   \* SUP:58-63
         prow == IF ~own /\ pid # 0 /\ prov # NoRec /\ (prov.pid = pid \/ Mutant = "no_pid_check") /\ ~prov.applied /\ prov.row # None
                 THEN prov.row ELSE None                                  \* SUP:95
         discard == prow # None /\ ~aborted                               \* SUP:96
         row == IF own THEN crow ELSE IF discard THEN None ELSE prow
         times == IF row = None \/ Mutant = "no_blame_skip" THEN policy \cup {0} ELSE policy   \* POL:40-41
         n == Cardinality(times)
         u1 == IF row = None THEN unbl \cup {0} ELSE unbl
         dec == [blamed |-> row # None,
                 src |-> IF row = None THEN "none" ELSE IF own THEN "crash" ELSE "prov",
                 pid |-> pid,
                 srcPid |-> IF row = None THEN 0 ELSE IF own THEN crash.pid ELSE prov.pid,
                 death |-> host.death,
                 added |-> times # policy]
     IN IF ~armed
          THEN \* SUP:153: not armed -> DSH fatal dialog (main.ts:631); nothing is discarded
               /\ sup' = "fatal" /\ host' = NoHost
               /\ UNCHANGED <<armed, safeMode, timer, policy, launches, unbl, lastCount, last, prov>>
          ELSE /\ prov' = IF discard THEN NoRec ELSE prov                 \* SUP:36-44,159
               /\ policy' = times /\ unbl' = u1 /\ lastCount' = Cardinality(u1) /\ last' = dec
               /\ host' = NoHost
               /\ IF n >= (IF Mutant = "give_up_late" THEN 5 ELSE 4)     \* POL:43 GIVE_UP_AFTER
                    THEN sup' = "gaveUp" /\ timer' = (IF Mutant = "no_dispose" THEN 1 ELSE -1) /\ UNCHANGED safeMode   \* SUP:161-164,187-192
                    ELSE /\ sup' = sup
                         /\ safeMode' = (IF Mutant = "safe_off_by_one" THEN n > 2 ELSE n >= 2)   \* POL:48 SAFE_MODE_AFTER
                         /\ timer' = IF row = None THEN Backoff[Min(n, 3)] ELSE Backoff[1]  \* POL:47
               /\ UNCHANGED <<armed, launches>>
  /\ UNCHANGED <<nextPid, mainVars, crash, quar, hash, ghostQ>>

AgeBy(S, d) == {a + d : a \in {x \in S : x + d < WIN}}

\* A ready Host runs quietly for a full window: each crash ages out (POL:40).
LongQuiet ==
  /\ host.phase = "ready" /\ run = None /\ ~provAt /\ (policy # {} \/ unbl # {})
  /\ policy' = {} /\ unbl' = {}
  /\ UNCHANGED <<sup, armed, safeMode, timer, launches, lastCount, last, host, nextPid, mainVars,
                 crash, prov, quar, hash, ghostQ>>

\* SUP:170-182 the timer fires after its delay (the crashes age by it): start a
\* new Host with the safe-mode env (main.ts:549).
Restart ==
  /\ sup = "run" /\ host = NoHost /\ timer > 0 /\ nextPid <= MaxHosts
  /\ NewHost(nextPid, safeMode)
  /\ timer' = -1 /\ policy' = AgeBy(policy, timer) /\ unbl' = AgeBy(unbl, timer)
  /\ UNCHANGED <<sup, armed, safeMode, launches, lastCount, last,
                 crash, prov, quar, hash, ghostQ>>

\* The user starts the app again after a dialog. Files under $DSH_HOME stay.
Relaunch ==
  /\ sup \in {"fatal", "gaveUp"} /\ host = NoHost /\ launches < MaxLaunch /\ nextPid <= MaxHosts
  /\ NewHost(nextPid, FALSE)
  /\ sup' = "run" /\ armed' = FALSE /\ safeMode' = FALSE /\ timer' = -1 /\ policy' = {}
  /\ launches' = launches + 1 /\ unbl' = {} /\ lastCount' = 0 /\ last' = NoDecision
  /\ UNCHANGED <<crash, prov, quar, hash, ghostQ>>

\* A new version of an agent widget's files is installed while no Host runs.
ChangeHash(w) ==
  /\ ~Alive /\ hash[w] < MaxHash
  /\ hash' = [hash EXCEPT ![w] = hash[w] + 1]
  /\ UNCHANGED <<supVars, host, nextPid, mainVars, crash, prov, quar, ghostQ>>

\* End states of the bounded model.
Done ==
  /\ host = NoHost
  /\ \/ sup = "run" /\ timer > 0 /\ nextPid > MaxHosts
     \/ sup \in {"fatal", "gaveUp"} /\ (launches >= MaxLaunch \/ nextPid > MaxHosts)
  /\ UNCHANGED vars

Next ==
  \/ IsolationStart \/ HostReady
  \/ \E w \in Agents, s \in BOOLEAN : RunWidget(w, s)
  \/ RunWidget(Sample, TRUE)
  \/ \E w \in Agents : Register(w)
  \/ FinishWidget \/ Beat
  \/ PollBeat \/ PollStall \/ WatchdogKill \/ Suspend
  \/ Throw \/ Abort \/ OtherExit \/ BootFail
  \/ HostFails \/ LongQuiet \/ Restart \/ Relaunch
  \/ \E w \in Agents : ChangeHash(w)
  \/ Done

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* Mutants. Each value of Mutant breaks the code like one code mistake, and *)
(* its config in cfg/mut/ must break one rule:                              *)
(*   no_blame_skip    a blamed crash counts       -> BlamedCrashNeverCounts *)
(*   safe_off_by_one  safe mode after 3, not 2    -> SafeModeAfterTwo       *)
(*   give_up_late     give up after 5, not 4      -> GiveUpAtFour           *)
(*   no_dispose       restart timer after give-up -> NoRestartAfterGiveUp   *)
(*   no_quarantine    the crash record is ignored -> QuarantinedNeverRuns   *)
(*   no_pid_check     no pid match in the blame   -> RecordOnlyBlamesItsHost*)
(*   keep_prov        the beat keeps provisional  -> ProvisionalGoneAfterBeat *)
(***************************************************************************)

(***************************************************************************)
(* Rules.                                                                   *)
(***************************************************************************)
\* BlamedCrashNeverCounts (SPEC:36; SUP:4,156; POL:3-4,35-36): a blamed crash never counts.
BlamedCrashNeverCounts == last.blamed => ~last.added

\* SafeModeAfterTwo (SPEC:40; POL:13-14): 2 unblamed crashes in the window start safe mode,
\* and the next Host starts in that mode (main.ts:549, IDX:504).
SafeModeAfterTwo ==
  /\ (sup = "run" /\ last # NoDecision) => (safeMode <=> lastCount >= 2)
  /\ (Alive /\ sup = "run") => (host.safe <=> safeMode)
\* GiveUpAtFour (SPEC:40; POL:15-16): 4 unblamed crashes in the window give up.
GiveUpAtFour == (lastCount >= 4) <=> (sup = "gaveUp")
\* NoRestartAfterGiveUp (SUP:186-192): the supervisor never restarts the Host after the give-up.
NoRestartAfterGiveUp == sup = "gaveUp" => (host = NoHost /\ timer = -1)

\* QuarantinedNeverRuns (SPEC:36-38; ISO:8-9): a quarantined agent widget never runs until its hash changes.
QuarantinedNeverRuns ==
  \A w \in Agents : (run = w \/ loaded[w] = "live") => ~(ghostQ[w] # -1 /\ ghostQ[w] = hash[w])
\* HashChangeLifts (SPEC:38; ISO:198): after a hash change, it can run again (it is not held).
HashChangeLifts ==
  \A w \in Agents : (Started /\ loaded[w] = "held") => ghostQ[w] = hash[w]

\* SampleNeverQuarantined and SampleLiveInSafeMode (brief; SPEC:40 "each agent widget is off"; IDX:40-45): the built-in sample
\* is never quarantined, and it is live in safe mode.
SampleNeverQuarantined == quar[Sample] = NoQ
SampleLiveInSafeMode == (Started /\ host.safe) => loaded[Sample] = "live"

\* RecordOnlyBlamesItsHost (SUP:52-55,65-66; ISO:8): a record blames only the crash of the Host that wrote it.
RecordOnlyBlamesItsHost == last.blamed => (last.pid # 0 /\ last.srcPid = last.pid)

\* ProvisionalOnlyOnAbort (SUP:81-86; ISO:187-191): a provisional record blames only after an abort.
ProvisionalOnlyOnAbort ==
  /\ last.src = "prov" => last.death = "abort"
  /\ \A w \in Widgets : quar[w].src = "prov" => quar[w].death = "abort"

\* InnocentNeverQuarantined (SPEC:16-20,28): a widget whose code did not run when its Host died is never quarantined.
InnocentNeverQuarantined ==
  \A w \in Widgets : quar[w] # NoQ => quar[w].running = w

\* ProvisionalGoneAfterBeat (SPEC:28; WDW:5-6,150-157): the provisional record is gone once the heartbeat came back.
ProvisionalGoneAfterBeat == (Started /\ ~provAt) => ~OwnProv

TypeOK ==
  /\ sup \in {"run", "fatal", "gaveUp"}
  /\ stall \in 0..T
  /\ run \in Widgets \cup {None} /\ slot \in Widgets \cup {None}
=============================================================================
