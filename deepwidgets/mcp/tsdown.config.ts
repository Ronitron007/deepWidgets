import { clientLibrary } from '../../packages/client/tsdown.client.ts'

// lib/testrun-child.js runs in the test run process.
export default clientLibrary(import.meta.dirname, ['lib/types/index.js', 'lib/types/testrun-child.js'])
