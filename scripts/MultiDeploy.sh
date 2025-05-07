#!/bin/bash

# Load environment variables from .env safely
if [ -f .env ]; then
    set -a  # Export all variables automatically
    source .env
    set +a
fi

# Load the chain data utility function
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils/load_chain_data.sh"

# Ensure RESULTS_FILE is set
if [ -z "$RESULTS_FILE" ]; then
    echo "❌ Error: RESULTS_FILE is not set in .env!"
    exit 1
fi

# Ensure CHAIN_DATA_URL is set
if [ -z "$CHAIN_DATA_URL" ]; then
    echo "❌ Error: CHAIN_DATA_URL is not set in .env!"
    exit 1
fi

# Load the chain data using the utility function
DEPLOY_JSON=$(load_chain_data "$CHAIN_DATA_URL")
if [ $? -ne 0 ]; then
    # Error messages are already displayed by the function
    exit 1
fi

# Only remove the results file if we're not in append mode
if [ -z "$APPEND_RESULTS" ] || [ "$APPEND_RESULTS" != "true" ]; then
    # Remove existing deploy file before starting
    if [ -f "$RESULTS_FILE" ]; then
        echo "🗑️  Deleting previous deploy file: $RESULTS_FILE"
        rm "$RESULTS_FILE"
        touch "$RESULTS_FILE"
    fi
else
    echo "📝 Appending to existing results file: $RESULTS_FILE"
    # Create the file if it doesn't exist yet
    if [ ! -f "$RESULTS_FILE" ]; then
        touch "$RESULTS_FILE"
    fi
fi

PUBLIC_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "Wallet Public Address: $PUBLIC_ADDRESS"
# Process each chain from the JSON data
echo "$DEPLOY_JSON" | jq -c 'to_entries[]' | while IFS= read -r entry; do
    CHAIN_ID=$(echo "$entry" | jq -r '.key')
    value=$(echo "$entry" | jq -c '.value')

    RPC_URL=$(echo "$value" | jq -r '.url')
    MAILBOX_CONTRACT=$(echo "$value" | jq -r '.mailbox')
    GAS_MULTIPLIER=$(echo "$value" | jq -r '.gasMultiplier // ""')

    if [[ "$RPC_URL" == "null" || -z "$RPC_URL" || "$MAILBOX_CONTRACT" == "null" || -z "$MAILBOX_CONTRACT" ]]; then
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
    echo "📬 Mailbox Contract: $MAILBOX_CONTRACT"

    # Construct Foundry command
    FOUNDRY_CMD="MAILBOX=\"$MAILBOX_CONTRACT\" SALT=\"$SALT\" DEPLOY_FILE=\"$RESULTS_FILE\" forge script scripts/Deploy.s.sol \
            --rpc-url \"$RPC_URL\" \
            --slow \
            --broadcast \
            --private-key \"$PRIVATE_KEY\""

    # Only add --gas-estimate-multiplier if GAS_MULTIPLIER is defined and not empty
    if [[ -n "$GAS_MULTIPLIER" && "$GAS_MULTIPLIER" != "null" ]]; then
        echo "⛽ Gas Multiplier: $GAS_MULTIPLIER x"
        FOUNDRY_CMD+=" --gas-estimate-multiplier \"$GAS_MULTIPLIER\""
    fi

    # Run the command
    eval $FOUNDRY_CMD

    echo "✅ Deployment on Chain ID: $CHAIN_ID completed!"
done