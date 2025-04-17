import {
  prepare,
  SemanticContext,
  SemanticPluginConfig
} from './sr-prepare'
import { verifyConditions } from './sr-verify-conditions'
import { version } from './sr-version'
import { publish } from './sr-publish'
import { ENV_VARS, PACKAGE } from './constants'

async function main() {
  // Create plugin config and context
  const pluginConfig: SemanticPluginConfig = {}
  const context: SemanticContext = {
    nextRelease: { version: '0.0.2', gitTag: 'v0.0.2', notes: 'Test release' },
    logger: {
      log: console.log,
      error: console.error,
      warn: console.warn
    },
    cwd: process.cwd()
  }

  // Simulate the semantic-release lifecycle
  try {
    // 1. First verify conditions
    console.log('--- Starting verifyConditions phase ---')
    await verifyConditions(pluginConfig, context)

    // 2. Run version update phase
    console.log('\n--- Starting version phase ---')
    await version(pluginConfig, context)

    // 3. Then run prepare phase (build the solidity files, deploy contracts, verify contracts)
    console.log('\n--- Starting prepare phase ---')
    await prepare(pluginConfig, context)

    // 4. Finally run publish phase (publish to npm)
    console.log('\n--- Starting publish phase ---')

    // 5. Publish the package
    const result = await publish(pluginConfig, context)
    

    console.log('\n✅ Semantic release simulation completed successfully')
  } catch (error) {
    console.error('\n❌ Semantic release simulation failed:')
    console.error((error as Error).message)
    process.exit(1)
  }
}
main().catch((err) => {
  console.error('Error:', err)
})