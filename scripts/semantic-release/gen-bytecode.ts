import {
  encodeFunctionData,
  Hex,
  encodeDeployData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
  getAbiItem,
} from 'viem'
import fs from 'fs'
import path from 'path'

// CREATEX Deployer ABI for the deploy function
const CREATE_X_ABI = [
  {
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'initCode', type: 'bytes' },
    ],
    name: 'deployCreate2',
    outputs: [{ name: 'newContract', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
]

type Contract = {
  name: 'IntentSource' | 'Inbox' | 'HyperProver'
  path: string
  args: any[]
}
// Address of the CREATEXDeployer contract
const CREATE_X_DEPLOYER_ADDRESS = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'

// List of contracts to deploy
const CONTRACTS_TO_DEPLOY: Contract[] = [
  { name: 'IntentSource', args: [], path: 'contracts/IntentSource.sol:IntentSource' },
  { name: 'Inbox', args: ['0xB963326B9969f841361E6B6605d7304f40f6b414', true, []] , path: 'contracts/Inbox.sol:Inbox'},
  { name: 'HyperProver', args: [] , path: 'contracts/prover/HyperProver.sol:HyperProver'},
]

/**
 * Generates deployment data for all contracts and saves to JSON
 * @param salt The salt to use for all deployments
 * @param chainId The chain ID for the deployments
 * @param outputPath The path to save the JSON file to
 */
export async function generateDeploymentFile(
  salts: { value: Hex; name: string }[],
  outputPath: string,
  verificationPath: string = path.join('out', 'deployment-results.csv'),
): Promise<void> {
  console.log(`Generating deployment data with salts ${salts.length}`)
  const deploymentData: Record<string, any> = {}

  // Fetch chain IDs from the deployment data URL
  // If this fails, it will throw an error that should propagate up
  const chainIds = await fetchChainIdsFromDeployData()
  console.log(`Using chain IDs for deployment: ${chainIds.join(', ')}`)

  // Generate bytecode deployment data for each salt
  for (const salt of salts) {
    console.log(`Generating deployment data for salt ${salt.name}...`)
    const data = generateMultipleDeploymentData(salt.value)
    data.chainIds = chainIds // Store chain IDs in the deployment data
    deploymentData[salt.name] = data
  }

  // Save deployment data
  saveDeploymentData(deploymentData, outputPath)

  console.log('Deployment data generation complete')
}

/**
 * Generates verification data from deployment data and chain IDs
 * @param deploymentData Deployment data
 * @param chainIds Array of chain IDs
 * @returns Array of verification data entries
 */
function generateVerificationData(
  deploymentData: Record<string, any>,
  chainIds: string[]
): Array<{
  chainId: string
  contractAddress: string
  contractPath: string
  constructorArgs: string
  environment: string
}> {
  const verificationData = []

  // Go through each environment (default, pre, etc.)
  for (const [envName, envData] of Object.entries(deploymentData)) {
    if (!envData.contracts) continue

    // For each contract in this environment
    for (const [contractName, contractData] of Object.entries(envData.contracts)) {
      if (!contractData) continue

      const contractPath = getContractPath(contractName)
      const args = (contractData as any).args || []

      // Format constructor args properly for verification
      let constructorArgs = ''
      if (args.length > 0) {
        try {
          constructorArgs = serializeConstructorArgs(args, contractName)
        } catch (error) {
          console.error(`Error encoding constructor args for ${contractName}:`, error)
        }
      }

      // Create an entry for each chain ID
      for (const chainId of chainIds) {
        verificationData.push({
          chainId,
          contractAddress: '0x', // Placeholder - will be updated after deployment
          contractPath,
          constructorArgs,
          environment: envName
        })
      }
    }
  }

  return verificationData
}

// Function removed - verification data file is now created after deployment with actual addresses

/**
 * Properly serialize constructor arguments for contract verification
 * @param args The constructor arguments
 * @param contractName The name of the contract
 * @returns Hex string of encoded constructor arguments
 */
function serializeConstructorArgs(args: any[], contractName: string): string {
  // This is a simplified implementation - in a real-world scenario, 
  // you would use a library like ethers.js or web3.js to properly ABI-encode the arguments
  if (args.length === 0) return ''

  // For basic types like addresses, we can format them directly
  // In a real implementation, this would be more comprehensive
  // based on the actual contract ABI
  try {
    // Basic encoding for common argument types
    if (contractName === 'Inbox') {
      // For Inbox constructor: (address owner, bool isActive, uint96 minReward, address[] solvers)
      const [owner, isActive, minReward, solvers] = args

      // Return a hexadecimal string without 0x prefix - simplified for this example
      // In a real implementation, this would use proper ABI encoding
      return encodeTxData(args)
    } else if (contractName === 'HyperProver') {
      // For HyperProver constructor: (address mailbox, address inbox)
      const [mailbox, inbox] = args

      // Return a hexadecimal string without 0x prefix
      return encodeTxData(args)
    }

    // Default case for other contracts
    return encodeTxData(args)
  } catch (error) {
    console.error(`Error serializing constructor args for ${contractName}:`, error)
    return ''
  }
}

/**
 * Simple encoding of transaction data
 * @param args Arguments to encode
 * @returns Encoded hex string
 */
function encodeTxData(args: any[]): string {
  // This is a placeholder - in a real implementation, you would use a proper ABI encoder
  // For example, with ethers.js: ethers.utils.defaultAbiCoder.encode(types, args)

  // For now, we'll just return a simplified representation
  const hexArgs = args.map(arg => {
    if (typeof arg === 'string' && arg.startsWith('0x')) {
      // Already a hex string (like an address)
      return arg.slice(2).padStart(64, '0')
    } else if (typeof arg === 'boolean') {
      // Boolean values
      return arg ? '1'.padStart(64, '0') : '0'.padStart(64, '0')
    } else if (typeof arg === 'number') {
      // Number values
      return arg.toString(16).padStart(64, '0')
    } else if (Array.isArray(arg)) {
      // For arrays, this is a simplified approach
      // Real implementation would properly encode array length and elements
      return arg.map(item =>
        typeof item === 'string' && item.startsWith('0x')
          ? item.slice(2).padStart(64, '0')
          : item.toString(16).padStart(64, '0')
      ).join('')
    }

    // Default
    return '0'.padStart(64, '0')
  }).join('')

  return hexArgs ? `0x${hexArgs}` : ''
}

/**
 * Generates deployment data for multiple contracts using the same salt
 * @param salt The salt to use for all deployments (32 bytes hex string with 0x prefix)
 * @returns Object with deployment data for all contracts
 */
export function generateMultipleDeploymentData(salt: Hex): Record<string, any> {
  const deploymentData: Record<string, any> = {
    createXDeployerAddress: CREATE_X_DEPLOYER_ADDRESS,
    salt,
    keccakSalt: keccak256(salt),
    contracts: {},
  }

  for (const contract of CONTRACTS_TO_DEPLOY) {
    const contractName = contract.name
    try {
      console.log(`Generating deployment data for ${contractName}...`)
      const contractData = generateBytecodeDeployData({
        value: 0n,
        salt,
        contract,
      })

      deploymentData.contracts[contractName] = {
        args: contractData.args,
        initCodeHash: contractData.initCodeHash,
        encodedArgs: contractData.encodedArgs,
        contractPath: contract.path,
        deployBytecode: contractData.deployBytecode,
      }

      console.log(`Successfully generated deployment data for ${contractName}`)
    } catch (error) {
      console.error(
        `Error generating deployment data for ${contractName}:`,
        error,
      )
    }
  }

  return deploymentData
}

/**
 * Generates the bytecode and deployment data for a contract
 * @param contractName The name of the contract to deploy (matches the JSON file name)
 * @param salt The salt to use for the CREATE2 deployment (32 bytes hex string with 0x prefix)
 * @param chainId The chain ID to deploy to
 * @returns Object with contract deployment data
 */
export function generateBytecodeDeployData(create2Params: {
  value: bigint
  salt: Hex
  contract: Contract
}): {
  contractName: string
  salt: Hex
  initCodeHash: Hex
  args: any[]
  encodedArgs: string
  deployBytecode: Hex
} {
  const { value, salt, contract } = create2Params
  const contractName = contract.name
  // Path to the compiled contract JSON
  const contractJsonPath = path.join(
    process.cwd(),
    'out',
    `${contractName}.sol`,
    `${contractName}.json`,
  )

  if (!fs.existsSync(contractJsonPath)) {
    throw new Error(`Contract JSON file not found: ${contractJsonPath}`)
  }

  // Read the contract JSON file
  const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'))

  // Extract bytecode from the JSON
  const bytecode = contractJson.bytecode.object as Hex

  if (!bytecode || bytecode === '0x') {
    throw new Error(`Bytecode is empty for ${contractName}`)
  }
  // Encode the deployment data
  // The deployment data includes the bytecode and constructor arguments
  const deploymentBytecode = encodeDeployData({
    abi: contractJson.abi,
    bytecode,
    args: contract.args,
  })

  // Encode the function call to deploy
  const deployBytecode = encodeFunctionData({
    abi: CREATE_X_ABI,
    functionName: 'deployCreate2',
    args: [salt, deploymentBytecode],
  })

  const encodedArgs = encodeAbiParameters(
    contractJson.abi[0].inputs,// Assuming the first item in the ABI is the constructor
    contract.args,
  )

  return {
    contractName,
    salt,
    initCodeHash: keccak256(deploymentBytecode),
    args: contract.args,
    encodedArgs,
    deployBytecode,
  }
}

/**
 * Saves deployment data to a JSON file
 * @param deploymentData The deployment data to save
 * @param outputPath The path to save the JSON file to
 */
export function saveDeploymentData(
  deploymentData: Record<string, any>,
  outputPath: string = 'bytecode_deployment.json',
): void {
  // Ensure directory exists
  const directory = path.dirname(outputPath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
    console.log(`Created directory: ${directory}`)
  }

  // Delete the file if it exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
    console.log(`Deleted existing file: ${outputPath}`)
  }

  // Create and write to the file
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2))
  console.log(`Deployment data saved to ${outputPath}`)
}

/**
 * Saves verification data to a CSV file for contract verification
 * @param verificationData Array of verification data entries
 * @param outputPath The path to save the CSV file to
 */
export function saveVerificationData(
  verificationData: Array<{
    chainId: string
    contractAddress: string
    contractPath: string
    constructorArgs: string
    environment: string
  }>,
  outputPath: string
): void {
  // Ensure directory exists
  const directory = path.dirname(outputPath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
    console.log(`Created directory: ${directory}`)
  }

  // Write the verification CSV header in Deploy.s.sol format
  let csvContent = 'Environment,ChainID'

  // Add contract names as columns
  const uniqueContracts = [...new Set(verificationData.map(entry =>
    entry.contractPath.split(':')[1] || entry.contractPath.split('/').pop() || ''
  ))]

  for (const contract of uniqueContracts) {
    csvContent += `,${contract}`
  }
  csvContent += '\n'

  // Group by environment and chainId
  const groupedData: Record<string, Record<string, Record<string, string>>> = {}

  for (const entry of verificationData) {
    const envKey = entry.environment
    const chainKey = entry.chainId
    const contractName = entry.contractPath.split(':')[1] || entry.contractPath.split('/').pop() || ''

    if (!groupedData[envKey]) {
      groupedData[envKey] = {}
    }

    if (!groupedData[envKey][chainKey]) {
      groupedData[envKey][chainKey] = {}
    }

    groupedData[envKey][chainKey][contractName] = entry.contractAddress
  }

  // Create rows for each environment and chain
  for (const [env, chains] of Object.entries(groupedData)) {
    for (const [chainId, contracts] of Object.entries(chains)) {
      let row = `${env},${chainId}`

      // Add each contract address (or 'undefined' if missing)
      for (const contractName of uniqueContracts) {
        row += `,${contracts[contractName] || 'undefined'}`
      }

      csvContent += row + '\n'
    }
  }

  // Save to file, overwriting any existing content
  fs.writeFileSync(outputPath, csvContent)
  console.log(`Verification data saved to ${outputPath}`)
}

/**
 * Fetches chain IDs from the deployment data URL using fetch API
 * @returns Array of available chain IDs
 * @throws Error if unable to fetch or parse deployment data
 */
export async function fetchChainIdsFromDeployData(): Promise<string[]> {
  // Get the URL from environment or use default
  const DEPLOY_DATA_URL = process.env.DEPLOY_DATA_URL ||
    "https://raw.githubusercontent.com/eco/eco-chains/refs/heads/ED-5079-auto-deploy/t.json"

  console.log(`Fetching deployment data from ${DEPLOY_DATA_URL}...`)

  try {
    // Use native fetch API (available in Node.js v18+)

    // Fetch the data
    const response = await fetch(DEPLOY_DATA_URL)

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    // Parse the JSON
    const deployData = await response.json()
    const chainIds = Object.keys(deployData)

    if (chainIds.length > 0) {
      console.log(`Found ${chainIds.length} chain IDs in deployment data: ${chainIds.join(', ')}`)
      return chainIds
    } else {
      throw new Error('No chain IDs found in deployment data')
    }
  } catch (error) {
    console.error('Error fetching or parsing deployment data:', error)
    throw new Error(`Failed to fetch or parse deployment data from ${DEPLOY_DATA_URL}: ${(error as Error).message}`)
  }
}

// async function main() {
//   generateDeploymentFile([{ name: 'test', value: '0x4dad9ff70cc0946e063bbeb57f1ded0f808a3026d96866d52157e150b507a986' }], 'bytecode_deployment.json')
// }

// main().catch((err) => {
//   console.error('Error:', err)
// })
