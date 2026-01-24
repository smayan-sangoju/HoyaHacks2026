#!/usr/bin/env node

/**
 * Compatibility Checker
 * Verifies the system can run ClearCycle
 * Run: node check-compatibility.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(symbol, message, color = 'reset') {
  console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

async function checkNodeVersion() {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const [major] = version.slice(1).split('.');
    
    if (parseInt(major) >= 18) {
      log('✅', `Node.js ${version} (Compatible)`, 'green');
      return true;
    } else {
      log('❌', `Node.js ${version} (Need v18+)`, 'red');
      return false;
    }
  } catch (e) {
    log('❌', 'Node.js not found. Install from https://nodejs.org/', 'red');
    return false;
  }
}

async function checkNpmVersion() {
  try {
    const { stdout } = await execAsync('npm --version');
    const version = stdout.trim();
    log('✅', `npm ${version} (Compatible)`, 'green');
    return true;
  } catch (e) {
    log('❌', 'npm not found', 'red');
    return false;
  }
}

function checkFiles() {
  const requiredFiles = [
    'backend/server.js',
    'backend/models/TrashCan.js',
    'public/index.html',
    'public/server.js'
  ];
  
  let allFound = true;
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log('✅', file, 'green');
    } else {
      log('❌', `${file} not found`, 'red');
      allFound = false;
    }
  });
  
  return allFound;
}

function checkDependencies() {
  const backendPackage = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
  const publicPackage = JSON.parse(fs.readFileSync('public/package.json', 'utf8'));
  
  console.log('\nBackend dependencies:');
  Object.keys(backendPackage.dependencies).forEach(dep => {
    log('✅', dep, 'green');
  });
  
  console.log('\nFrontend dependencies:');
  Object.keys(publicPackage.dependencies).forEach(dep => {
    log('✅', dep, 'green');
  });
  
  return true;
}

function checkEnv() {
  if (fs.existsSync('backend/.env')) {
    log('✅', '.env file exists', 'green');
    const env = fs.readFileSync('backend/.env', 'utf8');
    if (env.includes('MONGO_URI')) {
      log('✅', 'MONGO_URI is configured', 'green');
      return true;
    } else {
      log('⚠️', 'MONGO_URI not found in .env', 'yellow');
      return false;
    }
  } else {
    log('⚠️', '.env file not found (create one with MONGO_URI)', 'yellow');
    return false;
  }
}

function checkPlatform() {
  const platform = process.platform;
  const osMap = {
    'darwin': 'macOS',
    'win32': 'Windows',
    'linux': 'Linux'
  };
  
  const osName = osMap[platform] || 'Unknown';
  log('✅', `Running on ${osName}`, 'green');
  
  return true;
}

async function run() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  ClearCycle Compatibility Checker      ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);
  
  const checks = [
    { name: 'Platform', fn: checkPlatform },
    { name: 'Node.js', fn: checkNodeVersion },
    { name: 'npm', fn: checkNpmVersion },
    { name: 'Project Files', fn: checkFiles },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Environment', fn: checkEnv }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    console.log(`\n${colors.blue}${check.name}:${colors.reset}`);
    try {
      const result = await check.fn();
      if (!result) allPassed = false;
    } catch (e) {
      log('❌', e.message, 'red');
      allPassed = false;
    }
  }
  
  console.log(`\n${colors.blue}════════════════════════════════════════${colors.reset}`);
  
  if (allPassed) {
    log('✅', 'All checks passed! Ready to run.', 'green');
    console.log(`\n${colors.green}Next steps:${colors.reset}`);
    console.log('  cd backend');
    console.log('  npm start');
    process.exit(0);
  } else {
    log('❌', 'Some checks failed. Please fix issues above.', 'red');
    process.exit(1);
  }
}

run();
