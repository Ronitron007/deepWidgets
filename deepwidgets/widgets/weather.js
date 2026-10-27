import { z } from 'zod'

export const name = 'deepwidgets-widget-weather'
export const inject = ['widgets', 'timer']


const PROGRAM = `root = Card([CardHeader("Weather"), Row([Stat("Temperature", w.temperature, w.observedAt), Stat("Wind", w.wind)]), Button("Refresh", Action([@Run(refresh), @Run(w)]), "outline", "sm")])
w = Query("current", {}, {temperature: "-", wind: "-", observedAt: ""})
refresh = Mutation("refresh", {})
`

async function fetchWeather(config, signal) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(config.latitude))
  url.searchParams.set('longitude', String(config.longitude))
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m')
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`open-meteo answered ${response.status}`)
  const body = await response.json()
  return {
    temperature: body.current?.temperature_2m ?? null,
    weatherCode: body.current?.weather_code ?? null,
    wind: body.current?.wind_speed_10m ?? null,
    observedAt: body.current?.time ?? null,
  }
}

export function apply(ctx, config = {}) {
  const settings = {
    latitude: config.latitude ?? 52.52,
    longitude: config.longitude ?? 13.41,
    intervalMs: Number(process.env.DEEPWIDGETS_WEATHER_MS ?? 0) || (config.intervalMs ?? 600_000),
  }

  // One refresh path for the timer and the 'refresh' action; a failure keeps the last good value.
  async function refresh(write, signal) {
    let next
    try {
      next = { ...(await fetchWeather(settings, signal ?? AbortSignal.timeout(10_000))), fetchedAt: Date.now(), error: null }
    } catch (error) {
      return write((state) => ({ ...(state ?? {}), error: String(error?.message ?? error), failedAt: Date.now() }))
    }
    return write(() => next)
  }

  ctx.widgets.register({
    slug: 'weather',
    title: 'Weather',
    program: PROGRAM,
    initialState: null,
    actions: [
      { name: 'current', kind: 'query', description: 'Last reading: { temperature, wind, observedAt, error }.', handler: (_args, w) => w.state ?? {} },
      {
        name: 'refresh',
        kind: 'mutation',
        args: z.object({}).strict(),
        timeoutMs: 15_000,
        handler: (_args, w) => refresh(w.update, w.signal),
      },
    ],
  })

  const tick = () => {
    refresh((fn) => ctx.widgets.update('weather', fn)).catch((error) => ctx.logger.warn('weather: timer refresh failed', error))
  }
  ctx.timeout(tick, 1_000)
  ctx.interval(tick, settings.intervalMs)
}
