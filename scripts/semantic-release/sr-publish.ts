/**
 * @file sr-publish.ts
 *
 * Handles publishing the built package to npm as part of the semantic-release process.
 * This is the final step in the semantic-release lifecycle.
 *
 * Key features:
 * - Controls whether packages are actually published (dry-run vs. real publish)
 * - Handles npm tag selection (latest vs. beta for prereleases)
 * - Publishes from the build directory with complete package contents
 * - Verifies package contents before publishing
 * - Returns metadata about the published package for semantic-release
 *
 * The publish step only executes in CI environments or when explicitly
 * enabled to prevent accidental publishing during development.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { SemanticContext } from './sr-prepare'
import { 
  ENV_VARS, 
  PACKAGE, 
  PATHS, 
  getBuildDirPath, 
  getTsBuildDirPath 
} from './constants'

const execPromise = promisify(exec)

/**
 * Publishes the built packages to npm
 * Publishes both the main package with Solidity files and the TypeScript-only package
 * 
 * @param pluginConfig Plugin configuration
 * @param context The semantic release context
 * @returns Object containing package names and URLs
 */
export async function publish(
  pluginConfig: any,
  context: SemanticContext,
): Promise<any> {
  const { nextRelease, logger, cwd } = context
  if (!shouldWePublish(nextRelease?.version || '')) {
    return
  }

  try {
    // Determine the tag to use for publishing
    // Use 'latest' for stable releases, 'beta' for prerelease versions
    const tag = nextRelease?.type === 'prerelease' ? 'beta' : 'latest'
    const version = nextRelease?.version || ''

    logger.log(`Publishing packages version ${version} with tag ${tag}`)

    // Get directory paths
    const buildDir = getBuildDirPath(cwd)
    const tsBuildDir = getTsBuildDirPath(cwd)

    // Publish results
    const results = []

    // 1. First publish the main package with Solidity files
    logger.log(`Publishing main package: ${PACKAGE.ROUTES_PACKAGE_NAME}@${version}`)
    
    // Ensure the dist directory exists after compilation
    const distDirPath = path.join(buildDir, 'dist')
    if (!fs.existsSync(distDirPath)) {
      throw new Error(
        `Compilation failed: dist directory not found at ${distDirPath}`,
      )
    }

    // Publish the main package with the appropriate tag
    await publishPackage(buildDir, tag, logger)
    
    logger.log(
      `✅ Main package ${PACKAGE.ROUTES_PACKAGE_NAME}@${version} published successfully with tag ${tag}`,
    )
    
    results.push({
      name: PACKAGE.ROUTES_PACKAGE_NAME,
      url: `https://www.npmjs.com/package/${PACKAGE.ROUTES_PACKAGE_NAME}`,
    })

    // 2. Then publish the TypeScript-only package
    logger.log(`Publishing TypeScript package: ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version}`)
    
    // Ensure the TypeScript build directory exists
    if (!fs.existsSync(tsBuildDir)) {
      throw new Error(
        `TypeScript build directory not found at ${tsBuildDir}`,
      )
    }
    
    // Ensure the dist directory exists in TypeScript build
    const tsDistDirPath = path.join(tsBuildDir, 'dist')
    if (!fs.existsSync(tsDistDirPath)) {
      throw new Error(
        `TypeScript compilation failed: dist directory not found at ${tsDistDirPath}`,
      )
    }
    
    // Publish the TypeScript package with the appropriate tag
    await publishPackage(tsBuildDir, tag, logger)
    
    logger.log(
      `✅ TypeScript package ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version} published successfully with tag ${tag}`,
    )
    
    results.push({
      name: PACKAGE.ROUTES_TS_PACKAGE_NAME,
      url: `https://www.npmjs.com/package/${PACKAGE.ROUTES_TS_PACKAGE_NAME}`,
    })

    // Return results for both packages
    return results
  } catch (error) {
    logger.error('❌ Package publish failed')
    logger.error((error as Error).message)
    throw error
  }
}

/**
 * Helper function to publish a package from a specific directory
 * 
 * @param packageDir - Directory containing the package to publish
 * @param tag - The npm tag to publish with (latest or beta)
 * @param logger - Logger instance for output messages
 */
async function publishPackage(
  packageDir: string,
  tag: string,
  logger: Logger
): Promise<void> {
  // Make sure NPM_TOKEN environment variable is set for authentication
  const publishCommand = `cd ${packageDir} && npm publish --tag ${tag} --access public`
  logger.log(`Executing: ${publishCommand}`)

  const { stdout, stderr } = await execPromise(publishCommand)

  if (stdout) {
    logger.log(stdout)
  }

  if (stderr) {
    logger.error(stderr)
  }
}

/**
 * Determines whether packages should be published based on environment variables
 * 
 * @param version - The version being published
 * @returns Boolean indicating whether to publish packages
 */
function shouldWePublish(version: string): boolean {
  // Check if running in GitHub Actions
  const isGitHubCI = process.env[ENV_VARS.CI] === 'true'
  const notDryRun = process.env[ENV_VARS.NOT_DRY_RUN] === 'true'

  // Only publish if running in CI or explicitly set to not be a dry run
  const shouldPublish = isGitHubCI || notDryRun

  if (!shouldPublish) {
    console.log(
      'DRY RUN: Skipping actual npm publish. Would have published packages to npm.',
    )
    console.log(`Would publish: ${PACKAGE.ROUTES_PACKAGE_NAME}@${version}`)
    console.log(`Would publish: ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version}`)
    console.log(
      `Not publishing. Set ${ENV_VARS.NOT_DRY_RUN} to true to publish or run in a CI environment with ${ENV_VARS.CI} set to true.`,
    )
    return false
  } else {
    console.log(
      `Publishing ${PACKAGE.ROUTES_PACKAGE_NAME}@${version} and ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version} to npm...`,
    )
    return true
  }
}
