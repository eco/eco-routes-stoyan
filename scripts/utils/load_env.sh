#!/bin/bash

# Function to load environment variables from .env file
# with a preference for existing environment variables
load_env() {
  local env_file="$1"
  
  # Default to .env if no file is specified
  if [ -z "$env_file" ]; then
    env_file=".env"
  fi
  
  # Check if the file exists
  if [ -f "$env_file" ]; then
    # Read the file line by line
    while IFS= read -r line || [ -n "$line" ]; do
      # Skip empty lines and comments
      [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue
      
      # Extract variable name and value
      var_name=$(echo "$line" | cut -d= -f1)
      
      # Only set if not already in environment
      if [ -z "${!var_name}" ]; then
        # Use eval to handle complex variable values properly
        eval "export $line"
      fi
    done < "$env_file"
  fi
}

# Export the function so it can be called from other scripts
export -f load_env