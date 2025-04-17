/**
 * @file index.ts
 *
 * Main entry point for the eco-routes semantic-release plugin.
 * Exports all lifecycle hooks that this plugin implements.
 *
 * Lifecycle order:
 * 1. verifyConditions - validate environment and versions
 * 2. analyzeCommits - determine next version (built-in to semantic-release)
 * 3. verifyRelease - additional verification (optional)
 * 4. generateNotes - create release notes (built-in to semantic-release)
 * 5. version - update version information in files
 * 6. prepare - build, deploy contracts, etc.
 * 7. publish - publish to npm, etc.
 */

import { prepare } from './sr-prepare'
import { verifyConditions } from './sr-verify-conditions'
import { version } from './sr-version'
import { publish } from './sr-publish'

// Export functions for each semantic-release lifecycle hook
export default {
  // First step: verify all conditions are met for a release
  verifyConditions,

  // Version step: update version info in Solidity files and package.json
  // This runs after analyzeCommits and before prepare
  version,

  // Prepare step: deploy contracts and build package
  prepare,

  // Publish step: publish the built package to npm
  publish,

  // Additional hooks can be added later:
  // success, fail, etc.
}
