#!/usr/bin/env bash

# load_chain_data.sh
# Utility script to load chain data from URL or local file path
# This function can be sourced and used by other scripts

# Function to load chain data JSON from URL or local file
# Returns the JSON content via stdout
load_chain_data() {
  local data_url="$1"
  local json_data=""
  
  # Ensure URL/path is provided
  if [ -z "$data_url" ]; then
    echo "❌ Error: Chain data URL/path not provided" >&2
    return 1
  fi
  
  # Check if data_url is a local file or remote URL
  if [[ "$data_url" =~ ^https?:// ]]; then
    echo "📥 Loading chain data from URL: $data_url" >&2
    json_data=$(curl -s "$data_url")
    
    if [ $? -ne 0 ]; then
      echo "❌ Error: Failed to fetch data from URL: $data_url" >&2
      return 1
    fi
  else
    # Treat as local file path
    if [ -f "$data_url" ]; then
      echo "📄 Loading chain data from local file: $data_url" >&2
      json_data=$(cat "$data_url")
      
      if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to read local file: $data_url" >&2
        return 1
      fi
    else
      echo "❌ Error: Local file not found at: $data_url" >&2
      return 1
    fi
  fi
  
  # Ensure data is pulled
  if [ -z "$json_data" ]; then
    echo "❌ Error: Could not load chain data from: $data_url" >&2
    return 1
  fi
  
  # Validate JSON format
  if ! echo "$json_data" | jq empty 2>/dev/null; then
    echo "❌ Error: Invalid JSON format in: $data_url" >&2
    return 1
  fi
  
  echo "✅ Chain data loaded successfully" >&2
  echo "$json_data"
  return 0
}

# If this script is being executed directly (not sourced), print usage info
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [ -z "$1" ]; then
    echo "Usage: $0 <chain_data_url>"
    exit 1
  fi
  
  # Call the function with the provided argument and print the result
  json_data=$(load_chain_data "$1")
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    echo "$json_data"
    exit 0
  else
    exit $exit_code
  fi
fi