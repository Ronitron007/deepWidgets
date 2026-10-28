/** Overlay text that shows the host process id from `GET /api/probe`. */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

/** @returns the probe text element. */
export function Probe(): ReactElement {
  const [text, setText] = useState('probe pending')
  useEffect(() => {
    fetch('api/probe')
      .then(async (response) => {
        if (!response.ok) return `probe error ${String(response.status)}`
        const body: { pid: number } = await response.json()
        return `probe pid ${String(body.pid)}`
      })
      .catch((error: unknown) => `probe error ${error instanceof Error ? error.message : 'fetch failed'}`)
      .then(setText)
  }, [])
  return <div data-deepwidgets-probe="">{text}</div>
}
