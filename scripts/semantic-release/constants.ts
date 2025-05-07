import path from 'path'

/**
 * File paths and directories used across semantic-release scripts
 * Centralizes all path definitions to avoid duplication and make maintenance easier
 */
export const PATHS = {
  // Build related paths
  BUILD_DIR: 'build',

  // Deployment related paths
  OUTPUT_DIR: 'out',
  DEPLOYMENT_RESULTS_FILE: 'deployed.csv',
  DEPLOYMENT_ALL_FILE: 'deployedAll.csv',
  DEPLOYMENT_BYTECODE_FILE: 'deployBytecode.json',
  DEPLOYED_ADDRESSES_JSON: 'build/deployAddresses.json',
  SINGLETON_FACTORY_DEPLOY_SCRIPT: 'scripts/deploySingletonFactory.sh',
  DEPLOY_SCRIPT: 'scripts/deployRoutes.sh',

  // Verification related paths
  VERIFICATION_SCRIPT: 'scripts/verifyRoutes.sh',
  VERIFICATION_KEYS_FILE: 'verification-keys.json',

  //Chains
  DEFAULT_CHAIN_DATA_URL : "https://raw.githubusercontent.com/eco/eco-chains/refs/heads/main/src/assets/chain.json",

  // Package related
  PACKAGE_JSON: 'package.json',
  README_FILE: 'README.md',
  LICENSE_FILE: 'LICENSE',
}

/**
 * Environment variable names used across semantic-release scripts
 * These are used for deployment credentials, verification keys, and controlling publishing behavior
 */
export const ENV_VARS = {
  // Deployment related
  PRIVATE_KEY: 'PRIVATE_KEY',
  ALCHEMY_API_KEY: 'ALCHEMY_API_KEY',
  SALT: 'SALT',
  APPEND_RESULTS: 'APPEND_RESULTS',
  RESULTS_FILE: 'RESULTS_FILE',

  // NPM related
  NPM_TOKEN: 'NPM_TOKEN',
  NOT_DRY_RUN: 'NOT_DRY_RUN',
  CI: 'CI',

  // Verification related
  VERIFICATION_KEYS: 'VERIFICATION_KEYS',
  VERIFICATION_KEYS_FILE: 'VERIFICATION_KEYS_FILE',
}

/**
 * Environment variables that are required for deployment and verification
 */
export const ENV_VARS_REQUIRED = [
  ENV_VARS.PRIVATE_KEY,
  ENV_VARS.ALCHEMY_API_KEY,
  ENV_VARS.RESULTS_FILE,
]

/**
 * Package related constants including npm package names
 * Used to maintain consistent naming between JavaScript and Solidity components
 */
export const PACKAGE = {
  ROUTES_PACKAGE_NAME: '@eco-foundation/eco-routes',
  ROUTES_TS_PACKAGE_NAME: '@eco-foundation/eco-routes-ts',
}

/**
 * Threshold values and limits for various operations
 * Used to warn about potential performance or security issues
 */
export const THRESHOLDS = {
  // Number of verification entries that might cause performance concerns
  VERIFICATION_ENTRIES_WARNING: 20,
}

/**
 * Get absolute path based on current working directory
 *
 * @param cwd - Current working directory
 * @param relativePath - Relative path to resolve
 * @returns Absolute path
 */
export function getAbsolutePath(cwd: string, relativePath: string): string {
  return path.join(cwd, relativePath)
}

/**
 * Get deployment results file path
 *
 * @param cwd - Current working directory
 * @returns Absolute path to deployment results file
 */
export function getDeploymentResultsPath(cwd: string): string {
  return getAbsolutePath(
    cwd,
    path.join(PATHS.OUTPUT_DIR, PATHS.DEPLOYMENT_RESULTS_FILE),
  )
}

/**
 * Get deployed addresses JSON file path
 *
 * @param cwd - Current working directory
 * @returns Absolute path to deployed addresses JSON file
 */
export function getDeployedAddressesJsonPath(cwd: string): string {
  return getAbsolutePath(cwd, PATHS.DEPLOYED_ADDRESSES_JSON)
}

/**
 * Get build directory path
 *
 * @param cwd - Current working directory
 * @returns Absolute path to build directory
 */
export function getBuildDirPath(cwd: string): string {
  return getAbsolutePath(cwd, PATHS.BUILD_DIR)
}
