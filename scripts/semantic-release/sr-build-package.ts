import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { stringify as stringifyCSV } from 'csv-stringify/sync'
import { SemanticContext } from './sr-prepare'
import semverUtils from 'semver-utils'
import { getPackageInfo, Logger } from './helpers'
import { PACKAGE } from './constants'
import { getGitHashShort } from './solidity-version-updater'

// Define the contract types that form our chain configuration
// This is used for both CSV headers and TypeScript type definitions
export const CONTRACT_TYPES = ['IntentSource', 'Inbox', 'HyperProver'] as const

const execPromise = promisify(exec)

/**
 * Represents the structure of the addresses.json file
 * with chain IDs as keys and contract names/addresses as values
 */
interface AddressesJson {
  [chainId: string]: {
    [contractName: string]: string
  }
}


// need to ge tthe publishing of build and buildts going
// then need to set up dispatches
// need to rebase on the audit branch
/**
 * Represents the structure of an ABI file
 */
interface AbiFile {
  abi: any[]
  bytecode: string
  deployedBytecode: string
  contractName: string
  sourceName: string
}

/**
 * Builds the package for distribution
 * @param context The semantic release context
 */
export async function buildPackage(context: SemanticContext): Promise<void> {
  const { nextRelease, logger, cwd } = context

  try {
    // Determine version for npm package retrieval
    const version = nextRelease!.version
    const parsedVersion = semverUtils.parse(version)
    const majorMinorVersion = `${parsedVersion.major}.${parsedVersion.minor}`

    logger.log(`Building package for version ${version}`)

    // Get local deployment addresses
    const localAddressesPath = path.join(cwd, 'build', 'deployAddresses.json')
    let deployedAddresses: AddressesJson = {}

    if (fs.existsSync(localAddressesPath)) {
      const localAddressesContent = fs.readFileSync(localAddressesPath, 'utf-8')
      deployedAddresses = JSON.parse(localAddressesContent)
    } else {
      logger.error(`No local addresses found in file at ${localAddressesPath}`)
      return
    }

    // Create build directory
    const buildDir = path.join(cwd, 'build')
    fs.mkdirSync(buildDir, { recursive: true })

    // Create necessary subdirectories
    fs.mkdirSync(path.join(buildDir, 'src', 'abi', 'contracts'), { recursive: true })
    fs.mkdirSync(path.join(buildDir, 'src', 'abi', 'interfaces'), { recursive: true })
    fs.mkdirSync(path.join(buildDir, 'src', 'utils'), { recursive: true })

    // Copy ABIs using the approach from prepack.sh
    logger.log('Copying ABI files')
    await execPromise(`cp ${cwd}/artifacts/contracts/**/*.json ${buildDir}/src/abi/contracts`)
    await execPromise(`cp ${cwd}/artifacts/contracts/interfaces/**/*.json ${buildDir}/src/abi/interfaces`)

    // Remove debug files from all directories recursively
    await execPromise(`find ${buildDir}/src/abi -name "*.dbg.json" -type f -delete`)

    // Copy the solidity files, excluding test, tools, and build directories
    logger.log('Copying Solidity files')
    const contractsDir = path.join(cwd, 'contracts')
    const solidityFiles = listFilesRecursively(contractsDir)

    // Define directories to skip
    const skipDirs = ['test', 'tools', 'build']

    solidityFiles
      .filter(file => !skipDirs.some(dir => file.startsWith(dir) || file.includes(`/${dir}/`)))
      .forEach((file) => {
        const sourcePath = path.join(contractsDir, file)
        const targetPath = path.join(buildDir, 'src', file)
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.copyFileSync(sourcePath, targetPath)
        logger.log(`Copied ${sourcePath} to ${targetPath}`)
      })
    // Generate TypeScript files from ABI JSON files
    logger.log('Generating TypeScript files from ABI JSON files')
    generateAbiTypeScriptFiles(buildDir, logger)

    // Copy utility files from semantic-release/assets/utils
    logger.log('Copying utility files from assets/utils')
    await execPromise(`cp ${cwd}/scripts/semantic-release/assets/utils/*.ts ${buildDir}/src/utils/`)

    // Generate CSV file from addresses
    generateCsvFile(deployedAddresses, buildDir, logger)

    // Generate index.ts file
    generateIndexFile(deployedAddresses, buildDir, version, logger)

    // Copy other necessary files
    copyOtherPackageFiles(buildDir, cwd, version, logger)

    // Create tsconfig.json for TypeScript compilation
    createTsConfig(buildDir, logger)

    // Compile TypeScript files
    logger.log('Compiling TypeScript files...')
    await execPromise(`cd ${buildDir} && tsc`)

    logger.log('✅ Package build completed successfully')
  } catch (error) {
    logger.error('❌ Package build failed')
    logger.error((error as Error).message)
    throw error
  }
}

/**
 * Generates TypeScript files from ABI JSON files
 * @param buildDir The directory to build in
 * @param logger The logger to use
 */
function generateAbiTypeScriptFiles(buildDir: string, logger: Logger): void {
  // Directory containing the JSON files
  const abiParentDir = path.join(buildDir, 'src', 'abi')
  const dirs = [
    path.join(abiParentDir, 'contracts'),
    path.join(abiParentDir, 'interfaces'),
  ]

  let mainIndexContent = `// Export all ABIs with proper typing for viem\n`
  logger.log('Starting ABI exports')

  dirs.forEach((abiDir) => {
    logger.log(`Processing directory: ${abiDir}`)

    // Read through the directory and get all .json files
    const jsonFiles = fs
      .readdirSync(abiDir)
      .filter((file) => file.endsWith('.json'))

    // Read each JSON file and parse its content
    const data = jsonFiles.reduce((acc: AbiFile[], file) => {
      const filePath = path.join(abiDir, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const abiFile = JSON.parse(fileContent)
      acc.push({
        abi: abiFile.abi,
        bytecode: abiFile.bytecode,
        deployedBytecode: abiFile.deployedBytecode,
        contractName: abiFile.contractName,
        sourceName: abiFile.sourceName,
      })
      // Remove the JSON file after processing
      fs.unlinkSync(filePath)
      return acc
    }, [])

    let indexContent = `// Contract ABIs for ${path.basename(abiDir)}\n`
    const indexFilePath = path.join(abiDir, 'index.ts')

    // Generate the TypeScript code
    data.forEach((abiFile: AbiFile) => {
      const abiVarName = `${abiFile.contractName}Abi`
      const bytecodeVarName = `${abiFile.contractName}Bytecode`
      const deployedBytecodeVarName = `${abiFile.contractName}DeployedBytecode`

      // Add export to directory index
      indexContent += `export * from './${abiFile.contractName}'\n`

      // Generate contract ABI file with proper typing
      const outputContent =
        `/**\n * ABI for the ${abiFile.contractName} contract\n */\n` +
        `export const ${abiVarName} = ${JSON.stringify(abiFile.abi, null, 2)} as const\n\n` +
        `/**\n * Type-safe ABI for the ${abiFile.contractName} contract\n */\n` +
        `export type ${abiFile.contractName}AbiType = typeof ${abiVarName}\n\n` +
        `/**\n * Bytecode for the ${abiFile.contractName} contract\n */\n` +
        `export const ${bytecodeVarName} = "${abiFile.bytecode}"\n\n` +
        `/**\n * Deployed bytecode for the ${abiFile.contractName} contract\n */\n` +
        `export const ${deployedBytecodeVarName} = "${abiFile.deployedBytecode}"\n`

      const filePath = path.join(abiDir, `${abiFile.contractName}.ts`)
      fs.writeFileSync(filePath, outputContent, 'utf-8')
    })

    fs.writeFileSync(indexFilePath, indexContent, 'utf-8')
    mainIndexContent += `export * from './${path.basename(abiDir)}'\n`
  })

  // Create index file that re-exports all contract ABIs
  fs.writeFileSync(path.join(abiParentDir, 'index.ts'), mainIndexContent, 'utf-8')

  logger.log('Finished ABI exports')
}

/**
 * Generates a CSV file from the addresses JSON
 * @param addresses Object containing chain IDs and contract addresses
 * @param buildDir Directory to store the output CSV
 * @param logger The logger instance
 */
function generateCsvFile(
  addresses: AddressesJson,
  buildDir: string,
  logger: Logger
): void {
  const rows = []

  // Add header row with specified format using the shared CONTRACT_TYPES
  const headers = ['Chain', ...CONTRACT_TYPES]
  rows.push(headers)

  // Add data rows
  for (const [chainId, contracts] of Object.entries(addresses)) {
    // Create a row for each chain
    const row = [chainId]

    // Add values for each contract type from the shared constant
    CONTRACT_TYPES.forEach(contractType => {
      row.push(contracts[contractType] || '')
    })

    rows.push(row)
  }

  // Generate CSV content
  const csvContent = stringifyCSV(rows)

  // Save to file
  const csvPath = path.join(buildDir, 'deployAddresses.csv')
  fs.writeFileSync(csvPath, csvContent)

  logger.log(`CSV file saved to ${csvPath}`)
}

/**
 * Generates the main index.ts file with addresses exports
 * @param addresses Object containing chain IDs and contract addresses
 * @param buildDir Directory to store the output file
 * @param version Package version number
 * @param logger The logger instance
 */
function generateIndexFile(
  addresses: AddressesJson,
  buildDir: string,
  version: string,
  logger: Logger
): void {
  const gitHash = getGitHashShort()
  
  // Create the index content with template literals
  const indexContent = `// Generated by build script for version ${version}-${gitHash}
import { Hex } from 'viem'
export * from './abi'
export * from './utils'

/**
 * This file contains the addresses of the contracts deployed on the EcoProtocol network
 * for the current npm package release. The addresses are generated by the deploy script.
 *
 * @packageDocumentation
 * @module index
*/
export const EcoProtocolAddresses = ${JSON.stringify(addresses, null, 2)} as const;

/**
 * The eco protocol chain configuration type. Represents
 * all the deployed contracts on a chain.
 * 
 * @packageDocumentation
 * @module index
 */
export type EcoChainConfig = {
  ${CONTRACT_TYPES.map(type => `${type}: Hex`).join(',\n  ')}
}
export type EcoChainIds = keyof typeof EcoProtocolAddresses;
export type ContractName<T extends EcoChainIds> = keyof typeof EcoProtocolAddresses[T];

export function getContractAddress<T extends EcoChainIds>(
  chainId: T,
  contractName: ContractName<T>
): Hex {
  return EcoProtocolAddresses[chainId][contractName] as Hex;
}
`

  // Create index.ts
  fs.writeFileSync(path.join(buildDir, 'src', 'index.ts'), indexContent)

  logger.log(`Index files generated in ${buildDir}`)
}

/**
 * Lists all files in a directory recursively
 * @param dir Directory to list files from
 * @returns Array of file paths relative to the provided directory
 */
function listFilesRecursively(dir: string): string[] {
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
 * Copies essential files to the build directory and creates package.json
 * @param buildDir Directory to copy files to
 * @param cwd Current working directory
 * @param logger The logger instance
 */
function copyOtherPackageFiles(
  buildDir: string,
  cwd: string,
  version: string,
  logger: Logger
): void {
  // Copy common files like README, LICENSE, etc.
  const filesToCopy = [
    { source: path.join(cwd, 'README.md'), target: path.join(buildDir, 'README.md') },
    { source: path.join(cwd, 'LICENSE'), target: path.join(buildDir, 'LICENSE') }
  ]

  for (const file of filesToCopy) {
    if (fs.existsSync(file.source)) {
      fs.copyFileSync(file.source, file.target)
      logger.log(`Copied ${file.source} to ${file.target}`)
    }
  }

  // Create package.json for the build
  const projectPackageJson = getPackageInfo(cwd)
  const buildPackageJson = {
    name: PACKAGE.ROUTES_TS_PACKAGE_NAME, // Use the standardized package name
    version: version, // Use the version from semantic-release
    description: projectPackageJson.description,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['dist', 'src', 'deployAddresses.json', 'deployAddresses.csv', '!src/abi', '!src/utils', '!src/index.ts'],
    homepage: projectPackageJson.homepage,
    bugs: projectPackageJson.bugs,
    repository: projectPackageJson.repository,
    author: projectPackageJson.author,
    license: projectPackageJson.license,
    keywords: projectPackageJson.keywords,
    publishConfig: projectPackageJson.publishConfig,
    dependencies: {
      viem: projectPackageJson.dependencies?.viem || '^2.22.21'
    }
  }

  fs.writeFileSync(
    path.join(buildDir, 'package.json'),
    JSON.stringify(buildPackageJson, null, 2)
  )

  logger.log('Created package.json for the build')
}

/**
 * Creates tsconfig.json for TypeScript compilation
 * @param buildDir Directory to create the config in
 * @param logger The logger instance
 */
function createTsConfig(buildDir: string, logger: Logger): void {
  const tsConfig = {
    compilerOptions: {
      target: 'es2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true
    },
    include: ['*.ts', 'src/**/*.ts'],
    exclude: ['node_modules', 'dist']
  }

  fs.writeFileSync(
    path.join(buildDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  )

  logger.log('Created tsconfig.json for the build')
}