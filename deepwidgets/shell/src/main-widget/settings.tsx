/**
 * The Settings tab of the main widget (`main_widget.settings`). Each section is one view: the MCP modes, the approved
 * agents, the MCP port, and launch at login. The data comes from the query `settings` of main. A switch calls one
 * action of main (`setMode`, `setLoginItem`), shows the answer at once, and then runs `refresh`, so the query reads the
 * files and Electron main again. The page talks only to the host (`widget.page_channel`).
 * @module @deepwidgets/shell/main-widget/settings
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { z } from 'zod'
import { Button } from '../ui/button.tsx'
import { Switch } from '../ui/switch.tsx'
import { useCall } from './call.tsx'
import { LoginItemAnswerSchema, ModesAnswerSchema, ModesSchema, PortAnswerSchema, type LoginStatus } from './schema.ts'

/** One section of the tab: a title, and its content. */
function Section({ title, dw, children, extra }: { title: string, dw: string, children: ReactNode, extra?: Record<string, string> }) {
  return (
    <section className="dwm-section" data-dw={dw} {...extra}>
      <h3 className="dwm-section-title">{title}</h3>
      {children}
    </section>
  )
}

function Loading() {
  return <div className="flex flex-col gap-2" aria-busy="true"><div className="dw-skeleton" /></div>
}

/** A section that the host did not fill, or a shape that the page can not read. */
function SectionProblem({ text }: { text: string }) {
  return <div className="dwm-callout" data-tone="error" role="alert" data-dw="main-problem">{text}</div>
}

/** The refusal of a switch, under the section. */
function CallError({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return <span className="text-xs text-destructive" role="alert" data-dw="control-error">{message}</span>
}

/**
 * The call of one switch: the wait, the refusal, and the count of the calls that ended (`data-done`, for the smoke).
 * `run` gives the result of a call that worked, or undefined.
 */
function useSwitchCall() {
  const call = useCall()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [done, setDone] = useState(0)
  async function run(name: string, args: Record<string, unknown>): Promise<unknown> {
    setBusy(true)
    setError(undefined)
    const answer = await call(name, args)
    setBusy(false)
    setDone((count) => count + 1)
    if (!answer.ok) { setError(answer.message); return undefined }
    return answer.result
  }
  return { busy, error, done, run }
}

/**
 * Keep the answer of a switch until the query gives new data, so the switch does not go back to the old value
 * between the answer and the refresh.
 */
function useAnswerUntilRefresh<T>(data: unknown): [T | undefined, (value: T) => void] {
  const [kept, setKept] = useState<{ base: unknown, value: T } | undefined>(undefined)
  return [kept !== undefined && kept.base === data ? kept.value : undefined, (value) => { setKept({ base: data, value }) }]
}

/** The MCP modes: one switch for each gated mode, and `interact` as always on (`modes.settings`). */
export function ModeSwitchesView({ modes, refresh }: { modes: unknown, refresh: () => void }) {
  const control = useSwitchCall()
  const [answered, keep] = useAnswerUntilRefresh<z.infer<typeof ModesSchema>>(modes)
  const [pending, setPending] = useState<{ mode: string, on: boolean } | undefined>(undefined)
  const extra = { 'data-done': String(control.done), 'data-busy': control.busy ? 'true' : 'false' }
  if (modes === null || modes === undefined) return <Section title="MCP modes" dw="settings-modes" extra={extra}><Loading /></Section>
  const parsed = ModesAnswerSchema.safeParse(modes)
  if (!parsed.success) return <Section title="MCP modes" dw="settings-modes" extra={extra}><SectionProblem text={`The host gave the modes in a shape that the page can not read: ${z.prettifyError(parsed.error)}`} /></Section>
  if (!parsed.data.ok) return <Section title="MCP modes" dw="settings-modes" extra={extra}><SectionProblem text={parsed.data.message} /></Section>
  const shown = answered ?? parsed.data
  async function turn(mode: string, on: boolean): Promise<void> {
    setPending({ mode, on })
    const result = await control.run('setMode', { mode, on })
    setPending(undefined)
    const settings = ModesSchema.safeParse(result)
    if (settings.success) keep(settings.data)
    refresh()
  }
  return (
    <Section title="MCP modes" dw="settings-modes" extra={extra}>
      <p className="dwm-section-note">A mode that is off refuses its tools to agents. The next tool call reads the change.</p>
      {shown.error === undefined ? null : (
        <div className="dwm-callout" data-tone="error" role="alert" data-dw="settings-error">
          <strong>The settings file does not parse.</strong> {shown.error} The switches do not change it. Each mode is on until you fix or remove the file.
        </div>
      )}
      <ul className="dwm-settings-list">
        {shown.modes.map((mode) => {
          const on = pending?.mode === mode.name ? pending.on : mode.on
          return (
            <li key={mode.name} className="dwm-setting-row" data-dw="mode" data-mode={mode.name}>
              <span className="flex min-w-0 flex-col">
                <code className="font-mono text-[12px] font-medium text-foreground">{mode.name}</code>
                <span className="text-[11px] text-muted-foreground">{mode.goal}</span>
              </span>
              {mode.setting === null
                ? <span className="dwm-kind" data-dw="mode-always-on" data-mode={mode.name}>Always on</span>
                : (
                  <Switch checked={on} disabled={control.busy || shown.error !== undefined} aria-label={`Mode ${mode.name}`}
                    title={mode.setting} onCheckedChange={(next) => { void turn(mode.name, next) }} data-dw="mode-switch" data-mode={mode.name} />
                )}
            </li>
          )
        })}
      </ul>
      <span className="dwm-path">File <code title={shown.file} data-dw="settings-file">{shown.file}</code></span>
      <CallError message={control.error} />
    </Section>
  )
}

/** The approved agents. The list needs the consent server (`mcp.consent_server`), which is not built yet. */
export function ApprovedAgentsView() {
  return (
    <Section title="Approved agents" dw="settings-agents">
      <p className="dwm-section-note" data-dw="agents-note">The list of approved agents comes with the consent server. The consent server is not built yet.</p>
    </Section>
  )
}

/** A button that copies `text`. It says for a moment that it copied, or that the copy failed. */
function CopyButton({ text, label, dw }: { text: string, label: string, dw: string }) {
  const [copied, setCopied] = useState<'copied' | 'failed' | undefined>(undefined)
  useEffect(() => {
    if (copied === undefined) return
    const timer = setTimeout(() => { setCopied(undefined) }, 1500)
    return () => { clearTimeout(timer) }
  }, [copied])
  function copy(): void {
    void navigator.clipboard.writeText(text).then(() => { setCopied('copied') }, () => { setCopied('failed') })
  }
  return (
    <Button variant="ghost" size="xs" onClick={copy} aria-label={`Copy ${label}`} data-dw={dw} data-copied={copied ?? ''}>
      {copied === 'copied' ? <Check /> : <Copy />}{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
    </Button>
  )
}

/** The MCP port and the path of mcp.json, read only, each with a copy button (`safe_host.port`). */
export function McpPortView({ port }: { port: unknown }) {
  if (port === null || port === undefined) return <Section title="MCP port" dw="settings-port"><Loading /></Section>
  const parsed = PortAnswerSchema.safeParse(port)
  if (!parsed.success) return <Section title="MCP port" dw="settings-port"><SectionProblem text={`The host gave the port in a shape that the page can not read: ${z.prettifyError(parsed.error)}`} /></Section>
  if (!parsed.data.ok) return <Section title="MCP port" dw="settings-port"><SectionProblem text={parsed.data.message} /></Section>
  const { file, port: number, error } = parsed.data
  return (
    <Section title="MCP port" dw="settings-port">
      <p className="dwm-section-note">Agents read the port from this file. The port can not change here.</p>
      <dl className="dwm-fields">
        <dt className="pt-1 text-muted-foreground">Port</dt>
        <dd className="m-0 flex min-w-0 items-center gap-2">
          {number === undefined
            ? <span className="text-destructive" data-dw="mcp-port-error">{error ?? 'No port'}</span>
            : <><code className="font-mono text-[12px] tabular-nums" data-dw="mcp-port">{number}</code><CopyButton text={String(number)} label="the port" dw="copy-port" /></>}
        </dd>
        <dt className="pt-1 text-muted-foreground">File</dt>
        <dd className="m-0 flex min-w-0 items-center gap-2">
          <code className="min-w-0 break-all font-mono text-[12px]" title={file} data-dw="mcp-port-file">{file}</code>
          <CopyButton text={file} label="the path of mcp.json" dw="copy-port-file" />
        </dd>
      </dl>
    </Section>
  )
}

/** What a status of macOS means for the operator. */
const STATUS_HINT: Record<LoginStatus, string> = {
  'enabled': 'The app opens at login.',
  'requires-approval': 'macOS has the login item, but it waits for your approval. Approve deepWidgets in System Settings, under General, Login Items. Until then, the app does not open at login. Turn the switch off to remove the login item.',
  'not-registered': 'The app does not open at login.',
  'not-found': 'macOS can not find the app. A build with an ad-hoc signature can give this after each rebuild.',
}

/** Launch at login: one switch and the status from macOS. In a dev run, the switch is off and disabled. */
export function LaunchAtLoginView({ loginItem, refresh }: { loginItem: unknown, refresh: () => void }) {
  const control = useSwitchCall()
  const [answered, keep] = useAnswerUntilRefresh<z.infer<typeof LoginItemAnswerSchema>>(loginItem)
  const [pending, setPending] = useState<boolean | undefined>(undefined)
  const extra = { 'data-done': String(control.done), 'data-busy': control.busy ? 'true' : 'false' }
  if (loginItem === null || loginItem === undefined) return <Section title="Launch at login" dw="settings-login" extra={extra}><Loading /></Section>
  const parsed = LoginItemAnswerSchema.safeParse(loginItem)
  if (!parsed.success) return <Section title="Launch at login" dw="settings-login" extra={extra}><SectionProblem text={`The host gave the login item in a shape that the page can not read: ${z.prettifyError(parsed.error)}`} /></Section>
  if (!parsed.data.ok) {
    return (
      <Section title="Launch at login" dw="settings-login" extra={extra}>
        <p className="dwm-section-note" data-dw="login-note">{parsed.data.message}</p>
      </Section>
    )
  }
  const shown = answered?.ok === true ? answered : parsed.data
  async function turn(open: boolean): Promise<void> {
    setPending(open)
    const result = await control.run('setLoginItem', { open })
    setPending(undefined)
    const item = LoginItemAnswerSchema.safeParse(result)
    if (item.success && item.data.ok) keep(item.data)
    refresh()
  }
  // requires_approval_switch_off: a login item that waits for approval shows on, so that a click removes it.
  const registered = shown.status === undefined ? shown.openAtLogin : shown.status === 'enabled' || shown.status === 'requires-approval'
  const on = shown.settable && (pending ?? registered)
  return (
    <Section title="Launch at login" dw="settings-login" extra={extra}>
      <div className="dwm-setting-row">
        <span className="flex min-w-0 flex-col">
          <span className="font-medium text-foreground">Open deepWidgets at login</span>
          <span className="text-[11px] text-muted-foreground">
            Status from macOS: {shown.status === undefined ? 'none' : <code className="font-mono" data-dw="login-status">{shown.status}</code>}
          </span>
        </span>
        <Switch checked={on} disabled={!shown.settable || control.busy} aria-label="Open deepWidgets at login"
          onCheckedChange={(next) => { void turn(next) }} data-dw="login-switch" />
      </div>
      {shown.blocked === 'dev-run'
        ? <p className="dwm-section-note" data-dw="login-note">Launch at login needs a packaged app. A dev run registers no login item.</p>
        : shown.blocked === 'platform'
          ? <p className="dwm-section-note" data-dw="login-note">Launch at login works only on macOS.</p>
          : shown.status === undefined ? null : <p className="dwm-section-note" data-dw="login-hint">{STATUS_HINT[shown.status]}</p>}
      <CallError message={control.error} />
    </Section>
  )
}
