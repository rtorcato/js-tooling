
#!/bin/sh

# chmod +x scripts/fix-bins.sh

set -e

BIN_SCRIPTS=$(jq -r '.bin | to_entries[] | .value' package.json)

echo "🔍 Checking bin scripts for executable permissions..."

for script in $BIN_SCRIPTS; do
  if [ ! -f "$script" ]; then
    echo "❌ File not found: $script"
    exit 1
  fi

  if [ ! -x "$script" ]; then
    echo "⚙️  Fixing permissions: $script"
    chmod +x "$script"
    git add "$script"
  else
    echo "✅ Executable: $script"
  fi
done

echo "🎉 All bin scripts are now executable!"
