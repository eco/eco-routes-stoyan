/**
 * @file envUtils.ts
 *
 * Utility functions for environment variable management.
 */

import { ENV_VARS_REQUIRED } from '../semantic-release/constants'

/**
 * Validates that required environment variables are set
 * 
 * @param envVars Array of required environment variable names
 * @throws Error if any required environment variable is not set
 */
export function validateEnvVariables(envVars: string[] = ENV_VARS_REQUIRED): void {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`)
    }
  }
}