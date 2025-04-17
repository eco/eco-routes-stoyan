/**
 * @file sr-prepare.ts
 *
 * Implements the prepare step in the semantic-release lifecycle.
 * This step runs after the version has been determined and version files updated,
 * but before the actual publishing to npm.
 *
 * Responsibilities:
 * 1. Building the Hardhat project
 * 2. Deploying contracts to all configured networks
 * 3. Verifying deployed contracts on block explorers
 * 4. Building the TypeScript package for distribution
 *
 * The prepare step is crucial for ensuring that what gets published
 * contains all the necessary artifacts and deployed contract addresses.
 */

import path from 'path'
import fs from 'fs'
import { buildPackage } from './sr-build-package'
import { deployRoutesContracts } from './deploy-contracts'
import dotenv from 'dotenv'
import { Logger } from './helpers'
import { promisify } from 'util'
import { exec } from 'child_process'
import { verifyContracts } from './verify-contracts'
import { PATHS, PACKAGE, getBuildDirPath, getTsBuildDirPath } from './constants'
dotenv.config()

const execPromise = promisify(exec)

// Define types for semantic-release context
export interface SemanticNextRelease {
  version: string
  gitTag: string
  notes: string
}

export interface SemanticPluginConfig {
  // Any plugin-specific configuration options
}

export interface SemanticContext {
  nextRelease?: SemanticNextRelease
  logger: Logger
  cwd: string
}

/**
 * Plugin to handle contract deployment during semantic-release process
 * This is the prepare step in the semantic-release lifecycle
 * Will deploy contracts with deterministic addresses by reusing salt for patch versions
 *
 * @param pluginConfig - Plugin configuration options
 * @param context - Semantic release context
 */
/**
 * Creates a TypeScript-only build directory that excludes Solidity files
 * This directory will be published as a separate npm package that includes
 * only TypeScript types and utilities without the Solidity contracts
 * 
 * @param context - Semantic release context
 */
export async function createTsBuildDir(context: SemanticContext): Promise<void> {
  const { logger, cwd, nextRelease } = context
  
  if (!nextRelease) {
    return
  }
  
  const buildDir = getBuildDirPath(cwd)
  const tsBuildDir = getTsBuildDirPath(cwd)
  
  logger.log(`Creating TypeScript-only build directory at ${tsBuildDir}`)
  
  // Ensure the TS build directory exists
  if (fs.existsSync(tsBuildDir)) {
    logger.log('Cleaning existing TypeScript build directory')
    fs.rmSync(tsBuildDir, { recursive: true, force: true })
  }
  
  // Create TypeScript build directory
  fs.mkdirSync(tsBuildDir, { recursive: true })
  
  // Copy dist and src directories from build to buildTs, but exclude Solidity files
  const directoriesToCopy = ['dist', 'src']
  const filesToCopy = ['README.md', 'LICENSE', 'deployAddresses.json', 'deployAddresses.csv']
  const excludeExtensions = ['.sol']
  
  // First, copy the files at the root level
  for (const file of filesToCopy) {
    const sourcePath = path.join(buildDir, file)
    const destPath = path.join(tsBuildDir, file)
    
    if (fs.existsSync(sourcePath)) {
      logger.log(`Copying ${file} to TypeScript build directory`)
      fs.copyFileSync(sourcePath, destPath)
    }
  }
  
  // Now copy directories recursively excluding Solidity files
  for (const dir of directoriesToCopy) {
    const sourceDir = path.join(buildDir, dir)
    const destDir = path.join(tsBuildDir, dir)
    
    if (fs.existsSync(sourceDir)) {
      logger.log(`Copying ${dir} directory to TypeScript build directory`)
      copyDirRecursively(sourceDir, destDir, excludeExtensions, logger)
    }
  }
  
  // Create a TypeScript-specific package.json
  const packageJsonPath = path.join(buildDir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    logger.log('Creating TypeScript-specific package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    
    // Modify package.json for TypeScript build
    const tsPackageJson = { ...packageJson }
    
    // Change package name to add -ts suffix
    tsPackageJson.name = PACKAGE.ROUTES_TS_PACKAGE_NAME
    
    // Update description to indicate this is the TypeScript version
    tsPackageJson.description = (packageJson.description || '') + ' (TypeScript-only package)'
    
    // Remove Solidity files from the files array
    if (tsPackageJson.files) {
      tsPackageJson.files = tsPackageJson.files.filter((f: string) => !f.endsWith('.sol'))
    }
    
    // Write the modified package.json
    fs.writeFileSync(
      path.join(tsBuildDir, 'package.json'),
      JSON.stringify(tsPackageJson, null, 2)
    )
  }
  
  logger.log('TypeScript build directory created successfully')
}

/**
 * Helper function to recursively copy a directory excluding certain file extensions
 */
function copyDirRecursively(
  sourceDir: string, 
  destDir: string, 
  excludeExtensions: string[], 
  logger: Logger
): void {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const destPath = path.join(destDir, entry.name)
    
    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      copyDirRecursively(sourcePath, destPath, excludeExtensions, logger)
    } else {
      // Skip files with excluded extensions
      const extension = path.extname(entry.name)
      if (!excludeExtensions.includes(extension)) {
        fs.copyFileSync(sourcePath, destPath)
      } else {
        logger.log(`Skipping Solidity file: ${sourcePath}`)
      }
    }
  }
}

export async function prepare(
  pluginConfig: SemanticPluginConfig,
  context: SemanticContext,
): Promise<void> {
  const { nextRelease, logger, cwd } = context

  if (!nextRelease) {
    logger.log('No release detected, skipping contract deployment')
    return
  }

  logger.log(`Preparing to deploy contracts for version ${nextRelease.version}`)

  // Extract version components
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
  )
  const packageName = packageJson.name

  // 1. Build the hardhat files
  buildHardhat()

  // 2. Deploy contracts
  logger.log(`Deploying contracts for package: ${packageName}`)
  await deployRoutesContracts(context, packageName)
  logger.log(`Contracts deployed for version ${nextRelease.version}`)

  // 3. Verify contracts
  logger.log(`Verifying deployed contracts`)
  await verifyContracts(context)
  logger.log(`Contracts verified for version ${nextRelease.version}`)

  // 4. Build the distribution package
  logger.log(`Building main package`)
  await buildPackage(context)
  logger.log(`Main package built for version ${nextRelease.version}`)
  
  // 5. Create TypeScript-only build directory
  logger.log(`Creating TypeScript-only package`)
  await createTsBuildDir(context)
  logger.log(`TypeScript package prepared for version ${nextRelease.version}`)
}

async function buildHardhat() {
  // Build the hardhat files
  await execPromise('npm run clean')
  await execPromise('env COMPILE_MODE=production npm run build')
}
