import { clientLibrary } from '../../packages/client/tsdown.client.ts'

// lib/testrun-child.js runs in the test run process. lib/page-build-child.js runs in the build process of a page.
export default clientLibrary(import.meta.dirname, ['lib/types/index.js', 'lib/types/testrun-child.js', 'lib/types/page-build-child.js'])
