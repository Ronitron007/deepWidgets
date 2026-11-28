/**
 * The only tools a remote call may reach: the four interact tools (ARCHITECTURE-r1.md section 5).
 * Create-mode tools are a remote code execution path on the owner's PC, so they are never listed here.
 */
export const ALLOWED_TOOLS = Object.freeze(['widget_list', 'widget_describe', 'widget_call', 'widget_changes'] as const)

export type AllowedTool = (typeof ALLOWED_TOOLS)[number]

/** The scope that covers each allowed tool. */
export const SCOPE_OF: Readonly<Record<AllowedTool, string>> = Object.freeze({
  widget_list: 'widgets:read',
  widget_describe: 'widgets:read',
  widget_changes: 'widgets:read',
  widget_call: 'widgets:call',
})

export function isAllowedTool(tool: string): tool is AllowedTool {
  return (ALLOWED_TOOLS as readonly string[]).includes(tool)
}
