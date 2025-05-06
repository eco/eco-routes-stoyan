# Eco-Routes Deployment Scripts

This README provides instructions for setting up and using the deployment scripts in the eco-routes project.

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

## Deployment Process

Follow these steps for a complete deployment:

1. Configure your `.env` file with all required environment variables
2. Run `./scripts/deploySingletonFactory.sh` to ensure the Singleton Factory is deployed
3. Run `./scripts/MultiDeploy.sh` to deploy all contracts across chains

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