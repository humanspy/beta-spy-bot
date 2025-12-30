#!/usr/bin/env bash

echo "======================================"
echo "🚀 Starting Spy Group Discord Bot"
echo "======================================"

# Ensure Node.js is available
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  exit 1
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
  echo "📦 Loading environment variables"
  export $(grep -v '^#' .env | xargs)
fi

# Check required env vars
if [ -z "$DISCORD_BOT_TOKEN" ]; then
  echo "❌ DISCORD_BOT_TOKEN is missing"
  exit 1
fi

# Deploy slash commands (safe to re-run)
if [ -f "deploy-commands.js" ]; then
  echo "📡 Deploying slash commands..."
  node deploy-commands.js
fi

# Start the bot
echo "🤖 Bot is starting..."
node index.js
