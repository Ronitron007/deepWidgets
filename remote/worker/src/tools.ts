/**
 * The four interact tools the relay offers (ARCHITECTURE.md section 14, worker/): names, input schemas and
 * descriptions. The scope of each tool is TOOL_SCOPE in core.ts. Create-mode tools are never here.
 */
import { z } from 'zod'
import type { InteractTool } from './assertion.ts'

/** Args larger than this are refused before signing (the bridge refuses them too). */
export const MAX_ARGS_BYTES = 64 * 1024

export interface ToolSpec {
  description: string
  input: z.ZodObject
}

export const TOOL_SPECS: Readonly<Record<InteractTool, ToolSpec>> = Object.freeze({
  widget_list: {
    description: 'List the widgets this grant may use, with their rev and the change cursor.',
    input: z.object({}),
  },
  widget_describe: {
    description: 'Describe one widget: its actions, their args schemas, and its current state.',
    input: z.object({ slug: z.string().min(1).max(64) }),
  },
  widget_call: {
    description: 'Run one action of a widget. Call widget_describe first for the action names and args. For a change, pass a new requestId; after a timeout or an unknown outcome, retry with the same requestId and args and the change is applied once.',
    input: z.object({
      slug: z.string().min(1).max(64),
      action: z.string().min(1).max(100),
      args: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().min(1).max(100).optional(),
    }),
  },
  widget_changes: {
    description: 'The widget changes after a cursor from widget_list or an earlier widget_changes.',
    input: z.object({ since: z.string().max(40).optional() }),
  },
})
