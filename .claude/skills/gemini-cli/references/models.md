# Model Reference

Complete model documentation for gemini-cli.

## Available Models

### Gemini 3 (Preview)
| Model | Description | Use Case |
|-------|-------------|----------|
| `gemini-3-pro-preview` | Most capable, advanced reasoning | Complex debugging, architecture, deep analysis |
| `gemini-3-flash-preview` | Fast, very capable | Quick analysis, summarization, batch processing |

### Gemini 2.5
| Model | Description | Use Case |
|-------|-------------|----------|
| `gemini-2.5-pro` | High capability, large context | General purpose, balanced performance |
| `gemini-2.5-flash` | Fast, capable | Quick responses, bulk processing |
| `gemini-2.5-flash-lite` | Lightweight, fast | High-volume operations, simple tasks |

## Model Selection

### Command Line
```bash
gemini -p "Query" -m gemini-3-pro-preview
gemini -p "Query" --model gemini-2.5-flash
```

### Settings File
```json
{
  "model": {
    "name": "gemini-3-flash-preview"
  }
}
```

## Model Configuration Aliases

Gemini CLI uses a hierarchy of configuration presets. Custom aliases can extend built-in ones.

### Base Aliases

#### `base`
Foundation config with conservative settings:
```json
{
  "modelConfig": {
    "generateContentConfig": {
      "temperature": 0,
      "topP": 1
    }
  }
}
```

#### `chat-base`
Standard chat configuration:
```json
{
  "extends": "base",
  "modelConfig": {
    "generateContentConfig": {
      "thinkingConfig": { "includeThoughts": true },
      "temperature": 1,
      "topP": 0.95,
      "topK": 64
    }
  }
}
```

#### `chat-base-2.5`
Gemini 2.5 chat configuration:
```json
{
  "extends": "chat-base",
  "modelConfig": {
    "generateContentConfig": {
      "thinkingConfig": { "thinkingBudget": 8192 }
    }
  }
}
```

#### `chat-base-3`
Gemini 3 chat configuration:
```json
{
  "extends": "chat-base",
  "modelConfig": {
    "generateContentConfig": {
      "thinkingConfig": { "thinkingLevel": "HIGH" }
    }
  }
}
```

### Model Aliases

#### `gemini-3-pro-preview`
```json
{
  "extends": "chat-base-3",
  "modelConfig": { "model": "gemini-3-pro-preview" }
}
```

#### `gemini-3-flash-preview`
```json
{
  "extends": "chat-base-3",
  "modelConfig": { "model": "gemini-3-flash-preview" }
}
```

#### `gemini-2.5-pro`
```json
{
  "extends": "chat-base-2.5",
  "modelConfig": { "model": "gemini-2.5-pro" }
}
```

#### `gemini-2.5-flash`
```json
{
  "extends": "chat-base-2.5",
  "modelConfig": { "model": "gemini-2.5-flash" }
}
```

#### `gemini-2.5-flash-lite`
```json
{
  "extends": "chat-base-2.5",
  "modelConfig": { "model": "gemini-2.5-flash-lite" }
}
```

### Specialized Aliases

#### `classifier`
For classification tasks:
```json
{
  "extends": "base",
  "modelConfig": {
    "model": "gemini-2.5-flash-lite",
    "generateContentConfig": {
      "maxOutputTokens": 1024,
      "thinkingConfig": { "thinkingBudget": 512 }
    }
  }
}
```

#### `summarizer-default`
For summarization:
```json
{
  "extends": "base",
  "modelConfig": {
    "model": "gemini-2.5-flash-lite",
    "generateContentConfig": { "maxOutputTokens": 2000 }
  }
}
```

#### `web-search`
For web search integration:
```json
{
  "extends": "gemini-2.5-flash-base",
  "modelConfig": {
    "generateContentConfig": {
      "tools": [{ "googleSearch": {} }]
    }
  }
}
```

#### `web-fetch`
For URL context fetching:
```json
{
  "extends": "gemini-2.5-flash-base",
  "modelConfig": {
    "generateContentConfig": {
      "tools": [{ "urlContext": {} }]
    }
  }
}
```

## Custom Model Configuration

### Define Custom Aliases
```json
{
  "modelConfigs": {
    "customAliases": {
      "my-creative": {
        "extends": "chat-base-3",
        "modelConfig": {
          "model": "gemini-3-pro-preview",
          "generateContentConfig": {
            "temperature": 1.2,
            "topP": 0.98
          }
        }
      },
      "my-precise": {
        "extends": "base",
        "modelConfig": {
          "model": "gemini-3-flash-preview",
          "generateContentConfig": {
            "temperature": 0.1,
            "topP": 0.9
          }
        }
      }
    }
  }
}
```

Use custom alias:
```bash
gemini -p "Query" -m my-creative
```

### Configuration Parameters

| Parameter | Description | Range |
|-----------|-------------|-------|
| `temperature` | Randomness of output | 0.0 - 2.0 |
| `topP` | Nucleus sampling threshold | 0.0 - 1.0 |
| `topK` | Top-k sampling | 1 - 100 |
| `maxOutputTokens` | Maximum response length | 1 - model limit |
| `thinkingBudget` | Tokens for reasoning (2.5) | 0 - 32768 |
| `thinkingLevel` | Reasoning depth (3.0) | LOW, MEDIUM, HIGH |

## Rate Limit Fallback Strategy

When encountering rate limits, fall back through this hierarchy:

**Pro models:**
1. `gemini-3-pro-preview`
2. `gemini-2.5-pro`

**Flash models:**
1. `gemini-3-flash-preview`
2. `gemini-2.5-flash`
3. `gemini-2.5-flash-lite`

### Implementation Example
```bash
#!/bin/bash
query_with_fallback() {
  local prompt="$1"
  local models=("gemini-3-flash-preview" "gemini-2.5-flash" "gemini-2.5-flash-lite")
  
  for model in "${models[@]}"; do
    result=$(gemini -p "$prompt" -m "$model" --output-format json 2>&1)
    if ! echo "$result" | jq -e '.error' > /dev/null 2>&1; then
      echo "$result" | jq -r '.response'
      return 0
    fi
    echo "Rate limited on $model, trying next..." >&2
  done
  
  echo "All models rate limited" >&2
  return 1
}
```

## Model Comparison Summary

| Model | Speed | Capability | Context | Best For |
|-------|-------|------------|---------|----------|
| gemini-3-pro-preview | Slow | Highest | Very Large | Complex reasoning |
| gemini-3-flash-preview | Fast | Very High | Very Large | General use |
| gemini-2.5-pro | Medium | High | Large | Balanced tasks |
| gemini-2.5-flash | Fast | Good | Large | Quick tasks |
| gemini-2.5-flash-lite | Fastest | Basic | Medium | High volume |
