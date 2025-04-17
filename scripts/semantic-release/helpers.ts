/**
 * @file helpers.ts
 * 
 * Helper functions for semantic-release plugin lifecycle events.
 * This file contains shared functionality used by multiple lifecycle events
 * such as fetching npm packages, comparing versions, and other utilities.
 */

import fs from 'fs'
import path from 'path'
import pacote from 'pacote'
import semverUtils from 'semver-utils'
import semver from 'semver'
import { PACKAGE } from './constants'

// Define a logger interface to make it consistent with semantic-release logger
export interface Logger {
  log: (message: string) => void
  error: (message: string) => void
  warn: (message: string) => void
}

/**
 * Fetches information about the latest version of a package with the same major.minor version
 * 
 * @param packageName - Name of the package to check
 * @param version - Current version being released
 * @param logger - Logger instance for output messages
 * @returns Object containing version info or null if not found
 */
export async function fetchLatestPackageVersion(
  packageName: string,
  version: string,
  logger: Logger
): Promise<{ version: string; isNewer: boolean } | null> {
  try {
    // Parse the current version to extract major.minor
    const parsedVersion = semverUtils.parse(version)
    if (!parsedVersion) {
      logger.error(`Failed to parse version: ${version}`)
      return null
    }

    const majorMinorVersion = `${parsedVersion.major}.${parsedVersion.minor}`
    logger.log(`Checking for existing package ${packageName}@${majorMinorVersion}.x`)

    // Query for the latest package matching the major.minor version
    try {
      const manifest = await pacote.manifest(`${packageName}@${majorMinorVersion}.x`, {
        // Refresh cache to ensure we get the latest version
        preferOnline: true
      })
      
      const publishedVersion = manifest.version
      logger.log(`Found published version: ${publishedVersion}`)
      
      // Compare if the current version is newer than what's published
      const isNewer = semver.gt(version, publishedVersion)
      
      return {
        version: publishedVersion,
        isNewer
      }
    } catch (error) {
      // If the error is 'No matching version found', this might be a new major.minor version
      if ((error as Error).message.includes('No matching version found')) {
        logger.log(`No existing package found for ${packageName}@${majorMinorVersion}.x`)
        return null
      }
      
      throw error
    }
  } catch (error) {
    logger.error(`Error fetching package info: ${(error as Error).message}`)
    return null
  }
}

/**
 * Downloads and extracts the latest package with the same major.minor version
 * 
 * @param packageName - Name of the package to download
 * @param version - Current version being released
 * @param extractDir - Directory to extract the package to
 * @param logger - Logger instance for output messages
 * @returns Object containing addresses and file list from the package, or null if failed
 */
export async function downloadPackage(
  packageName: string,
  version: string,
  extractDir: string,
  logger: Logger
): Promise<{ addresses: Record<string, Record<string, string>>; packageFiles: string[] } | null> {
  try {
    // Parse the current version to extract major.minor
    const parsedVersion = semverUtils.parse(version)
    if (!parsedVersion) {
      logger.error(`Failed to parse version: ${version}`)
      return null
    }

    const majorMinorVersion = `${parsedVersion.major}.${parsedVersion.minor}`
    const packageVersion = `${majorMinorVersion}.x`
    
    logger.log(`Downloading latest ${packageName}@${packageVersion}...`)
    
    try {
      // Get the exact version
      const manifest = await pacote.manifest(`${packageName}@${packageVersion}`)
      const exactVersion = manifest.version
      logger.log(`Found package version: ${exactVersion}`)
      
      // Extract package to temporary directory
      await pacote.extract(`${packageName}@${exactVersion}`, extractDir)
      
      // Read addresses from the package
      const addressesPath = path.join(extractDir, 'dist', 'deployAddresses.json')
      let addresses: Record<string, Record<string, string>> = {}
      
      if (fs.existsSync(addressesPath)) {
        addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'))
      } else {
        logger.warn(`Addresses file not found in downloaded package at ${addressesPath}`)
      }
      
      // List all files in the package
      const packageFiles = listFilesRecursively(extractDir)
      
      return { addresses, packageFiles }
    } catch (error) {
      // If package doesn't exist at this version range, return empty results
      if ((error as Error).message.includes('No matching version found')) {
        logger.log(`No existing package found for ${packageName}@${majorMinorVersion}.x`)
        return { addresses: {}, packageFiles: [] }
      }
      
      throw error
    }
  } catch (error) {
    logger.error(`Failed to download npm package: ${(error as Error).message}`)
    return null
  }
}

/**
 * List all files in a directory recursively
 * 
 * @param dir - Directory to list files from
 * @returns Array of relative file paths
 */
export function listFilesRecursively(dir: string): string[] {
  const files: string[] = []
  
  function traverseDir(currentDir: string, relativePath: string = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      const relativeFull = path.join(relativePath, entry.name)
      
      if (entry.isDirectory()) {
        traverseDir(fullPath, relativeFull)
      } else {
        files.push(relativeFull)
      }
    }
  }
  
  traverseDir(dir)
  return files
}

/**
 * Validates that the semantic version follows proper formatting rules
 * 
 * @param version - Version string to validate
 * @returns Whether the version is valid
 */
export function isValidVersion(version: string): boolean {
  return !!semver.valid(version)
}

/**
 * Get the package name for the TypeScript wrapper
 * 
 * @param baseName - The base package name (e.g., '@eco-foundation/routes')
 * @returns The TypeScript wrapper package name
 */
export function getTypeScriptPackageName(baseName: string): string {
  // If the package name is for the core contracts, use the TypeScript package name
  if (baseName === '@eco-foundation/routes') {
    return PACKAGE.ROUTES_TS_PACKAGE_NAME
  }
  
  // For other packages, we might have different naming conventions
  return baseName + '-ts'
}

/**
 * Reads the package.json file from the current working directory
 * @param cwd - Current working directory
 * @returns 
 */
export function getPackageInfo(cwd: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'))
}