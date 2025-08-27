#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get version from command line or package.json
const version = process.argv[2] || require('../package.json').version;

console.log(`🚀 Creating release for version ${version}`);

try {
  // Update package.json version
  const packagePath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = version.replace('v', '');
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  
  // Commit version bump
  execSync(`git add package.json`);
  execSync(`git commit -m "chore: bump version to ${version}"`);
  
  // Create and push tag
  execSync(`git tag ${version}`);
  execSync(`git push origin ${version}`);
  
  console.log(`✅ Release ${version} created successfully!`);
  console.log(`📦 GitHub Actions will build and publish the release automatically.`);
  
} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}