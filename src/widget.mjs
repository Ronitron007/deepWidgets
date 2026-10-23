export function createWidget() {
  const state = {
    status: '',
    mood: 'idle',
    stats: new Map(),
    toasts: [],
  }

  return {
    setStatus(text) {
      state.status = String(text)
    },
    setMood(mood) {
      state.mood = String(mood)
    },
    pushStat(stat) {
      if (!stat || typeof stat.id !== 'string' || stat.id.length === 0) {
        throw new Error('pushStat requires an id')
      }
      state.stats.set(stat.id, {
        id: stat.id,
        label: stat.label == null ? stat.id : String(stat.label),
        value: stat.value,
        unit: stat.unit == null ? '' : String(stat.unit),
      })
    },
    clearStat(id) {
      state.stats.delete(id)
    },
    showToast(message) {
      state.toasts.push(String(message))
    },
    snapshot() {
      return {
        status: state.status,
        mood: state.mood,
        stats: [...state.stats.values()],
        toasts: [...state.toasts],
      }
    },
  }
}
