/**
 * One row of the Widgets tab (`main_widget.widgets`). The head shows the title, the slug, the status, and the state
 * rev. A click opens the details: each other field of the row, and the controls Show or Hide for a widget with a
 * window (`main_widget.window_state`), Turn off or Turn on, and Remove. A widget with a window also shows its layer,
 * its lock, and its position, with a switch for the layer, a switch for the lock, and Reset position
 * (`window_manager.panel`).
 * @module @deepwidgets/shell/main-widget/widget-row
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import { ChevronRight, Eye, EyeOff, Power, PowerOff, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '../ui/button.tsx'
import { Switch } from '../ui/switch.tsx'
import { useCall } from './call.tsx'
import { ActionListView, StateView, StatusPill } from './parts.tsx'
import { ProgramTextSchema, type Widget } from './schema.ts'

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <>
      <dt className="pt-px text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>
}

/** The program rev, and its text when the operator opens it. The text loads again when the rev changes. */
function ProgramField({ slug, rev }: { slug: string, rev: number }) {
  const call = useCall()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<{ rev: number, text: string } | { error: string } | undefined>(undefined)
  // A refusal stays until the operator closes the text. A text of another rev loads again.
  const stale = loaded === undefined || ('rev' in loaded && loaded.rev !== rev)
  useEffect(() => {
    if (!open || !stale) return
    let live = true
    void call('program', { slug }).then((answer) => {
      if (!live) return
      if (!answer.ok) { setLoaded({ error: answer.message }); return }
      const parsed = ProgramTextSchema.safeParse(answer.result)
      setLoaded(parsed.success ? { rev: parsed.data.rev, text: parsed.data.text } : { error: 'The host gave a program in a shape that the page can not read.' })
    })
    return () => { live = false }
  }, [call, slug, open, stale])
  function toggle(): void {
    if (open && loaded !== undefined && 'error' in loaded) setLoaded(undefined)
    setOpen(!open)
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <span className="tabular-nums">rev {rev}</span>
        <button type="button" className="dwm-link" aria-expanded={open} onClick={toggle} data-dw="program-toggle">
          {open ? 'Hide text' : 'Show text'}
        </button>
      </span>
      {!open ? null : loaded === undefined ? <div className="dw-skeleton" />
        : 'error' in loaded ? <span className="text-destructive">{loaded.error}</span>
          : <pre className="dwm-code" data-dw="program-text">{loaded.text}</pre>}
    </div>
  )
}

type Control = 'show' | 'hide' | 'setLayer' | 'setLock' | 'resetPosition' | 'turnOff' | 'turnOn' | 'remove'

const BUSY_TEXT: Record<Control, string> = {
  show: 'Showing…',
  hide: 'Hiding…',
  setLayer: 'Changing the layer…',
  setLock: 'Changing the lock…',
  resetPosition: 'Resetting the position…',
  turnOff: 'Turning off…',
  turnOn: 'Turning on…',
  remove: 'Removing…',
}

/**
 * The wait and the refusal of the controls of one row. The row keeps them, not the details: a close of the row or a
 * switch of the tab does not lose a call that still waits, and the buttons stay off until it ends.
 */
interface RowControl {
  busy: Control | undefined
  error: { message: string, nextStep?: string } | undefined
  /** Call the action `control` of main with the slug of the row and `args`. */
  run: (control: Control, args?: Record<string, unknown>) => Promise<boolean>
  clearError: () => void
}

function useRowControl(slug: string, onChanged: () => void): RowControl {
  const call = useCall()
  const [busy, setBusy] = useState<Control | undefined>(undefined)
  const [error, setError] = useState<{ message: string, nextStep?: string } | undefined>(undefined)
  async function run(control: Control, args: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(control)
    setError(undefined)
    const answer = await call(control, { ...args, slug })
    setBusy(undefined)
    if (answer.ok) onChanged()
    else setError({ message: answer.message, ...(answer.nextStep === undefined ? {} : { nextStep: answer.nextStep }) })
    return answer.ok
  }
  return { busy, error, run, clearError: () => { setError(undefined) } }
}

/**
 * Show or Hide for a widget with a window, Turn off or Turn on, and Remove for an agent widget. Remove asks first. A
 * refusal shows under the buttons.
 */
function Controls({ widget, control }: { widget: Widget, control: RowControl }) {
  const { busy, error } = control
  const [confirming, setConfirming] = useState(false)
  const name = widget.title ?? widget.slug

  async function run(which: Control): Promise<void> {
    await control.run(which)
    setConfirming(false)
  }

  // In safe mode the status stays safe-mode; `turnedOff` tells that the operator turned the widget off.
  const off = widget.turnedOff === true || widget.status.kind === 'turned-off'
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2.5" data-dw="controls">
      {confirming ? (
        <div className="dwm-confirm" role="alertdialog" aria-label={`Remove ${name}`} data-dw="remove-confirm">
          <span className="text-foreground">
            Remove <strong className="font-medium">{name}</strong>? The widget and its window go away. Its state stays in storage.
          </span>
          <span className="flex justify-end gap-2">
            <Button variant="outline" size="xs" onClick={() => { setConfirming(false) }} disabled={busy !== undefined}>Cancel</Button>
            <Button variant="destructive" size="xs" onClick={() => { void run('remove') }} disabled={busy !== undefined} data-dw="remove-confirm-button">
              {busy === 'remove' ? BUSY_TEXT.remove : 'Remove'}
            </Button>
          </span>
        </div>
      ) : (
        <span className="flex items-center gap-2">
          {widget.window === 'shown' ? (
            <Button variant="outline" size="xs" onClick={() => { void run('hide') }} disabled={busy !== undefined} data-dw="hide">
              <EyeOff />{busy === 'hide' ? BUSY_TEXT.hide : 'Hide'}
            </Button>
          ) : widget.window === 'hidden' ? (
            <Button variant="outline" size="xs" onClick={() => { void run('show') }} disabled={busy !== undefined} data-dw="show">
              <Eye />{busy === 'show' ? BUSY_TEXT.show : 'Show'}
            </Button>
          ) : null}
          {off ? (
            <Button size="xs" onClick={() => { void run('turnOn') }} disabled={busy !== undefined} data-dw="turn-on">
              <Power />{busy === 'turnOn' ? BUSY_TEXT.turnOn : 'Turn on'}
            </Button>
          ) : (
            <Button variant="outline" size="xs" onClick={() => { void run('turnOff') }} disabled={busy !== undefined} data-dw="turn-off">
              <PowerOff />{busy === 'turnOff' ? BUSY_TEXT.turnOff : 'Turn off'}
            </Button>
          )}
          {widget.agent ? (
            <Button variant="ghost" size="xs" className="dwm-remove" onClick={() => { control.clearError(); setConfirming(true) }}
              disabled={busy !== undefined} data-dw="remove">
              <Trash2 />Remove
            </Button>
          ) : null}
        </span>
      )}
      {error === undefined ? null : (
        <span className="flex flex-col gap-0.5" role="alert" data-dw="control-error">
          <span className="text-destructive">{error.message}</span>
          {error.nextStep === undefined ? null : <span className="text-muted-foreground">{error.nextStep}</span>}
        </span>
      )}
    </div>
  )
}

/**
 * window_manager.panel: the layer, the lock, and the position of the widget window, each with its control. A switch or
 * the reset calls one action of main. The value shows the window data of the last query, so a change on the bar of the
 * window shows here when the change frame of the host runs the query again.
 */
function WindowFields({ windowData, control }: { windowData: NonNullable<Widget['windowData']>, control: RowControl }) {
  const { layer, locked, x, y } = windowData
  const busy = control.busy !== undefined
  const position = x === undefined || y === undefined ? undefined : `${String(x)}, ${String(y)}`
  return (
    <>
      <Field label="Layer">
        <span className="flex items-center gap-2" data-dw="window-layer">
          <Switch checked={layer === 'top'} disabled={busy} aria-label="Keep the window above other windows"
            onCheckedChange={(top) => { void control.run('setLayer', { layer: top ? 'top' : 'normal' }) }} data-dw="layer-switch" />
          <span data-dw="layer" data-layer={layer}>{layer === 'top' ? 'On top' : 'Normal'}</span>
        </span>
      </Field>
      <Field label="Lock">
        <span className="flex items-center gap-2" data-dw="window-lock">
          <Switch checked={locked} disabled={busy} aria-label="Lock the position of the window"
            onCheckedChange={(next) => { void control.run('setLock', { locked: next }) }} data-dw="lock-switch" />
          <span data-dw="lock" data-locked={String(locked)}>{locked ? 'Locked' : 'Not locked'}</span>
        </span>
      </Field>
      <Field label="Position">
        <span className="flex items-center gap-2" data-dw="window-position">
          <span className="tabular-nums" data-dw="position" data-position={position ?? 'default'}>
            {position ?? <Muted>Default</Muted>}
          </span>
          <Button variant="outline" size="xs" onClick={() => { void control.run('resetPosition') }} disabled={busy || position === undefined}
            title="Move the window to the default position" data-dw="reset-position">
            <RotateCcw />{control.busy === 'resetPosition' ? BUSY_TEXT.resetPosition : 'Reset position'}
          </Button>
        </span>
      </Field>
    </>
  )
}

function Details({ id, widget, control }: { id: string, widget: Widget, control: RowControl }) {
  const { status, catalog, state, program, actions, source, rows } = widget
  return (
    <div id={id} className="flex flex-col gap-3 px-3 pb-3" data-dw="widget-details">
      {status.kind === 'failed' ? <div className="dwm-callout" data-tone="error"><strong>Failed.</strong> {status.reason}</div> : null}
      {status.kind === 'safe-mode' ? (
        <div className="dwm-callout" data-tone="warn">
          <strong>Off in safe mode.</strong> {status.message}{widget.turnedOff === true ? ' The operator also turned it off.' : ''}
        </div>
      ) : null}
      <dl className="dwm-fields">
        <Field label="Catalog">{catalog === undefined ? <Muted>Only a live widget has one</Muted> : <code className="font-mono text-[12px]">{catalog}</code>}</Field>
        <Field label="State">
          {state === undefined ? <Muted>No stored state</Muted> : (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="tabular-nums">rev {state.rev}</span>
              <StateView data={state.data} />
            </div>
          )}
        </Field>
        <Field label="Program">{program === undefined ? <Muted>No stored program</Muted> : <ProgramField slug={widget.slug} rev={program.rev} />}</Field>
        <Field label="Actions">{actions === undefined ? <Muted>Only a live widget lists them</Muted> : <ActionListView actions={actions} />}</Field>
        <Field label="Source">
          {source !== undefined ? <code className="block break-all font-mono text-[12px]" title={source}>{source}</code>
            : <Muted>{widget.agent ? 'Unknown' : 'Built in'}</Muted>}
        </Field>
        <Field label="Row">
          {rows.length === 0 ? <Muted>No plugin row</Muted> : (
            <ul className="flex flex-col gap-1">
              {rows.map((row) => (
                <li key={row.entryId} className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <code className="truncate font-mono text-[12px]" title={row.entryId}>{row.id}</code>
                    {row.enabled ? null : <span className="dwm-kind">off</span>}
                  </span>
                  <code className="truncate font-mono text-[11px] text-muted-foreground">{row.name}</code>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Window">
          {widget.window === undefined ? <Muted>No window</Muted>
            : <span data-dw="window" data-window={widget.window}>{widget.window === 'shown' ? 'Shown' : 'Hidden'}</span>}
        </Field>
        {widget.windowData === undefined ? null : <WindowFields windowData={widget.windowData} control={control} />}
      </dl>
      <Controls widget={widget} control={control} />
    </div>
  )
}

/** One widget: a head that opens and closes the details. */
export function WidgetRow({ widget, onChanged }: { widget: Widget, onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const { slug, title, status, state, agent } = widget
  const control = useRowControl(slug, onChanged)
  return (
    <li className="dwm-row" data-dw="widget-row" data-slug={slug} data-open={open ? 'true' : 'false'}>
      <button type="button" className="dwm-row-head" aria-expanded={open} aria-controls={detailsId} onClick={() => { setOpen(!open) }} data-dw="row-toggle">
        <ChevronRight className="dwm-chevron" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-foreground">{title ?? slug}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {title === undefined ? null : <><code className="font-mono">{slug}</code> · </>}{agent ? 'agent widget' : 'built in'}
            {/* A closed row still shows a call that waits, and a refusal that came. */}
            {control.busy === undefined ? null : <span data-dw="row-busy"> · {BUSY_TEXT[control.busy]}</span>}
            {control.busy !== undefined || control.error === undefined ? null : <span className="text-destructive" data-dw="row-refused"> · refused</span>}
          </span>
        </span>
        <StatusPill status={status} />
        <span className="dwm-rev" data-dw="state-rev" data-rev={state === undefined ? '' : String(state.rev)} title="The rev of the stored state">
          {state === undefined ? 'no state' : `rev ${String(state.rev)}`}
        </span>
      </button>
      {open ? <Details id={detailsId} widget={widget} control={control} /> : null}
    </li>
  )
}
