<div id="top"></div>
<h1>Eco Routes</h1>

</div>

- [Abstract](#Abstract)
- [Components](#Components)
- [Usage](#usage)
  - [Installation](#installation)
  - [Testing](#testing)
  - [Deployment](#deployment)
  - [End-to-End Testing](#end-to-end-testing)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Abstract

An intents-driven, permissionless, trust-neutral protocol for facilitating the creation, incentivized execution, and proof of cross-L2 transactions.

- [Intent Publishing](#intent-publishing)
- [Intent Funding](#intent-funding)
- [Intent Fulfillment](#intent-fulfillment)
- [Intent Proving](#intent-proving)
- [Reward Settlement](#intent-reward-settlement)

We identify three main user profiles:

- `Users`: Individuals who want to transact across different L2s.
- `Solvers`: Individuals interested in performing transactions on behalf of others for a fee.
- `Provers`: Individuals interested in proving on the source chain that an intent was fulfilled on the destination chain.

### How it works

A `User` wants to initiate a cross-chain transaction by creating an intent. Put simply, an intent represents a `User`'s end goals on the destination chain. It contains the calls they'd want to make, those calls' corresponding addresses, the resources a `Solver` would need to perform those calls, and the rewards the `User` would be willing to pay a `Solver` to execute this call on their behalf, along with other metadata. A `User` can publish this directly on our system or otherwise disseminate that information to a `Solver`. A `User` also must fund this intent - escrow the reward tokens corresponding to the intent. A `Solver`, upon seeing this intent and determining based on the inputs and outputs that it is profitable and ensuring that the `User` has funded the intent, marshalls the required resources and fulfills the intent transaction on the destination chain that corresponds to the user's intent, storing the fulfilled intent's hash on the destination chain. A `Prover` - perhaps the `Solver` themselves or a service they subscribe to - sees this fulfillment transaction and performs a proof that the hash of the fulfilled transaction on the destination chain matches that of the intent on the source chain. After the intent is marked as proven,the `Solver` can withdraw their reward.

We also implement ERC-7683 and enable the creation and fulfillment of intents in our system via that interface.

## Components

Within the following sections, the terms 'source chain' and 'destination chain' will be relative to any given intent. Each supported chain will have its own `IntentSource`, `Inbox` and a set of `Prover`s.

### Intent Publishing

The `IntentSource` contract provides functionality for publishing intents. Intents can be published in this way on any chain, regardless of where the input and output tokens live. An intent need not be published via the `IntentSource` at all - a user can disseminate intent information directly to solvers if they so choose.

### Intent Funding

A funded intent effectively has its reward tokens stored in a `Vault`. An intent can be funded on the `IntentSource` contract during publishing, after the fact via permit2 signatures, or a user may directly transfer tokens to the `Vault`.

### Intent Fulfillment

Intent fulfillment happens on the `Inbox`, which lives on the destination chain. Solvers approve the `Inbox` to pull the required tokens and then call upon the `Inbox` to fulfill the intent. Fulfillment may also trigger some proving-related post-processing, for example relaying a message indicating fulfillment back to the source chain.

### Intent Proving

Intent proving lives on `Prover` contracts, which are on the source chain. `Prover`s are effectively the source chain's oracle for whether an intent was fulfilled on the destination chain. A User chooses ahead of time which `Prover` their intent will query for fulfillment status. There are currently two types of provers: StorageProvers (`Prover.sol`), which use storage proofs to verify the fulfillment of an intent, and HyperProvers(`HyperProver.sol`), which utilize a <a href="https://hyperlane.xyz/" target="_blank">Hyperlane</a> bridge in verifying intent fulfillment.

### Intent Reward Settlement

Intent reward settlement occurs on the `IntentSource` on the destination chain. The withdrawal flow checks that an intent has been fulfilled on the `Prover` and then transfers reward tokens to the address provided by the solver. In the event that an intent was not fulfilled before the deadline, the user can trigger a refund of their reward tokens through the same flow. Other edge cases like overfunding an intent are also handled by the `IntentSource`.

### ERC-7683

Eco's implementation of ERC-7683 allows users to create and fulfill intents on Eco's ecosystem through ERC-7683's rails. `EcoERC7683OriginSettler` is the entrypoint to our system, while `EcoERC7683DestinationSettler` is where they are fulfilled. While `EcoERC7683OriginSettler` is a separate contract, `EcoERC7683DestinationSettler` is an abstract contract inherited by Eco's `Inbox`.

## Contract Addresses

| **Mainnet Chains** | IntentSource                               | Inbox                                      | StorageProver                              | HyperProver                                |
| :----------------- | :----------------------------------------- | :----------------------------------------- | :----------------------------------------- | :----------------------------------------- |
| Optimism           | 0xa6B316239015DFceAC5bc9c19092A9B6f59ed905 | 0xfB853672cE99D9ff0a7DE444bEE1FB2C212D65c0 | 0xE00c8FD8b50Fed6b652A5cC66c1d0C090fde037f | 0xAfD3029f582455ed0f06F22AcD916B27bc9b3a55 |
| Base               | 0xa6B316239015DFceAC5bc9c19092A9B6f59ed905 | 0xfB853672cE99D9ff0a7DE444bEE1FB2C212D65c0 | 0xE00c8FD8b50Fed6b652A5cC66c1d0C090fde037f | 0xc8E7060Cd790A030164aCbE2Bd125A6c06C06f69 |
| Mantle             | 0xa6B316239015DFceAC5bc9c19092A9B6f59ed905 | 0xfB853672cE99D9ff0a7DE444bEE1FB2C212D65c0 | 0xE00c8FD8b50Fed6b652A5cC66c1d0C090fde037f | 0xaf034DD5eaeBB49Dc476402C6650e85Cc22a0f1a |
| Arbitrum           | 0xa6B316239015DFceAC5bc9c19092A9B6f59ed905 | 0xfB853672cE99D9ff0a7DE444bEE1FB2C212D65c0 | WIP                                        | 0xB1017F865c6306319C65266158979278F7f50118 |

| **Testnet Chains** | IntentSource                               | Inbox                                      | StorageProver                              | HyperProver                                |
| :----------------- | :----------------------------------------- | :----------------------------------------- | :----------------------------------------- | :----------------------------------------- |
| OptimismSepolia    | 0x734a3d5a8D691d9b911674E682De5f06517c79ec | 0xB73fD43C293b250Cb354c4631292A318248FB33E | 0xDcbe9977821a2565a153b5c3622a999F7BeDcdD9 | 0x39cBD6e1C0E6a30dF33428a54Ac3940cF33B23D6 |
| BaseSepolia        | 0x734a3d5a8D691d9b911674E682De5f06517c79ec | 0xB73fD43C293b250Cb354c4631292A318248FB33E | 0xDcbe9977821a2565a153b5c3622a999F7BeDcdD9 | 0x39cBD6e1C0E6a30dF33428a54Ac3940cF33B23D6 |
| MantleSepolia      | 0x734a3d5a8D691d9b911674E682De5f06517c79ec | 0xB73fD43C293b250Cb354c4631292A318248FB33E | 0xDcbe9977821a2565a153b5c3622a999F7BeDcdD9 | WIP                                        |
| ArbitrumSepolia    | 0x734a3d5a8D691d9b911674E682De5f06517c79ec | 0xB73fD43C293b250Cb354c4631292A318248FB33E | WIP                                        | 0x6D6556B3a199cbbdcFE4E7Ba3FA6330D066A31a9 |

## Future Work

Fully-operational end-to-end tests are currently under development. We are also working on services for streamlining and batching prover and solver functionalities. Additionally, we intend to build out support for additional chains.

## Usage

To get a local copy up and running follow these simple steps.

### Prerequisites

Running this project locally requires the following:

- [NodeJS v18.20.3](https://nodejs.org/en/blog/release/v18.20.3) - using nvm (instructions below)
- [Yarn v1.22.19](https://www.npmjs.com/package/yarn/v/1.22.19)

It is recommended to use `nvm` to install Node. This is a Node version manager so your computer can easily handle multiple versions of Node:

1. Install `nvm` using the following command in your terminal:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
```

2. If you're not on an M1 Mac, skip to step 3. For Node < v15, `nvm` will need to be run in a Rosetta terminal since those versions are not supported by the M1 chip for installation. To do that, in the terminal simply run either:

If running bash:

```sh
arch -x86_64 bash
```

If running zsh:

```sh
arch -x86_64 zsh
```

More information about this can be found in [this thread](https://github.com/nvm-sh/nvm/issues/2350).

3. Install our Node version using the following command:

```sh
nvm install v18.20.3
```

4. Once the installation is complete you can use it by running:

```bash
nvm use v18.20.3
```

You should see it as the active Node version by running:

```bash
nvm ls
```

### Installation

1. Clone the repo

```bash
 git clone git@github.com:the-eco-foundation/eco-routes.git
```

2. Install and build using yarn

```bash
 yarn install
```

```bash
 yarn build
```

### Lint

```bash
yarn lint
```

### Testing

```bash
# tests
$ yarn  test

# test coverage
$ yarn coverage
```

### Deployment

Eco Routes uses a sophisticated deployment system that ensures deterministic addresses across multiple blockchains, automated verification, and semantic versioning.

#### Deployment System Architecture

The deployment system consists of several interconnected components:

1. **Semantic Release Pipeline**: Handles versioning, deployment, verification, and publishing.
2. **Deterministic Deployment**: Uses CREATE2/CREATE3 for predictable contract addresses across networks.
3. **Multi-Chain Deployment**: Deploys contracts to multiple EVM chains in one operation.
4. **Contract Verification**: Automatically verifies deployed contracts on block explorers.
5. **Package Publishing**: Builds and publishes npm packages with contract artifacts and TypeScript types.

#### Setting Up the Deployment Environment

1. **Required Environment Variables**:

   ```bash
   # Required for deployment
   PRIVATE_KEY=0x...                # Deployer wallet private key
   ALCHEMY_API_KEY=...              # API key for Alchemy RPC endpoints
   
   # For contract verification
   CONTRACT_VERIFICATION_KEYS={"10":"your_api_key","8453":"your_api_key",...}
   
   # For publishing (CI environment)
   NPM_TOKEN=...                    # NPM token with publish rights
   
   # Optional overrides
   SALT=0x...                       # Override the default version-based salt
   RESULTS_FILE=./path/to/file.csv  # Custom path for deployment results
   DEPLOY_DATA_URL=https://...      # Custom URL for deployment chain configuration
   ```

2. **Installation**:

   ```bash
   yarn install
   yarn build
   ```

#### Deployment Process

The deployment process follows these steps:

1. **Version Determination**:
   - Based on semantic versioning from git commits
   - Updates Solidity files with new version strings

2. **Bytecode Generation**:
   ```bash
   yarn genBytecode
   ```
   - Generates deployment bytecode with constructor arguments
   - Creates verification templates
   - Fetches target chain IDs from deployment configuration

3. **Contract Deployment**:
   ```bash
   yarn deploy:plugin
   ```
   - Deploys contracts to all configured chains
   - Uses deterministic CREATE2/CREATE3 deployment
   - Records addresses in deployment results CSV

4. **Contract Verification**:
   - Automatically verifies contracts on block explorers
   - Formats constructor arguments correctly
   - Handles verification API limitations and retries

#### Deterministic Deployment with Salts

The system uses CREATE2/CREATE3 for deterministic deployments:

- **Salt Generation**: Derived from semantic version (e.g., `1.2.0`)
- **Address Prediction**: Same contract + same version = same address across all chains
- **Environment Support**: Separate salts for production and pre-production environments
- **Deduplication**: Skips deployment if a contract is already deployed at the expected address

#### Running a Deployment

For local development and testing:

```bash
# Generate deployment bytecode and verification templates
yarn genBytecode

# Deploy to specified chains
yarn deploy:plugin

# Complete semantic-release process (deployment + verification + publishing)
yarn semantic:pub
```

For CI/CD pipeline, deployments are triggered by commits to designated branches based on semantic versioning rules.

#### Extending Deployment Support

To add support for new chains:

1. Update the deployment data URL with new chain IDs
2. Add verification API keys for new chains
3. Test deployment on new chains with the pre-production environment first

For automated deployments and package publishing, we use semantic-release. Detailed documentation on the semantic-release process is available in the [semantic-release README](./scripts/semantic-release/README.md).

### End-To-End Testing

This section is under development. While the tests are not yet operational, the scripts are available in the `scripts` directory

## Contributing

1. Fork the Project
2. Create your Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- LICENSE -->

## License

[MIT License](./LICENSE)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/eco/eco-routes](https://github.com/eco/eco-routes)

<p align="right">(<a href="#top">back to top</a>)</p>
