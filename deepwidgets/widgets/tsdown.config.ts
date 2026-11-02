import { clientLibrary } from '../../packages/client/tsdown.client.ts'

export default clientLibrary(import.meta.dirname, ['lib/types/index.js', 'lib/types/watchdog-worker.js'])
