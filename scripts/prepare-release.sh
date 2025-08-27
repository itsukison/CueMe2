#!/bin/bash

# CueMe Release Preparation Script
set -e

echo "🚀 CueMe Release Preparation"
echo "=========================="

# Check if version is provided
if [ -z "$1" ]; then
    echo "❌ Please provide a version number"
    echo "Usage: ./scripts/prepare-release.sh v1.0.0"
    exit 1
fi

VERSION=$1
echo "📦 Preparing release for version: $VERSION"

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use format: v1.0.0"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on the main branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Update package.json version
echo "📝 Updating package.json version..."
npm version ${VERSION#v} --no-git-tag-version

# Build the application
echo "🔨 Building application..."
npm run build

# Test the build
echo "🧪 Testing build..."
if [ ! -d "dist" ] || [ ! -d "dist-electron" ]; then
    echo "❌ Build failed - missing dist directories"
    exit 1
fi

# Commit version bump
echo "💾 Committing version bump..."
git add package.json package-lock.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
echo "🏷️  Creating and pushing tag..."
git tag $VERSION
git push origin main
git push origin $VERSION

echo "✅ Release preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. GitHub Actions will automatically build and create the release"
echo "2. Monitor the build at: https://github.com/ibttf/interview-coder-frontend/actions"
echo "3. Once complete, the release will be available at: https://github.com/ibttf/interview-coder-frontend/releases"
echo ""
echo "🌐 The landing page will automatically detect and show the new version!"