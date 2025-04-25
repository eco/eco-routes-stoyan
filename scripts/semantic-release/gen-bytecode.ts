import {
  encodeFunctionData,
  Hex,
  encodeDeployData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
  getAbiItem,
  getContractAddress,
} from 'viem'
import fs from 'fs'
import path from 'path'


type FetchData = {
  [chainId: string]: {
    url: string
    mailbox: Hex
  }
}

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
  { name: 'Inbox', args: ['0xB963326B9969f841361E6B6605d7304f40f6b414', true, []], path: 'contracts/Inbox.sol:Inbox' },
  { name: 'HyperProver', args: [], path: 'contracts/prover/HyperProver.sol:HyperProver' },
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
): Promise<void> {
  console.log(`Generating deployment data with salts ${salts.length}`)
  const deploymentData: Record<string, any> = {}

  // Fetch chain IDs from the deployment data URL
  // If this fails, it will throw an error that should propagate up
  const deployData = await fetchDeployData()
  const chainIDs = Object.keys(deployData)
  console.log(`Using chain IDs for deployment: ${chainIDs.join(', ')}`)

  // Generate bytecode deployment data for each salt
  for (const salt of salts) {
    console.log(`Generating deployment data for salt ${salt.name}...`)
    const data = generateMultipleDeploymentData(salt.value, deployData)
    data.chainIds = chainIDs // Store chain IDs in the deployment data
    deploymentData[salt.name] = data
  }

  // Save deployment data
  saveDeploymentData(deploymentData, outputPath)

  console.log('Deployment data generation complete')
}

/**
 * Generates deployment data for multiple contracts using the same salt
 * @param salt The salt to use for all deployments (32 bytes hex string with 0x prefix)
 * @returns Object with deployment data for all contracts
 */
export function generateMultipleDeploymentData(salt: Hex, deployData: FetchData): Record<string, any> {

  
  // Initialize the deployment data structure with per-chain objects
  const deploymentData: Record<string, any> = {}
  
  // For each chain ID in the deployment data
  for (const [chainId, chainData] of Object.entries(deployData)) {
    console.log(`Generating deployment data for chain ID ${chainId}...`)
    
    // Initialize chain-specific object
    deploymentData[chainId] = {
      mailboxAddress: chainData.mailbox, // Store mailbox address from chain data
      salt,
      keccakSalt: keccak256(salt),
      contracts: {},
    }
    
    // Deploy all contracts in order
    // Making sure that dependencies are available when needed
    const deployedContracts: Record<string, any> = {}
    
    // Process contracts in order that ensures dependencies are available
    // Sort contracts placing Inbox first, then others
    const sortedContracts = [...CONTRACTS_TO_DEPLOY].sort((a, b) => {
      if (a.name === 'Inbox') return -1;
      if (b.name === 'Inbox') return 1;
      return 0;
    });
    
    for (const contract of sortedContracts) {
      const contractName = contract.name
      try {
        console.log(`Generating ${contractName} deployment data for chain ${chainId}...`)
        
        // Create a copy of the contract to modify without affecting the original
        let contractWithArgs = {...contract}
        let contractArgs = [...contract.args]
        
        // Set dynamic arguments based on contract type and chain
        if (contractName === 'HyperProver') {
          // For HyperProver we need the inbox address for this chain
          if (deployedContracts['Inbox']) {
            // Calculate inbox address from previously generated data
            const inboxAddress = getContractAddress({
              bytecode: deployedContracts['Inbox'].deployBytecode,
              from: CREATE_X_DEPLOYER_ADDRESS,
              opcode: 'CREATE2',
              salt: keccak256(salt),
            });
            
            // Set constructor args: [mailboxAddress, inboxAddress]
            contractArgs = [chainData.mailbox, inboxAddress];
            console.log(`Setting HyperProver args for chain ${chainId}: [${chainData.mailbox}, ${inboxAddress}]`);
          } else {
            console.warn(`Cannot find Inbox data for HyperProver on chain ${chainId}, using default args`);
            contractArgs = [chainData.mailbox, '0x0000000000000000000000000000000000000001'];
          }
        }
        
        // Update args in the contract copy
        contractWithArgs = {
          ...contract,
          args: contractArgs
        };
        
        // Generate the deployment bytecode with the updated args
        const contractData = generateBytecodeDeployData({
          value: 0n,
          salt,
          contract: contractWithArgs,
        });
        
        // Store the generated data
        deployedContracts[contractName] = {
          args: contractArgs,
          initCodeHash: contractData.initCodeHash,
          encodedArgs: contractData.encodedArgs,
          contractPath: contract.path,
          deployBytecode: contractData.deployBytecode,
        };
        
        console.log(`Successfully generated ${contractName} deployment data for chain ${chainId}`);
      } catch (error) {
        console.error(
          `Error generating ${contractName} deployment data for chain ${chainId}:`,
          error,
        );
      }
    }
    
    // Store all contracts for this chain
    deploymentData[chainId].contracts = deployedContracts;
  }
  
  return deploymentData;
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
 * Fetches chain IDs from the deployment data URL using fetch API
 * @returns Array of available chain IDs
 * @throws Error if unable to fetch or parse deployment data
 */
export async function fetchDeployData(): Promise<FetchData> {
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
      return deployData
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
