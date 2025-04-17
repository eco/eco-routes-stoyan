import * as pacote from 'pacote'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { keccak256, toHex } from 'viem'
import { Logger } from '../semantic-release/helpers'

/**
 * Determine salts for deployment based on version
 * @param version The full semantic version string (e.g. "1.2.3")
 * @param logger Logger interface for output
 * @returns Object containing production and pre-production salts
 */
export async function determineSalts(
  version: string,
  logger: Logger
): Promise<{ rootSalt: string; preprodRootSalt: string }> {
  // Extract version components
  const [major, minor, patch] = version.split('.')
  const versionBase = `${major}.${minor}`

  let rootSalt: string
  let preprodRootSalt: string

  // major/minor version - calculate fresh salt
  logger.log(`major/minor version (${versionBase}), calculating salt`)
  rootSalt = keccak256(toHex(versionBase))
  preprodRootSalt = keccak256(toHex(`${versionBase}-preprod`))

  logger.log(`Using salt for production: ${rootSalt}`)
  logger.log(`Using salt for pre-production: ${preprodRootSalt}`)

  return { rootSalt, preprodRootSalt }
}