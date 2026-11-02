const death = { abort: "aborted", kill: "killed", exit1: "exited after an uncaught error", wdkill: "killed by the watchdog", bootfail: "boot failed" };
export const title = "deepWidgets crash_lifecycle";
export const state = (v) => {
  if (v.sup === "gaveUp") return "Gave up: fatal dialog";
  if (v.sup === "fatal") return "Fatal dialog: Host was never ready";
  const h = v.host;
  if (h.kind === "nil") return v.safeMode ? "Waiting to restart, safe mode next" : "Waiting to restart";
  if (h.phase === "dead") return `Host ${death[h.death]}`;
  const q = Object.entries(v.quar).filter(([, e]) => e.kind !== "nil").map(([w]) => w);
  let s = h.phase === "spawned" ? "Host starting" : h.phase === "booting" ? "Host booting" : "Host ready";
  if (h.safe) s += " in safe mode";
  if (v.run !== "none") s += v.provAt ? `, ${v.run} runs long (provisional record)` : `, ${v.run} runs`;
  else if (v.provAt) s += ", provisional record not yet removed";
  if (q.length && h.phase !== "spawned") s += `, quarantined: ${q.join(", ")}`;
  return s;
};
export const group = (v) => (v.sup !== "run" ? "dialog" : v.host.kind === "nil" ? "waiting" : v.host.phase === "dead" ? "dead" : "host");
export const colors = { dialog: "pink", waiting: "yellow", dead: "orange", host: "blue" };
export const step = (a, from, to) => {
  switch (a) {
    case "IsolationStart": return "the Host applies the crash records";
    case "HostReady": return "the Host is ready";
    case "RunWidget": return `${to.run} code starts`;
    case "Register": return "the widget registers its slug";
    case "FinishWidget": return `${from.run} code returns`;
    case "Beat": return "the heartbeat ticks";
    case "PollBeat": return "the watchdog sees the heartbeat";
    case "PollStall": return "the watchdog sees a stall";
    case "WatchdogKill": return "the watchdog kills the Host";
    case "Suspend": return "the machine sleeps";
    case "Throw": return "an uncaught error";
    case "Abort": return "the Host aborts (out of memory)";
    case "OtherExit": return "the OS kills the Host";
    case "BootFail": return "the boot fails";
    case "HostFails": return "Electron main sees the exit";
    case "LongQuiet": return "a minute passes";
    case "Restart": return "the restart timer fires";
    case "Relaunch": return "you start the app again";
    case "ChangeHash": return "a new version of the widget is installed";
    case "Done": return null;
  }
  return a;
};
