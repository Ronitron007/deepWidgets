---- MODULE ActionContract ----
(***************************************************************************)
(* The action contract of the deepWidgets widget runtime, for one slug.   *)
(* Code: deepwidgets/widgets/src/index.ts at c254b9df, after the unit     *)
(* widget.action_settle (spec widget_fv.action). The mutant              *)
(* slot_at_timeout is the timeout of the code before that unit.           *)
(* Spec: docs/specs/widget-mvp.md, widget_mvp.runtime.contract,          *)
(*       widget_mvp.runtime.storage, widget_mvp.runtime.api, and          *)
(*       docs/specs/widget-fv.md, widget_fv.action.                       *)
(* Line refs: index.ts is deepwidgets/widgets/src/index.ts, domain.ts is  *)
(* packages/storage/storage-domain/src/domain.ts, both at c254b9df.       *)
(*                                                                         *)
(* Each step is one run of JS code between two awaits (or between an      *)
(* await and a timer). Back-to-back awaits on promises that are already   *)
(* resolved, with no shared read or write between them, are one step.    *)
(* Time is abstract: a wait timer, a run timeout, and the request TTL     *)
(* can fire at any moment when their guard holds.                          *)
(*                                                                         *)
(* Jobs (each one attempt of one client):                                  *)
(*   A1, A2  client A, requestId k, args a (A2 is the retry of A1)        *)
(*   B1      client B, same caller and requestId k, same args a           *)
(*   C1      client C, same caller and requestId k, other args b          *)
(*   N1      a mutation with no requestId                                  *)
(*   U1      update() from a timer (index.ts:916-926)                      *)
(*   Q1      a query                                                       *)
(* One `requests` key k exists: all keyed jobs share (caller, requestId). *)
(***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Jobs,         \* subset of {"A1","A2","B1","C1","N1","U1","Q1"}
          MaxRestarts,  \* host restarts (crash, or start after a stop)
          MaxExpire,    \* TTL expiries of the record of k
          DisposeOn,    \* whether the runtime can be disposed
          Mutant        \* "none", or one broken variant of the code (see the mutant table)

Kind(j)  == CASE j = "U1" -> "upd" [] j = "Q1" -> "qry" [] OTHER -> "mut"
Keyed(j) == j \in {"A1", "A2", "B1", "C1"}
Args(j)  == IF j = "C1" THEN "b" ELSE "a"
Prev(j)  == IF j = "A2" THEN "A1" ELSE "none"

\* An answer: its code, `replayed` (rp), its rev, and `resultLost` (rl, index.ts:1065).
NoAns   == [code |-> "none", rp |-> FALSE, rev |-> 0, rl |-> FALSE]
NoRec   == [args |-> "none", code |-> "none", rev |-> 0]
NoMark  == [args |-> "none", rev |-> 0]
Pending == {"seed", "dup", "queued", "run", "rec0", "rec"}

VARIABLES
  pc,        \* per job: idle seed dup queued run rec0 rec answered dead
  h,         \* per job: handler code still runs ("on"), also after a timeout
  w,         \* per job: its state write: none pre chain io done refused lost
  aborted,   \* per job: the run timer fired and aborted w.signal (index.ts:948-949):
             \*   "no"; "pre": run.committed was false then; "cmt": it was true (index.ts:950)
  wrote,     \* per job: run.wrote (index.ts:903)
  ran,       \* per job: the handler or update job started (left the queue)
  ans,       \* per job: the answer the caller got
  pend,      \* per job: the outcome that remember() stores (index.ts:1069,1075)
  waitOn,    \* per job: the in-flight owner a duplicate awaits (index.ts:1038)
  queue,     \* the FIFO tail chain of the slug, jobs not yet turned (index.ts:845)
  holder,    \* the job that holds the queue slot (its turn has not settled)
  chain,     \* the domain write chain (domain.ts:283-300)
  inflight,  \* the in-flight owner of key k (index.ts:712,1041), process memory
  rec,       \* the durable `requests` record of k (the outcome)
  mk,        \* the durable write mark of k: it lands in the state record, in the same write (index.ts:898-901)
  rev,       \* the durable and in-memory state revision
  stopping,  \* index.ts:725
  dom,       \* the storage domain: open closing closed
  restarts, expires,
  \* ghosts for the rules
  log,       \* each state write that landed, by job
  cnt,       \* writes of key k that landed since the last TTL expiry
  okRevs,    \* revs of ok answers for key k since the last expiry
  okArgs,    \* args of ok answers for key k since the last expiry
  late,      \* a write landed after its call gave its answer
  overlap,   \* a write landed while another job held the slot
  enqOrd, startOrd,
  afterStop, \* a call or update was admitted after dispose began
  base       \* per job: the rev a write read; used only by the stale_rev mutant. That mutant has
             \* no run: the slot keeps one write at a time, so a stale read can not occur here.

vars == <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
          inflight, rec, mk, rev, stopping, dom, restarts, expires, log, cnt, okRevs,
          okArgs, late, overlap, enqOrd, startOrd, afterStop, base>>

ghosts == <<log, cnt, okRevs, okArgs, late, overlap, enqOrd, startOrd, afterStop, base>>

Init ==
  /\ pc = [j \in Jobs |-> "idle"]
  /\ h = [j \in Jobs |-> "off"]
  /\ w = [j \in Jobs |-> "none"]
  /\ aborted = [j \in Jobs |-> "no"]
  /\ wrote = [j \in Jobs |-> FALSE]
  /\ ran = [j \in Jobs |-> FALSE]
  /\ ans = [j \in Jobs |-> NoAns]
  /\ pend = [j \in Jobs |-> NoAns]
  /\ waitOn = [j \in Jobs |-> "none"]
  /\ queue = <<>> /\ holder = "none" /\ chain = <<>>
  /\ inflight = "none" /\ rec = NoRec /\ mk = NoMark /\ rev = 0
  /\ stopping = FALSE /\ dom = "open" /\ restarts = 0 /\ expires = 0
  /\ log = <<>> /\ cnt = 0 /\ okRevs = {} /\ okArgs = {}
  /\ late = FALSE /\ overlap = FALSE /\ enqOrd = <<>> /\ startOrd = <<>>
  /\ afterStop = FALSE
  /\ base = [j \in Jobs |-> 0]

Range(s) == {s[i] : i \in 1..Len(s)}
Drop(s, x) == SelectSeq(s, LAMBDA y : y # x)

\* The run timer of j fired.
Ab(j) == aborted[j] # "no"

DupAns(a) == IF a.code = "ok" /\ Mutant # "dup_no_flag" THEN [a EXCEPT !.rp = TRUE] ELSE a

(* The call of j settles with answer a. For the in-flight owner of k:    *)
(* `finally inflight.delete(key)` (index.ts:1044-1045), and each         *)
(* duplicate that awaits it gets `{ ...outcome, replayed: true }`        *)
(* (index.ts:1038).                                                       *)
Finish(j, a) ==
  LET D == {d \in Jobs : pc[d] = "dup" /\ waitOn[d] = j}
      okNow == {x \in D \cup {j} : Keyed(x) /\ a.code = "ok"}
  IN /\ pc' = [x \in Jobs |-> IF x = j \/ x \in D THEN "answered" ELSE pc[x]]
     /\ ans' = [x \in Jobs |-> IF x = j THEN a ELSE IF x \in D THEN DupAns(a) ELSE ans[x]]
     /\ inflight' = IF inflight = j THEN "none" ELSE inflight
     /\ okRevs' = IF okNow # {} THEN okRevs \cup {a.rev} ELSE okRevs
     /\ okArgs' = okArgs \cup {Args(x) : x \in okNow}

Ans(code, r) == [code |-> code, rp |-> FALSE, rev |-> r, rl |-> FALSE]

----------------------------------------------------------------------------
(* admit (index.ts:728-735, 1473-1474), then call() up to its first     *)
(* await (index.ts:1016-1041), or update() up to enqueue                 *)
(* (index.ts:916-925).                                                     *)
Admit(j) ==
  /\ pc[j] = "idle"
  /\ IF Prev(j) = "none" THEN TRUE ELSE pc[Prev(j)] \in {"answered", "dead"}
  /\ IF stopping /\ Mutant # "no_stop_check"                     \* index.ts:729
     THEN /\ pc' = [pc EXCEPT ![j] = "answered"]
          /\ ans' = [ans EXCEPT ![j] = Ans("busy", 0)]
          /\ UNCHANGED <<queue, enqOrd, inflight, waitOn, ran, h, okRevs, okArgs>>
     ELSE CASE Kind(j) = "upd" ->                               \* index.ts:924-925
                 /\ pc' = [pc EXCEPT ![j] = "queued"]
                 /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
                 /\ UNCHANGED <<ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] Kind(j) = "qry" /\ Mutant = "query_queued" ->
                 /\ pc' = [pc EXCEPT ![j] = "queued"]
                 /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
                 /\ UNCHANGED <<ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] Kind(j) = "qry" ->            \* runAction: no queue (index.ts:1012)
                 /\ pc' = [pc EXCEPT ![j] = "run"]
                 /\ ran' = [ran EXCEPT ![j] = TRUE]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, waitOn, h, okRevs, okArgs>>
            [] ~Keyed(j) ->                                     \* index.ts:1026-1027
                 /\ pc' = [pc EXCEPT ![j] = "seed"]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] inflight # "none" /\ Mutant # "no_inflight" /\ Args(inflight) # Args(j) ->   \* index.ts:1037
                 /\ pc' = [pc EXCEPT ![j] = "answered"]
                 /\ ans' = [ans EXCEPT ![j] = Ans("conflict", 0)]
                 /\ UNCHANGED <<queue, enqOrd, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] inflight # "none" /\ Mutant # "no_inflight" ->     \* index.ts:1038
                 /\ pc' = [pc EXCEPT ![j] = "dup"]
                 /\ waitOn' = [waitOn EXCEPT ![j] = inflight]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, ran, h, okRevs, okArgs>>
            [] OTHER ->                                          \* index.ts:1040-1041
                 /\ pc' = [pc EXCEPT ![j] = "seed"]
                 /\ inflight' = j
                 /\ UNCHANGED <<queue, enqOrd, ans, waitOn, ran, h, okRevs, okArgs>>
  /\ afterStop' = (afterStop \/ (stopping /\ pc'[j] # "answered"))
  /\ UNCHANGED <<w, aborted, wrote, pend, holder, chain, rec, mk, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, startOrd, base>>

(* runOnce after `await entry.seeded; await ready` (index.ts:1052-1054): *)
(* read the outcome record, then the write mark, then replay, conflict,  *)
(* or enqueue.                                                             *)
Lookup(j) ==
  /\ pc[j] = "seed" /\ Keyed(j)
  /\ IF rec # NoRec
     THEN /\ IF rec.args # Args(j) /\ Mutant # "no_hash_check" THEN Finish(j, Ans("conflict", 0))  \* :1056
             ELSE IF rec.code = "ok"
                  THEN Finish(j, [code |-> "ok", rp |-> TRUE, rl |-> FALSE,                    \* :1057
                                  rev |-> IF Mutant = "replay_live_rev" THEN rev ELSE rec.rev])
                  ELSE Finish(j, Ans(rec.code, rec.rev))                                       \* :1058
          /\ UNCHANGED <<queue, enqOrd>>
     ELSE IF mk # NoMark   \* a write mark with no outcome: the call wrote, then the host stopped (:1062-1065)
     THEN /\ IF mk.args # Args(j) /\ Mutant # "no_hash_check" THEN Finish(j, Ans("conflict", 0))  \* :1064
             ELSE Finish(j, [code |-> "ok", rp |-> TRUE, rev |-> mk.rev, rl |-> TRUE])         \* :1065 resultLost
          /\ UNCHANGED <<queue, enqOrd>>
     ELSE /\ pc' = [pc EXCEPT ![j] = "queued"]                                                \* :1068, runAction :1013
          /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, holder, chain, rec, mk, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap,
                 startOrd, afterStop, base>>

(* call() with no requestId: after `await entry.seeded` (index.ts:1027). *)
EnqueuePlain(j) ==
  /\ pc[j] = "seed" /\ ~Keyed(j)
  /\ pc' = [pc EXCEPT ![j] = "queued"]
  /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
  /\ UNCHANGED <<h, w, aborted, wrote, ran, ans, pend, waitOn, holder, chain, inflight,
                 rec, mk, rev, stopping, dom, restarts, expires, log, cnt, okRevs, okArgs,
                 late, overlap, startOrd, afterStop, base>>

(* The wait timer fires before the turn (index.ts:830-834): busy.        *)
(* error.wrote is not set, so runOnce stores nothing (index.ts:1074).    *)
WaitTimeout(j) ==
  /\ pc[j] = "queued" /\ j \in Range(queue)
  /\ queue' = IF Mutant = "no_cancel" THEN queue ELSE Drop(queue, j)
  /\ Finish(j, Ans("busy", 0))
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, holder, chain, rec, mk, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap, enqOrd,
                 startOrd, afterStop, base>>

(* turn() of the queue head after the slot frees (index.ts:835-840),    *)
(* and the handler starts (index.ts:963). An update job starts write()  *)
(* (index.ts:925).                                                         *)
Turn(j) ==
  /\ holder = "none" /\ queue # <<>>
  /\ IF Mutant = "any_turn" THEN j \in Range(queue) ELSE Head(queue) = j
  /\ queue' = Drop(queue, j)
  /\ holder' = j
  /\ pc' = [pc EXCEPT ![j] = "run"]
  /\ ran' = [ran EXCEPT ![j] = TRUE]
  /\ h' = [h EXCEPT ![j] = IF Kind(j) = "mut" THEN "on" ELSE "off"]
  /\ w' = [w EXCEPT ![j] = IF Kind(j) = "upd" THEN "pre" ELSE "none"]
  /\ startOrd' = Append(startOrd, j)
  /\ UNCHANGED <<aborted, wrote, ans, pend, waitOn, chain, inflight, rec, mk, rev, stopping,
                 dom, restarts, expires, log, cnt, okRevs, okArgs, late, overlap,
                 enqOrd, afterStop, base>>

(* The handler calls w.update(fn) (index.ts:939-941): write() starts and *)
(* awaits entry.seeded and ready (index.ts:875-885). A handler that      *)
(* timed out still runs and can do this too: its first write, or a       *)
(* second write after its first write landed. Each such write is         *)
(* refused (index.ts:876, 886).                                           *)
HandlerWrites(j) ==
  /\ Kind(j) = "mut" /\ h[j] = "on"
  /\ w[j] = "none" \/ (w[j] = "done" /\ Ab(j))
  /\ w' = [w EXCEPT ![j] = "pre"]
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, mk, rev, stopping, dom, restarts, expires, ghosts>>

(* write() after its awaits: the first abort check (index.ts:886), then  *)
(* table.update queues on the domain chain (domain.ts:375-376).          *)
WriteQueues(j) ==
  /\ w[j] = "pre"
  /\ IF Ab(j) \/ dom # "open"
     THEN /\ w' = [w EXCEPT ![j] = "refused"] /\ UNCHANGED chain
     ELSE /\ w' = [w EXCEPT ![j] = "chain"]
          /\ chain' = Append(chain, [t |-> "state", j |-> j])
  /\ base' = IF Mutant = "stale_rev" THEN [base EXCEPT ![j] = rev] ELSE base
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, inflight,
                 rec, mk, rev, stopping, dom, restarts, expires, log, cnt, okRevs, okArgs,
                 late, overlap, enqOrd, startOrd, afterStop>>

(* The write reaches its chain slot: fn runs with the second abort check *)
(* (index.ts:890), and the write commits: run.committed = true           *)
(* (index.ts:895). Then `await putRecord` (domain.ts:383-384) starts.    *)
WriteSlot(j) ==
  /\ w[j] = "chain" /\ chain # <<>> /\ Head(chain) = [t |-> "state", j |-> j]
  /\ IF Ab(j) /\ Mutant # "no_slot_abort_check"
     THEN /\ w' = [w EXCEPT ![j] = "refused"] /\ chain' = Tail(chain)
          /\ rev' = IF Mutant = "rev_on_refuse" THEN rev + 1 ELSE rev   \* mutant: the refused write bumps the rev
     ELSE /\ w' = [w EXCEPT ![j] = "io"] /\ UNCHANGED <<chain, rev>>
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, inflight,
                 rec, mk, stopping, dom, restarts, expires, ghosts>>

(* putRecord is durable; memory takes the new value (domain.ts:384-386).*)
(* The record holds the state and the write mark of a keyed run          *)
(* (index.ts:896-901). write() continues: run.wrote = true               *)
(* (index.ts:903). These microtasks run before any timer: one step.      *)
WriteLands(j) ==
  /\ w[j] = "io"
  /\ rev' = IF Mutant = "stale_rev" THEN base[j] + 1 ELSE rev + 1
  /\ chain' = Tail(chain)
  /\ w' = [w EXCEPT ![j] = "done"]
  /\ wrote' = [wrote EXCEPT ![j] = TRUE]
  /\ log' = Append(log, j)
  /\ mk' = IF Keyed(j) /\ Mutant # "no_mark" THEN [args |-> Args(j), rev |-> rev'] ELSE mk
  /\ cnt' = IF Keyed(j) THEN cnt + 1 ELSE cnt
  /\ late' = (late \/ pc[j] \in {"answered", "rec0", "rec"})   \* a write after the call's answer
  /\ overlap' = (overlap \/ holder \notin {"none", j})
  /\ UNCHANGED <<pc, h, aborted, ran, ans, pend, waitOn, queue, holder, inflight, rec,
                 stopping, dom, restarts, expires, okRevs, okArgs, enqOrd, startOrd,
                 afterStop, base>>

(* The handler returns after its write settled; the job waits for its   *)
(* started writes, reads rev, and settles; the slot frees                 *)
(* (index.ts:974, 999-1000, 1009, 840). An update job settles when its   *)
(* write lands. (A handler that returns with a write that is not awaited *)
(* clears the run timer, index.ts:980. The model lets the timer fire     *)
(* until the write settled: more paths, not fewer.)                       *)
Return(j) ==
  /\ pc[j] = "run" /\ ~Ab(j) /\ Kind(j) # "qry"
  /\ IF Kind(j) = "upd" THEN w[j] = "done" ELSE w[j] \in {"none", "done"}
  /\ holder' = "none"
  /\ h' = [h EXCEPT ![j] = "off"]
  /\ IF Keyed(j)
     THEN /\ pc' = [pc EXCEPT ![j] = "rec0"]
          /\ pend' = [pend EXCEPT ![j] = Ans("ok", rev)]
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("ok", rev)) /\ UNCHANGED pend
  /\ UNCHANGED <<w, aborted, wrote, ran, waitOn, queue, chain, rec, mk, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, enqOrd, startOrd, afterStop, base>>

(* widget_fv.action: a write is committed once it passed the abort check *)
(* at its storage slot (WriteSlot, index.ts:895).                          *)
Committed(j) == w[j] \in {"io", "done"}

(* The run timer fires (index.ts:948-950): abort w.signal, and read      *)
(* run.committed. A write that has not committed is refused at its next  *)
(* abort check. A committed write still lands.                            *)
Timeout(j) ==
  /\ Mutant # "slot_at_timeout"
  /\ pc[j] = "run" /\ Kind(j) = "mut" /\ ~Ab(j)
  /\ aborted' = [aborted EXCEPT ![j] = IF Committed(j) THEN "cmt" ELSE "pre"]
  /\ UNCHANGED <<pc, h, w, wrote, ran, ans, pend, waitOn, queue, holder, chain, inflight,
                 rec, mk, rev, stopping, dom, restarts, expires, ghosts>>

(* The started writes of the timed-out run settled (index.ts:954, 999).  *)
(* The handler may still run, and does not count (index.ts:964-966).     *)
(* The slot frees (index.ts:1000, 840). A run that was committed at the  *)
(* timer and wrote gives timeout-after-write with the rev (index.ts:957);*)
(* else it gives timeout (index.ts:951, 956). A keyed run that wrote     *)
(* stores its answer (index.ts:1003-1005, 1074-1075).                    *)
TimeoutSettles(j) ==
  LET a == IF aborted[j] = "cmt" /\ wrote[j] THEN Ans("timeout-after-write", rev)
           ELSE Ans("timeout", IF wrote[j] THEN rev ELSE 0)
  IN /\ Mutant # "slot_at_timeout"
     /\ pc[j] = "run" /\ Kind(j) = "mut" /\ Ab(j) /\ w[j] \in {"none", "refused", "done"}
     /\ holder' = "none"
     /\ IF wrote[j] /\ Keyed(j)
        THEN /\ pc' = [pc EXCEPT ![j] = "rec0"]
             /\ pend' = [pend EXCEPT ![j] = a]
             /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
        ELSE /\ Finish(j, a)
             /\ UNCHANGED pend
     /\ UNCHANGED <<h, w, aborted, wrote, ran, waitOn, queue, chain, rec, mk, rev, stopping,
                    dom, restarts, expires, log, cnt, late, overlap, enqOrd, startOrd, afterStop, base>>

(* Mutant slot_at_timeout: the code before widget.action_settle. The run *)
(* timer fires at any time: abort, reject timeout, the slot frees.       *)
TimeoutOld(j) ==
  /\ Mutant = "slot_at_timeout"
  /\ pc[j] = "run" /\ Kind(j) = "mut" /\ ~Ab(j)
  /\ aborted' = [aborted EXCEPT ![j] = "pre"]
  /\ holder' = "none"
  /\ IF Keyed(j) /\ wrote[j]
     THEN /\ pc' = [pc EXCEPT ![j] = "rec0"]
          /\ pend' = [pend EXCEPT ![j] = Ans("timeout", 0)]
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("timeout", 0)) /\ UNCHANGED pend
  /\ UNCHANGED <<h, w, wrote, ran, waitOn, queue, chain, rec, mk, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, enqOrd, startOrd, afterStop, base>>

(* A query handler ends, by return or by timeout. It cannot write       *)
(* (index.ts:940).                                                         *)
QueryEnds(j) ==
  /\ pc[j] = "run" /\ Kind(j) = "qry"
  /\ pc' = [pc EXCEPT ![j] = "answered"]
  /\ ans' = [ans EXCEPT ![j] = Ans("ok", rev)]
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, chain, inflight,
                 rec, mk, rev, stopping, dom, restarts, expires, ghosts>>

(* remember(): requests.put queues on the domain chain                   *)
(* (index.ts:1082-1086, called at 1069 and 1075).                        *)
Remember(j) ==
  /\ pc[j] = "rec0"
  /\ IF dom = "open"
     THEN /\ pc' = [pc EXCEPT ![j] = "rec"]
          /\ chain' = Append(chain, [t |-> "req", j |-> j])
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("closed", 0)) /\ UNCHANGED chain
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, rec, mk, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap, enqOrd,
                 startOrd, afterStop, base>>

(* The record is durable (domain.ts:340-345); the call answers.          *)
RecordLands(j) ==
  /\ pc[j] = "rec" /\ chain # <<>> /\ Head(chain) = [t |-> "req", j |-> j]
  /\ chain' = Tail(chain)
  /\ rec' = [args |-> Args(j), code |-> pend[j].code, rev |-> pend[j].rev]
  /\ Finish(j, pend[j])
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, mk, rev, stopping,
                 dom, restarts, expires, log, cnt, late, overlap, enqOrd, startOrd,
                 afterStop, base>>

(* The host process ends (crash, kill, or a stop) and starts again. The  *)
(* state and requests tables persist; the queue, the in-flight map, the  *)
(* domain chain, and running handlers are lost (spec runtime.storage).   *)
HostRestart ==
  /\ restarts < MaxRestarts
  /\ restarts' = restarts + 1
  /\ pc' = [x \in Jobs |-> IF pc[x] \in Pending THEN "dead" ELSE pc[x]]
  /\ w' = [x \in Jobs |-> IF w[x] \in {"pre", "chain", "io"} THEN "lost" ELSE w[x]]
  /\ h' = [x \in Jobs |-> "off"]
  /\ queue' = <<>> /\ holder' = "none" /\ chain' = <<>> /\ inflight' = "none"
  /\ stopping' = FALSE /\ dom' = "open"
  /\ UNCHANGED <<aborted, wrote, ran, ans, pend, waitOn, rec, mk, rev, expires, ghosts>>

(* The runtime row disposes (index.ts:746-763).                          *)
DisposeStarts ==
  /\ DisposeOn /\ ~stopping
  /\ stopping' = TRUE                                              \* index.ts:747
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, mk, rev, dom, restarts, expires, ghosts>>

(* allSettled(running) resolved (index.ts:755-756): close begins; the    *)
(* domain refuses new writes (domain.ts:256-257, 283-286). The drain     *)
(* bound of index.ts:753-760 is not in the model: it is longer than the  *)
(* wait and the run of a job, and time is abstract here.                  *)
DomainCloses ==
  /\ stopping /\ dom = "open"
  /\ Mutant = "no_drain" \/ \A x \in Jobs : pc[x] \notin Pending
  /\ dom' = "closing"
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, mk, rev, stopping, restarts, expires, ghosts>>

(* The chain drained and the unit closed: dispose ends (domain.ts:260-263). *)
DisposeEnds ==
  /\ dom = "closing" /\ chain = <<>>
  /\ dom' = "closed"
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, mk, rev, stopping, restarts, expires, ghosts>>

(* The record of k grows older than requestTtlMs: it is void            *)
(* (index.ts:1055, 1084, 718). The write mark is older than the record, *)
(* so it is void too (index.ts:858, 851, 1205-1208). Rule               *)
(* rules.at_most_once then starts over for k.                            *)
RecordExpires ==
  /\ expires < MaxExpire /\ (rec # NoRec \/ mk # NoMark)
  /\ rec' = NoRec /\ mk' = NoMark
  /\ expires' = expires + 1
  /\ cnt' = 0 /\ okRevs' = {} /\ okArgs' = {}
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rev, stopping, dom, restarts, log, late, overlap, enqOrd,
                 startOrd, afterStop, base>>

Quiet ==
  /\ \A x \in Jobs : pc[x] \notin Pending /\ w[x] \notin {"pre", "chain", "io"}
  /\ queue = <<>> /\ chain = <<>>

Done == Quiet /\ UNCHANGED vars

Next ==
  \/ \E j \in Jobs : Admit(j)
  \/ \E j \in Jobs : Lookup(j)
  \/ \E j \in Jobs : EnqueuePlain(j)
  \/ \E j \in Jobs : WaitTimeout(j)
  \/ \E j \in Jobs : Turn(j)
  \/ \E j \in Jobs : HandlerWrites(j)
  \/ \E j \in Jobs : WriteQueues(j)
  \/ \E j \in Jobs : WriteSlot(j)
  \/ \E j \in Jobs : WriteLands(j)
  \/ \E j \in Jobs : Return(j)
  \/ \E j \in Jobs : Timeout(j)
  \/ \E j \in Jobs : TimeoutSettles(j)
  \/ \E j \in Jobs : TimeoutOld(j)
  \/ \E j \in Jobs : QueryEnds(j)
  \/ \E j \in Jobs : Remember(j)
  \/ \E j \in Jobs : RecordLands(j)
  \/ HostRestart
  \/ DisposeStarts
  \/ DomainCloses
  \/ DisposeEnds
  \/ RecordExpires
  \/ Done

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(* Rules. Each cites the spec line or code line that promises it.         *)

\* rules.at_most_once. widget_mvp.runtime.storage: "This table makes a retried call
\* idempotent after a host restart"; index.ts:260 "a retried mutation runs once (also
\* after a host restart)". widget_fv.action: the state and the request record land in
\* one write (index.ts:898-901), and a retry of a call that wrote does not write again.
AtMostOnce == cnt <= 1

\* rules.replay_recorded. index.ts:1038,1057: a replay gives the recorded
\* { result, rev } with replayed: true; a fresh run never says replayed.
ReplaySameResult == Cardinality(okRevs) <= 1
ReplayFlag == \A j \in Jobs :
  (pc[j] = "answered" /\ Keyed(j) /\ ans[j].code = "ok") => (ans[j].rp = ~ran[j])
\* rules.replay_conflict. index.ts:1037,1056,1064: other args under one requestId
\* give idempotency-conflict, so two ok answers never carry different args.
ConflictOnOtherArgs == Cardinality(okArgs) <= 1

\* rules.no_late_write. widget_mvp.runtime.contract: "At the timeout, the runtime aborts
\* w.signal and refuses each later write of that call"; index.ts:190, 876, 886, 890.
\* widget_fv.action: a call that gives timeout wrote nothing, and no write of a call lands
\* after the call gave its answer (timeout-after-write waits for its started writes).
NoLateWrite ==
  /\ ~late
  /\ \A j \in Jobs : (ans[j].code = "timeout" \/ pend[j].code = "timeout") => j \notin Range(log)

\* rules.one_at_a_time. widget_mvp.runtime.contract: "one FIFO queue for mutations and
\* update"; index.ts:820-847. widget_fv.action: the slot frees only after the writes of
\* the run settled (index.ts:997-1000). A write lands only from the slot holder.
OneAtATime == ~overlap
FIFO == \A i, k \in 1..Len(startOrd) :
  i < k => \E a, b \in 1..Len(enqOrd) :
             a < b /\ enqOrd[a] = startOrd[i] /\ enqOrd[b] = startOrd[k]
\* "A query does not wait in the queue" (contract; index.ts:1011-1012).
QueryNoQueue == \A j \in Jobs : Kind(j) = "qry" => (j \notin Range(queue) /\ holder # j)

\* rules.busy_never_runs. contract: "fails with busy and does not run";
\* index.ts:822-823, 830-837.
BusyNeverRuns == \A j \in Jobs : ans[j].code = "busy" => ~ran[j]

\* rules.dispose_drain. index.ts:724 "Each call, update, and setProgram that is
\* admitted runs to its end before the domain closes"; index.ts:729, 738-740.
NoAdmitAfterStop == ~afterStop
DrainBeforeClose == dom # "open" => \A j \in Jobs : pc[j] \notin Pending

\* rules.rev_counts_writes. index.ts:896 `rev = current.rev + 1` in fn on the
\* domain chain (domain.ts:101-102, 383).
RevCountsWrites == rev = Len(log)

TypeOK ==
  /\ pc \in [Jobs -> {"idle", "seed", "dup", "queued", "run", "rec0", "rec", "answered", "dead"}]
  /\ w \in [Jobs -> {"none", "pre", "chain", "io", "done", "refused", "lost"}]
  /\ aborted \in [Jobs -> {"no", "pre", "cmt"}]
  /\ holder \in Jobs \cup {"none"}
  /\ mk \in {NoMark} \cup [args : {"a", "b"}, rev : Nat]
  /\ dom \in {"open", "closing", "closed"}
====
