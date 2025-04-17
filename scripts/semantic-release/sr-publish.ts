/**
 * @file sr-publish.ts
 * 
 * Handles publishing the built package to npm as part of the semantic-release process
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { SemanticContext } from './sr-prepare'
import { ENV_VARS, PACKAGE } from './constants'

const execPromise = promisify(exec)

/**
 * Publishes the built package to npm
 * @param pluginConfig Plugin configuration
 * @param context The semantic release context
 * @returns Object containing package name and URL
 */
export async function publish(pluginConfig: any, context: SemanticContext): Promise<any> {
  const { nextRelease, logger, cwd } = context
  if(!shouldWePublish(nextRelease?.version || '')) {
    return
  }

  try {
    // Determine the tag to use for publishing
    // Use 'latest' for stable releases, 'beta' for prerelease versions
    const tag = nextRelease?.type === 'prerelease' ? 'beta' : 'latest'

    logger.log(`Publishing package version ${nextRelease?.version} with tag ${tag}`)

    // Use the build directory
    const buildDir = path.join(cwd, 'build')

    // Ensure the dist directory exists after compilation
    const distDirPath = path.join(buildDir, 'dist')
    if (!fs.existsSync(distDirPath)) {
      throw new Error(`Compilation failed: dist directory not found at ${distDirPath}`)
    }

    // Publish the package with the appropriate tag
    // Note: Make sure NPM_TOKEN environment variable is set for authentication
    const publishCommand = `cd ${buildDir} && npm publish --tag ${tag} --access public`
    logger.log(`Executing: ${publishCommand}`)

    const { stdout, stderr } = await execPromise(publishCommand)

    if (stdout) {
      logger.log(stdout)
    }

    if (stderr) {
      logger.error(stderr)
    }

    logger.log(`✅ Package ${nextRelease?.version} published successfully with tag ${tag}`)

    return {
      name: PACKAGE.ROUTES_TS_PACKAGE_NAME,
      url: `https://www.npmjs.com/package/${PACKAGE.ROUTES_TS_PACKAGE_NAME}`
    }
  } catch (error) {
    logger.error('❌ Package publish failed')
    logger.error((error as Error).message)
    throw error
  }
}

function shouldWePublish(version: string): boolean {
  // Check if running in GitHub Actions
  const isGitHubCI = process.env[ENV_VARS.CI] === 'true'
  const notDryRun = process.env[ENV_VARS.NOT_DRY_RUN] === 'true'

  // Only publish if running in CI and it's not a PR
  const shouldPublish = isGitHubCI || notDryRun

  if (!shouldPublish) {
    console.log('DRY RUN: Skipping actual npm publish. Would have published package to npm.')
    console.log(`Would publish: ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version}`)
    console.log(`Not publishing, Set ${ENV_VARS.NOT_DRY_RUN} to true to publish or run in a CI environment with ${ENV_VARS.CI} set to true.`)
    return false
  } else {
    console.log(`Publishing ${PACKAGE.ROUTES_TS_PACKAGE_NAME}@${version} to npm...`)
    return true
  }
}