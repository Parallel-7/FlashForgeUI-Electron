#!/bin/bash
# gemini_helper.sh - Common gemini-cli operations with error handling
#
# Usage:
#   source gemini_helper.sh
#   gemini_query "Your prompt" [model] [max_retries]
#   gemini_analyze_file "file.py" "Find bugs"
#   gemini_batch_process "./src" "*.py" "Review code"

# Default models
GEMINI_DEFAULT_MODEL="${GEMINI_DEFAULT_MODEL:-gemini-3-flash-preview}"
GEMINI_ADVANCED_MODEL="${GEMINI_ADVANCED_MODEL:-gemini-3-pro-preview}"
GEMINI_FAST_MODEL="${GEMINI_FAST_MODEL:-gemini-2.5-flash}"
GEMINI_LITE_MODEL="${GEMINI_LITE_MODEL:-gemini-2.5-flash-lite}"

# Fallback chain for rate limits
GEMINI_FALLBACK_CHAIN=("$GEMINI_DEFAULT_MODEL" "$GEMINI_FAST_MODEL" "$GEMINI_LITE_MODEL")

# Query with automatic retry and fallback
gemini_query() {
  local prompt="$1"
  local model="${2:-$GEMINI_DEFAULT_MODEL}"
  local max_retries="${3:-3}"
  local retry_delay=5
  
  local attempt=0
  local result
  
  while [ $attempt -lt $max_retries ]; do
    ((attempt++))
    
    result=$(gemini -p "$prompt" -m "$model" --output-format json 2>&1)
    
    # Check for errors
    if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
      local error_type=$(echo "$result" | jq -r '.error.type // "Unknown"')
      local error_msg=$(echo "$result" | jq -r '.error.message // "No message"')
      
      echo "[gemini_query] Attempt $attempt failed: $error_type" >&2
      
      # Handle rate limits with fallback
      if [[ "$error_type" == *"RateLimit"* ]] || [[ "$error_type" == *"429"* ]]; then
        # Try next model in fallback chain
        for fallback in "${GEMINI_FALLBACK_CHAIN[@]}"; do
          if [ "$fallback" != "$model" ]; then
            echo "[gemini_query] Trying fallback model: $fallback" >&2
            model="$fallback"
            break
          fi
        done
        sleep "$retry_delay"
        continue
      fi
      
      # Other retryable errors
      if [ $attempt -lt $max_retries ]; then
        sleep "$retry_delay"
        continue
      fi
      
      return 1
    fi
    
    # Success - return response
    echo "$result" | jq -r '.response'
    return 0
  done
  
  echo "[gemini_query] Max retries exceeded" >&2
  return 1
}

# Query returning full JSON (for stats, etc.)
gemini_query_json() {
  local prompt="$1"
  local model="${2:-$GEMINI_DEFAULT_MODEL}"
  
  gemini -p "$prompt" -m "$model" --output-format json 2>&1
}

# Analyze a single file
gemini_analyze_file() {
  local file="$1"
  local prompt="${2:-Analyze this code}"
  local model="${3:-$GEMINI_DEFAULT_MODEL}"
  
  if [ ! -f "$file" ]; then
    echo "[gemini_analyze_file] File not found: $file" >&2
    return 1
  fi
  
  cat "$file" | gemini_query "$prompt" "$model"
}

# Batch process files
gemini_batch_process() {
  local directory="$1"
  local pattern="${2:-*.py}"
  local prompt="${3:-Analyze this file}"
  local output_dir="${4:-./gemini-results}"
  local model="${5:-$GEMINI_FAST_MODEL}"
  
  mkdir -p "$output_dir"
  
  local files=($(find "$directory" -name "$pattern" -type f))
  local total=${#files[@]}
  local current=0
  local success=0
  local failed=0
  
  echo "[gemini_batch_process] Processing $total files..."
  
  for file in "${files[@]}"; do
    ((current++))
    local basename=$(basename "$file")
    local output_file="$output_dir/${basename}.analysis"
    
    echo "[$current/$total] $file"
    
    result=$(gemini_analyze_file "$file" "$prompt" "$model")
    
    if [ $? -eq 0 ]; then
      echo "$result" > "$output_file"
      ((success++))
    else
      echo "FAILED" > "$output_file"
      ((failed++))
    fi
    
    # Rate limiting pause
    sleep 1
  done
  
  echo "[gemini_batch_process] Complete: $success succeeded, $failed failed"
  echo "[gemini_batch_process] Results in: $output_dir"
}

# Get token usage from JSON result
gemini_get_tokens() {
  local json="$1"
  echo "$json" | jq -r '.stats.models // {} | to_entries | map(.value.tokens.total) | add // 0'
}

# Check if gemini-cli is available
gemini_check() {
  if ! command -v gemini &> /dev/null; then
    echo "[gemini_check] gemini-cli not found. Install with: npm install -g @anthropic/gemini-cli" >&2
    return 1
  fi
  
  if ! command -v jq &> /dev/null; then
    echo "[gemini_check] jq not found. Install with: apt install jq (or brew install jq)" >&2
    return 1
  fi
  
  echo "[gemini_check] gemini-cli and jq are available"
  return 0
}

# Advanced query (uses pro model)
gemini_advanced_query() {
  local prompt="$1"
  gemini_query "$prompt" "$GEMINI_ADVANCED_MODEL"
}

# Fast query (uses lite model)
gemini_fast_query() {
  local prompt="$1"
  gemini_query "$prompt" "$GEMINI_LITE_MODEL"
}

# Stream events and call a handler function
gemini_stream() {
  local prompt="$1"
  local handler="${2:-gemini_default_stream_handler}"
  local model="${3:-$GEMINI_DEFAULT_MODEL}"
  
  gemini -p "$prompt" -m "$model" --output-format stream-json | while read -r line; do
    $handler "$line"
  done
}

# Default stream handler
gemini_default_stream_handler() {
  local event="$1"
  local type=$(echo "$event" | jq -r '.type')
  local timestamp=$(echo "$event" | jq -r '.timestamp // ""')
  
  case "$type" in
    "init")
      local model=$(echo "$event" | jq -r '.model')
      echo "[INIT] Model: $model"
      ;;
    "tool_use")
      local tool=$(echo "$event" | jq -r '.tool_name')
      echo "[TOOL] $tool"
      ;;
    "tool_result")
      local status=$(echo "$event" | jq -r '.status')
      echo "[RESULT] $status"
      ;;
    "message")
      local role=$(echo "$event" | jq -r '.role')
      [ "$role" = "assistant" ] && echo "[RESPONSE] ..."
      ;;
    "result")
      local status=$(echo "$event" | jq -r '.status')
      echo "[COMPLETE] $status"
      ;;
    "error")
      local msg=$(echo "$event" | jq -r '.message')
      echo "[ERROR] $msg" >&2
      ;;
  esac
}

# Print available functions
gemini_help() {
  echo "Gemini CLI Helper Functions"
  echo "==========================="
  echo ""
  echo "Core Functions:"
  echo "  gemini_query <prompt> [model] [retries]  - Query with auto-retry"
  echo "  gemini_query_json <prompt> [model]       - Query returning full JSON"
  echo "  gemini_advanced_query <prompt>           - Query using pro model"
  echo "  gemini_fast_query <prompt>               - Query using lite model"
  echo ""
  echo "File Processing:"
  echo "  gemini_analyze_file <file> [prompt] [model]"
  echo "  gemini_batch_process <dir> [pattern] [prompt] [output_dir] [model]"
  echo ""
  echo "Streaming:"
  echo "  gemini_stream <prompt> [handler_func] [model]"
  echo ""
  echo "Utilities:"
  echo "  gemini_check                             - Verify dependencies"
  echo "  gemini_get_tokens <json>                 - Extract token count"
  echo "  gemini_help                              - Show this help"
  echo ""
  echo "Environment Variables:"
  echo "  GEMINI_DEFAULT_MODEL  = $GEMINI_DEFAULT_MODEL"
  echo "  GEMINI_ADVANCED_MODEL = $GEMINI_ADVANCED_MODEL"
  echo "  GEMINI_FAST_MODEL     = $GEMINI_FAST_MODEL"
  echo "  GEMINI_LITE_MODEL     = $GEMINI_LITE_MODEL"
}
