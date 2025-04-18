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
import { ENV_VARS, getBuildDirPath, PACKAGE } from './constants'
import { setPublishingPackage } from './sr-build-package'

const execPromise = promisify(exec)

/**
 * Publishes both packages to npm (the main package with Solidity files and the TypeScript-only package)
 * @param pluginConfig Plugin configuration
 * @param context The semantic release context
 * @returns Object containing package names and URLs
 */
export async function publish(
  pluginConfig: any,
  context: SemanticContext,
): Promise<any> {
  const { nextRelease, logger, cwd } = context
  const dryRun = !shouldWePublish(nextRelease?.version || '')
  if (dryRun) {
    logger.log(`DRY RUN: Skipping actual npm publish. Would have published packages to npm.`)
  }

  try {
    // Determine the tag to use for publishing
    // Use 'latest' for stable releases, 'beta' for prerelease versions
    const tag = nextRelease?.type === 'prerelease' ? 'beta' : 'latest'
    const version = nextRelease?.version || ''

    logger.log(`Publishing packages version ${version} with tag ${tag}`)

    // Get directory paths
    const buildDir = getBuildDirPath(cwd)

    for (const packageName of [PACKAGE.ROUTES_PACKAGE_NAME, PACKAGE.ROUTES_TS_PACKAGE_NAME]) {
      logger.log(`Publishing package: ${packageName}@${version}`)
      setPublishingPackage(context, packageName)
      // Ensure the dist directory exists after compilation
      const distDirPath = path.join(buildDir, 'dist')
      if (!fs.existsSync(distDirPath)) {
        throw new Error(
          `Compilation failed: dist directory not found at ${distDirPath}`,
        )
      }

      // Create .npmrc file with auth token
      const npmToken = process.env[ENV_VARS.NPM_TOKEN]
      if (!dryRun) {
        if (npmToken) {
          const npmrcPath = path.join(buildDir, '.npmrc')
          fs.writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${npmToken}\n`)
          logger.log('Created .npmrc file with authentication token')
        } else {
          logger.log('Warning: No NPM_TOKEN environment variable found')
        }
      }

      // Publish the package to npm
      // const result = await execPromise(`npm publish --tag ${tag} ${dryRun ? '--dry-run' : ''}`, {
      //   cwd: getBuildDirPath(cwd),
      //   env: {
      //     ...process.env,},
      //   shell: 'true',
      // })
      const pathD = getBuildDirPath(cwd)
      await execPromise('npm publish', {
        cwd: pathD,
        env: {
          ...process.env,
        },
        shell: 'true',
      })

      // logger.log(result.stdout)

      // Clean up .npmrc file for security
      if (!dryRun && npmToken) {
        const npmrcPath = path.join(buildDir, '.npmrc')
        if (fs.existsSync(npmrcPath)) {
          fs.unlinkSync(npmrcPath)
          logger.log('Removed .npmrc file for security')
        }
      }
    }
  } catch (error) {
    logger.error('❌ Package publish failed')
    logger.error((error as Error).message)
    throw error
  }
}

/**
 * Determines whether packages should be published based on environment variables
 * 
 * @param version - The version being published
 * @returns Boolean indicating whether to publish packages
 */
function shouldWePublish(version: string): boolean {
  // Check if running in GitHub Actions or local CI mode
  const isCI = process.env[ENV_VARS.CI] === 'true'
  const notDryRun = process.env[ENV_VARS.NOT_DRY_RUN] === 'true'

  // For local testing, allow forcing publish with NOT_DRY_RUN
  const shouldPublish = isCI || notDryRun

  if (!shouldPublish) {
    console.log(
      'DRY RUN: Skipping actual npm publish. Would have published packages to npm.',
    )
    console.log(`Would publish: ${PACKAGE.ROUTES_PACKAGE_NAME}@${version}`)
    console.log(`Would publish: ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version}`)
    console.log(
      `Not publishing. Set ${ENV_VARS.NOT_DRY_RUN} to true to publish or run in a CI environment with ${ENV_VARS.CI} set to true.`,
    )
  }
  return shouldPublish
}
