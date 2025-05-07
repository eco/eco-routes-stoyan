/**
 * @file verify-contracts.ts
 *
 * Handles verification of deployed smart contracts on blockchain explorers (like Etherscan).
 * This process runs after deployment but before publishing to ensure that contract code
 * is publicly verified on-chain.
 *
 * Key features:
 * - Reads deployment results from the deployment step
 * - Obtains verification API keys from environment variables or local file
 * - Runs the verification script with appropriate parameters
 * - Handles potential verification failures gracefully (non-blocking for releases)
 * - Warns about large numbers of contracts that might cause timeouts
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { SemanticContext } from './sr-prepare'
import {
  PATHS,
  ENV_VARS,
  THRESHOLDS
} from './constants'
import { Logger } from './helpers'

/**
 * Plugin to handle contract verification during semantic-release process
 * Will verify contracts deployed during the prepare phase
 * Contract verification makes the contract source code viewable on block explorers
 */
export async function verifyContracts(context: SemanticContext): Promise<void> {
  const { nextRelease, logger, cwd } = context

  if (!nextRelease) {
    logger.log('No release detected, skipping contract verification')
    return
  }

  logger.log(`Preparing to verify contracts for version ${nextRelease.version}`)

  try {
    // Get verification keys from environment variable or file
    let verificationKeys: Record<string, string> = {}

    // Try environment variable first, this should be local in development
    // In the CI/CD pipeline, it will be loaded from the AWS secret manager
    if (process.env[ENV_VARS.CONTRACT_VERIFICATION_KEYS]) {
      try {
        verificationKeys = JSON.parse(
          process.env[ENV_VARS.CONTRACT_VERIFICATION_KEYS] as string,
        )
        logger.log(
          `Found verification keys in ${ENV_VARS.CONTRACT_VERIFICATION_KEYS} environment variable`,
        )
      } catch (e) {
        logger.warn(
          `Failed to parse ${ENV_VARS.CONTRACT_VERIFICATION_KEYS} as JSON: ${(e as Error).message}`,
        )
      }
    }
    const backupFile =
      process.env[ENV_VARS.CONTRACT_VERIFICATION_KEYS_FILE] ||
      PATHS.VERIFICATION_KEYS_FILE
    // If environment variable didn't work, try file fallback
    if (Object.keys(verificationKeys).length === 0) {
      try {
        const keysFile = backupFile
        if (fs.existsSync(keysFile)) {
          const keysContent = fs.readFileSync(keysFile, 'utf-8')
          verificationKeys = JSON.parse(keysContent)
          logger.log(`Found verification keys in file: ${keysFile}`)
        } else {
          logger.warn(`Verification keys file not found: ${keysFile}`)
        }
      } catch (e) {
        logger.error(`Failed to parse keys file: ${(e as Error).message}`)
      }
    }

    // Return if we still don't have verification keys
    if (Object.keys(verificationKeys).length === 0) {
      logger.error(
        'No valid verification keys found, skipping contract verification',
      )
      return
    }

    logger.log(
      `Found verification keys for ${Object.keys(verificationKeys).length} chain IDs`,
    )

    // Set up environment for verification
    const resultsFile = path.join(cwd, PATHS.OUTPUT_DIR, 'verify-data.txt')

    // Check if verification data exists
    if (!fs.existsSync(resultsFile)) {
      logger.error(
        `Verification data file not found at ${resultsFile}, skipping verification`,
      )
      return
    }

    // Check if the file has content
    const fileContent = fs.readFileSync(resultsFile, 'utf-8')
    if (!fileContent.trim()) {
      logger.error(
        `Verification data file is empty at ${resultsFile}, skipping verification`,
      )
      return
    }

    const entryCount = fileContent.split('\n').filter(Boolean).length
    logger.log(
      `Found verification data file with ${entryCount} entries to verify`,
    )

    // If there are too many entries, provide a warning that verification might take a while
    if (entryCount > THRESHOLDS.VERIFICATION_ENTRIES_WARNING) {
      logger.warn(
        `Large number of verification entries (${entryCount}) might cause verification to take longer than usual`,
      )
    }

    // The chain IDs are already included in the verification file
    // No need to fetch them separately, Verify.sh will read them directly from the file
    logger.log('Chain IDs already included in verification data file')

    // Execute verification
    await executeVerification(logger, cwd, {
      resultsFile,
      verificationKeys,
    })

    logger.log('✅ Contract verification completed')
  } catch (error) {
    logger.error('❌ Contract verification failed')
    logger.error((error as Error).message)
    // Don't throw the error to avoid interrupting the release process
  }
}

/**
 * Execute the verification script using async/await
 * @param logger Logger instance for output messages
 * @param cwd Current working directory
 * @param config Configuration for verification including results file and keys
 */
async function executeVerification(
  logger: Logger,
  cwd: string,
  config: { resultsFile: string; verificationKeys: Record<string, string> },
): Promise<void> {
  // Path to the verification script
  const verifyScriptPath = path.join(cwd, PATHS.VERIFICATION_SCRIPT)

  if (!fs.existsSync(verifyScriptPath)) {
    throw new Error(`Verification script not found at ${verifyScriptPath}`)
  }

  logger.log(
    `Running verification for deployment results in ${config.resultsFile}`,
  )

  // Pass verification keys directly as JSON string
  const verificationKeysJson = JSON.stringify(config.verificationKeys)
  
  // Use promisify for cleaner async/await handling
  
  const execProcess = promisify((script: string, options: any, callback: (err: Error | null, code: number) => void) => {
    const verifyProcess = spawn(script, [], options);
    
    verifyProcess.on('close', (code) => {
      logger.log(`Verification process exited with code ${code}`);
      
      if (code !== 0) {
        logger.error('Verification encountered some failures');
      }
      
      // Always call back with success - we don't want to fail the release
      callback(null, code || 0);
    });
    
    verifyProcess.on('error', (error) => {
      logger.error(
        `Verification process failed to start: ${(error as Error).message}`,
      );
      callback(error, 1);
    });
  });
  
  try {
    await execProcess(verifyScriptPath, {
      env: {
        ...process.env,
        [ENV_VARS.RESULTS_FILE]: config.resultsFile,
        [ENV_VARS.VERIFICATION_KEYS]: verificationKeysJson,
      },
      stdio: 'inherit',
      shell: true,
      cwd,
    });
  } catch (error) {
    // Log the error but don't throw - we want to continue the release process
    logger.error(`Verification process error: ${(error as Error).message}`);
  }
}
