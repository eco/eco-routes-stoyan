#!/bin/bash

# Load environment variables from .env safely
if [ -f .env ]; then
    set -a  # Export all variables automatically
    source .env
    set +a
fi

# Function to compute CREATE2 address and check if contract is already deployed
check_create2_deployed() {
    local createX_deployer=$1
    local salt=$2
    local initCodeHash=$3
    local rpc_url=$4
    local contract_name=$5

    # Call the CreateX deployer to compute the deterministic address
    # Using computeCreate2Address function as per https://github.com/pcaversaccio/createx
    echo "🧮 Computing CREATE2 address for $contract_name..."
    local predicted_address=$(cast call "$createX_deployer" "computeCreate2Address(bytes32,bytes32)(address)" "$salt" "$initCodeHash" --rpc-url "$rpc_url")

    if [ $? -ne 0 ]; then
        echo "⚠️ Failed to compute CREATE3 address. The deployer might not support this function."
        return 1
    fi
    
    echo "🔍 Predicted address: $predicted_address"
    
    # Check if there's already code deployed at this address
    # local code_size=$(cast code "$predicted_address" --rpc-url "$rpc_url" | wc -c)
    local code=$(cast code "$predicted_address" --rpc-url "$rpc_url" )
    # echo "📏 Code size at $predicted_address: $code_size "
    # If code length is more than 2 (which would be just "0x"), then there's code at the address
    if [ "$code" == "0x" ]; then
        echo "🆕 No contract found at $predicted_address. Need to deploy."
        return 1
    else
        echo "✅ Contract already deployed at $predicted_address"
        return 0
    fi
}

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY is not set in environment variables!"
    exit 1
fi

# Get the deployment data URL from the same source as MultiDeploy.sh
DEPLOY_DATA_URL="https://raw.githubusercontent.com/eco/eco-chains/refs/heads/ED-5079-auto-deploy/t.json"
if [ -z "$DEPLOY_DATA_URL" ]; then
    echo "❌ Error: DEPLOY_DATA_URL is not set!"
    exit 1
fi

# Path to the bytecode file
BYTECODE_FILE="./build/deployBytecode.json"
if [ ! -f "$BYTECODE_FILE" ]; then
    echo "❌ Error: Bytecode file not found at $BYTECODE_FILE"
    exit 1
fi

# Get the deployment data from the URL for RPC endpoints
echo "📥 Fetching deployment data from $DEPLOY_DATA_URL..."
DEPLOY_JSON=$(curl -s "$DEPLOY_DATA_URL")

# Ensure deploy data is pulled
if [ -z "$DEPLOY_JSON" ]; then
    echo "❌ Error: Could not get deployment data from URL: $DEPLOY_DATA_URL"
    exit 1
fi
echo "✅ Deployment data loaded successfully"

# Get the wallet address
PUBLIC_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "👛 Wallet Public Address: $PUBLIC_ADDRESS"

# Get root level keys from deployBytecode.json (these are environment names like "default", "production", etc.)
ROOT_KEYS=$(jq -r 'keys[]' "$BYTECODE_FILE")

# Loop through each environment in the bytecode file
for ENV_KEY in $ROOT_KEYS; do
    echo "🔄 Processing environment: $ENV_KEY"
    
    # Get contract list for this environment
    CONTRACT_KEYS=$(jq -r ".[\"$ENV_KEY\"].contracts | keys[]" "$BYTECODE_FILE")
    echo "📜 Contracts to deploy: $CONTRACT_KEYS"

     # Extract the CREATE3 Deployer address from the bytecode file                                                                                 
      CREATEX_DEPLOYER_ADDRESS=$(jq -r ".[\"$ENV_KEY\"].createXDeployerAddress" "$BYTECODE_FILE")                                            
      if [[ "$CREATEX_DEPLOYER_ADDRESS" == "null" || -z "$CREATEX_DEPLOYER_ADDRESS" ]]; then                                                 
          echo "❌ Error: No createXDeployerAddress found for environment $ENV_KEY. Using default deployment method."                      
          exit 1
      fi

       SALT=$(jq -r ".[\"$ENV_KEY\"].salt" "$BYTECODE_FILE")
            if [[ "$SALT" == "null" || -z "$SALT" ]]; then
                echo "❌ Error: Salt not set for contract $CONTRACT_NAME"
                exit 1
            fi
            echo "🔑 Using salt: $SALT"

    # Process each chain from the deployment JSON data
    echo "$DEPLOY_JSON" | jq -c 'to_entries[]' | while IFS= read -r entry; do
        CHAIN_ID=$(echo "$entry" | jq -r '.key')
        value=$(echo "$entry" | jq -c '.value')
        
        RPC_URL=$(echo "$value" | jq -r '.url')
        GAS_MULTIPLIER=$(echo "$value" | jq -r '.gasMultiplier // ""')

        if [[ "$RPC_URL" == "null" || -z "$RPC_URL" ]]; then
            echo "⚠️  Warning: Missing required data for Chain ID $CHAIN_ID. Skipping..."
            continue
        fi
        
        # Replace environment variable placeholders if necessary
        RPC_URL=$(eval echo "$RPC_URL")
        
        # Check for API keys in URL
        if [[ "$RPC_URL" == *"${ALCHEMY_API_KEY}"* && -z "$ALCHEMY_API_KEY" ]]; then
            echo "❌ Error: ALCHEMY_API_KEY is required but not set."
            exit 1
        fi
        
        echo "🌐 Deploying contracts to Chain ID: $CHAIN_ID with RPC: $RPC_URL"
        
        # Loop through each contract and deploy using cast
        for CONTRACT_NAME in $CONTRACT_KEYS; do
            echo "📝 Deploying contract: $CONTRACT_NAME"
            
            # Extract bytecode for this contract
            BYTECODE=$(jq -r ".[\"$ENV_KEY\"].contracts[\"$CONTRACT_NAME\"].deployBytecode" "$BYTECODE_FILE")
            
            # Skip if bytecode is empty or null
            if [[ "$BYTECODE" == "null" || -z "$BYTECODE" ]]; then
                echo "⚠️ Warning: No bytecode found for $CONTRACT_NAME. Skipping..."
                continue
            fi

            INIT_CODE_HASH=$(jq -r ".[\"$ENV_KEY\"].contracts[\"$CONTRACT_NAME\"].initCodeHash" "$BYTECODE_FILE")
            if [[ "$INIT_CODE_HASH" == "null" || -z "$INIT_CODE_HASH" ]]; then
                echo "❌ Error: initCodeHash not set for contract $CONTRACT_NAME"
                exit 1
            fi

            # Check if contract is already deployed using CREATE3
            if check_create2_deployed "$CREATEX_DEPLOYER_ADDRESS" "$SALT" "$INIT_CODE_HASH" "$RPC_URL" "$CONTRACT_NAME"; then
                    echo " ⏭️ Skipping deployment for $CONTRACT_NAME as it's already deployed"
                    continue
            fi
            # Deploy using cast
            echo "🚀 Deploying $CONTRACT_NAME to chain $CHAIN_ID..."
            TEMP_BYTECODE_FILE=$(mktemp)
            echo "$BYTECODE" > "$TEMP_BYTECODE_FILE"
            # Deploy using cast with bytecode from file
            FOUNDRY_CMD="cast send \"$CREATEX_DEPLOYER_ADDRESS\" \"$(cat $TEMP_BYTECODE_FILE)\" --private-key \"$PRIVATE_KEY\" --rpc-url \"$RPC_URL\"" 
            echo "Executing command: FOUNDRY_CMD"
            echo $FOUNDRY_CMD
            DEPLOY_EXIT_CODE=$?
            # Clean up temp file                                                                                                                  │ │
            rm "$TEMP_BYTECODE_FILE"  
            
            if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
                # Extract the contract address from the result
                CONTRACT_ADDR=$(echo "$RESULT" | grep -oE "Deployed to: (0x[a-fA-F0-9]{40})" | cut -d' ' -f3)
                echo "✅ $CONTRACT_NAME deployed to: $CONTRACT_ADDR on chain $CHAIN_ID"
                
                # Save these addresses to a file for reference
                echo "$ENV_KEY,$CHAIN_ID,$CONTRACT_NAME,$CONTRACT_ADDR" >> deploy_results.csv
            else
                echo "❌ Failed to deploy $CONTRACT_NAME to chain $CHAIN_ID"
            fi
        done
        
        echo "✅ Deployment on Chain ID: $CHAIN_ID completed!"
    done
done

echo "🎉 All deployments completed!"
echo "📋 Deployment results saved to deploy_results.csv"