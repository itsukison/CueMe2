#!/bin/bash

# Simple build test script
set -e

echo "🧪 Testing CueMe Build Process"
echo "=============================="

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Check if build succeeded
if [ -d "dist" ] && [ -d "dist-electron" ]; then
    echo "✅ Build successful!"
    echo "📁 Output directories:"
    echo "   - dist/ (renderer)"
    echo "   - dist-electron/ (main process)"
    
    # Show build sizes
    echo ""
    echo "📊 Build sizes:"
    du -sh dist/ dist-electron/
    
    echo ""
    echo "🚀 Ready for packaging! Run:"
    echo "   npm run app:build        # Current platform"
    echo "   npm run app:build:all    # All platforms"
else
    echo "❌ Build failed - missing output directories"
    exit 1
fi