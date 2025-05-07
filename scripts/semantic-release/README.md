# Semantic Release Process

This directory contains the Eco Routes semantic-release system that automates versioning, contract deployment, and package publishing. The system uses a deterministic deployment approach with CREATE3 to ensure contract addresses are consistent across deployments and networks.

## Overview

The semantic-release workflow handles:

1. **Versioning**: Automatically determines the next version number based on conventional commits
2. **Contract deployment**: Deploys contracts to multiple networks with deterministic addresses
3. **Contract verification**: Verifies deployed contracts on block explorers
4. **Package publishing**: Builds and publishes npm packages with TypeScript support

## Lifecycle Hooks

The semantic-release process consists of the following steps:

1. **verifyConditions**: Validates environment variables, package.json, and version compatibility
2. **analyzeCommits**: Determines the next version based on commit messages (built into semantic-release)
3. **version**: Updates version information in Solidity files and package.json
4. **prepare**: Builds the project, deploys contracts, and prepares the package for publishing
5. **publish**: Publishes the built package to npm

## GitHub Actions Integration

The semantic-release process is integrated with GitHub Actions in the repository. When a PR is merged to the main branch, the workflow automatically:

1. Builds and tests the project
2. Determines the next version
3. Deploys contracts to specified networks
4. Publishes the package to npm

### GitHub Actions Workflow

The workflow is defined in `.github/workflows/release.yml` and runs when:
- A PR is merged to the main branch
- The workflow is manually triggered

Required GitHub repository secrets:
- `NPM_TOKEN`: For publishing to npm
- `PRIVATE_KEY`: Deployer wallet private key
- `ALCHEMY_API_KEY`: Used for contract deployment and verification
- `VERIFICATION_KEYS`: API keys for etherscan verification

## Testing Locally

You can test the semantic-release process locally without actually publishing or deploying contracts using the provided scripts.

### Setup

1. Create a `.env` file in the project root with the following variables:
   ```
   PRIVATE_KEY=your_private_key
   ALCHEMY_API_KEY=your_alchemy_api_key
   NPM_TOKEN=your_npm_token
   ```

2. Make sure your working directory is clean (no uncommitted changes)

### Local Testing Command

```bash
# Test the publishing process (dry run)
yarn semantic:pub
```

To actually publish during local testing (USE WITH CAUTION):
```bash
NOT_DRY_RUN=true yarn semantic:pub
```

## Directory Structure

- `assets/`: Utility files that get bundled with the package
- `tests/`: Unit tests for the semantic-release functions
- `constants.ts`: Shared constants and path utilities
- `deploy-contracts.ts`: Handles deployment of contracts to networks
- `eco-routes-local.ts`: Local testing script for the full process
- `helpers.ts`: Shared utility functions
- `index.ts`: Main entry point for semantic-release
- `solidity-version-updater.ts`: Updates version strings in Solidity files
- `sr-build-package.ts`: Builds the package for distribution
- `sr-prepare.ts`: Prepare step in the semantic-release lifecycle
- `sr-publish.ts`: Publishes the package to npm
- `sr-verify-conditions.ts`: Validates conditions for a release
- `sr-version.ts`: Updates version information
- `verify-contracts.ts`: Handles verification of contracts on block explorers. This module:
  - Reads deployment results from the deployment step
  - Obtains verification API keys from environment variables or local file
  - Runs the verification script with appropriate parameters
  - Handles potential verification failures gracefully (non-blocking for releases)
  - Warns about large numbers of contracts that might cause timeouts

## Deterministic Deployments

The system uses deterministic deployment with CREATE2/CREATE3 to ensure that contracts deployed with the same salt have the same address across different deployments and networks. This is critical for cross-chain protocols.

### Salt Generation and Addressing

The salt is derived from the package version, providing several benefits:
- Production and pre-production contracts have different but predictable addresses
- Patch versions maintain the same contract addresses as their minor versions (e.g., 1.2.0, 1.2.1, and 1.2.2 all deploy to the same addresses)
- Contract addresses are consistent across all EVM-compatible chains

### Deployment Process in Detail

1. **Salt Computation**:
   ```typescript
   // For production
   const rootSalt = keccak256(toHex(`${major}.${minor}`))
   
   // For pre-production
   const preprodRootSalt = keccak256(toHex(`${major}.${minor}-preprod`))
   ```

2. **Bytecode Generation and Constructor Arguments**:
   - The system generates deployment bytecode with properly encoded constructor arguments
   - This bytecode is combined with the salt to predict contract addresses
   - The `gen-bytecode.ts` script handles creation of all necessary deployment data

3. **Contract Deployment Execution**:
   - The `deploy.sh` script is called with the appropriate environment variables
   - It uses CREATE2/CREATE3 factory contracts to deploy with deterministic addresses
   - Results are stored in CSV format with headers: `Environment,ChainID,[Contract Names...]`

4. **Chain ID Determination**:
   - Chain IDs are fetched from a remote configuration URL using fetch API
   - This allows easy addition of new chains without code changes
   - The system falls back to environment variables if the fetch fails

5. **Verification Data Generation**:
   - Constructor arguments are properly encoded for each contract
   - Verification data follows the format required by block explorer APIs
   - The system handles the unique requirements of each verification service

### Technical Implementation Details

The deployment pipeline uses modern async/await patterns for all asynchronous operations:

- HTTP requests use native fetch API
- Process execution uses promisified spawn calls
- All deployment steps follow proper error handling patterns

Example of deterministic deployment transaction:

```solidity
// Inside Deploy.s.sol
function createDeterministicAddress(bytes32 salt, bytes memory bytecode) internal returns (address) {
    bytes memory deploymentData = abi.encodePacked(
        bytes1(0xff),
        CREATE2_DEPLOYER_ADDRESS,
        salt,
        keccak256(bytecode)
    );
    return address(uint160(uint256(keccak256(deploymentData))));
}
```

## Version Control

The system follows semantic versioning principles:
- **Major**: Breaking changes
- **Minor**: New features, non-breaking changes
- **Patch**: Bug fixes and minor improvements

When a new version is released:
1. Contract versions are updated in Solidity files
2. Package.json is updated with the new version
3. Contract addresses are included in the published package

## Troubleshooting

### Common Issues

1. **Missing environment variables**: 
   - Ensure all required environment variables are set
   - Check for spaces in JSON-formatted environment variables like VERIFICATION_KEYS

2. **Authentication errors**: 
   - Make sure your NPM_TOKEN is valid and has publish rights
   - For verification issues, verify your block explorer API keys are valid

3. **Deployment failures**:
   - Check network connectivity and gas prices
   - Ensure your deployer account has sufficient funds on all target chains
   - Verify the bytecode deployment file was generated correctly

4. **Verification failures**:
   - Block explorers may have rate limits - check the response codes
   - Ensure constructor arguments are properly encoded
   - Some networks might have delays before verification is possible

5. **Address mismatch issues**:
   - If addresses don't match expectations, check the salt calculation
   - Confirm bytecode is identical (no subtle changes in contracts)
   - Verify the CREATE2/CREATE3 factory address is correct for the network

6. **Chain ID fetch failures**:
   - If network requests fail, check connectivity to the deployment URL
   - Set CHAIN_IDS environment variable as fallback: `CHAIN_IDS=10,8453,42161`

### Debugging

For more detailed logs during local testing:
```bash
DEBUG=true yarn semantic:local
```

To inspect the deployment bytecode before deploying:
```bash
cat build/bytecode_deployment.json | jq
```

To validate verification data before submitting:
```bash
cat out/verify-data.txt
```

### Running Individual Components

You can run individual components of the deployment process:

```bash
# Generate bytecode only
yarn genBytecode

# Deploy contracts only
yarn deploy:plugin

# Verify contracts only (after deployment)
yarn run tsx scripts/semantic-release/verify-contracts.ts
```

## References

- [Semantic Release Documentation](https://semantic-release.gitbook.io/semantic-release/)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [CREATE3 Deployment Explanation](https://github.com/0xsequence/create3)