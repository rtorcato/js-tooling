#!/usr/bin/env bash

# chmod +x scripts/commitmessage.sh
set -e

echo "Select commit type by number:"
select type in "feat" "fix" "perf" "ci" "WIP" "chore" "docs" "test" "style" "refactor" "build" "BREAKING CHANGE" "revert"; do
    if [ -n "$type" ]; then
        break
    else
        echo "❌ Invalid selection. Try again."
    fi
done

if [[ "$type" =~ ^(feat|fix|perf)$ ]]; then
    echo "Select semantic version by number:"
    select semantic_version in "none" "patch" "minor" "major"; do
        [ -n "$semantic_version" ] && break
    done
else
    semantic_version="none"
fi

read -p "Enter commit description: " description
read -p "Skip CI? (y/n) [n]: " skip_ci
skip_ci=${skip_ci:-n}

msg="$type"
[ "$semantic_version" != "none" ] && msg="$msg($semantic_version)"
msg="$msg: $description"
[ "$skip_ci" = "y" ] && msg="$msg [skip ci]"

echo ""
echo "🔍 Commit preview:"
echo "$msg"
read -p "Is this okay? (y/n): " confirm
[ "$confirm" != "y" ] && echo "❌ Commit aborted." && exit 1

git add -A
git commit -m "$msg"

echo ""
read -p "Do you want to push the commit? (y/n): " push_confirm
[ "$push_confirm" = "y" ] && git push || echo "🚫 Commit not pushed."
