/**
 * The Settings tab of the main widget (`main_widget.settings`). Each section is one view: the MCP modes, the widget kit,
 * the approved agents, the MCP port, and launch at login. The data comes from the query `settings` of main. A switch
 * calls one action of main (`setMode`, `setLoginItem`), shows the answer at once, and then runs `refresh`, so the query
 * reads the files and Electron main again. The controls of the widget kit (`kit.pane.view`) call `kitAdd`, `kitRemove`,
 * and `setRefuseBuilds` the same way. The page talks only to the host (`widget.page_channel`).
 * @module @deepwidgets/shell/main-widget/settings
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Copy, Lock, Plus, Trash2, X } from 'lucide-react'
import { z } from 'zod'
import { Button } from '../ui/button.tsx'
import { Input } from '../ui/input.tsx'
import { Switch } from '../ui/switch.tsx'
import { useCall } from './call.tsx'
import {
  KitAnswerSchema,
  LoginItemAnswerSchema,
  ModesAnswerSchema,
  ModesSchema,
  PortAnswerSchema,
  RefuseBuildsSchema,
  type Kit,
  type KitChange,
  type KitLast,
  type KitStatus,
  type LoginStatus,
} from './schema.ts'

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

const KIT_STATUS_TEXT: Record<KitStatus, string> = { starting: 'Starting', ready: 'Ready', changing: 'Changing', unavailable: 'Unavailable' }

/** The tone of each status: the colors of the status badge of a widget in main.css, keyed by its `data-kind`. */
const KIT_STATUS_TONE: Record<KitStatus, string> = { starting: 'turned-off', ready: 'live', changing: 'safe-mode', unavailable: 'failed' }

/** A change of the kit for people: `add date-fns@^4` or `remove date-fns`. */
function kitChangeText(change: KitChange | KitLast): string {
  return change.kind === 'add' ? `add ${change.spec}` : `remove ${change.name}`
}

/** A time span for people: `4 s`, `2 min 5 s`. */
function spanText(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return seconds < 60 ? `${String(seconds)} s` : `${String(Math.floor(seconds / 60))} min ${String(seconds % 60)} s`
}

/** A heading inside a section. */
function SubTitle({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}

/** The status line of the kit: the badge, and the change that runs, the start, or the cause of `unavailable`. */
function KitStatusLine({ kit, now }: { kit: Kit, now: number }) {
  const { status, change } = kit
  let detail: ReactNode = null
  if (status === 'changing' && change !== undefined) {
    detail = <span data-dw="kit-change"><code className="font-mono">{kitChangeText(change)}</code> · {spanText(now - change.startedAt)}</span>
  } else if (status === 'starting') {
    detail = 'The kit starts. Its controls wait for the start.'
  } else if (status === 'ready') {
    detail = 'Add and Remove change the kit with pnpm and the network.'
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="dwm-setting-row">
        <span className="flex min-w-0 flex-col">
          <SubTitle>Status</SubTitle>
          {detail === null ? null : <span className="text-[11px] text-muted-foreground">{detail}</span>}
        </span>
        <span className="dwm-status" data-kind={KIT_STATUS_TONE[status]} data-dw="kit-status" data-status={status}>
          <span className="dwm-status-dot" aria-hidden="true" />
          {KIT_STATUS_TEXT[status]}
        </span>
      </div>
      {status === 'unavailable' ? (
        <div className="dwm-callout" data-tone="error" role="alert" data-dw="kit-unavailable">
          <strong>The kit is unavailable.</strong> {kit.reason ?? 'The host log names the cause.'} To try the start again, quit deepWidgets and open it again. A widget with no page still installs.
        </div>
      ) : null}
    </div>
  )
}

/** The result of the last change: the change, the time, and the error code and message when it failed. */
function KitLastLine({ last }: { last: KitLast }) {
  const time = new Date(last.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-dw="kit-last" data-kind={last.kind} data-ok={last.error === undefined ? 'true' : 'false'} data-code={last.error?.code ?? ''}>
      <SubTitle>Last change</SubTitle>
      <span className="text-muted-foreground">
        <code className="font-mono text-foreground">{kitChangeText(last)}</code> at <span className="tabular-nums">{time}</span>
        {last.error === undefined ? <> · made kit version <span className="tabular-nums">{last.version}</span></> : <> · failed with <code className="font-mono text-destructive">{last.error.code}</code></>}
      </span>
      {last.error === undefined ? null : <span className="line-clamp-4 break-words text-destructive" title={last.error.message} data-dw="kit-last-error">{last.error.message}</span>}
    </div>
  )
}

/** A text field and one button, sent with Enter or with the button. */
function KitField({ value, setValue, placeholder, label, button, dw, disabled, onSubmit }: {
  value: string
  setValue: (value: string) => void
  placeholder: string
  label: string
  button: string
  dw: string
  disabled: boolean
  onSubmit: (value: string) => void
}) {
  function submit(event: FormEvent): void {
    event.preventDefault()
    const text = value.trim()
    if (!disabled && text !== '') onSubmit(text)
  }
  // The Input of shadcn has h-9 and text-base, and clsx keeps both classes of a pair, so the sizes of the section need the
  // important modifier of Tailwind.
  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input value={value} onChange={(event) => { setValue(event.target.value) }} placeholder={placeholder} aria-label={label}
        spellCheck={false} autoComplete="off" autoCapitalize="off" className="h-7! px-2! font-mono text-[12px]!" data-dw={`${dw}-field`} />
      <Button type="submit" size="xs" variant="outline" disabled={disabled || value.trim() === ''} data-dw={dw}><Plus />{button}</Button>
    </form>
  )
}

/**
 * The widget kit (`kit.pane.view`): the status, the kit version, the core with a lock mark, the extras with Remove, the
 * Add field, the last change, and the refused install scripts. Add, Remove, and the refuse list do nothing unless the
 * status is `ready`. While the status is `starting` or `changing`, the section reads the query `settings` again each
 * second, and it stops at `ready` or `unavailable` (`kit.pane.actions`). No event tells the page that the kit start
 * ended, so a page that opens during the start sees `ready` only through this read.
 */
export function WidgetKitView({ kit, refresh }: { kit: unknown, refresh: () => void }) {
  const change = useSwitchCall()
  const refuse = useSwitchCall()
  const [keptNames, keepNames] = useAnswerUntilRefresh<string[]>(kit)
  const [spec, setSpec] = useState('')
  const [refuseName, setRefuseName] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const parsed = kit === null || kit === undefined ? undefined : KitAnswerSchema.safeParse(kit)
  const status = parsed?.success === true && parsed.data.ok ? parsed.data.status : undefined
  const polling = status === 'starting' || status === 'changing'
  const latestRefresh = useRef(refresh)
  useEffect(() => { latestRefresh.current = refresh })
  useEffect(() => {
    if (!polling) return
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
      latestRefresh.current()
    }, 1000)
    return () => { clearInterval(timer) }
  }, [polling])
  const extra = { 'data-done': String(change.done + refuse.done), 'data-busy': change.busy || refuse.busy ? 'true' : 'false', 'data-status': status ?? '' }
  if (parsed === undefined) return <Section title="Widget kit" dw="settings-kit" extra={extra}><Loading /></Section>
  if (!parsed.success) return <Section title="Widget kit" dw="settings-kit" extra={extra}><SectionProblem text={`The host gave the kit in a shape that the page can not read: ${z.prettifyError(parsed.error)}`} /></Section>
  if (!parsed.data.ok) return <Section title="Widget kit" dw="settings-kit" extra={extra}><SectionProblem text={parsed.data.message} /></Section>
  const data = parsed.data
  const ready = data.status === 'ready'
  const list = data.refuseBuilds
  const names = keptNames ?? (list.ok ? list.names : [])
  const listOff = !ready || refuse.busy || !list.ok

  async function startChange(action: 'kitAdd' | 'kitRemove', args: Record<string, unknown>): Promise<boolean> {
    const result = await change.run(action, args)
    refresh()
    return result !== undefined
  }
  async function setNames(next: string[]): Promise<boolean> {
    const written = RefuseBuildsSchema.safeParse(await refuse.run('setRefuseBuilds', { names: next }))
    if (written.success) keepNames(written.data.names)
    refresh()
    return written.success
  }

  return (
    <Section title="Widget kit" dw="settings-kit" extra={extra}>
      <p className="dwm-section-note">The packages that the page of a widget can import. A change of the kit makes a new kit version.</p>
      <KitStatusLine kit={data} now={now} />
      <div className="dwm-setting-row">
        <SubTitle>Kit version</SubTitle>
        <code className="font-mono text-[12px] tabular-nums" data-dw="kit-version">{data.version ?? 'none'}</code>
      </div>
      <div className="flex flex-col gap-1">
        <SubTitle>Core</SubTitle>
        <span className="text-[11px] text-muted-foreground">The core comes with the app. Only an app update changes it.</span>
        <ul className="dwm-settings-list">
          {data.core.map((item) => (
            <li key={item.name} className="dwm-setting-row" data-dw="kit-core" data-name={item.name}>
              <code className="min-w-0 truncate font-mono text-[12px]">{item.name}</code>
              <span className="flex flex-none items-center gap-1.5 text-muted-foreground">
                <span className="font-mono text-[11px] tabular-nums">{item.version}</span>
                <span className="inline-flex" title="Core package: only an app update changes it" data-dw="kit-lock">
                  <Lock className="size-3" aria-hidden="true" /><span className="sr-only">Locked</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <SubTitle>Extras</SubTitle>
        {data.extras.length === 0
          ? <span className="text-[11px] text-muted-foreground" data-dw="kit-no-extras">No extras yet.</span>
          : (
            <ul className="dwm-settings-list">
              {data.extras.map((item) => (
                <li key={item.name} className="dwm-setting-row" data-dw="kit-extra" data-name={item.name}>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <code className="truncate font-mono text-[12px]">{item.name}</code>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{item.version}</span>
                  </span>
                  <Button variant="ghost" size="xs" className="dwm-remove" disabled={!ready || change.busy} aria-label={`Remove ${item.name}`}
                    onClick={() => { void startChange('kitRemove', { name: item.name }) }} data-dw="kit-remove" data-name={item.name}>
                    <Trash2 />Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        <KitField value={spec} setValue={setSpec} placeholder="date-fns@^4" label="Package to add, with an optional version or range" button="Add"
          dw="kit-add" disabled={!ready || change.busy} onSubmit={(text) => { void startChange('kitAdd', { spec: text }).then((started) => { if (started) setSpec('') }) }} />
        <CallError message={change.error} />
      </div>
      {data.last === undefined ? null : <KitLastLine last={data.last} />}
      <div className="flex flex-col gap-1" data-dw="kit-refuse">
        <SubTitle>Refused install scripts</SubTitle>
        <span className="text-[11px] text-muted-foreground" data-dw="kit-refuse-note">
          The kit refuses each package on this list, also when another package needs it. A name blocks the whole package, not only its install script. The next change of the kit reads the list.
        </span>
        {!list.ok
          ? <div className="dwm-callout" data-tone="error" role="alert" data-dw="kit-refuse-error">{list.message}</div>
          : names.length === 0
            ? <span className="text-[11px] text-muted-foreground" data-dw="kit-refuse-empty">No refused packages.</span>
            : (
              <ul className="dwm-settings-list">
                {names.map((name) => (
                  <li key={name} className="dwm-setting-row" data-dw="kit-refuse-row" data-name={name}>
                    <code className="min-w-0 truncate font-mono text-[12px]">{name}</code>
                    <Button variant="ghost" size="xs" className="dwm-remove" disabled={listOff} aria-label={`Stop refusing ${name}`}
                      onClick={() => { void setNames(names.filter((item) => item !== name)) }} data-dw="kit-refuse-remove" data-name={name}>
                      <X />Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
        <KitField value={refuseName} setValue={setRefuseName} placeholder="core-js" label="Package name to refuse" button="Refuse" dw="kit-refuse-add"
          disabled={listOff} onSubmit={(text) => { void setNames(names.includes(text) ? names : [...names, text]).then((written) => { if (written) setRefuseName('') }) }} />
        <CallError message={refuse.error} />
      </div>
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
