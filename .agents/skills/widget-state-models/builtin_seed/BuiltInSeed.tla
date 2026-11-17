----------------------------- MODULE BuiltInSeed -----------------------------
(***************************************************************************)
(* The seed rule of a built-in widget row (spec main_widget.seed, unit     *)
(* main.seed_refresh), apart from the install job of widget_install: no    *)
(* install step changes the program record of a built-in slug, because the *)
(* slug of a built-in widget is reserved (BuiltInSlugReserved).            *)
(*                                                                         *)
(* Code: deepwidgets/widgets/src/index.ts (W): `seed`, `add` (it sets      *)
(* `registration.builtIn`), and `setProgram`. The model has the built-in   *)
(* sample. Its record is the text, the seed hash, and the rev of the       *)
(* storage table `program`. An app update can bring a new seed program at  *)
(* a host start.                                                           *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS MaxSteps,    \* bound on the steps of a behavior (each step adds at most 1 to the rev)
          Mutant       \* "none" for the code; a broken variant proves that a rule can fail

None   == "none"
(* The seed programs of the code of the built-in sample. p0 is also the program that an older app stored. *)
BSeeds == {"p0", "p5"}
(* An edit of the stored program. It keeps the seed hash of the record (W setProgram), so the model marks *)
(* each edit with that hash: e0 under the hash of p0, e5 under the hash of p5, eN under no hash.           *)
EditOf(ps) == CASE ps = "p0" -> "e0" [] ps = "p5" -> "e5" [] OTHER -> "eN"
Edits  == {"e0", "e5", "eN"}

VARIABLES
  up,         \* the host runs
  sampleOn,   \* the built-in sample row is on (the user can switch it in the plugin manager)
  bcode,      \* the seed program of the built-in sample in the code of the host that runs
  prog,       \* the stored text of sample: a seed program, or an edit
  pseed,      \* the seed hash in the program record of sample; it lands in the same put as the text
  rev,        \* the rev of the program record; each put adds 1 (W seed, W setProgram)
  sameWrote,  \* ghost: a start of sample, whose stored record had the seed hash of its code, changed that record
  n           \* the steps so far

vars == <<up, sampleOn, bcode, prog, pseed, rev, sameWrote, n>>

TypeOK ==
  /\ up \in BOOLEAN
  /\ sampleOn \in BOOLEAN
  /\ bcode \in BSeeds
  /\ prog \in BSeeds \cup Edits
  /\ pseed \in {None} \cup BSeeds
  /\ rev \in 1..(MaxSteps + 1)
  /\ sameWrote \in BOOLEAN
  /\ n \in 0..MaxSteps

(* W seed() of a built-in row (`registration.builtIn`, set in W add): a record whose seed hash      *)
(* differs from the hash of the seed program of the code, also a record with no hash, gets that seed *)
(* program and its hash in one put, with the next rev. A record with the same hash stays, also an    *)
(* edit: W setProgram keeps the hash. An edit and a call of the slug wait for the seed (`seeded`),   *)
(* so the seed is part of the step that starts the row.                                              *)
(* Mutant builtinSkip: the code before main.seed_refresh. Only a slug with no record gets the seed,  *)
(* with no hash. Here the record always exists, so the row never writes it.                          *)
(* Mutant builtinAlways: each start of the row writes its seed, with no compare.                     *)
(* Mutant textOnly: a stale record gets the new text, but its seed hash stays.                       *)
BWrites(ps, c) == CASE Mutant = "builtinSkip" -> FALSE
                    [] Mutant = "builtinAlways" -> TRUE
                    [] OTHER -> ps # c

(* The registration of sample with the seed program c of its code. The ghost sameWrote compares the  *)
(* stored record before and after the step. It does not use BWrites, so any write of a record that   *)
(* has the seed hash of the code breaks the rule BuiltInSameSeedKeepsProgram.                         *)
Register(c) ==
  /\ prog' = IF BWrites(pseed, c) THEN c ELSE prog
  /\ pseed' = IF BWrites(pseed, c) /\ Mutant # "textOnly" THEN c ELSE pseed
  /\ rev' = IF BWrites(pseed, c) THEN rev + 1 ELSE rev
  /\ sameWrote' = (sameWrote \/ (pseed = c /\ <<prog', pseed', rev'>> # <<prog, pseed, rev>>))

(* An older app stored the program p0 of sample at rev 1, with no seed hash. The host of the code of *)
(* this unit has not started yet.                                                                    *)
Init ==
  /\ up = FALSE
  /\ sampleOn = TRUE
  /\ bcode = "p0"
  /\ prog = "p0"
  /\ pseed = None
  /\ rev = 1
  /\ sameWrote = FALSE
  /\ n = 0

(* The host starts. It can run the code of an app update, with another seed program of sample (bc).  *)
(* When the sample row is on, it registers, and W seed() applies the seed rule.                      *)
Boot ==
  /\ ~up /\ n < MaxSteps
  /\ \E bc \in BSeeds :
       /\ bcode' = bc
       /\ IF sampleOn THEN Register(bc) ELSE UNCHANGED <<prog, pseed, rev, sameWrote>>
  /\ up' = TRUE
  /\ n' = n + 1
  /\ UNCHANGED sampleOn

(* The host stops: a crash, or the user quits. *)
Stop ==
  /\ up /\ n < MaxSteps
  /\ up' = FALSE
  /\ n' = n + 1
  /\ UNCHANGED <<sampleOn, bcode, prog, pseed, rev, sameWrote>>

(* The user turns the sample row off or on (PM setPluginEnabled). When it turns on, the row registers *)
(* again, and W seed() applies the seed rule.                                                         *)
ToggleSample ==
  /\ up /\ n < MaxSteps
  /\ sampleOn' = ~sampleOn
  /\ IF sampleOn' THEN Register(bcode) ELSE UNCHANGED <<prog, pseed, rev, sameWrote>>
  /\ n' = n + 1
  /\ UNCHANGED <<up, bcode>>

(* A plugin edits the stored program of sample while it runs: ctx.widgets.setProgram (W setProgram). *)
(* The edit keeps the seed hash, with the next rev.                                                    *)
UserEdit ==
  /\ up /\ sampleOn /\ n < MaxSteps
  /\ prog' = EditOf(pseed)
  /\ rev' = rev + 1
  /\ n' = n + 1
  /\ UNCHANGED <<up, sampleOn, bcode, pseed, sameWrote>>

(* The bound of the behavior is reached. *)
Done ==
  /\ n = MaxSteps
  /\ UNCHANGED vars

Next == Boot \/ Stop \/ ToggleSample \/ UserEdit \/ Done

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

(* builtin.same_seed: "A start of a built-in widget whose record has the seed hash of its code changes nothing in *)
(* that record: the text, an edit, the seed hash, and the rev stay." spec main_widget.seed, and the plan row of   *)
(* main.seed_refresh: "A second start with the same seed changes nothing: the program rev stays." W seed().      *)
BuiltInSameSeedKeepsProgram == ~sameWrote

=============================================================================
