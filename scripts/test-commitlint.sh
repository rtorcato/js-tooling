#!/bin/bash

# Test commitlint with example messages
echo "🧪 Testing commitlint configuration..."

# Test valid messages
echo ""
echo "✅ Testing VALID commit messages..."
echo "feat: add new feature" | npx commitlint
echo "fix: resolve bug in authentication" | npx commitlint  
echo "docs: update README with examples" | npx commitlint
echo "refactor: simplify user validation logic" | npx commitlint

echo ""
echo "❌ Testing INVALID commit messages..."

# Test invalid messages (these should fail)
echo "Add new feature" | npx commitlint || echo "  ↳ ❌ Failed as expected (no type)"
echo "feat add new feature" | npx commitlint || echo "  ↳ ❌ Failed as expected (no colon)"  
echo "feat: add new feature that is way too long and exceeds the maximum allowed length for commit messages which should be rejected" | npx commitlint || echo "  ↳ ❌ Failed as expected (too long)"
echo "invalid: add new feature" | npx commitlint || echo "  ↳ ❌ Failed as expected (invalid type)"

echo ""
echo "🎉 Commitlint testing complete!"