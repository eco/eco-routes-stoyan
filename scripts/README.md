# Eco-Routes Scripts

This directory contains scripts for deploying, verifying, and publishing the Eco-Routes protocol. The scripts are divided into two main categories:

1. **Deployment Scripts**: Shell scripts and Solidity scripts for deploying and verifying contracts
2. **Semantic Release Scripts**: TypeScript modules for versioning, building, and publishing npm packages

## Directory Structure

- `scripts/` - Root scripts directory
  - `createXOld/` - Legacy deployment scripts using CreateX (archived)
  - `semantic-release/` - Semantic release automation scripts
  - `utils/` - Shared utility scripts
  - `*.sh` - Direct deployment and verification shell scripts
  - `Deploy.s.sol` - Main Foundry deployment script

## Semantic Release Integration

The `semantic-release/` directory contains a complete system for automated versioning, deployment, and publishing. See [semantic-release/README.md](./semantic-release/README.md) for details.

## Deployment Scripts

The deployment scripts handle the deterministic deployment of contracts across multiple chains. These scripts can be used directly or through the semantic-release process.

## Setup Requirements

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Required for all deployments
PRIVATE_KEY=<Your private key>
CHAIN_DATA_URL=<URL or local path to the chain data JSON file>
SALT=<Deployment salt as a bytes32 value>

# For MultiDeploy.sh
RESULTS_FILE=<Path to store deployment results>
APPEND_RESULTS=<true/false> # Optional: Set to true to append to existing results file

# For SingletonFactory deployment
ALCHEMY_API_KEY=<Your Alchemy API key if using Alchemy RPCs>

# For Deploy.s.sol
MAILBOX=<Optional: Mailbox contract address for HyperProver>
ROUTER=<Optional: Router contract address for MetaProver>

# For deployCore.sh
BYTECODE_PATH=<Path to bytecode JSON file>

# For VerifyResults.sh
VERIFICATION_KEYS_FILE=<Path to verification keys JSON file>
VERIFICATION_KEYS=<Optional: JSON string of verification keys>
```

### Account Funding

The deployer account must have:

1. **For SingletonFactory deployment**: If the SingletonFactory needs deployment, the account needs exactly 0.0247 ETH on the target chain. The script will automatically fund the account if needed.

2. **For other contract deployments**: Sufficient funds to cover gas costs for all contract deployments.

## Script Usage

### 1. Deploy SingletonFactory (ERC-2470)

This script deploys the standard ERC-2470 Singleton Factory if not already deployed:

```bash
./scripts/deploySingletonFactory.sh
```

The script:

- Checks if the factory exists at the standard address on each chain
- Funds the dedicated factory deployer address if needed
- Deploys the factory using a pre-signed transaction

**Always run this script first** before other deployments to ensure the Singleton Factory is available.

### 2. MultiDeploy

This script deploys contracts across multiple chains:

```bash
./scripts/MultiDeploy.sh
```

The script:

- Loads chain data from the specified URL or local file
- Deploys contracts on each chain using the `Deploy.s.sol` script
- Saves deployment data to the specified results file

### 3. Deploy.s.sol

This Foundry script handles the actual contract deployments using CREATE2/CREATE3:

- **IntentSource**: Deployed using CREATE2
- **Inbox**: Deployed using CREATE2
- **HyperProver**: Deployed using CREATE3 (if MAILBOX is provided)
- **MetaProver**: Deployed using CREATE3 (if ROUTER is provided)

The script logs all deployed contract addresses and generates verification data.

### 4. VerifyResults.sh

This script verifies all contracts deployed by MultiDeploy.sh on their respective block explorers:

```bash
./scripts/VerifyResults.sh
```

The script:

- Reads deployment data from RESULTS_FILE
- Uses verification API keys from VERIFICATION_KEYS_FILE
- Verifies each contract on the appropriate block explorer
- Supports constructor arguments stored in the deployment data
- Automatically retries failed verifications

## Deployment Process

Follow these steps for a complete deployment:

1. Configure your `.env` file with all required environment variables
2. Create a verification keys file (see `verification-keys-example.json`)
3. Run `./scripts/deploySingletonFactory.sh` to ensure the Singleton Factory is deployed
4. Run `./scripts/MultiDeploy.sh` to deploy all contracts across chains
5. Run `./scripts/VerifyResults.sh` to verify the deployed contracts

## Chain Data JSON Format

The CHAIN_DATA_URL can point to either:

- A remote HTTP URL: `https://raw.githubusercontent.com/eco/eco-chains/refs/heads/main/src/assets/chain.json`
- A local file path: `/path/to/local/chains.json`

The JSON file should have the following structure:

```json
{
  "1": {
    "url": "https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}",
    "mailbox": "0x123...",
    "gasMultiplier": "1.2"
  },
  "10": {
    "url": "https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
    "mailbox": "0x456..."
  }
}
```

Each entry contains:

- Chain ID as the key
- `url`: RPC endpoint (with optional environment variable substitution)
- `mailbox`: Address of the Mailbox contract on this chain (if applicable)
- `gasMultiplier`: Optional gas multiplier for this chain

## Notes

- All deployments use deterministic addresses through CREATE2/CREATE3
- The same SALT value ensures consistent addresses across all environments
- Contract addresses are predictable and can be computed before deployment
- All scripts are idempotent - running them multiple times will not redeploy existing contracts

## Verification Keys Format

The VERIFICATION_KEYS_FILE should contain a JSON object with chain IDs as keys and API keys as values:

```json
{
  "1": "YOUR_ETHERSCAN_API_KEY",
  "10": "YOUR_OPTIMISM_API_KEY",
  "56": "YOUR_BSCSCAN_API_KEY",
  "137": "YOUR_POLYGONSCAN_API_KEY",
  "43114": "YOUR_AVALANCHE_API_KEY",
  "42161": "YOUR_ARBISCAN_API_KEY"
}
```

Each chain requires its own specific API key for the relevant block explorer:

- Chain ID 1: Etherscan API key
- Chain ID 10: Optimism Explorer API key
- Chain ID 56: BscScan API key
- And so on for other chains

You can also provide the verification keys as a JSON string in the VERIFICATION_KEYS environment variable instead of using a file.
