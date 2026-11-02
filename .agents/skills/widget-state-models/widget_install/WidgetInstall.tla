---------------------------- MODULE WidgetInstall ----------------------------
(***************************************************************************)
(* The agent tools widget_install, widget_reload, and widget_remove of     *)
(* deepWidgets at commit 38df710e.                                         *)
(*                                                                         *)
(* Code: deepwidgets/mcp/src/creation.ts (C), deepwidgets/widgets/src/     *)
(* index.ts (W), deepwidgets/widgets/src/isolation.ts (I),                 *)
(* packages/boot/plugin-manager/src/index.ts (PM).                          *)
(* Each await of WidgetInstaller.installNow / remove / reload is one step. *)
(* WidgetInstaller.serial (C:433-437) runs one job at a time, so the model *)
(* has one job slot. Crashes, user calls, user program edits, and the user *)
(* switch of the built-in sample row interleave with every job step.       *)
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

(* The agent code of one install. Its seed program, whether it passes the   *)
(* three gates (C:363-382), and what its apply does in the host.            *)
Codes == {"v1", "v2", "bad", "lint"}
Seed(c) == CASE c = "v1" -> "p1" [] c = "v2" -> "p2" [] c = "bad" -> "p3" [] c = "lint" -> "p4"
Seeds == {"p1", "p2", "p3", "p4"}
GatePass(c) == c # "lint"               \* lint: a raw setTimeout, refused by the lint gate
ApplyOk(c)  == c \in {"v1", "v2"}       \* bad: registers, then throws in the host only (passes the test run)

Locs == {"none", "folder", "prev", "other"}

VARIABLES
  inst,       \* [Slugs -> BOOLEAN]  package deepwidgets-widget-<slug> is in the profile package.json (PM listBundles .installed).
              \* It is a link: dependency to <profile>/deepwidgets-widgets/<slug>, so the code that loads is `folder`.
  enabled,    \* [Slugs -> BOOLEAN]          the bundle is selected (dsh.profile.bundles)
  folder,     \* [Slugs -> None \cup Codes]  <profile>/deepwidgets-widgets/<slug>
  next,       \*                              <slug>.next
  prev,       \*                              <slug>.previous
  reg,        \* [Slugs -> {"none","live","failed","off"}]  the runtime entry of an agent registration of the slug
  offMap,     \* [Slugs -> BOOLEAN]          W:505 `off`: safe mode refused the slug in this host start
  sampleOn,   \* the built-in sample row is on (the user can switch it in the plugin manager)
  prog,       \* [Slugs -> None \cup Seeds \cup {"edit"}]  stored program (storage table `program`)
  state,      \* [Slugs -> {"none","init","used"}]         stored state (storage table `state`)
  everUsed,   \* ghost: a user call wrote the state of the slug
  seedRec,    \* [Slugs -> None \cup Seeds]  .seeds/<slug> (C:45, C:552-555)
  lastInst,   \* ghost: seed of the code most recently installed in the profile for the slug
  quar,       \* [Slugs -> BOOLEAN]  I: quarantine.json has an item for the row of the slug
  blamed,     \* [Slugs -> Locs]     where the files are whose hash the quarantine item names
  runBlamed,  \* ghost [Slugs -> BOOLEAN]: the running registration was loaded from the blamed files
  safe,       \* this host start is in safe mode (W:504)
  crashes, calls,
  job         \* the one running installer job

vars == <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
          seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls, job>>

NoJob == [op |-> "none", s |-> "none", c |-> "none", pc |-> "idle", replaced |-> FALSE,
          prevSeed |-> "none", oldCode |-> "none", oldLive |-> FALSE,
          wrote |-> FALSE, edited |-> FALSE, app |-> "none", err |-> "", builtinHeld |-> FALSE, editedAtStart |-> FALSE]

TypeOK ==
  /\ inst \in [Slugs -> BOOLEAN]
  /\ enabled \in [Slugs -> BOOLEAN]
  /\ folder \in [Slugs -> {None} \cup Codes]
  /\ next \in [Slugs -> {None} \cup Codes]
  /\ prev \in [Slugs -> {None} \cup Codes]
  /\ reg \in [Slugs -> {"none", "live", "failed", "off"}]
  /\ offMap \in [Slugs -> BOOLEAN]
  /\ sampleOn \in BOOLEAN
  /\ prog \in [Slugs -> {None, "edit", "p0"} \cup Seeds]
  /\ state \in [Slugs -> {"none", "init", "used"}]
  /\ seedRec \in [Slugs -> {None} \cup Seeds]
  /\ quar \in [Slugs -> BOOLEAN]
  /\ blamed \in [Slugs -> Locs]
  /\ safe \in BOOLEAN

Init ==
  /\ inst = [s \in Slugs |-> FALSE]
  /\ enabled = [s \in Slugs |-> FALSE]
  /\ folder = [s \in Slugs |-> None]
  /\ next = [s \in Slugs |-> None]
  /\ prev = [s \in Slugs |-> None]
  /\ reg = [s \in Slugs |-> "none"]
  /\ offMap = [s \in Slugs |-> FALSE]
  /\ sampleOn = TRUE
  \* The built-in sample is live and seeded at start.
  /\ prog = [s \in Slugs |-> IF s = BuiltIn THEN "p0" ELSE None]
  /\ state = [s \in Slugs |-> IF s = BuiltIn THEN "init" ELSE "none"]
  /\ everUsed = [s \in Slugs |-> FALSE]
  /\ seedRec = [s \in Slugs |-> None]
  /\ lastInst = [s \in Slugs |-> None]
  /\ quar = [s \in Slugs |-> FALSE]
  /\ blamed = [s \in Slugs |-> "none"]
  /\ runBlamed = [s \in Slugs |-> FALSE]
  /\ safe = FALSE
  /\ crashes = 0
  /\ calls = 0
  /\ job = NoJob

(* W:933-936 `list()`: live and failed entries, and the slugs that safe mode refused in this start. *)
InList(s) == reg[s] # "none" \/ offMap[s] \/ (s = BuiltIn /\ sampleOn)

(* A row of slug s loads code c (hmr reconcile in PM installBundle, or a host start).          *)
(* I:wrap/held: a quarantine item holds the row while the folder still has the blamed files;    *)
(*   otherwise held() deletes the item.                                                         *)
(* W:883-890 add: safe mode refuses an agent widget (it goes into `off`).                       *)
(* W:870-879 seed: program and state are written when storage has none. seed() starts in add(), *)
(*   before apply can throw, so code that registers and then throws still seeds.                *)
Load(s, c) ==
  IF s = BuiltIn /\ Mutant # "builtinRow"
    \* The Loader keeps one row per id. The agent row deepwidgets-widget-sample does not replace the
    \* built-in row of that id; it never starts (replay-builtin.mjs: "applied at enable", row not running).
    THEN [r |-> "none", off |-> offMap[s], p |-> prog[s], st |-> state[s], q |-> quar[s], threw |-> FALSE]
  ELSE IF quar[s] /\ blamed[s] = "folder"
    THEN [r |-> "failed", off |-> offMap[s], p |-> prog[s], st |-> state[s], q |-> TRUE, threw |-> FALSE]
  ELSE IF safe
    THEN [r |-> "off", off |-> TRUE, p |-> prog[s], st |-> state[s], q |-> FALSE, threw |-> TRUE]
  ELSE [r |-> IF ApplyOk(c) THEN "live" ELSE "none",
        off |-> offMap[s],
        p |-> IF prog[s] = None THEN Seed(c) ELSE prog[s],
        st |-> IF state[s] = "none" \/ Mutant = "stateReset" THEN "init" ELSE state[s],
        q |-> FALSE,
        threw |-> ~ApplyOk(c)]

(* Apply the result of Load to the variables of slug s. *)
Loaded(s, c) ==
  LET L == Load(s, c) IN
  /\ reg' = [reg EXCEPT ![s] = L.r]
  /\ offMap' = [offMap EXCEPT ![s] = L.off]
  /\ prog' = [prog EXCEPT ![s] = L.p]
  /\ state' = [state EXCEPT ![s] = L.st]
  /\ quar' = [quar EXCEPT ![s] = L.q]
  /\ runBlamed' = [runBlamed EXCEPT ![s] = (L.r = "live" /\ blamed[s] = "folder")]

(* A rename of `from` to `to` moves the blamed files with it. *)
Move(loc, from, to) == IF loc = from THEN to ELSE loc
Drop(loc, at) == IF loc = at THEN "other" ELSE loc

Goto(pc) == job' = [job EXCEPT !.pc = pc]
End(ok, code) == job' = [job EXCEPT !.pc = IF ok THEN "ok" ELSE "err", !.err = code]

Fixed(vs) == UNCHANGED vs

---------------------------------------------------------------------------
(* The agent calls a tool. The call waits in the serial queue (C:433-437). *)

AgentInstall ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in Slugs, c \in Codes :
       /\ (s = BuiltIn => c = "v1")
       /\ job' = [op |-> "install", s |-> s, c |-> c, pc |-> "gates", replaced |-> FALSE,
                  prevSeed |-> lastInst[s], oldCode |-> IF inst[s] THEN folder[s] ELSE None, oldLive |-> reg[s] = "live",
                  wrote |-> FALSE, edited |-> FALSE, app |-> "none", err |-> "", builtinHeld |-> FALSE,
                  editedAtStart |-> prog[s] = "edit"]
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes>>

AgentReload ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in AgentSlugs, c \in Codes :
       job' = [op |-> "reload", s |-> s, c |-> c, pc |-> "reloadCheck", replaced |-> FALSE,
               prevSeed |-> lastInst[s], oldCode |-> IF inst[s] THEN folder[s] ELSE None, oldLive |-> reg[s] = "live",
               wrote |-> FALSE, edited |-> FALSE, app |-> "none", err |-> "", builtinHeld |-> FALSE,
               editedAtStart |-> prog[s] = "edit"]
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes>>

AgentRemove ==
  /\ job = NoJob /\ calls < MaxCalls
  /\ \E s \in Slugs :
       job' = [op |-> "remove", s |-> s, c |-> "v1", pc |-> "removeCheck", replaced |-> FALSE,
               prevSeed |-> lastInst[s], oldCode |-> IF inst[s] THEN folder[s] ELSE None, oldLive |-> reg[s] = "live",
               wrote |-> FALSE, edited |-> FALSE, app |-> "none", err |-> "", builtinHeld |-> FALSE, editedAtStart |-> FALSE]
  /\ calls' = calls + 1
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes>>

---------------------------------------------------------------------------
(* installNow (C:506-574), one await per step. *)

JS == job.s
JC == job.c

(* C:488-489 reload: meta() and installed(). *)
ReloadCheck ==
  /\ job.pc = "reloadCheck"
  /\ IF folder[JS] # None /\ inst[JS] THEN Goto("gates") ELSE End(FALSE, "not-installed")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:507-512 runGates: a failed gate throws gate-failed before anything is written. *)
Gates ==
  /\ job.pc = "gates"
  /\ IF GatePass(JC) \/ Mutant = "skipGate" THEN Goto("checkInstalled") ELSE End(FALSE, "gate-failed")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:519-522 replaced = installed(slug); slug-taken when not replaced and the slug is in list(). *)
CheckInstalled ==
  /\ job.pc = "checkInstalled"
  /\ LET r == inst[JS] IN
       IF ~r /\ InList(JS)
         THEN job' = [job EXCEPT !.replaced = r, !.pc = "err", !.err = "slug-taken",
                          !.builtinHeld = (JS = BuiltIn /\ sampleOn)]
         ELSE job' = [job EXCEPT !.replaced = r, !.pc = "writeNext"]
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:523-526 writeBundle(next). *)
WriteNext ==
  /\ job.pc = "writeNext"
  /\ next' = [next EXCEPT ![JS] = JC]
  /\ Goto(IF job.replaced THEN "removeOld" ELSE "clearFolder")
  /\ UNCHANGED <<inst, enabled, folder, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:528-532 removeBundle(name) of the old bundle. PM removeBundle (PM:1000-1030) first deselects *)
(* the bundle and reloads (its rows stop), then runs `pnpm remove`. A failure of pnpm remove       *)
(* leaves the bundle installed but deselected; a lock timeout or `not-removable` changes nothing.  *)
RemoveOld ==
  /\ job.pc = "removeOld"
  /\ \/ /\ inst' = [inst EXCEPT ![JS] = FALSE]
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
        /\ Goto("backup")
        /\ UNCHANGED next
     \/ /\ UNCHANGED <<runBlamed, inst, enabled, reg>>
        /\ next' = [next EXCEPT ![JS] = None]
        /\ End(FALSE, "install-failed")
     \/ /\ DeselectFails /\ UNCHANGED inst
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
        /\ next' = [next EXCEPT ![JS] = None]
        /\ End(FALSE, "install-failed")
  /\ UNCHANGED <<folder, prev, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:533-534 rm(backup); rename(folder, backup). *)
Backup ==
  /\ job.pc = "backup"
  /\ prev' = [prev EXCEPT ![JS] = folder[JS]]
  /\ folder' = [folder EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Move(Drop(@, "prev"), "folder", "prev")]
  /\ Goto("renameNext")
  /\ UNCHANGED <<runBlamed, inst, enabled, next, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* C:536 rm(folder) when nothing is installed. *)
ClearFolder ==
  /\ job.pc = "clearFolder"
  /\ folder' = [folder EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Drop(@, "folder")]
  /\ Goto("renameNext")
  /\ UNCHANGED <<runBlamed, inst, enabled, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* C:538 rename(next, folder). *)
RenameNext ==
  /\ job.pc = "renameNext"
  /\ folder' = [folder EXCEPT ![JS] = next[JS]]
  /\ next' = [next EXCEPT ![JS] = None]
  /\ Goto("installNew")
  /\ UNCHANGED <<inst, enabled, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* PM installBundle(folder) (PM:836-985). With hmr, a package that is already in package.json is *)
(* refused (`already-installed`). pnpm can fail and change nothing. When the package goes in, the *)
(* row loads at once, and the result can still be `failed` or `restart-required` (a failed enable *)
(* stage keeps the package).                                                                      *)
InstallBundle(s, c, nextPc) ==
  \/ /\ ~inst[s] /\ c # None
     /\ inst' = [inst EXCEPT ![s] = TRUE]
     /\ enabled' = [enabled EXCEPT ![s] = TRUE]
     /\ lastInst' = [lastInst EXCEPT ![s] = Seed(c)]
     /\ Loaded(s, c)
     \* A row whose apply throws gives `failed at enable`, and the package stays (replay-newseed.mjs,
     \* replay-safe.mjs). A row that starts gives `applied`.
     /\ job' = [job EXCEPT !.app = IF Load(s, c).threw THEN "failed" ELSE "applied", !.pc = nextPc]
  \/ /\ UNCHANGED <<runBlamed, inst, enabled, lastInst, reg, offMap, prog, state, quar>>
     /\ job' = [job EXCEPT !.app = "failed", !.pc = nextPc]

(* C:540 installBundle of the new bundle. *)
InstallNew ==
  /\ job.pc = "installNew"
  /\ InstallBundle(JS, JC, "waitLive")
  /\ UNCHANGED <<folder, next, prev, sampleOn, everUsed, seedRec, blamed, safe, crashes, calls>>

(* C:541 applied && waitLive(slug): the slug shows in list() within 5 s. *)
WaitLive ==
  /\ job.pc = "waitLive"
  /\ Goto(IF job.app = "applied" /\ InList(JS) THEN "rmBackup" ELSE "undoCheck")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:542 rm(backup). *)
RmBackup ==
  /\ job.pc = "rmBackup"
  /\ prev' = [prev EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Drop(@, "prev")]
  /\ Goto("readSeed")
  /\ UNCHANGED <<runBlamed, inst, enabled, folder, next, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* C:544-548 last = lastSeed(slug). *)
ReadSeed ==
  /\ job.pc = "readSeed"
  /\ LET last == seedRec[JS] IN
       job' = [job EXCEPT !.pc = IF last # None /\ last # Seed(JC) THEN "setProgram"
                                  ELSE IF last # Seed(JC) THEN "writeSeed" ELSE "ok"]
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:549 widgets.setProgram. W:796 liveEntry throws for a slug that is not in the map (safe mode) *)
(* or failed (quarantine). The throw leaves installNow: the new bundle stays, the backup is gone. *)
SetProgram ==
  /\ job.pc = "setProgram"
  /\ IF reg[JS] = "live"
       THEN /\ prog' = [prog EXCEPT ![JS] = Seed(JC)]
            /\ job' = [job EXCEPT !.wrote = TRUE, !.pc = "writeSeed"]
       ELSE /\ UNCHANGED prog
            /\ End(FALSE, "setProgram-threw")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:552-555 write .seeds/<slug>. *)
WriteSeed ==
  /\ job.pc = "writeSeed"
  /\ seedRec' = [seedRec EXCEPT ![JS] = Seed(JC)]
  /\ End(TRUE, "")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:561 if installed(slug). *)
UndoCheck ==
  /\ job.pc = "undoCheck"
  /\ Goto(IF inst[JS] THEN "undoRemove" ELSE "rmFolder")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:562-563 removeBundle of the failed bundle; its result is only reported. *)
UndoRemove ==
  /\ job.pc = "undoRemove"
  /\ \/ /\ inst' = [inst EXCEPT ![JS] = FALSE]
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
     \/ UNCHANGED <<runBlamed, inst, enabled, reg>>
     \/ /\ DeselectFails /\ UNCHANGED inst
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
  /\ Goto("rmFolder")
  /\ UNCHANGED <<folder, next, prev, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* C:565 rm(folder). *)
RmFolder ==
  /\ job.pc = "rmFolder"
  /\ folder' = [folder EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Drop(@, "folder")]
  /\ IF job.replaced THEN Goto("restoreRename") ELSE End(FALSE, "install-failed")
  /\ UNCHANGED <<runBlamed, inst, enabled, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* C:567 rename(backup, folder). *)
RestoreRename ==
  /\ job.pc = "restoreRename"
  /\ folder' = [folder EXCEPT ![JS] = prev[JS]]
  /\ prev' = [prev EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Move(Drop(@, "folder"), "prev", "folder")]
  /\ Goto("restoreInstall")
  /\ UNCHANGED <<runBlamed, inst, enabled, next, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* C:568-573 installBundle(folder) of the old bundle, then throw install-failed. *)
RestoreInstall ==
  /\ job.pc = "restoreInstall"
  /\ InstallBundle(JS, folder[JS], "restoreDone")
  /\ UNCHANGED <<folder, next, prev, sampleOn, everUsed, seedRec, blamed, safe, crashes, calls>>

RestoreDone ==
  /\ job.pc = "restoreDone"
  /\ End(FALSE, "install-failed")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

---------------------------------------------------------------------------
(* remove (C:495-504). *)

RemoveCheck ==
  /\ job.pc = "removeCheck"
  /\ IF folder[JS] # None /\ inst[JS] THEN Goto("removeBundle") ELSE End(FALSE, "not-installed")
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

RemoveBundle ==
  /\ job.pc = "removeBundle"
  /\ \/ /\ inst' = [inst EXCEPT ![JS] = FALSE]
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
        /\ Goto("removeFolder")
     \/ /\ UNCHANGED <<runBlamed, inst, enabled, reg>>
        /\ End(FALSE, "install-failed")
     \/ /\ DeselectFails /\ UNCHANGED inst
        /\ enabled' = [enabled EXCEPT ![JS] = FALSE]
        /\ reg' = [reg EXCEPT ![JS] = "none"]
        /\ End(FALSE, "install-failed")
  /\ UNCHANGED <<folder, next, prev, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

RemoveFolder ==
  /\ job.pc = "removeFolder"
  /\ folder' = [folder EXCEPT ![JS] = None]
  /\ blamed' = [blamed EXCEPT ![JS] = Drop(@, "folder")]
  /\ End(TRUE, "")
  /\ UNCHANGED <<runBlamed, inst, enabled, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, safe, crashes, calls>>

(* The tool call returns its result; the queue takes the next call. *)
Return ==
  /\ job.pc \in {"ok", "err"}
  /\ job' = NoJob
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

---------------------------------------------------------------------------
(* The user and the host. *)

(* A widget_call mutation writes the state (W:729-790). *)
UserCall ==
  /\ \E s \in Slugs :
       /\ reg[s] = "live" \/ (s = BuiltIn /\ sampleOn /\ ~inst[BuiltIn])
       /\ state' = [state EXCEPT ![s] = "used"]
       /\ everUsed' = [everUsed EXCEPT ![s] = TRUE]
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, prog,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls, job>>

(* A plugin or the widget edits the stored program: ctx.widgets.setProgram (W:795-803). *)
UserEdit ==
  /\ \E s \in AgentSlugs :
       /\ reg[s] = "live"
       /\ prog' = [prog EXCEPT ![s] = "edit"]
       /\ job' = IF job # NoJob /\ job.s = s THEN [job EXCEPT !.edited = TRUE] ELSE job
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, sampleOn, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls>>

(* The user turns the built-in sample row off or on (PM setPluginEnabled). *)
ToggleSample ==
  /\ sampleOn' = ~sampleOn
  /\ UNCHANGED <<inst, enabled, folder, next, prev, reg, offMap, prog, state, everUsed,
                 seedRec, lastInst, quar, blamed, runBlamed, safe, crashes, calls, job>>

(* The host exits at once (I:claim), and the supervisor starts it again. A crash in live agent  *)
(* code is blamed on its row: the quarantine names the hash of the installed folder. An         *)
(* unblamed crash can put the next start in safe mode. The running job dies with the host.      *)
(* At the start, each installed and selected agent bundle loads from its folder.                *)
Crash ==
  /\ crashes < MaxCrashes
  /\ \E b \in {None} \cup {s \in AgentSlugs : reg[s] = "live"}, sm \in BOOLEAN :
       /\ (b # None => sm = FALSE)
       /\ LET q0 == IF b = None THEN quar ELSE [quar EXCEPT ![b] = TRUE]
              bl == IF b = None THEN blamed ELSE [blamed EXCEPT ![b] = "folder"]
              held(s) == q0[s] /\ bl[s] = "folder"
              up(s) == inst[s] /\ enabled[s] /\ folder[s] # None /\ s # BuiltIn
          IN /\ quar' = [s \in Slugs |-> IF up(s) THEN held(s) ELSE q0[s]]
             /\ blamed' = bl
             /\ runBlamed' = [s \in Slugs |-> FALSE]
             /\ reg' = [s \in Slugs |-> IF ~up(s) THEN "none"
                                        ELSE IF held(s) THEN "failed"
                                        ELSE IF sm THEN "off"
                                        ELSE IF ApplyOk(folder[s]) THEN "live" ELSE "none"]
             /\ offMap' = [s \in Slugs |-> up(s) /\ ~held(s) /\ sm]
             /\ prog' = [s \in Slugs |-> IF up(s) /\ ~held(s) /\ ~sm /\ prog[s] = None
                                         THEN Seed(folder[s]) ELSE prog[s]]
             /\ state' = [s \in Slugs |-> IF up(s) /\ ~held(s) /\ ~sm /\ state[s] = "none"
                                          THEN "init" ELSE state[s]]
             /\ safe' = sm
  /\ crashes' = crashes + 1
  /\ job' = NoJob
  /\ UNCHANGED <<inst, enabled, folder, next, prev, sampleOn, everUsed, seedRec, lastInst, calls>>

Next ==
  \/ AgentInstall \/ AgentReload \/ AgentRemove
  \/ ReloadCheck \/ Gates \/ CheckInstalled \/ WriteNext \/ RemoveOld \/ Backup \/ ClearFolder
  \/ RenameNext \/ InstallNew \/ WaitLive \/ RmBackup \/ ReadSeed \/ SetProgram \/ WriteSeed
  \/ UndoCheck \/ UndoRemove \/ RmFolder \/ RestoreRename \/ RestoreInstall \/ RestoreDone
  \/ RemoveCheck \/ RemoveBundle \/ RemoveFolder \/ Return
  \/ UserCall \/ UserEdit \/ ToggleSample \/ Crash

Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* The rules. *)

(* gates.never_host: "Code that fails a gate never reaches the host." spec widget_phase2.creation.gates; C:5-6, C:509-512. *)
GatesGuardHost ==
  \A s \in Slugs : folder[s] # "lint" /\ prev[s] # "lint" /\ next[s] # "lint"

(* replace.keeps_old: "A failed reinstall keeps the old version live." C:8-9 "removes the old bundle first and *)
(* puts it back when the new one fails"; C:531 "the old bundle stays"; tools/widgets-create.mjs rollback check. *)
FailedReplaceKeepsOld ==
  (job.pc = "err" /\ job.replaced) =>
    /\ inst[job.s] /\ folder[job.s] = job.oldCode
    /\ enabled[job.s]
    /\ (job.oldLive => reg[job.s] = "live")

(* state.kept: "The state of a slug survives install, replace, reload, and remove." spec creation.tools; C:9-10; W:313. *)
StateKept == \A s \in Slugs : everUsed[s] => state[s] = "used"

(* program.new_seed: "After an install with a new seed program, the stored program is the new seed."  *)
(* C:546-551. New: differs from the seed of the code that was last installed for the slug.            *)
NewSeedSetsProgram ==
  (job.pc = "ok" /\ job.op # "remove" /\ job.s \in AgentSlugs /\ Seed(job.c) # job.prevSeed) =>
    (prog[job.s] \in {Seed(job.c), None} \/ job.edited)

(* program.same_seed: "After an install with the same seed, an edited stored program stays." C:546-547; *)
(* tools/widgets-create.mjs "a reinstall of the same seed program leaves the stored program alone".     *)
SameSeedKeepsProgram ==
  (job.pc = "ok" /\ job.op # "remove" /\ job.s \in AgentSlugs /\ Seed(job.c) = job.prevSeed /\ job.editedAtStart)
    => ~job.wrote

(* builtin.untouched: "A built-in widget is never replaced or removed by an agent tool." spec creation.rows: *)
(* "an agent bundle cannot use the row id of a built-in widget". bundleName (C:157) gives the agent bundle  *)
(* of slug sample the row id deepwidgets-widget-sample, the row id of the built-in.                        *)
BuiltInUntouched == reg[BuiltIn] = "none"   \* no agent registration of the built-in slug ever runs

(* slug.one_bundle: "At most one live bundle per slug": at most one running row registers the slug. *)
OneBundlePerSlug ==
  \A s \in Slugs :
    Cardinality({x \in {"agent", "builtin"} :
                   \/ (x = "agent" /\ reg[s] \in {"live", "failed"})
                   \/ (x = "builtin" /\ s = BuiltIn /\ sampleOn)}) <= 1

(* slug.taken_only_builtin: slug-taken only when a live widget that is not an agent bundle has the slug. *)
(* spec widget_phase2.creation.rows; C:520-521 message "a widget that is not an agent bundle".          *)
SlugTakenOnlyForBuiltIn ==
  (job.pc = "err" /\ job.err = "slug-taken") => job.builtinHeld

(* quarantine.holds: "A quarantined widget comes back when the hash of its files changes."            *)
(* spec widget_phase2.isolation.supervisor; I:1-12. The blamed files are not live while installed.    *)
QuarantineHolds ==
  \A s \in AgentSlugs : ~(reg[s] = "live" /\ runBlamed[s])

=============================================================================
