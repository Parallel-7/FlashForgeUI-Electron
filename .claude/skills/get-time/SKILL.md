---
name: get-time
description: Get the current local time in various formats. Use when the user asks for the current time, what time it is, the date, or needs timestamp information. Works across claude.ai web, Claude Desktop, and Claude Code environments.
---

# Get Time

This skill provides the current local time with automatic timezone detection or manual timezone specification.

## Usage

### Automatic Timezone Detection

The script attempts to auto-detect the user's timezone using IP geolocation:

```bash
python3 scripts/get_time.py [format]
```

### Manual Timezone Specification

For more accurate results, especially in containerized environments, specify the timezone explicitly:

```bash
python3 scripts/get_time.py [format] [timezone]
```

**Important:** When you know the user's timezone from context or memory, always pass it explicitly for accuracy.

## Available Formats

- **full** (default): Full datetime with day name and timezone (e.g., "Sunday, December 14, 2025 at 05:09:44 PM EST")
- **time**: Just the time in 12-hour format (e.g., "05:09:44 PM")
- **date**: Just the date (e.g., "2025-12-14")
- **datetime**: Date and time with timezone (e.g., "2025-12-14 05:09:44 PM EST")
- **iso**: ISO 8601 format (e.g., "2025-12-14T17:09:44-05:00")
- **unix**: Unix timestamp (e.g., "1734220184")

## Common Timezones

- US Eastern: `America/New_York`
- US Pacific: `America/Los_Angeles`
- US Central: `America/Chicago`
- US Mountain: `America/Denver`
- UK: `Europe/London`
- Central Europe: `Europe/Paris`
- Japan: `Asia/Tokyo`
- Australia Eastern: `Australia/Sydney`

See [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for full list.

## Examples

```bash
# Auto-detect timezone (may be less accurate in containers)
python3 scripts/get_time.py

# Get time in US Eastern timezone
python3 scripts/get_time.py full America/New_York

# Get just the time in Pacific timezone
python3 scripts/get_time.py time America/Los_Angeles

# Get ISO format for logging in specific timezone
python3 scripts/get_time.py iso Europe/London

# Get Unix timestamp (timezone-independent)
python3 scripts/get_time.py unix
```

## Best Practices

1. **Use user's known location**: If you have information about the user's location from conversation history or memory, convert it to a timezone and pass it explicitly
2. **Common US locations**: 
   - New York, Boston, Washington DC → `America/New_York`
   - Los Angeles, San Francisco, Seattle → `America/Los_Angeles`
   - Chicago, Dallas → `America/Chicago`
   - Denver, Phoenix → `America/Denver`
3. **Fallback**: If timezone detection fails or no timezone is specified, the script falls back to UTC
