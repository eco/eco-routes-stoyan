#!/usr/bin/env bash

# Load environment variables from .env safely
if [ -f .env ]; then
    set -a  # Export all variables automatically
    source .env
    set +a
fi


# Get the deployment data from the specified URL
if [ -z "$DEPLOY_DATA_URL" ]; then
    echo "❌ Error: DEPLOY_DATA_URL is not set in .env!"
    exit 1
fi
DEPLOY_JSON=$(curl -s "$DEPLOY_DATA_URL")

# Ensure deploy data is pulled
if [ -z "$DEPLOY_JSON" ]; then
    echo "❌ Error: Could not get deployment data from URL: $DEPLOY_DATA_URL"
    exit 1
fi
echo "Deployment JSON loaded successfully"


PUBLIC_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "Wallet Public Address: $PUBLIC_ADDRESS"

CREATE_X_DEPLOYER_ADDRESS = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'
$CREATE_X_DEPLOYER_ADDRESS
# Process each chain from the JSON data
echo "$DEPLOY_JSON" | jq -c 'to_entries[]' | while IFS= read -r entry; do
    CHAIN_ID=$(echo "$entry" | jq -r '.key')
    value=$(echo "$entry" | jq -c '.value')

    RPC_URL=$(echo "$value" | jq -r '.url')

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

    echo "🔄 Deploying contracts for Chain ID: $CHAIN_ID"

    code=$(cast code $CREATE_X_DEPLOYER_ADDRESS --rpc-url "$RPC_URL")
    if [ "$code" == "0x" ]; then
        echo "❌ Error: CREATE_X_DEPLOYER_ADDRESS not deployed on: $CHAIN_ID"
    fi

    # # IntentSource Deployment 
    # code=$(cast code 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 --rpc-url "$RPC_URL")
    # if [ "$code" == "0x" ]; then
    #     cast send $CREATE_X_DEPLOYER_ADDRESS  --rpc-url "$expanded_url" --private-key "$PRIVATE_KEY"
    # fi

    # # Inbox Deployment
    # code=$(cast code 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 --rpc-url "$RPC_URL")
    # if [ "$code" == "0x" ]; then
    #     cast send $CREATE_X_DEPLOYER_ADDRESS  --rpc-url "$expanded_url" --private-key "$PRIVATE_KEY"
    # fi



    echo "✅ Deployment on Chain ID: $CHAIN_ID completed!"
done