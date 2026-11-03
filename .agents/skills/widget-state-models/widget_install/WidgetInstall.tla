---------------------------- MODULE WidgetInstall ----------------------------
(***************************************************************************)
(* The agent tools widget_install, widget_reload, and widget_remove of     *)
(* deepWidgets at commit b3af1ff7 (spec widget_fv.replace is in).       *)
(*                                                                         *)
(* Code: deepwidgets/mcp/src/creation.ts (C), deepwidgets/widgets/src/     *)
(* index.ts (W), deepwidgets/widgets/src/isolation.ts (I),                 *)
(* packages/boot/plugin-manager/src/index.ts (PM).                          *)
(* Each await of WidgetInstaller.installNow / remove / reload is one step. *)
(* WidgetInstaller.serial (C:450-454) runs one job at a time, so the model *)
(* has one job slot. Crashes, user calls, user program edits, and the user *)
(* switch of the built-in sample row interleave with every job step.       *)
(*                                                                         *)
(* widget_fv.replace: each agent slug has two package names, A and B       *)
(* (C:166-173). Each name is its own row and its own folder. A replace     *)
(* installs the new version under the name that is not installed. Its      *)
(* registration waits as the standby of the old entry (W:1185-1268), and   *)
(* the old bundle goes only after the new one registered.                  *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS AgentSlugs,   \* slugs that only agent code registers, e.g. {"a"}
          MaxCalls,     \* bound on agent tool calls
          MaxCrashes,   \* bound on host crashes
          DeselectFails, \* TRUE: PM removeBundle can deselect the bundle and then fail in `pnpm remove`
          Mutant        \* "none" for the code; a broken variant proves that a rule can fail

None    == "none"
BuiltIn == "sample"                     \* deepwidgets/widget-sample registers slug "sample"
Slugs   == AgentSlugs \cup {BuiltIn}    \* slugs that agent code can register
(* C:166-173: A is deepwidgets-agent-<slug> in <root>/<slug>, B is deepwidgets-agent-<slug>.b in <root>/<slug>.b. *)
Names   == {"A", "B"}
Other(n) == IF n = "A" THEN "B" ELSE "A"

(* The agent code of one install. Its seed program, whether it passes the   *)
(* three gates (C:382-401), and what its apply does in the host.            *)
Codes == {"v1", "v2", "bad", "lint"}
Seed(c) == CASE c = "v1" -> "p1" [] c = "v2" -> "p2" [] c = "bad" -> "p3" [] c = "lint" -> "p4"
Seeds == {"p1", "p2", "p3", "p4"}
GatePass(c) == c # "lint"               \* lint: a raw setTimeout, refused by the lint gate
ApplyOk(c)  == c \in {"v1", "v2"}       \* bad: registers, then throws in the host only (passes the test run)

VARIABLES
  inst,       \* [Slugs -> [Names -> BOOLEAN]]  the package of the name is in the profile package.json (PM listBundles .installed).
              \* It is a link: dependency to the folder of the name, so the code that loads is `folder`.
  enabled,    \* [Slugs -> [Names -> BOOLEAN]]  the bundle is selected (dsh.profile.bundles)
  folder,     \* [Slugs -> [Names -> None \cup Codes]]  the folder of the name
  reg,        \* [Slugs -> {"none","live","failed","off"}]  the runtime entry of an agent registration of the slug
  row,        \* [Slugs -> {None} \cup Names]  the name whose row owns the live or failed entry
  sby,        \* [Slugs -> {None} \cup Names]  the name whose registration waits as the standby (W:1210-1232)
  sbyCode,    \* [Slugs -> {None} \cup Codes]  the code of the standby. It runs from memory, also after its folder goes.
  offMap,     \* [Slugs -> BOOLEAN]          W:1187-1192 `off`: safe mode refused the agent slug in this host start
  sampleOn,   \* the built-in sample row is on (the user can switch it in the plugin manager)
  prog,       \* [Slugs -> None \cup Seeds \cup {"edit"}]  stored program (storage table `program`)
  state,      \* [Slugs -> {"none","init","used"}]         stored state (storage table `state`)
  everUsed,   \* ghost: a user call wrote the state of the slug
  pseed,      \* [Slugs -> None \cup Seeds]  the seed hash in the program record (W:286-291); it lands
              \* in the same put as prog. An edit keeps it (W:1061-1073). The older file .seeds/<slug>
              \* (C:506-519) is not in the model: the model starts with no records.
  lastInst,   \* ghost: seed of the code that last went live for the slug. A load that throws, that safe
              \* mode refuses, that the quarantine holds, or that waits as a standby does not count. The
              \* restore of a rollback puts back the value from before the install (spec widget_fv.install:
              \* a rolled-back install leaves the program as before).
  quar,       \* [Slugs -> [Names -> BOOLEAN]]  I: quarantine.json has an item for the row of the name
  bl,         \* [Slugs -> [Names -> BOOLEAN]]  the folder of the name still has the files whose hash the item names
  runBlamed,  \* ghost [Slugs -> BOOLEAN]: the live registration was loaded from blamed files
  safe,       \* this host start is in safe mode (W:1187)
  crashes, calls,
  job         \* the one running installer job

vars == <<inst, enabled, folder, reg, row, sby, sbyCode, offMap, sampleOn, prog, state, everUsed,
          pseed, lastInst, quar, bl, runBlamed, safe, crashes, calls, job>>

(* The runtime of one slug, as one record (below: RS and SetRS). *)
rt == <<reg, row, sby, sbyCode, offMap, prog, pseed, state, quar, runBlamed, lastInst>>

NoJob == [op |-> "none", s |-> "none", c |-> "none", pc |-> "idle", replaced |-> FALSE,
          prevSeed |-> "none", old |-> "none", name |-> "none", oldCode |-> "none", oldOn |-> FALSE, oldLive |-> FALSE, early |-> FALSE,
          wrote |-> FALSE, edited |-> FALSE, app |-> "none", err |-> "", builtinHeld |-> FALSE, editedAtStart |-> FALSE,
          snapP |-> "none", snapS |-> "none",
          beforeP |-> "unset", beforeS |-> "unset", editAfter |-> FALSE, hold |-> FALSE, pend |-> {}, newLeft |-> FALSE, beforeL |-> "none"]

TypeOK ==
  /\ inst \in [Slugs -> [Names -> BOOLEAN]]
  /\ enabled \in [Slugs -> [Names -> BOOLEAN]]
  /\ folder \in [Slugs -> [Names -> {None} \cup Codes]]
  /\ reg \in [Slugs -> {"none", "live", "failed", "off"}]
  /\ row \in [Slugs -> {None} \cup Names]
  /\ sby \in [Slugs -> {None} \cup Names]
  /\ sbyCode \in [Slugs -> {None} \cup Codes]
  /\ offMap \in [Slugs -> BOOLEAN]
  /\ sampleOn \in BOOLEAN
  /\ prog \in [Slugs -> {None, "edit", "p0"} \cup Seeds]
  /\ state \in [Slugs -> {"none", "init", "used"}]
  /\ pseed \in [Slugs -> {None} \cup Seeds]
  /\ quar \in [Slugs -> [Names -> BOOLEAN]]
  /\ bl \in [Slugs -> [Names -> BOOLEAN]]
  /\ safe \in BOOLEAN

Init ==
  /\ inst = [s \in Slugs |-> [n \in Names |-> FALSE]]
  /\ enabled = [s \in Slugs |-> [n \in Names |-> FALSE]]
  /\ folder = [s \in Slugs |-> [n \in Names |-> None]]
  /\ reg = [s \in Slugs |-> "none"]
  /\ row = [s \in Slugs |-> None]
  /\ sby = [s \in Slugs |-> None]
  /\ sbyCode = [s \in Slugs |-> None]
  /\ offMap = [s \in Slugs |-> FALSE]
  /\ sampleOn = TRUE
  \* The built-in sample is live and seeded at start.
  /\ prog = [s \in Slugs |-> IF s = BuiltIn THEN "p0" ELSE None]
  /\ state = [s \in Slugs |-> IF s = BuiltIn THEN "init" ELSE "none"]
  /\ everUsed = [s \in Slugs |-> FALSE]
  /\ pseed = [s \in Slugs |-> None]
  /\ lastInst = [s \in Slugs |-> None]
  /\ quar = [s \in Slugs |-> [n \in Names |-> FALSE]]
  /\ bl = [s \in Slugs |-> [n \in Names |-> FALSE]]
  /\ runBlamed = [s \in Slugs |-> FALSE]
  /\ safe = FALSE
  /\ crashes = 0
  /\ calls = 0
  /\ job = NoJob

Installed(s) == \E n \in Names : inst[s][n]

(* W:1300-1303 `list()`: live and failed entries, and the slugs that safe mode refused in this start. *)
InList(s) == reg[s] # "none" \/ offMap[s] \/ (s = BuiltIn /\ sampleOn)

(* C:607-610 (widget.builtin_slugs, W:115-138): the slug of a built-in widget is reserved, also *)
(* while its row is off. Mutant offAllowed: only a live built-in takes its slug, as before the rule.   *)
(* Mutant builtinRow also has no reservation: it is the row-id clash of aa7cd518.                     *)
Reserved == Mutant \notin {"offAllowed", "builtinRow"}

(* C:613-616: slug-taken counts the widgets in list() that are not off: live and failed entries. *)
Taken(s) == reg[s] \in {"live", "failed"} \/ (s = BuiltIn /\ sampleOn)

---------------------------------------------------------------------------
(* The runtime of one slug as a record. A step computes a new record, and SetRS writes it back. *)

RS(s) == [reg |-> reg[s], row |-> row[s], sby |-> sby[s], sc |-> sbyCode[s], off |-> offMap[s], p |-> prog[s], ps |-> pseed[s],
          st |-> state[s], q |-> quar[s], rb |-> runBlamed[s], li |-> lastInst[s], threw |-> FALSE, pend |-> {}]

SetRS(s, R) ==
  /\ reg' = [reg EXCEPT ![s] = R.reg]
  /\ row' = [row EXCEPT ![s] = R.row]
  /\ sby' = [sby EXCEPT ![s] = R.sby]
  /\ sbyCode' = [sbyCode EXCEPT ![s] = R.sc]
  /\ offMap' = [offMap EXCEPT ![s] = R.off]
  /\ prog' = [prog EXCEPT ![s] = R.p]
  /\ pseed' = [pseed EXCEPT ![s] = R.ps]
  /\ state' = [state EXCEPT ![s] = R.st]
  /\ quar' = [quar EXCEPT ![s] = R.q]
  /\ runBlamed' = [runBlamed EXCEPT ![s] = R.rb]
  /\ lastInst' = [lastInst EXCEPT ![s] = R.li]

(* W:1161-1182 seed of an agent row: no record, or a record whose seed hash differs from the seed  *)
(* of the code that loads, gets the seed of the code. Text and hash land in one put. A record     *)
(* with no hash stays.                                                                           *)
(* Mutant seedFile: the code before widget_fv.install. The hash is in its own file (.seeds/<slug>), *)
(* the load writes the program only when storage has none, and the installer writes the file last.  *)
NewSeed(R, c) ==
  IF Mutant = "seedFile" THEN R.p = None
  ELSE R.p = None \/ (R.ps # None /\ R.ps # Seed(c))
LoadSeed(R, c) == IF Mutant = "seedFile" THEN R.ps ELSE Seed(c)

(* W:1236-1268 start: the registration of name n with code c goes live. seed() runs in start, and    *)
(* the state record is made when there is none. blv: whether each folder has the blamed files.     *)
Live(R, n, c, blv) ==
  [R EXCEPT !.reg = "live", !.row = n,
            !.p = IF NewSeed(R, c) THEN Seed(c) ELSE @,
            !.ps = IF NewSeed(R, c) THEN LoadSeed(R, c) ELSE @,
            !.st = IF @ = "none" \/ Mutant = "stateReset" THEN "init" ELSE @,
            !.rb = blv[n], !.li = Seed(c)]

(* I:233-247 lift, I:283-307 wrap: a quarantine item of the row ends only when other files load with  *)
(* success. I:249-275, I:373-385 holdLift and settleLift: during the install job of the slug, a load  *)
(* with success only marks the item (pend). The item goes when the install succeeds.                   *)
(* widget_fv.replace (I:262-274 loaded): during the install, the load also marks the item of the other  *)
(* name of the slug. The replace removes that name before it succeeds, and LiveCheck lifts an item only *)
(* when its folder no longer has the blamed files.                                                     *)
(* A replace never loads other files under the row of the old name, and a row that loaded other files  *)
(* never gets the blamed files back. Thus the hold guards no path of this model: the mutant liftAtLoad  *)
(* of widget.install_records (the item goes at the load) holds QuarantineHolds.                        *)
LiftQ(R, n, holding) ==
  [R EXCEPT !.q = [@ EXCEPT ![n] = @ /\ holding], !.pend = @ \cup {m \in {n, Other(n)} : R.q[m] /\ holding}]

(* I:233-239 held: the item of the row holds it while its folder still has the blamed files.  *)
(* Mutant oneName: the quarantine knows only the first name of a slug.                         *)
Held(R, n, blv) == R.q[n] /\ blv[n] /\ (Mutant # "oneName" \/ n = "A")

(* A row of name n of slug s loads code c: hmr reconcile in PM installBundle, or a host start. *)
(* sm: safe mode. holding: the install job of the slug holds the lift.                          *)
Step(R, s, n, c, sm, holding, blv) ==
  IF s = BuiltIn /\ Mutant # "builtinRow"
    \* Not reached by the code: widget.builtin_slugs refuses the slug of a built-in before a load
    \* (CheckInstalled). Only the mutants offAllowed and builtinRow install the slug sample. This branch
    \* is the behavior at aa7cd518: the agent row deepwidgets-widget-sample never started.
    THEN R
  ELSE IF Held(R, n, blv)
    \* W:1334-1340 hold: a held row shows a failed entry, only when the slug has no entry.
    THEN IF R.reg \in {"live", "failed"} THEN R ELSE [R EXCEPT !.reg = "failed", !.row = n]
  ELSE IF sm
    \* W:1187-1192: safe mode refuses an agent widget (it goes into `off`) before the slug check.
    THEN [R EXCEPT !.off = TRUE, !.reg = IF @ \in {"live", "failed"} THEN @ ELSE "off", !.threw = TRUE]
  ELSE IF R.reg \in {"live", "failed"}
    \* W:1193-1201: the slug has an entry. A registration of another agent row waits as its standby
    \* (W:1212-1222 wait), and writes no seed. Bad code registers the standby, then throws: the end of
    \* its fiber drops the standby. A second standby, or the row of the entry itself, is a conflict.
    THEN IF R.row # n /\ R.sby = None /\ ApplyOk(c) THEN LiftQ([R EXCEPT !.sby = n, !.sc = c], n, holding)
         ELSE [R EXCEPT !.threw = TRUE]
  ELSE IF ApplyOk(c) THEN LiftQ(Live(R, n, c, blv), n, holding)
  \* bad: seed() starts in start(), before apply throws. The end of the fiber removes the entry.
  ELSE [Live(R, n, c, blv) EXCEPT !.reg = "none", !.row = None, !.rb = FALSE, !.li = R.li, !.threw = TRUE]

(* W:1224-1232 promote: the entry ended, and the standby takes its place (start, W:1236). *)
Promote(R, s) ==
  IF R.sby = None THEN R
  ELSE Live([R EXCEPT !.sby = None, !.sc = None], R.sby, R.sc, bl[s])

(* The fiber of the row of name n ends: PM removeBundle deselects the bundle and reloads.        *)
(* W:1256-1268: the entry of the row ends, and then its standby takes over. W:1217-1220: a       *)
(* standby that ends is dropped. An off slug is no longer off (as before widget_fv.replace).      *)
Dispose(R, s, n) ==
  IF R.row = n /\ R.reg \in {"live", "failed"}
    THEN Promote([R EXCEPT !.reg = "none", !.row = None, !.rb = FALSE], s)
  ELSE IF R.sby = n THEN [R EXCEPT !.sby = None, !.sc = None]
  ELSE IF R.reg = "off" THEN [R EXCEPT !.reg = "none"]
  ELSE R

(* PM removeBundle(name) (PM:1047-1079) of the name n of slug s. It first deselects the bundle and *)
(* reloads (its row stops), then runs `pnpm remove`. A failure of pnpm remove leaves the bundle    *)
(* installed but deselected (DeselectFails); a lock timeout or `not-removable` changes nothing.    *)
(* Each takes the step of the job: ok, nothing, or deselected.                                     *)
Removed(s, n) ==
  /\ inst' = [inst EXCEPT ![s][n] = FALSE]
  /\ enabled' = [enabled EXCEPT ![s][n] = FALSE]
  /\ SetRS(s, Dispose(RS(s), s, n))
Deselected(s, n) ==
  /\ DeselectFails
  /\ UNCHANGED inst
  /\ enabled' = [enabled EXCEPT ![s][n] = FALSE]
  /\ SetRS(s, Dispose(RS(s), s, n))

(* wrote: a load in the job changed the stored program (the seed rule of W:1161-1182). *)
Wrote(s) == job.wrote \/ prog'[s] # prog[s]

Goto(pc) == job' = [job EXCEPT !.pc = pc]
End(ok, code) == job' = [job EXCEPT !.pc = IF ok THEN "ok" ELSE "err", !.err = code]

---------------------------------------------------------------------------
(* The agent calls a tool. The call waits in the serial queue (C:450-454). *)

NewJob(op, s, c, pc) ==
  [NoJob EXCEPT !.op = op, !.s = s, !.c = c, !.pc = pc, !.prevSeed = lastInst[s],
                !.editedAtStart = op # "remove" /\ prog[s] = "edit"]

AgentInstall ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in Slugs, c \in Codes :
       /\ (s = BuiltIn => c = "v1")
       /\ job' = NewJob("install", s, c, "gates")
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, sampleOn, everUsed, bl, safe, crashes>>
  /\ UNCHANGED rt

AgentReload ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in AgentSlugs, c \in Codes : job' = NewJob("reload", s, c, "reloadCheck")
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, sampleOn, everUsed, bl, safe, crashes>>
  /\ UNCHANGED rt

AgentRemove ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in Slugs : job' = NewJob("remove", s, "v1", "removeCheck")
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, sampleOn, everUsed, bl, safe, crashes>>
  /\ UNCHANGED rt

---------------------------------------------------------------------------
(* installNow (C:596-652) and loadNew (C:659-716), one await per step. *)

JS == job.s
JC == job.c

(* The variables that a job step that only moves the job keeps. *)
Keep == <<inst, enabled, folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:554-562 reload: installedNames() and meta(). *)
ReloadCheck ==
  /\ job.pc = "reloadCheck"
  /\ IF \E n \in Names : folder[JS][n] # None /\ inst[JS][n] THEN Goto("gates") ELSE End(FALSE, "not-installed")
  /\ UNCHANGED Keep /\ UNCHANGED rt

(* C:597-603 runGates: a failed gate throws gate-failed before anything is written. *)
Gates ==
  /\ job.pc = "gates"
  /\ IF GatePass(JC) \/ Mutant = "skipGate" THEN Goto("checkInstalled") ELSE End(FALSE, "gate-failed")
  /\ UNCHANGED Keep /\ UNCHANGED rt

(* C:607-618 replaced = installedNames(slug) is not empty; slug-taken when not replaced and a widget *)
(* of the slug is in list() and not off. Then clearOff (W:1360 clears an agent entry only) and the  *)
(* migration of the older .seeds file (C:506-519, not in the model).                                *)
CheckInstalled ==
  /\ job.pc = "checkInstalled"
  /\ LET r == Installed(JS) IN
       IF JS = BuiltIn /\ Reserved
         THEN /\ job' = [job EXCEPT !.replaced = r, !.pc = "err", !.err = "slug-taken", !.builtinHeld = TRUE]
              /\ UNCHANGED offMap
       ELSE IF ~r /\ Taken(JS)
         THEN /\ job' = [job EXCEPT !.replaced = r, !.pc = "err", !.err = "slug-taken",
                             !.builtinHeld = (JS = BuiltIn /\ sampleOn)]
              /\ UNCHANGED offMap
         ELSE /\ job' = [job EXCEPT !.replaced = r, !.pc = "decide"]
              /\ offMap' = [offMap EXCEPT ![JS] = IF JS = BuiltIn THEN @ ELSE FALSE]
  /\ UNCHANGED Keep
  /\ UNCHANGED <<reg, row, sby, sbyCode, prog, pseed, state, quar, runBlamed, lastInst>>

(* C:619-638 the old name and the new name. When a host crash left both names installed, the name of  *)
(* the entry of the slug stays (registeredName: the live or failed row, else A), and the other one is   *)
(* removed first (removeFirst). It is at most a standby, so its removal promotes nothing. Its folder is *)
(* written again by WriteNew. The new version goes under the name that is not installed.              *)
(* The ghosts oldOn and oldLive: the old bundle is selected, and it is live, when the job decides.     *)
(* Mutant removeFirst: the old bundle goes before the new one is written, as before widget_fv.replace. *)
Decide ==
  /\ job.pc = "decide"
  /\ LET both == inst[JS]["A"] /\ inst[JS]["B"]
         keep == IF both THEN (IF reg[JS] \in {"live", "failed"} /\ row[JS] # None THEN row[JS] ELSE "A")
                 ELSE IF inst[JS]["A"] THEN "A" ELSE IF inst[JS]["B"] THEN "B" ELSE None
         new == IF keep = "A" THEN "B" ELSE "A"
         early == Mutant = "removeFirst" /\ keep # None
         J == [job EXCEPT !.old = keep, !.name = new, !.early = early,
                          !.oldCode = IF keep = None THEN None ELSE folder[JS][keep],
                          !.oldOn = keep # None /\ enabled[JS][keep],
                          !.oldLive = keep # None /\ reg[JS] = "live" /\ row[JS] = keep,
                          !.pc = IF early THEN "removeOld" ELSE "writeNew"]
     IN IF ~both
          THEN /\ job' = J
               /\ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
          ELSE \/ /\ Removed(JS, new)
                  /\ job' = [J EXCEPT !.wrote = Wrote(JS)]
               \/ /\ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
                  /\ job' = [J EXCEPT !.pc = "err", !.err = "install-failed"]
               \/ /\ Deselected(JS, new)
                  /\ job' = [J EXCEPT !.pc = "err", !.err = "install-failed", !.wrote = Wrote(JS)]
  /\ UNCHANGED <<folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:639 writeBundle(folder, name) (C:412-428): rm the folder of the new name, then write it. *)
WriteNew ==
  /\ job.pc = "writeNew"
  /\ folder' = [folder EXCEPT ![JS][job.name] = JC]
  /\ bl' = [bl EXCEPT ![JS][job.name] = FALSE]
  /\ Goto("snapshot")
  /\ UNCHANGED <<inst, enabled, sampleOn, everUsed, safe, crashes, calls>> /\ UNCHANGED rt

(* C:643-645 before = programRecord(slug) (W:1075-1080). Then holdLift(slug). beforeP and beforeS are *)
(* the ghost of the record before the install, for the rule RollbackKeepsRecord; snapP and snapS are  *)
(* what the code keeps for its restore. A live old version can still take a user edit after this.     *)
Snapshot ==
  /\ job.pc = "snapshot"
  /\ job' = [job EXCEPT !.snapP = prog[JS], !.snapS = pseed[JS], !.pc = "installNew",
                        !.beforeP = prog[JS], !.beforeS = pseed[JS], !.beforeL = lastInst[JS], !.hold = TRUE]
  /\ UNCHANGED Keep /\ UNCHANGED rt

Holding(s) == job.hold /\ job.s = s

(* C:671 PM installBundle(folder) (PM:873-1012). With hmr, a package that is already in package.json  *)
(* is refused (`already-installed`). pnpm can fail and change nothing. When the package goes in, the  *)
(* row loads at once, and the result is `failed` at enable when apply throws (the package stays).     *)
InstallNew ==
  /\ job.pc = "installNew"
  /\ \/ /\ ~inst[JS][job.name]
        /\ inst' = [inst EXCEPT ![JS][job.name] = TRUE]
        /\ enabled' = [enabled EXCEPT ![JS][job.name] = TRUE]
        /\ LET R == Step(RS(JS), JS, job.name, JC, safe, Holding(JS), bl[JS]) IN
             /\ SetRS(JS, R)
             /\ job' = [job EXCEPT !.app = IF R.threw THEN "failed" ELSE "applied", !.pc = "waitReg",
                                   !.wrote = job.wrote \/ R.p # prog[JS], !.pend = job.pend \cup R.pend]
     \/ /\ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
        /\ job' = [job EXCEPT !.app = "failed", !.pc = "waitReg"]
  /\ UNCHANGED <<folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:673-675 applied && registeredName(slug, [name]) within 5 s: the row of the new name has the live *)
(* entry or the standby. The wait can also time out when the widget registers late                    *)
(* (replay-quarantine.mjs, a-late).                                                                  *)
WaitReg ==
  /\ job.pc = "waitReg"
  /\ \/ /\ job.app = "applied"
        /\ (reg[JS] = "live" /\ row[JS] = job.name) \/ sby[JS] = job.name
        /\ Goto(IF job.old # None /\ ~job.early THEN "removeOld" ELSE "live")
     \/ Goto("undoCheck")
  /\ UNCHANGED Keep /\ UNCHANGED rt

(* C:676-688 removeBundle(old). Its entry ends, and the standby of the new name takes its place.   *)
(* When the removal fails and the new version is live (pnpm remove failed after the deselect, or the *)
(* old version was not live), the install succeeds with a warning. Else the install fails, and the  *)
(* old version stays.                                                                                *)
(* Mutant removeFirst: this step runs before WriteNew, and a failure ends the job.                   *)
RemoveOld ==
  /\ job.pc = "removeOld"
  /\ \/ /\ Removed(JS, job.old)
        /\ job' = [job EXCEPT !.pc = "rmOld", !.wrote = Wrote(JS)]
     \/ /\ \/ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
           \/ Deselected(JS, job.old)
        /\ job' = [job EXCEPT !.wrote = Wrote(JS),
                              !.pc = IF job.early THEN "err"
                                     ELSE IF reg'[JS] = "live" /\ row'[JS] = job.name THEN "live" ELSE "undoCheck",
                              !.err = IF job.early THEN "install-failed" ELSE @]
  /\ UNCHANGED <<folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:679 rm the folder of the old name. *)
RmOld ==
  /\ job.pc = "rmOld"
  /\ folder' = [folder EXCEPT ![JS][job.old] = None]
  /\ bl' = [bl EXCEPT ![JS][job.old] = FALSE]
  /\ Goto(IF job.early THEN "writeNew" ELSE "live")
  /\ UNCHANGED <<inst, enabled, sampleOn, everUsed, safe, crashes, calls>> /\ UNCHANGED rt

(* C:689-690 waitLive(slug): the slug shows in list(). On success, settleLift(slug, true) ends a  *)
(* quarantine item that a load of other files marked.                                            *)
LiveCheck ==
  /\ job.pc = "live"
  /\ IF InList(JS)
       THEN /\ job' = [job EXCEPT !.pc = "adopt", !.hold = FALSE, !.pend = {}]
            /\ quar' = [quar EXCEPT ![JS] = [n \in Names |-> IF n \in job.pend /\ ~bl[JS][n] THEN FALSE ELSE @[n]]]
       ELSE /\ Goto("undoCheck")
            /\ UNCHANGED quar
  /\ UNCHANGED Keep
  /\ UNCHANGED <<reg, row, sby, sbyCode, offMap, prog, pseed, state, runBlamed, lastInst>>

(* C:693-695 after = programRecord(slug); a record with no seed hash takes the hash of this seed     *)
(* (W:1092-1096 re-checks in one update). The load set a new seed already (W:1161-1182).              *)
Adopt ==
  /\ job.pc = "adopt"
  /\ IF Mutant = "seedFile"
       \* The old installer: setProgram when the file names another seed, then write the file.
       THEN /\ IF pseed[JS] # None /\ pseed[JS] # Seed(JC) /\ reg[JS] = "live"
                 THEN /\ prog' = [prog EXCEPT ![JS] = Seed(JC)]
                      /\ job' = [job EXCEPT !.wrote = TRUE, !.pc = "writeSeed"]
                 ELSE /\ UNCHANGED prog
                      /\ Goto(IF pseed[JS] = Seed(JC) THEN "ok" ELSE "writeSeed")
            /\ UNCHANGED pseed
       ELSE /\ pseed' = [pseed EXCEPT ![JS] = IF prog[JS] # None /\ @ = None THEN Seed(JC) ELSE @]
            /\ End(TRUE, "")
            /\ UNCHANGED prog
  /\ UNCHANGED Keep
  /\ UNCHANGED <<reg, row, sby, sbyCode, offMap, state, quar, runBlamed, lastInst>>

(* Mutant seedFile only: write .seeds/<slug> last. *)
WriteSeed ==
  /\ job.pc = "writeSeed"
  /\ pseed' = [pseed EXCEPT ![JS] = Seed(JC)]
  /\ End(TRUE, "")
  /\ UNCHANGED Keep
  /\ UNCHANGED <<reg, row, sby, sbyCode, offMap, prog, state, quar, runBlamed, lastInst>>

(* C:701 if installedNames(slug) has the new name. *)
UndoCheck ==
  /\ job.pc = "undoCheck"
  /\ Goto(IF inst[JS][job.name] THEN "undoRemove" ELSE "rmFolder")
  /\ UNCHANGED Keep /\ UNCHANGED rt

(* C:702-703 removeBundle of the new bundle; its result is only reported. Its standby is dropped. *)
UndoRemove ==
  /\ job.pc = "undoRemove"
  /\ \/ Removed(JS, job.name)
     \/ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
     \/ Deselected(JS, job.name)
  /\ job' = [job EXCEPT !.pc = "rmFolder", !.wrote = Wrote(JS)]
  /\ UNCHANGED <<folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:705-706 clearOff(slug); rm the folder of the new name. *)
RmFolder ==
  /\ job.pc = "rmFolder"
  /\ folder' = [folder EXCEPT ![JS][job.name] = None]
  /\ bl' = [bl EXCEPT ![JS][job.name] = FALSE]
  /\ offMap' = [offMap EXCEPT ![JS] = IF JS = BuiltIn THEN @ ELSE FALSE]
  /\ Goto("restoreProgram")
  /\ UNCHANGED <<inst, enabled, sampleOn, everUsed, safe, crashes, calls>>
  /\ UNCHANGED <<reg, row, sby, sbyCode, prog, pseed, state, quar, runBlamed, lastInst>>

(* C:710-715 restoreProgram(slug, before) when no version of the slug is live (W:1082-1090; no record *)
(* deletes it). When a version still runs, its record stays: the old version, whose user edits stay, *)
(* or a failed bundle that could not be removed. Then settleLift(slug, false): the hold ends, and a   *)
(* marked quarantine stays. Then throw install-failed. Mutant noRestore: no restore at all.          *)
RestoreProgram ==
  /\ job.pc = "restoreProgram"
  /\ LET restore == Mutant # "noRestore" /\ reg[JS] # "live" IN
       /\ prog' = IF restore THEN [prog EXCEPT ![JS] = job.snapP] ELSE prog
       /\ pseed' = IF restore THEN [pseed EXCEPT ![JS] = job.snapS] ELSE pseed
  \* Ghost: the rolled-back load does not count as the last seed that went live.
  /\ lastInst' = IF reg[JS] # "live" THEN [lastInst EXCEPT ![JS] = job.beforeL] ELSE lastInst
  /\ job' = [job EXCEPT !.hold = FALSE, !.pend = {}, !.newLeft = reg[JS] = "live" /\ row[JS] = job.name,
                        !.pc = "err", !.err = "install-failed"]
  /\ UNCHANGED Keep
  /\ UNCHANGED <<reg, row, sby, sbyCode, offMap, state, quar, runBlamed>>

---------------------------------------------------------------------------
(* remove (C:564-585). *)

(* C:566-568 installedNames() and meta(). *)
RemoveCheck ==
  /\ job.pc = "removeCheck"
  /\ IF \E n \in Names : folder[JS][n] # None /\ inst[JS][n] THEN Goto("removeBundle") ELSE End(FALSE, "not-installed")
  /\ UNCHANGED Keep /\ UNCHANGED rt

(* C:571-578 removeBundle of each installed name, A first. *)
RemoveBundle ==
  /\ job.pc = "removeBundle"
  /\ LET n == IF inst[JS]["A"] THEN "A" ELSE "B" IN
       \/ /\ Removed(JS, n)
          /\ Goto(IF n = "A" /\ inst[JS]["B"] THEN "removeBundle" ELSE "removeFolder")
       \/ /\ UNCHANGED <<inst, enabled>> /\ UNCHANGED rt
          /\ End(FALSE, "install-failed")
       \/ /\ Deselected(JS, n)
          /\ End(FALSE, "install-failed")
  /\ UNCHANGED <<folder, sampleOn, everUsed, bl, safe, crashes, calls>>

(* C:580-582 rm both folders; clearOff(slug). *)
RemoveFolder ==
  /\ job.pc = "removeFolder"
  /\ folder' = [folder EXCEPT ![JS] = [n \in Names |-> None]]
  /\ bl' = [bl EXCEPT ![JS] = [n \in Names |-> FALSE]]
  /\ offMap' = [offMap EXCEPT ![JS] = IF JS = BuiltIn THEN @ ELSE FALSE]
  /\ End(TRUE, "")
  /\ UNCHANGED <<inst, enabled, sampleOn, everUsed, safe, crashes, calls>>
  /\ UNCHANGED <<reg, row, sby, sbyCode, prog, pseed, state, quar, runBlamed, lastInst>>

(* The tool call returns its result; the queue takes the next call. *)
Return ==
  /\ job.pc \in {"ok", "err"}
  /\ job' = NoJob
  /\ UNCHANGED Keep /\ UNCHANGED rt

---------------------------------------------------------------------------
(* The user and the host. *)

(* A widget_call mutation writes the state (W:call). *)
UserCall ==
  /\ \E s \in Slugs :
       /\ reg[s] = "live" \/ (s = BuiltIn /\ sampleOn /\ ~Installed(BuiltIn))
       /\ state' = [state EXCEPT ![s] = "used"]
       /\ everUsed' = [everUsed EXCEPT ![s] = TRUE]
  /\ UNCHANGED <<inst, enabled, folder, reg, row, sby, sbyCode, offMap, sampleOn, prog,
                 pseed, lastInst, quar, bl, runBlamed, safe, crashes, calls, job>>

(* A plugin or the widget edits the stored program: ctx.widgets.setProgram (W:1061-1073). The edit *)
(* keeps the seed hash of the record. During a replace, the old version is live and takes edits.  *)
UserEdit ==
  /\ \E s \in AgentSlugs :
       /\ reg[s] = "live"
       /\ prog' = [prog EXCEPT ![s] = "edit"]
       /\ job' = IF job # NoJob /\ job.s = s THEN [job EXCEPT !.edited = TRUE, !.editAfter = job.beforeP # "unset"] ELSE job
  /\ UNCHANGED <<inst, enabled, folder, reg, row, sby, sbyCode, offMap, sampleOn, state, everUsed,
                 pseed, lastInst, quar, bl, runBlamed, safe, crashes, calls>>

(* The user turns the built-in sample row off or on (PM setPluginEnabled). *)
ToggleSample ==
  /\ sampleOn' = ~sampleOn
  /\ UNCHANGED <<inst, enabled, folder, reg, row, sby, sbyCode, offMap, prog, state, everUsed,
                 pseed, lastInst, quar, bl, runBlamed, safe, crashes, calls, job>>

(* The host exits at once (I:claim), and the supervisor starts it again. A crash in running agent    *)
(* code (the live row, or the row of the standby) is blamed on its row: the quarantine names the hash *)
(* of the folder of that name. An unblamed crash can put the next start in safe mode. The running job *)
(* dies with the host. At the start, each installed and selected agent bundle loads from its folder,  *)
(* as Step does, in either order: the second row of a slug can wait as the standby of the first.      *)
NoBlame == <<None, None>>
Crash ==
  /\ crashes < MaxCrashes
  /\ \E b \in {NoBlame} \cup (AgentSlugs \X Names), sm \in BOOLEAN, first \in Names :
       /\ (b # NoBlame => (sm = FALSE /\ ((reg[b[1]] = "live" /\ row[b[1]] = b[2]) \/ sby[b[1]] = b[2])))
       /\ LET q0 == [s \in Slugs |-> [n \in Names |-> quar[s][n] \/ b = <<s, n>>]]
              b0 == [s \in Slugs |-> [n \in Names |-> bl[s][n] \/ b = <<s, n>>]]
              up(s, n) == inst[s][n] /\ enabled[s][n] /\ folder[s][n] # None /\ s # BuiltIn
              R0(s) == [reg |-> "none", row |-> None, sby |-> None, sc |-> None, off |-> FALSE, p |-> prog[s], ps |-> pseed[s],
                        st |-> state[s], q |-> q0[s], rb |-> FALSE, li |-> lastInst[s], threw |-> FALSE, pend |-> {}]
              R1(s) == IF up(s, first) THEN Step(R0(s), s, first, folder[s][first], sm, FALSE, b0[s]) ELSE R0(s)
              R2(s) == IF up(s, Other(first)) THEN Step(R1(s), s, Other(first), folder[s][Other(first)], sm, FALSE, b0[s]) ELSE R1(s)
          IN /\ reg' = [s \in Slugs |-> R2(s).reg]
             /\ row' = [s \in Slugs |-> R2(s).row]
             /\ sby' = [s \in Slugs |-> R2(s).sby]
             /\ sbyCode' = [s \in Slugs |-> R2(s).sc]
             /\ offMap' = [s \in Slugs |-> R2(s).off]
             /\ prog' = [s \in Slugs |-> R2(s).p]
             /\ pseed' = [s \in Slugs |-> R2(s).ps]
             /\ state' = [s \in Slugs |-> R2(s).st]
             /\ quar' = [s \in Slugs |-> R2(s).q]
             /\ runBlamed' = [s \in Slugs |-> R2(s).rb]
             /\ lastInst' = [s \in Slugs |-> R2(s).li]
             /\ bl' = b0
             /\ safe' = sm
  /\ crashes' = crashes + 1
  /\ job' = NoJob
  /\ UNCHANGED <<inst, enabled, folder, sampleOn, everUsed, calls>>

Next ==
  \/ AgentInstall \/ AgentReload \/ AgentRemove
  \/ ReloadCheck \/ Gates \/ CheckInstalled \/ Decide \/ WriteNew \/ Snapshot \/ InstallNew \/ WaitReg
  \/ RemoveOld \/ RmOld \/ LiveCheck \/ Adopt \/ WriteSeed
  \/ UndoCheck \/ UndoRemove \/ RmFolder \/ RestoreProgram
  \/ RemoveCheck \/ RemoveBundle \/ RemoveFolder \/ Return
  \/ UserCall \/ UserEdit \/ ToggleSample \/ Crash

Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* The rules. *)

(* gates.never_host: "Code that fails a gate never reaches the host." spec widget_phase2.creation.gates; C:5-6, C:597-603. *)
GatesGuardHost ==
  \A s \in Slugs, n \in Names : folder[s][n] # "lint"

(* replace.keeps_old: "A failed reinstall keeps the old version live." spec widget_fv.replace. The old bundle *)
(* stays installed with its files. When it was selected, and when it was live, as the job decided, it still  *)
(* is: it is still the live entry of the slug.                                                              *)
FailedReplaceKeepsOld ==
  (job.pc = "err" /\ job.replaced /\ job.old # None) =>
    /\ inst[job.s][job.old] /\ folder[job.s][job.old] = job.oldCode
    /\ (job.oldOn => enabled[job.s][job.old])
    /\ (job.oldLive => (reg[job.s] = "live" /\ row[job.s] = job.old))

(* state.kept: "The state of a slug survives install, replace, reload, and remove." spec creation.tools; C:9-11. *)
StateKept == \A s \in Slugs : everUsed[s] => state[s] = "used"

(* program.new_seed: "After an install with a new seed program, the stored program is the new seed."  *)
(* spec widget_fv.install; W:1161-1182. New: differs from the seed of the code that last went live.  *)
NewSeedSetsProgram ==
  (job.pc = "ok" /\ job.op # "remove" /\ job.s \in AgentSlugs /\ Seed(job.c) # job.prevSeed) =>
    (prog[job.s] \in {Seed(job.c), None} \/ job.edited)

(* program.same_seed: "After an install with the same seed, an edited stored program stays." spec       *)
(* widget_fv.install; W:1161-1182, W:1061-1073; a load of the job is the writer (`wrote`);              *)
(* tools/widgets-create.mjs "a reinstall of the same seed program leaves the stored program alone".     *)
SameSeedKeepsProgram ==
  (job.pc = "ok" /\ job.op # "remove" /\ job.s \in AgentSlugs /\ Seed(job.c) = job.prevSeed /\ job.editedAtStart)
    => ~job.wrote

(* builtin.untouched: "A built-in widget is never replaced or removed by an agent tool." spec creation.rows: *)
(* "an agent bundle cannot use the row id of a built-in widget". At aa7cd518 the agent bundle of slug      *)
(* sample had the row id deepwidgets-widget-sample. Since widget.agent_rows, bundleName (C:166) gives       *)
(* deepwidgets-agent-sample. The BuiltIn branch of Step still describes aa7cd518 (SKILL.md, open point).    *)
BuiltInUntouched == reg[BuiltIn] = "none"   \* no agent registration of the built-in slug ever runs

(* slug.one_bundle: "At most one live bundle per slug": at most one running row registers the slug. *)
(* A standby is not registered: it is not in list() and takes no call.                              *)
OneBundlePerSlug ==
  \A s \in Slugs :
    Cardinality({x \in {"agent", "builtin"} :
                   \/ (x = "agent" /\ reg[s] \in {"live", "failed"})
                   \/ (x = "builtin" /\ s = BuiltIn /\ sampleOn)}) <= 1

(* slug.taken_only_builtin: slug-taken only for the slug of a built-in widget (widget.builtin_slugs),  *)
(* or when a live widget that is not an agent bundle has the slug.                                      *)
(* spec widget_phase2.creation.rows and widget_fv.install; C:607-616.                                  *)
SlugTakenOnlyForBuiltIn ==
  (job.pc = "err" /\ job.err = "slug-taken") => job.builtinHeld

(* quarantine.holds: "A quarantined widget comes back only when the hash of its files changes."       *)
(* spec widget_phase2.isolation.supervisor and widget_fv.install; I:1-20. The blamed files are not   *)
(* live while installed.                                                                              *)
QuarantineHolds ==
  \A s \in AgentSlugs : ~(reg[s] = "live" /\ runBlamed[s])

(* rollback.keeps_record: "A rolled-back install leaves the stored program and its seed hash as they   *)
(* were before the install." spec widget_fv.install; C:643, C:710-711. A user edit after the snapshot  *)
(* of the job is a newer write, so it is out of the rule. So is a failed bundle that could not be      *)
(* removed and still runs (newLeft). widget_fv.replace: a failed replace never wrote the record, as its *)
(* standby wrote no seed, so the rule holds at each failed end of an install.                         *)
RollbackKeepsRecord ==
  (job.pc = "err" /\ job.beforeP # "unset" /\ ~job.editAfter /\ ~job.newLeft) =>
    (prog[job.s] = job.beforeP /\ pseed[job.s] = job.beforeS)

(* builtin.reserved: "The slug of a built-in widget is reserved. widget_install gives slug-taken for   *)
(* that slug, also when the built-in widget is off." spec widget_fv.install (widget.builtin_slugs).  *)
BuiltInSlugReserved == ~Installed(BuiltIn)

=============================================================================
