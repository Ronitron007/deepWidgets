window.__ModuleLoader__.load({
  id: '@deepwidgets/probe',
  factory(require) {
    const React = require('react')
    function Probe() {
      const [text, setText] = React.useState('probe pending')
      React.useEffect(() => {
        fetch('api/probe')
          .then(async (response) => {
            if (!response.ok) return `probe error ${String(response.status)}`
            const body = await response.json()
            return `probe pid ${String(body.pid)}`
          })
          .catch((error) => `probe error ${error instanceof Error ? error.message : 'fetch failed'}`)
          .then(setText)
      }, [])
      return React.createElement('div', { 'data-deepwidgets-probe': '' }, text)
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'deepwidgets-probe',
        }, Probe))
      },
    }
  },
})
