# Host handover notes `handover`

This file records ideas for a faster host restart. It is not a spec. The operator and the planning session wrote it on 2026-11-09. The spec `safe_host` builds the first step and keeps the rest open.

## The idea `handover.idea`

Today a crashed host must stop before Electron main starts a new host. The operator asked if a new host can start while the old host disposes. The old host disposes its plugins properly, and the new host serves the user at once. This pattern is a handover, also called blue-green.

## What a handover needs `handover.needs`

| Shared resource | The clash | The answer |
|---|---|---|
| Port 47615 | The old host holds the port while it disposes. Thus the new host can not listen on it. | Electron main owns the port and forwards each request to the current host. No host owns the port. The spec `safe_host` builds this. |
| Widget state, programs, and request records | The old host drains its queue during dispose, so its writes land after the new host read the same records. Thus one update is lost. | Fencing tokens |
| `committed.json`, the quarantine record, and `crash.json` | The old host can write a record after the new host read it | Fencing tokens in the file names |
| The profile files and the pnpm store | A rollback of the old host changes files that the new host loads | Fencing tokens, and the profile lock |
| `mcp.json` | When the old host stops, it can remove the port file of the new host | Electron main writes the port file. Only Electron main removes it. |

## Fencing tokens `handover.fencing`

- The supervisor gives each host a generation number when the host starts. The numbers only go up.

- Each write to shared state carries the generation of its host.

- The storage refuses a write from an older generation. Thus the old host can finish its dispose, but it can not change data that the new host owns.

## Record file names `handover.names`

The operator proposed a time in the file name of each record, so that two hosts never write one file. A time alone is not enough. The old host can write after the new host, so its old record gets the newest time.

Thus the name starts with the generation, then the time, for example `committed.g12.20261109T101500.json`. A reader takes the highest generation, then the newest file in that generation. Old files need a rule that removes them.

## The order of a handover `handover.order`

1. The old host writes the crash record.

2. The old host sends the message "dying" to Electron main.

3. Electron main starts the new host at once, with the next generation.

4. Electron main forwards each new request to the new host.

5. The old host disposes its plugins, with a time limit. Shared writes of the old generation are refused.

6. The old host stops.

This order applies only to an uncaught error. A host that is stuck in a loop, or that runs out of memory, runs no JavaScript. Thus it can not send "dying", and it can not dispose.
