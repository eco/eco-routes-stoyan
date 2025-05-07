/**
 * @file sr-singleton-factory.ts
 *
 * This file is responsible for deploying the EIP-2470 Singleton Factory.
 * The Singleton Factory is a standard CREATE2 factory deployed at the same address on all EVM chains.
 * It serves as a foundation for deterministic deployments.
 */

import path from 'path'
import fs from 'fs'
import { SemanticContext } from './sr-prepare'
import { validateEnvVariables } from '../utils/envUtils'
import { executeProcess } from '../utils/processUtils'
import { PATHS } from './constants'

/**
 * Deploys the EIP-2470 Singleton Factory across all configured chains.
 * This function executes the deploySingletonFactory.sh script and throws if the script fails.
 *
 * @param context Semantic release context
 * @throws Error if the deployment script fails or required environment variables are missing
 */
export async function deploySingletonFactory(
  context: SemanticContext,
): Promise<void> {
  const { logger, cwd } = context
  
  // Check for required environment variables
  validateEnvVariables()

  // Path to the deployment script
  const deployScriptPath = path.join(cwd, PATHS.SINGLETON_FACTORY_DEPLOY_SCRIPT)
  
  // Check if the script exists
  if (!fs.existsSync(deployScriptPath)) {
    throw new Error(`Deployment script not found at ${deployScriptPath}`)
  }

  logger.log('Deploying EIP-2470 Singleton Factory...')

  try {
    // Execute the deployment script
    const exitCode = await executeProcess(deployScriptPath, [], process.env, cwd)
    
    if (exitCode !== 0) {
      throw new Error(`Singleton Factory deployment failed with exit code ${exitCode}`)
    }
    
    logger.log('✅ EIP-2470 Singleton Factory deployment completed successfully')
  } catch (error: any) {
    logger.error(`Singleton Factory deployment failed: ${error.message}`)
    throw error
  }
}
