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

CONSTANTS MaxStarts,   \* bound on host starts after the first one
          Mutant       \* "none" for the code; a broken variant proves that a rule can fail

None   == "none"
(* The seed programs of the code of the built-in sample. p0 is the seed of the first host start. *)
BSeeds == {"p0", "p5"}

VARIABLES
  sampleOn,  \* the built-in sample row is on (the user can switch it in the plugin manager)
  bcode,     \* the seed program of the built-in sample in the code of this host start
  prog,      \* the stored text of sample: a seed program, or "edit"
  pseed,     \* the seed hash in the program record of sample; it lands in the same put as the text
  bLost,     \* ghost: a start of sample, whose record had the seed hash of its code, changed its program
  starts     \* host starts after the first one

vars == <<sampleOn, bcode, prog, pseed, bLost, starts>>

TypeOK ==
  /\ sampleOn \in BOOLEAN
  /\ bcode \in BSeeds
  /\ prog \in {"edit"} \cup BSeeds
  /\ pseed \in {None} \cup BSeeds
  /\ bLost \in BOOLEAN
  /\ starts \in 0..MaxStarts

(* W seed() of a built-in row (`registration.builtIn`, set in W add): a record whose seed hash      *)
(* differs from the hash of the seed program of the code, also a record with no hash, gets that seed *)
(* program and its hash in one put. A record with the same hash stays, also an edit: W setProgram    *)
(* keeps the hash. An edit and a call of the slug wait for the seed (`seeded`), so the seed is part  *)
(* of the step that starts the row.                                                                  *)
(* Mutant builtinSkip: the code before main.seed_refresh. Only a slug with no record gets the seed,  *)
(* with no hash.                                                                                     *)
(* Mutant builtinAlways: each start of the row writes its seed, with no compare.                     *)
BWrites(p, ps, c) == CASE Mutant = "builtinSkip" -> FALSE
                       [] Mutant = "builtinAlways" -> TRUE
                       [] OTHER -> ps # c
BSeedP(p, ps, c) == IF BWrites(p, ps, c) THEN c ELSE p
BSeedS(p, ps, c) == IF BWrites(p, ps, c) THEN c ELSE ps
(* The ghost bLost: the record had the seed hash of the code, and the start changed the program. *)
BLost(p, ps, c) == ps = c /\ BSeedP(p, ps, c) # p

(* An older app stored the program p0 of sample with no seed hash. This first host start of the code *)
(* applies the seed rule of a built-in row to it.                                                     *)
Init ==
  /\ sampleOn = TRUE
  /\ bcode = "p0"
  /\ prog = BSeedP("p0", None, "p0")
  /\ pseed = BSeedS("p0", None, "p0")
  /\ bLost = FALSE
  /\ starts = 0

(* The user turns the sample row off or on (PM setPluginEnabled). When it turns on, the row registers *)
(* again, and W seed() applies the seed rule.                                                         *)
ToggleSample ==
  /\ sampleOn' = ~sampleOn
  /\ IF sampleOn'
       THEN /\ prog' = BSeedP(prog, pseed, bcode)
            /\ pseed' = BSeedS(prog, pseed, bcode)
            /\ bLost' = (bLost \/ BLost(prog, pseed, bcode))
       ELSE UNCHANGED <<prog, pseed, bLost>>
  /\ UNCHANGED <<bcode, starts>>

(* The host stops and starts again. The new host can run the code of an app update, with another seed *)
(* program of sample (bc). When the sample row is on, it registers, and W seed() applies the seed rule. *)
Restart ==
  /\ starts < MaxStarts
  /\ \E bc \in BSeeds :
       /\ bcode' = bc
       /\ prog' = IF sampleOn THEN BSeedP(prog, pseed, bc) ELSE prog
       /\ pseed' = IF sampleOn THEN BSeedS(prog, pseed, bc) ELSE pseed
       /\ bLost' = (bLost \/ (sampleOn /\ BLost(prog, pseed, bc)))
  /\ starts' = starts + 1
  /\ UNCHANGED sampleOn

(* A plugin edits the stored program of sample while it is on: ctx.widgets.setProgram (W setProgram). *)
(* The edit keeps the seed hash.                                                                       *)
UserEdit ==
  /\ sampleOn
  /\ prog' = "edit"
  /\ UNCHANGED <<sampleOn, bcode, pseed, bLost, starts>>

Next == ToggleSample \/ Restart \/ UserEdit

Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* The rules. *)

(* builtin.seed_fresh: "While a built-in widget is on, its program record has the seed hash of the seed program of    *)
(* its code, and the text is that seed program or a later edit." spec main_widget.seed; W seed(). An older app stored  *)
(* the program of sample with no seed hash (Init), and an app update can bring a new seed program at a host start.     *)
BuiltInSeedFresh ==
  sampleOn => (pseed = bcode /\ prog \in {bcode, "edit"})

(* builtin.same_seed: "A start of a built-in widget whose record has the seed hash of its code keeps the stored       *)
(* program, also an edit." spec main_widget.seed; W seed(), W setProgram.                                              *)
BuiltInSameSeedKeepsProgram == ~bLost

=============================================================================
