#!/usr/bin/env bash

# Script to check and deploy the SingletonFactory (ERC-2470)
# This script checks if a contract exists at the standard ERC-2470 address
# and deploys it if not present

set -e

# Standard ERC-2470 Singleton Factory address
SINGLETON_FACTORY_ADDRESS="0xce0042B868300000d44A59004Da54A005ffdcf9f"

# Signed transaction to deploy the factory - this is the exact same for all chains
# Source: https://github.com/ethereum/ercs/blob/master/ERCS/erc-2470.md
SIGNED_TRANSACTION="0xf9016c8085174876e8008303c4d88080b90154608060405234801561001057600080fd5b50610134806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634af63f0214602d575b600080fd5b60cf60048036036040811015604157600080fd5b810190602081018135640100000000811115605b57600080fd5b820383602082011115606c57600080fd5b80359060200191846001830284011164010000000083111715608d57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550509135925060eb915050565b604080516001600160a01b039092168252519081900360200190f35b6000818351602085016000f5939250505056fea26469706673582212206b44f8a82cb6b156bfcc3dc6aadd6df4eefd204bc928a4397fd15dacf6d5320564736f6c634300060200331b83247000822470"

# Get the current RPC endpoint
if [ -z "$RPC_URL" ]; then
  if [ -n "$MAINNET_RPC_URL" ]; then
    RPC_URL=$MAINNET_RPC_URL
  elif [ -n "$TESTNET_RPC_URL" ]; then
    RPC_URL=$TESTNET_RPC_URL
  else
    echo "Error: No RPC URL specified. Please set the RPC_URL environment variable."
    exit 1
  fi
fi

echo "Using RPC URL: $RPC_URL"

# Check if we have jq installed
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed. Please install jq."
  exit 1
fi

# Function to check if the contract is deployed
check_contract_deployed() {
  local code=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["'"$SINGLETON_FACTORY_ADDRESS"'", "latest"],"id":1}' -H "Content-Type: application/json" $RPC_URL | jq -r '.result')
  
  if [[ "$code" == "0x" ]]; then
    echo "No contract deployed at $SINGLETON_FACTORY_ADDRESS"
    return 1
  else
    echo "Contract already deployed at $SINGLETON_FACTORY_ADDRESS"
    return 0
  fi
}

# Function to deploy the contract
deploy_singleton_factory() {
  echo "Deploying SingletonFactory (ERC-2470)..."
  
  # Send the signed transaction
  local tx_hash=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["'"$SIGNED_TRANSACTION"'"],"id":1}' -H "Content-Type: application/json" $RPC_URL | jq -r '.result')
  
  if [[ "$tx_hash" == "null" ]]; then
    local error=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["'"$SIGNED_TRANSACTION"'"],"id":1}' -H "Content-Type: application/json" $RPC_URL | jq -r '.error.message')
    echo "Error deploying contract: $error"
    return 1
  fi
  
  echo "Transaction sent: $tx_hash"
  echo "Waiting for transaction to be mined..."
  
  # Wait for transaction to be mined
  local receipt=""
  local attempts=0
  while [ -z "$receipt" ] || [ "$receipt" == "null" ]; do
    sleep 2
    ((attempts++))
    echo "Checking transaction receipt (attempt $attempts)..."
    receipt=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["'"$tx_hash"'"],"id":1}' -H "Content-Type: application/json" $RPC_URL | jq -r '.result')
    
    if [ $attempts -gt 30 ]; then
      echo "Timeout waiting for transaction to be mined."
      return 1
    fi
  done
  
  # Get the status of the transaction
  local status=$(echo $receipt | jq -r '.status')
  if [[ "$status" == "0x1" ]]; then
    echo "SingletonFactory successfully deployed!"
    return 0
  else
    echo "Transaction failed with status: $status"
    return 1
  fi
}

# Main execution flow
echo "Checking if SingletonFactory is already deployed..."
if ! check_contract_deployed; then
  echo "SingletonFactory not found. Deploying..."
  if deploy_singleton_factory; then
    echo "Verifying deployment..."
    if check_contract_deployed; then
      echo "✅ SingletonFactory successfully deployed and verified at $SINGLETON_FACTORY_ADDRESS"
    else
      echo "❌ Deployment verification failed. Contract not found at expected address."
      exit 1
    fi
  else
    echo "❌ Failed to deploy SingletonFactory."
    exit 1
  fi
else
  echo "✅ SingletonFactory already deployed at $SINGLETON_FACTORY_ADDRESS"
fi

echo "Done!"