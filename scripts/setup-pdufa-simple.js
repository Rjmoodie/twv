#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

console.log('🚀 PDUFA System Setup (Simplified)\n');

// Check Node.js version
function checkNodeVersion() {
  console.log('Checking Node.js version...');
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    console.error('❌ Node.js 18+ is required. Current version:', version);
    process.exit(1);
  }
  
  console.log('✅ Node.js version:', version);
}

// Check if required files exist
function checkFiles() {
  const requiredFiles = [
    'src/services/pdufa-scraper.ts',
    'src/services/discord-alerts.ts',
    'src/services/pdufa-scheduler.ts',
    'src/api/pdufa-api.ts',
    'src/components/PDUFACalendar.tsx',
    'scripts/pdufa-server.js'
  ];
  
  console.log('\n📁 Checking required files...');
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - Missing`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    console.error('\n❌ Some required files are missing. Please ensure all PDUFA system files are present.');
    process.exit(1);
  }
}

// Display next steps
function showNextSteps() {
  console.log('\n🎉 PDUFA System Setup Complete!\n');
  console.log('📋 Next Steps:');
  console.log('1. Start the development server:');
  console.log('   npm run pdufa:dev');
  console.log('');
  console.log('2. Or start components separately:');
  console.log('   npm run dev          # Frontend');
  console.log('   npm run pdufa:server # API Server');
  console.log('');
  console.log('3. Access the application:');
  console.log('   Frontend: http://localhost:5173');
  console.log('   API: http://localhost:3001');
  console.log('');
  console.log('4. Test the system:');
  console.log('   npm run pdufa:test');
  console.log('');
  console.log('📚 Documentation: README.md');
  console.log('');
  console.log('🔗 Useful URLs:');
  console.log('   - Health check: http://localhost:3001/health');
  console.log('   - API docs: http://localhost:3001/api/pdufa');
  console.log('   - Test Discord alert: POST http://localhost:3001/api/pdufa/scheduler/test-alert');
  console.log('');
  console.log('⚠️  Note: Redis server is required for full functionality.');
  console.log('   Start Redis with: docker run -d -p 6379:6379 redis:alpine');
}

// Main setup function
async function setup() {
  try {
    checkNodeVersion();
    checkFiles();
    showNextSteps();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup();
}

export { setup };
