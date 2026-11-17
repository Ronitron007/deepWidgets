----------------------------- MODULE BuiltInSeed -----------------------------
(***************************************************************************)
(* The seed rule of a built-in widget row (spec main_widget.seed, unit     *)
(* main.seed_refresh), apart from the install job of widget_install: no    *)
(* install step changes the program record of a built-in slug, because the *)
(* slug of a built-in widget is reserved (BuiltInSlugReserved).            *)
(*                                                                         *)
(* Code: deepwidgets/widgets/src/index.ts (W): `seed`, `add` (it sets      *)
(* `registration.builtIn`), and `setProgram`. The model has the built-in   *)
(* sample. Its record is the text and the seed hash of the storage table   *)
(* `program`. An app update can bring a new seed program at a host start.  *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS MaxStarts,   \* bound on host starts
          Mutant       \* "none" for the code; a broken variant proves that a rule can fail

None   == "none"
(* The seed programs of the code of the built-in sample. p0 is also the program that an older app stored. *)
BSeeds == {"p0", "p5"}
(* An edit of the stored program. It keeps the seed hash of the record (W setProgram), so the model marks *)
(* each edit with that hash: e0 under the hash of p0, e5 under the hash of p5, eN under no hash.           *)
EditOf(ps) == CASE ps = "p0" -> "e0" [] ps = "p5" -> "e5" [] OTHER -> "eN"
Edits  == {"e0", "e5", "eN"}

VARIABLES
  up,        \* the host runs
  sampleOn,  \* the built-in sample row is on (the user can switch it in the plugin manager)
  bcode,     \* the seed program of the built-in sample in the code of the host that runs
  prog,      \* the stored text of sample: a seed program, or an edit
  pseed,     \* the seed hash in the program record of sample; it lands in the same put as the text
  bLost,     \* ghost: a start of sample, whose record had the seed hash of its code, changed its program
  starts     \* host starts

vars == <<up, sampleOn, bcode, prog, pseed, bLost, starts>>

TypeOK ==
  /\ up \in BOOLEAN
  /\ sampleOn \in BOOLEAN
  /\ bcode \in BSeeds
  /\ prog \in BSeeds \cup Edits
  /\ pseed \in {None} \cup BSeeds
  /\ bLost \in BOOLEAN
  /\ starts \in 0..MaxStarts

(* W seed() of a built-in row (`registration.builtIn`, set in W add): a record whose seed hash      *)
(* differs from the hash of the seed program of the code, also a record with no hash, gets that seed *)
(* program and its hash in one put. A record with the same hash stays, also an edit: W setProgram    *)
(* keeps the hash. An edit and a call of the slug wait for the seed (`seeded`), so the seed is part  *)
(* of the step that starts the row.                                                                  *)
(* Mutant builtinSkip: the code before main.seed_refresh. Only a slug with no record gets the seed,  *)
(* with no hash. Here the record always exists, so the row never writes it.                          *)
(* Mutant builtinAlways: each start of the row writes its seed, with no compare.                     *)
(* Mutant textOnly: a stale record gets the new text, but its seed hash stays.                       *)
BWrites(p, ps, c) == CASE Mutant = "builtinSkip" -> FALSE
                       [] Mutant = "builtinAlways" -> TRUE
                       [] OTHER -> ps # c
BSeedP(p, ps, c) == IF BWrites(p, ps, c) THEN c ELSE p
BSeedS(p, ps, c) == IF BWrites(p, ps, c) /\ Mutant # "textOnly" THEN c ELSE ps
(* The ghost bLost: the record had the seed hash of the code, and the start changed the program. *)
BLost(p, ps, c) == ps = c /\ BSeedP(p, ps, c) # p

(* An older app stored the program p0 of sample with no seed hash. The host of the code of this unit *)
(* has not started yet.                                                                             *)
Init ==
  /\ up = FALSE
  /\ sampleOn = TRUE
  /\ bcode = "p0"
  /\ prog = "p0"
  /\ pseed = None
  /\ bLost = FALSE
  /\ starts = 0

(* The host starts. It can run the code of an app update, with another seed program of sample (bc).  *)
(* When the sample row is on, it registers, and W seed() applies the seed rule.                      *)
Boot ==
  /\ ~up /\ starts < MaxStarts
  /\ \E bc \in BSeeds :
       /\ bcode' = bc
       /\ prog' = IF sampleOn THEN BSeedP(prog, pseed, bc) ELSE prog
       /\ pseed' = IF sampleOn THEN BSeedS(prog, pseed, bc) ELSE pseed
       /\ bLost' = (bLost \/ (sampleOn /\ BLost(prog, pseed, bc)))
  /\ up' = TRUE
  /\ starts' = starts + 1
  /\ UNCHANGED sampleOn

(* The host stops: a crash, or the user quits. The last start runs to the end of the behavior. *)
Stop ==
  /\ up /\ starts < MaxStarts
  /\ up' = FALSE
  /\ UNCHANGED <<sampleOn, bcode, prog, pseed, bLost, starts>>

(* The user turns the sample row off or on (PM setPluginEnabled). When it turns on, the row registers *)
(* again, and W seed() applies the seed rule.                                                         *)
ToggleSample ==
  /\ up
  /\ sampleOn' = ~sampleOn
  /\ IF sampleOn'
       THEN /\ prog' = BSeedP(prog, pseed, bcode)
            /\ pseed' = BSeedS(prog, pseed, bcode)
            /\ bLost' = (bLost \/ BLost(prog, pseed, bcode))
       ELSE UNCHANGED <<prog, pseed, bLost>>
  /\ UNCHANGED <<up, bcode, starts>>

(* A plugin edits the stored program of sample while it runs: ctx.widgets.setProgram (W setProgram). *)
(* The edit keeps the seed hash.                                                                       *)
UserEdit ==
  /\ up /\ sampleOn
  /\ prog' = EditOf(pseed)
  /\ UNCHANGED <<up, sampleOn, bcode, pseed, bLost, starts>>

Next == Boot \/ Stop \/ ToggleSample \/ UserEdit

Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* The rules. spec main_widget.seed: "When the two differ, the host stores the new seed program and its hash in *)
(* one write." The rule has two halves, so that each half can break on its own.                               *)

(* builtin.seed_hash: "While a built-in widget runs, its program record has the seed hash of the seed program of *)
(* its code." W seed(). An older app stored the program of sample with no seed hash (Init).                    *)
BuiltInSeedHash ==
  (up /\ sampleOn) => pseed = bcode

(* builtin.seed_text: "While a built-in widget runs, its stored text is the seed program of its code, or an edit *)
(* under the seed hash of that seed program." W seed(), W setProgram. An app update can bring a new seed program. *)
BuiltInSeedText ==
  (up /\ sampleOn) => prog \in {bcode, EditOf(bcode)}

(* builtin.same_seed: "A start of a built-in widget whose record has the seed hash of its code keeps the stored    *)
(* program, also an edit." spec main_widget.seed; W seed(), W setProgram.                                           *)
BuiltInSameSeedKeepsProgram == ~bLost

=============================================================================
