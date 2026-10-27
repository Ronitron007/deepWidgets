/**
 * Host half of a logic widget: weather from Open-Meteo (keyless).
 * State: { place, latitude, longitude, current, fetchedAt, error }. The runtime stores it.
 * Actions: `current` (query, reads state), `refresh` (mutation, calls the API),
 * `set_place` (mutation, changes the location then refreshes).
 */
export const inject = ['widgets']

const API = 'https://api.open-meteo.com/v1/forecast'

/** Fetch current weather; throws a short message on any failure. */
async function fetchCurrent({ latitude, longitude }, timeoutMs, signal) {
  const url = `${API}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
  const res = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...signal ? [signal] : []]) })
  if (!res.ok) throw new Error(`open-meteo answered ${res.status}`)
  const body = await res.json()
  const c = body.current
  if (c === undefined || typeof c.temperature_2m !== 'number') throw new Error('open-meteo answer has no current block')
  return { temperature: c.temperature_2m, unit: body.current_units?.temperature_2m ?? '°C', code: c.weather_code, wind: c.wind_speed_10m, time: c.time }
}

export function apply(ctx, config) {
  const refresh = async (_args, api) => {
    const s = api.state.get()
    try {
      const current = await fetchCurrent(s, config.timeoutMs ?? 8000, api.signal)
      api.state.update(prev => ({ ...prev, current, fetchedAt: new Date().toISOString(), error: null }))
    } catch (error) {
      // Keep the last good reading; show the error beside it.
      api.state.update(prev => ({ ...prev, error: String(error?.message ?? error) }))
    }
    return api.state.get()
  }

  ctx.effect(() => ctx.widgets.define({
    slug: config.slug,
    title: config.title,
    initialState: { place: config.place, latitude: config.latitude, longitude: config.longitude, current: null, fetchedAt: null, error: null },
    program: new URL('./program.oui', import.meta.url).pathname,
    actions: {
      current: { kind: 'query', run: (_args, api) => api.state.get() },
      refresh: { kind: 'mutation', run: refresh },
      set_place: {
        kind: 'mutation',
        params: { place: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } },
        run: async (args, api) => {
          if (typeof args.latitude !== 'number' || typeof args.longitude !== 'number') throw new Error('latitude and longitude must be numbers')
          api.state.update(prev => ({ ...prev, place: String(args.place ?? ''), latitude: args.latitude, longitude: args.longitude }))
          return refresh({}, api)
        },
      },
    },
  }), `widget ${config.slug}`)

  // Timer: refresh on start and every refreshMinutes. Cleared with the plugin.
  ctx.effect(() => {
    const tick = () => ctx.widgets.call(config.slug, 'refresh', {}).catch(() => {})
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, Math.max(1, config.refreshMinutes ?? 15) * 60_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, `widget ${config.slug} timer`)
}
