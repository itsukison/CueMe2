#!/bin/bash

# Test Mac Release Script
# This script will trigger a test release to verify Mac builds are working

set -e

echo "🧪 Testing Mac builds for CueMe2..."

# Get current version and create a test version
CURRENT_VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
TEST_VERSION="v${CURRENT_VERSION}-test-${TIMESTAMP}"

echo "📦 Current version: $CURRENT_VERSION"
echo "🔖 Test version: $TEST_VERSION"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Warning: You have uncommitted changes"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create and push test tag
echo "🏷️  Creating test tag: $TEST_VERSION"
git tag $TEST_VERSION
git push origin $TEST_VERSION

echo "✅ Test release triggered!"
echo "📊 Check GitHub Actions at: https://github.com/itsukison/CueMe2/actions"
echo "📦 Check releases at: https://github.com/itsukison/CueMe2/releases"
echo ""
echo "After the build completes, verify Mac builds are present in the release assets."
echo "If successful, you can delete the test tag with:"
echo "  git tag -d $TEST_VERSION"
echo "  git push origin :refs/tags/$TEST_VERSION"