#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitInfo() {
  try {
    // Get current commit hash
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    
    // Get commit message
    const commitMessage = execSync('git log -1 --pretty=format:"%s"', { encoding: 'utf8' }).trim();
    
    // Check if we're on a tag (release)
    let tag = null;
    let isRelease = false;
    
    try {
      tag = execSync('git describe --exact-match --tags HEAD', { encoding: 'utf8' }).trim();
      isRelease = true;
    } catch (e) {
      // Not on a tag, that's fine
    }
    
    // Get branch name
    let branch = 'unknown';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (e) {
      // Ignore if we can't get branch
    }
    
    return {
      commit,
      commitMessage,
      tag,
      isRelease,
      branch
    };
  } catch (error) {
    console.warn('Warning: Unable to get Git information. Using fallback values.');
    return {
      commit: 'unknown',
      commitMessage: 'No commit message available',
      tag: null,
      isRelease: false,
      branch: 'unknown'
    };
  }
}

function getPackageVersion() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Warning: Unable to read package.json version. Using fallback.');
    return '0.0.0';
  }
}

function generateBuildNumber() {
  return Math.floor(Date.now() / 1000); // Unix timestamp
}

function detectEnvironment() {
  // Check common CI/CD environment variables
  if (process.env.VERCEL) return 'vercel';
  if (process.env.NETLIFY) return 'netlify';
  if (process.env.CI) return 'ci';
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'development') return 'development';
  return 'unknown';
}

function generateVersionInfo() {
  const gitInfo = getGitInfo();
  const packageVersion = getPackageVersion();
  const buildNumber = generateBuildNumber();
  const buildDate = new Date().toISOString();
  const environment = detectEnvironment();
  
  // Determine version to display
  let displayVersion;
  if (gitInfo.isRelease && gitInfo.tag) {
    // Use tag version for releases
    displayVersion = gitInfo.tag;
  } else {
    // Use package.json version for development
    displayVersion = packageVersion;
  }
  
  const versionInfo = {
    version: displayVersion,
    packageVersion: packageVersion,
    commit: gitInfo.commit,
    commitMessage: gitInfo.commitMessage,
    branch: gitInfo.branch,
    isRelease: gitInfo.isRelease,
    tag: gitInfo.tag,
    buildNumber: buildNumber,
    buildDate: buildDate,
    environment: environment,
    // Additional metadata
    generatedAt: buildDate,
    nodeVersion: process.version,
    platform: process.platform
  };
  
  return versionInfo;
}

function writeVersionFile(versionInfo) {
  const outputDir = path.join(process.cwd(), 'src', 'lib');
  const outputPath = path.join(outputDir, 'version.json');
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write version file
  fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
  
  console.log(`✅ Version info generated: ${outputPath}`);
  console.log(`📦 Version: ${versionInfo.version}`);
  console.log(`🔄 Commit: ${versionInfo.commit}`);
  console.log(`🏷️ Release: ${versionInfo.isRelease ? 'Yes' : 'No'}`);
  console.log(`🌍 Environment: ${versionInfo.environment}`);
  console.log(`⏰ Build Date: ${versionInfo.buildDate}`);
}

function main() {
  try {
    const versionInfo = generateVersionInfo();
    writeVersionFile(versionInfo);
  } catch (error) {
    console.error('❌ Error generating version info:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateVersionInfo,
  writeVersionFile,
  main
};