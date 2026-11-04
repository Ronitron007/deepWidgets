// Reader words for the action contract model (ActionContract.tla).
const NAME = {
  A1: "call A", A2: "the retry of A", B1: "duplicate B", C1: "call C (other args)",
  N1: "call N (no requestId)", U1: "the timer update", Q1: "the query",
};
const WRITE = { pre: ", write starting", chain: ", write waits for storage", io: ", write on disk", done: ", wrote", refused: ", write refused", lost: "", none: "" };

function phase(v, j) {
  const pc = v.pc[j];
  const a = v.ans[j];
  const zombie = v.h[j] === "on" && v.aborted[j] !== "no";
  let text;
  switch (pc) {
    case "idle": return null;
    case "seed": text = "starting"; break;
    case "dup": text = "waits for the first call"; break;
    case "queued": text = "in the queue"; break;
    case "run": text = "running"; break;
    case "rec0": case "rec": text = "saving its result"; break;
    case "answered": text = `got ${a.code}${a.rp ? " (replayed)" : ""}${a.rl ? " (result lost)" : ""}`; break;
    case "dead": text = "lost in the restart"; break;
    default: text = pc;
  }
  if (zombie) text += ", handler still runs";
  return `${NAME[j]} ${text}${WRITE[v.w[j]] ?? ""}`;
}

export const state = (v) => {
  const jobs = Object.keys(v.pc).map((j) => phase(v, j)).filter((x) => x !== null);
  const host = v.dom === "closed" ? "runtime stopped" : v.stopping ? "runtime stopping" : v.restarts > 0 ? "host restarted" : "host up";
  const saved = v.rec.code === "none" ? "no saved result" : `saved result ${v.rec.code}`;
  const mark = v.mk.args === "none" ? "no write mark" : `write mark rev ${v.mk.rev}`;
  return [host, saved, mark, `rev ${v.rev}`, ...jobs].join("; ");
};

export const group = (v) => (v.restarts > 0 ? "after restart" : "first host");
export const colors = { "first host": "blue", "after restart": "orange" };
export const title = "Action contract of one slug";

function changed(from, to) {
  for (const j of Object.keys(to.pc)) {
    if (from.pc[j] !== to.pc[j] || from.w[j] !== to.w[j] || from.h[j] !== to.h[j] || from.aborted[j] !== to.aborted[j]) return j;
  }
  return undefined;
}

export const step = (action, from, to) => {
  const j = changed(from, to);
  const n = j === undefined ? "" : NAME[j];
  switch (action) {
    case "Admit":
      if (to.pc[j] === "answered") return `${n} arrives and gets ${to.ans[j].code}`;
      if (to.pc[j] === "dup") return `${n} arrives while the first call runs`;
      return `${n} arrives`;
    case "Lookup":
      if (to.pc[j] === "queued") return `${n} finds no saved result and queues`;
      if (to.ans[j].rl) return `${n} finds only the write mark and gets ${to.ans[j].code} (replayed, result lost)`;
      return `${n} finds the saved result or the write mark and gets ${to.ans[j].code}${to.ans[j].rp ? " (replayed)" : ""}`;
    case "EnqueuePlain": return `${n} queues`;
    case "WaitTimeout": return `${n} waits too long and gets busy`;
    case "Turn": return `${n} starts`;
    case "HandlerWrites": return `${n}: the handler calls w.update`;
    case "WriteQueues": return to.w[j] === "refused" ? `${n}: the write is refused` : `${n}: the write passes the abort check`;
    case "WriteSlot": return to.w[j] === "refused" ? `${n}: the write is refused at its storage turn` : `${n}: the write goes to disk`;
    case "WriteLands": return `${n}: the write lands`;
    case "Return": return `${n}: the handler returns`;
    case "Timeout": return to.aborted[j] === "cmt" ? `${n}: the timer fires after the write committed; w.signal aborts` : `${n}: the timer fires before a write commits; w.signal aborts`;
    case "TimeoutSettles": return `${n}: its started writes settled; it gives ${(to.ans[j].code === "none" ? to.pend[j] : to.ans[j]).code} and frees the slot`;
    case "TimeoutOld": return `${n} times out and frees the slot`;
    case "QueryEnds": return `${n} ends`;
    case "Remember": return `${n} saves its result`;
    case "RecordLands": return `${n}: the result is saved and the caller gets it`;
    case "HostRestart": return "the host restarts";
    case "DisposeStarts": return "the runtime starts to stop";
    case "DomainCloses": return "the storage closes";
    case "DisposeEnds": return "the runtime has stopped";
    case "RecordExpires": return "the saved result and the write mark expire (TTL)";
    case "Done": return null;
    default: return action;
  }
};
