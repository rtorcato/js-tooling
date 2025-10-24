#!/bin/bash

# Copy Biome configuration from js-tooling
# Usage: ./scripts/copy-biome-config.sh

echo "📋 Copying Biome configuration from js-tooling..."

# Check if this is being run from a project that has js-tooling as dependency
if [ ! -d "node_modules/@rtorcato/js-tooling" ]; then
    echo "❌ Error: @rtorcato/js-tooling not found in node_modules"
    echo "   Please install it first: npm install @rtorcato/js-tooling"
    exit 1
fi

# Copy the base configuration
cp node_modules/@rtorcato/js-tooling/tooling/biome/biome.json ./biome.json

echo "✅ Biome configuration copied successfully!"
echo ""
echo "📁 Created: ./biome.json"
echo ""
echo "🔧 You can now customize the configuration for your project:"
echo "   - Add project-specific file patterns"
echo "   - Override rules as needed" 
echo "   - Modify formatter settings"
echo ""
echo "🚀 To run Biome:"
echo "   npx biome check ."
echo "   npx biome format ."
echo "   npx biome lint ."