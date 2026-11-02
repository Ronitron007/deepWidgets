---- MODULE ActionContract ----
(***************************************************************************)
(* The action contract of the deepWidgets widget runtime, for one slug.   *)
(* Code: deepwidgets/widgets/src/index.ts at 38df710e.                    *)
(* Spec: docs/specs/widget-mvp.md, widget_mvp.runtime.contract,          *)
(*       widget_mvp.runtime.storage, widget_mvp.runtime.api.             *)
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
(*   U1      update() from a timer (index.ts:667)                          *)
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

NoAns   == [code |-> "none", rp |-> FALSE, rev |-> 0]
NoRec   == [args |-> "none", code |-> "none", rev |-> 0]
Pending == {"seed", "dup", "queued", "run", "rec0", "rec"}

VARIABLES
  pc,        \* per job: idle seed dup queued run rec0 rec answered dead
  h,         \* per job: handler code still runs ("on"), also after a timeout
  w,         \* per job: its one state write: none pre chain io done refused lost
  aborted,   \* per job: run.signal aborted (index.ts:694)
  wrote,     \* per job: run.wrote (index.ts:657)
  ran,       \* per job: the handler or update job started (left the queue)
  ans,       \* per job: the answer the caller got
  pend,      \* per job: the outcome that remember() stores (index.ts:774,780)
  waitOn,    \* per job: the in-flight owner a duplicate awaits (index.ts:751)
  queue,     \* the FIFO tail chain of the slug, jobs not yet turned (index.ts:640)
  holder,    \* the job that holds the queue slot (its turn has not settled)
  chain,     \* the domain write chain (storage-domain domain.ts:283)
  inflight,  \* the in-flight owner of key k (index.ts:509,754), process memory
  rec,       \* the durable `requests` record of k
  rev,       \* the durable and in-memory state revision
  stopping,  \* index.ts:522
  dom,       \* the storage domain: open closing closed
  restarts, expires,
  \* ghosts for the rules
  log,       \* each state write that landed, by job
  cnt,       \* writes of key k that landed since the last TTL expiry
  okRevs,    \* revs of ok answers for key k since the last expiry
  okArgs,    \* args of ok answers for key k since the last expiry
  late,      \* a write landed after its call timed out
  overlap,   \* a write landed while another job held the slot
  enqOrd, startOrd,
  afterStop, \* a call or update was admitted after dispose began
  base       \* per job: the rev a write read; used only by the stale_rev mutant

vars == <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
          inflight, rec, rev, stopping, dom, restarts, expires, log, cnt, okRevs,
          okArgs, late, overlap, enqOrd, startOrd, afterStop, base>>

ghosts == <<log, cnt, okRevs, okArgs, late, overlap, enqOrd, startOrd, afterStop, base>>

Init ==
  /\ pc = [j \in Jobs |-> "idle"]
  /\ h = [j \in Jobs |-> "off"]
  /\ w = [j \in Jobs |-> "none"]
  /\ aborted = [j \in Jobs |-> FALSE]
  /\ wrote = [j \in Jobs |-> FALSE]
  /\ ran = [j \in Jobs |-> FALSE]
  /\ ans = [j \in Jobs |-> NoAns]
  /\ pend = [j \in Jobs |-> NoAns]
  /\ waitOn = [j \in Jobs |-> "none"]
  /\ queue = <<>> /\ holder = "none" /\ chain = <<>>
  /\ inflight = "none" /\ rec = NoRec /\ rev = 0
  /\ stopping = FALSE /\ dom = "open" /\ restarts = 0 /\ expires = 0
  /\ log = <<>> /\ cnt = 0 /\ okRevs = {} /\ okArgs = {}
  /\ late = FALSE /\ overlap = FALSE /\ enqOrd = <<>> /\ startOrd = <<>>
  /\ afterStop = FALSE
  /\ base = [j \in Jobs |-> 0]

Range(s) == {s[i] : i \in 1..Len(s)}
Drop(s, x) == SelectSeq(s, LAMBDA y : y # x)

DupAns(a) == IF a.code = "ok" /\ Mutant # "dup_no_flag" THEN [a EXCEPT !.rp = TRUE] ELSE a

(* The call of j settles with answer a. For the in-flight owner of k:    *)
(* `finally inflight.delete(key)` (index.ts:758), and each duplicate     *)
(* that awaits it gets `{ ...outcome, replayed: true }` (index.ts:751).  *)
Finish(j, a) ==
  LET D == {d \in Jobs : pc[d] = "dup" /\ waitOn[d] = j}
      okNow == {x \in D \cup {j} : Keyed(x) /\ a.code = "ok"}
  IN /\ pc' = [x \in Jobs |-> IF x = j \/ x \in D THEN "answered" ELSE pc[x]]
     /\ ans' = [x \in Jobs |-> IF x = j THEN a ELSE IF x \in D THEN DupAns(a) ELSE ans[x]]
     /\ inflight' = IF inflight = j THEN "none" ELSE inflight
     /\ okRevs' = IF okNow # {} THEN okRevs \cup {a.rev} ELSE okRevs
     /\ okArgs' = okArgs \cup {Args(x) : x \in okNow}

Ans(code, r) == [code |-> code, rp |-> FALSE, rev |-> r]

----------------------------------------------------------------------------
(* admit (index.ts:525,986-987), then call() up to its first await      *)
(* (index.ts:729-754), or update() up to enqueue (index.ts:667-676).    *)
Admit(j) ==
  /\ pc[j] = "idle"
  /\ IF Prev(j) = "none" THEN TRUE ELSE pc[Prev(j)] \in {"answered", "dead"}
  /\ IF stopping /\ Mutant # "no_stop_check"
     THEN /\ pc' = [pc EXCEPT ![j] = "answered"]
          /\ ans' = [ans EXCEPT ![j] = Ans("busy", 0)]
          /\ UNCHANGED <<queue, enqOrd, inflight, waitOn, ran, h, okRevs, okArgs>>
     ELSE CASE Kind(j) = "upd" ->
                 /\ pc' = [pc EXCEPT ![j] = "queued"]
                 /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
                 /\ UNCHANGED <<ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] Kind(j) = "qry" /\ Mutant = "query_queued" ->
                 /\ pc' = [pc EXCEPT ![j] = "queued"]
                 /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
                 /\ UNCHANGED <<ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] Kind(j) = "qry" ->            \* runAction: no queue (index.ts:725)
                 /\ pc' = [pc EXCEPT ![j] = "run"]
                 /\ ran' = [ran EXCEPT ![j] = TRUE]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, waitOn, h, okRevs, okArgs>>
            [] ~Keyed(j) ->
                 /\ pc' = [pc EXCEPT ![j] = "seed"]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] inflight # "none" /\ Mutant # "no_inflight" /\ Args(inflight) # Args(j) ->   \* index.ts:750
                 /\ pc' = [pc EXCEPT ![j] = "answered"]
                 /\ ans' = [ans EXCEPT ![j] = Ans("conflict", 0)]
                 /\ UNCHANGED <<queue, enqOrd, inflight, waitOn, ran, h, okRevs, okArgs>>
            [] inflight # "none" /\ Mutant # "no_inflight" ->     \* index.ts:751
                 /\ pc' = [pc EXCEPT ![j] = "dup"]
                 /\ waitOn' = [waitOn EXCEPT ![j] = inflight]
                 /\ UNCHANGED <<queue, enqOrd, ans, inflight, ran, h, okRevs, okArgs>>
            [] OTHER ->                                          \* index.ts:753-754
                 /\ pc' = [pc EXCEPT ![j] = "seed"]
                 /\ inflight' = j
                 /\ UNCHANGED <<queue, enqOrd, ans, waitOn, ran, h, okRevs, okArgs>>
  /\ afterStop' = (afterStop \/ (stopping /\ pc'[j] # "answered"))
  /\ UNCHANGED <<w, aborted, wrote, pend, holder, chain, rec, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, startOrd, base>>

(* runOnce after `await entry.seeded; await ready` (index.ts:764-773):  *)
(* read the record, then replay, conflict, or enqueue.                   *)
Lookup(j) ==
  /\ pc[j] = "seed" /\ Keyed(j)
  /\ IF rec # NoRec
     THEN /\ IF rec.args # Args(j) /\ Mutant # "no_hash_check" THEN Finish(j, Ans("conflict", 0))  \* :768
             ELSE IF rec.code = "ok"
                  THEN Finish(j, [code |-> "ok", rp |-> TRUE, rev |-> rec.rev])  \* :769
                  ELSE Finish(j, Ans(rec.code, 0))                               \* :770
          /\ UNCHANGED <<queue, enqOrd>>
     ELSE /\ pc' = [pc EXCEPT ![j] = "queued"]
          /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, holder, chain, rec, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap,
                 startOrd, afterStop, base>>

(* call() with no requestId: after `await entry.seeded` (index.ts:740). *)
EnqueuePlain(j) ==
  /\ pc[j] = "seed" /\ ~Keyed(j)
  /\ pc' = [pc EXCEPT ![j] = "queued"]
  /\ queue' = Append(queue, j) /\ enqOrd' = Append(enqOrd, j)
  /\ UNCHANGED <<h, w, aborted, wrote, ran, ans, pend, waitOn, holder, chain, inflight,
                 rec, rev, stopping, dom, restarts, expires, log, cnt, okRevs, okArgs,
                 late, overlap, startOrd, afterStop, base>>

(* The wait timer fires before the turn (index.ts:625-629): busy.        *)
(* error.wrote is false, so runOnce stores nothing (index.ts:779).       *)
WaitTimeout(j) ==
  /\ pc[j] = "queued" /\ j \in Range(queue)
  /\ queue' = IF Mutant = "no_cancel" THEN queue ELSE Drop(queue, j)
  /\ Finish(j, Ans("busy", 0))
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, holder, chain, rec, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap, enqOrd,
                 startOrd, afterStop, base>>

(* turn() of the queue head after the slot frees (index.ts:630-635),    *)
(* and the handler starts (index.ts:700). An update job starts write(). *)
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
  /\ UNCHANGED <<aborted, wrote, ans, pend, waitOn, chain, inflight, rec, rev, stopping,
                 dom, restarts, expires, log, cnt, okRevs, okArgs, late, overlap,
                 enqOrd, afterStop, base>>

(* The handler calls w.update(fn) (index.ts:685-687): write() starts and *)
(* awaits entry.seeded and ready (index.ts:646-647). A handler that      *)
(* timed out still runs and can do this too.                              *)
HandlerWrites(j) ==
  /\ Kind(j) = "mut" /\ h[j] = "on" /\ w[j] = "none"
  /\ w' = [w EXCEPT ![j] = "pre"]
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, rev, stopping, dom, restarts, expires, ghosts>>

(* write() after its awaits: the first abort check (index.ts:648), then  *)
(* table.update queues on the domain chain (domain.ts:387-388).          *)
WriteQueues(j) ==
  /\ w[j] = "pre"
  /\ IF aborted[j] \/ dom # "open"
     THEN /\ w' = [w EXCEPT ![j] = "refused"] /\ UNCHANGED chain
     ELSE /\ w' = [w EXCEPT ![j] = "chain"]
          /\ chain' = Append(chain, [t |-> "state", j |-> j])
  /\ base' = IF Mutant = "stale_rev" THEN [base EXCEPT ![j] = rev] ELSE base
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, inflight,
                 rec, rev, stopping, dom, restarts, expires, log, cnt, okRevs, okArgs,
                 late, overlap, enqOrd, startOrd, afterStop>>

(* The write reaches its chain slot: fn runs with the second abort check *)
(* (index.ts:652), then `await putRecord` (domain.ts:396) starts.        *)
WriteSlot(j) ==
  /\ w[j] = "chain" /\ chain # <<>> /\ Head(chain) = [t |-> "state", j |-> j]
  /\ IF aborted[j] /\ Mutant # "no_slot_abort_check"
     THEN /\ w' = [w EXCEPT ![j] = "refused"] /\ chain' = Tail(chain)
     ELSE /\ w' = [w EXCEPT ![j] = "io"] /\ UNCHANGED chain
  /\ UNCHANGED <<pc, h, aborted, wrote, ran, ans, pend, waitOn, queue, holder, inflight,
                 rec, rev, stopping, dom, restarts, expires, ghosts>>

(* putRecord is durable; memory takes the new value (domain.ts:396-398);*)
(* write() continues: run.wrote = true (index.ts:657). These microtasks  *)
(* run before any timer, so they are one step.                            *)
WriteLands(j) ==
  /\ w[j] = "io"
  /\ rev' = IF Mutant = "stale_rev" THEN base[j] + 1 ELSE rev + 1
  /\ chain' = Tail(chain)
  /\ w' = [w EXCEPT ![j] = "done"]
  /\ wrote' = [wrote EXCEPT ![j] = TRUE]
  /\ log' = Append(log, j)
  /\ cnt' = IF Keyed(j) THEN cnt + 1 ELSE cnt
  /\ late' = (late \/ aborted[j])
  /\ overlap' = (overlap \/ holder \notin {"none", j})
  /\ UNCHANGED <<pc, h, aborted, ran, ans, pend, waitOn, queue, holder, inflight, rec,
                 stopping, dom, restarts, expires, okRevs, okArgs, enqOrd, startOrd,
                 afterStop, base>>

(* The handler returns after its write settled; the job reads rev and   *)
(* settles; the slot frees (index.ts:716,721,635). An update job settles *)
(* when its write lands.                                                   *)
Return(j) ==
  /\ pc[j] = "run" /\ ~aborted[j] /\ Kind(j) # "qry"
  /\ IF Kind(j) = "upd" THEN w[j] = "done" ELSE w[j] \in {"none", "done"}
  /\ holder' = "none"
  /\ h' = [h EXCEPT ![j] = "off"]
  /\ IF Keyed(j)
     THEN /\ pc' = [pc EXCEPT ![j] = "rec0"]
          /\ pend' = [pend EXCEPT ![j] = Ans("ok", rev)]
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("ok", rev)) /\ UNCHANGED pend
  /\ UNCHANGED <<w, aborted, wrote, ran, waitOn, queue, chain, rec, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, enqOrd, startOrd, afterStop, base>>

(* The run timer fires first (index.ts:692-696): abort w.signal, reject *)
(* `timeout` with error.wrote = run.wrote (index.ts:718); the slot frees.*)
(* The handler code keeps running (h stays on).                           *)
Timeout(j) ==
  /\ pc[j] = "run" /\ Kind(j) = "mut" /\ ~aborted[j]
  /\ aborted' = [aborted EXCEPT ![j] = TRUE]
  /\ holder' = "none"
  /\ IF Keyed(j) /\ wrote[j]
     THEN /\ pc' = [pc EXCEPT ![j] = "rec0"]
          /\ pend' = [pend EXCEPT ![j] = Ans("timeout", 0)]
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("timeout", 0)) /\ UNCHANGED pend
  /\ UNCHANGED <<h, w, wrote, ran, waitOn, queue, chain, rec, rev, stopping, dom,
                 restarts, expires, log, cnt, late, overlap, enqOrd, startOrd, afterStop, base>>

(* A query handler ends, by return or by timeout. It cannot write       *)
(* (index.ts:686).                                                         *)
QueryEnds(j) ==
  /\ pc[j] = "run" /\ Kind(j) = "qry"
  /\ pc' = [pc EXCEPT ![j] = "answered"]
  /\ ans' = [ans EXCEPT ![j] = Ans("ok", rev)]
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, chain, inflight,
                 rec, rev, stopping, dom, restarts, expires, ghosts>>

(* remember(): requests.put queues on the domain chain (index.ts:787-791).*)
Remember(j) ==
  /\ pc[j] = "rec0"
  /\ IF dom = "open"
     THEN /\ pc' = [pc EXCEPT ![j] = "rec"]
          /\ chain' = Append(chain, [t |-> "req", j |-> j])
          /\ UNCHANGED <<ans, inflight, okRevs, okArgs>>
     ELSE /\ Finish(j, Ans("closed", 0)) /\ UNCHANGED chain
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, rec, rev,
                 stopping, dom, restarts, expires, log, cnt, late, overlap, enqOrd,
                 startOrd, afterStop, base>>

(* The record is durable (domain.ts:340-345); the call answers.          *)
RecordLands(j) ==
  /\ pc[j] = "rec" /\ chain # <<>> /\ Head(chain) = [t |-> "req", j |-> j]
  /\ chain' = Tail(chain)
  /\ rec' = [args |-> Args(j), code |-> pend[j].code, rev |-> pend[j].rev]
  /\ Finish(j, pend[j])
  /\ UNCHANGED <<h, w, aborted, wrote, ran, pend, waitOn, queue, holder, rev, stopping,
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
  /\ UNCHANGED <<aborted, wrote, ran, ans, pend, waitOn, rec, rev, expires, ghosts>>

(* The runtime row disposes (index.ts:543-558).                          *)
DisposeStarts ==
  /\ DisposeOn /\ ~stopping
  /\ stopping' = TRUE
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, rev, dom, restarts, expires, ghosts>>

(* allSettled(running) resolved (index.ts:550-551): close begins; the    *)
(* domain refuses new writes (domain.ts:256-260).                         *)
DomainCloses ==
  /\ stopping /\ dom = "open"
  /\ Mutant = "no_drain" \/ \A x \in Jobs : pc[x] \notin Pending
  /\ dom' = "closing"
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, rev, stopping, restarts, expires, ghosts>>

(* The chain drained and the unit closed: dispose ends.                  *)
DisposeEnds ==
  /\ dom = "closing" /\ chain = <<>>
  /\ dom' = "closed"
  /\ UNCHANGED <<pc, h, w, aborted, wrote, ran, ans, pend, waitOn, queue, holder, chain,
                 inflight, rec, rev, stopping, restarts, expires, ghosts>>

(* The record of k grows older than requestTtlMs: it is void            *)
(* (index.ts:767,515,789). Rule 1 then starts over for k.                *)
RecordExpires ==
  /\ expires < MaxExpire /\ rec # NoRec
  /\ rec' = NoRec
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

\* rules.at_most_once (rule 1). widget_mvp.runtime.storage: "This table makes a
\* retried call idempotent after a host restart"; index.ts:204 "a retried mutation
\* runs once (also after a host restart)"; index.ts:744-745,777.
AtMostOnce == cnt <= 1

\* rules.replay_recorded (rule 2). index.ts:751,769: a replay gives the recorded
\* { result, rev } with replayed: true; a fresh run never says replayed.
ReplaySameResult == Cardinality(okRevs) <= 1
ReplayFlag == \A j \in Jobs :
  (pc[j] = "answered" /\ Keyed(j) /\ ans[j].code = "ok") => (ans[j].rp = ~ran[j])
\* rules.replay_conflict (rule 2). index.ts:750,768: other args under one requestId
\* give idempotency-conflict, so two ok answers never carry different args.
ConflictOnOtherArgs == Cardinality(okArgs) <= 1

\* rules.no_late_write (rule 3). widget_mvp.runtime.contract: "At the timeout, the
\* runtime aborts w.signal and refuses each later write of that call"; index.ts:139,644.
NoLateWrite == ~late

\* rules.one_at_a_time (rule 4). widget_mvp.runtime.contract: "one FIFO queue for
\* mutations and update"; index.ts:615-641. A write lands only from the slot holder.
OneAtATime == ~overlap
FIFO == \A i, k \in 1..Len(startOrd) :
  i < k => \E a, b \in 1..Len(enqOrd) :
             a < b /\ enqOrd[a] = startOrd[i] /\ enqOrd[b] = startOrd[k]
\* "A query does not wait in the queue" (contract; index.ts:724-725).
QueryNoQueue == \A j \in Jobs : Kind(j) = "qry" => (j \notin Range(queue) /\ holder # j)

\* rules.busy_never_runs (rule 5). contract: "fails with busy and does not run";
\* index.ts:617-618,626-632.
BusyNeverRuns == \A j \in Jobs : ans[j].code = "busy" => ~ran[j]

\* rules.dispose_drain (rule 6). index.ts:521 "Each call, update, and setProgram
\* that is admitted runs to its end before the domain closes"; index.ts:526,536-537.
NoAdmitAfterStop == ~afterStop
DrainBeforeClose == dom # "open" => \A j \in Jobs : pc[j] \notin Pending

\* rules.rev_counts_writes (rule 7). index.ts:655 { rev: current.rev + 1 } on the
\* domain chain (domain.ts:101-102).
RevCountsWrites == rev = Len(log)

TypeOK ==
  /\ pc \in [Jobs -> {"idle", "seed", "dup", "queued", "run", "rec0", "rec", "answered", "dead"}]
  /\ w \in [Jobs -> {"none", "pre", "chain", "io", "done", "refused", "lost"}]
  /\ holder \in Jobs \cup {"none"}
  /\ dom \in {"open", "closing", "closed"}
====
