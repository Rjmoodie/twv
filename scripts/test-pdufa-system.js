import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testHealth() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testPDUFAAPI() {
  console.log('\n🔍 Testing PDUFA API endpoints...');
  
  try {
    // Test stats endpoint
    console.log('Testing stats endpoint...');
    const statsResponse = await axios.get(`${BASE_URL}/api/pdufa/stats`);
    console.log('✅ Stats endpoint:', statsResponse.data.success ? 'PASSED' : 'FAILED');
    
    // Test upcoming PDUFAs
    console.log('Testing upcoming PDUFAs endpoint...');
    const upcomingResponse = await axios.get(`${BASE_URL}/api/pdufa/upcoming?days=30`);
    console.log('✅ Upcoming PDUFAs endpoint:', upcomingResponse.data.success ? 'PASSED' : 'FAILED');
    
    // Test search endpoint
    console.log('Testing search endpoint...');
    const searchResponse = await axios.get(`${BASE_URL}/api/pdufa/search?q=test`);
    console.log('✅ Search endpoint:', searchResponse.data.success ? 'PASSED' : 'FAILED');
    
    return true;
  } catch (error) {
    console.error('❌ PDUFA API test failed:', error.message);
    return false;
  }
}

async function testScheduler() {
  console.log('\n🔍 Testing scheduler endpoints...');
  
  try {
    // Test scheduler status
    console.log('Testing scheduler status...');
    const statusResponse = await axios.get(`${BASE_URL}/api/pdufa/scheduler/status`);
    console.log('✅ Scheduler status:', statusResponse.data.success ? 'PASSED' : 'FAILED');
    
    // Test system validation
    console.log('Testing system validation...');
    const validationResponse = await axios.post(`${BASE_URL}/api/pdufa/scheduler/validate`);
    console.log('✅ System validation:', validationResponse.data.success ? 'PASSED' : 'FAILED');
    
    if (validationResponse.data.validation) {
      console.log('   Validation results:', validationResponse.data.validation);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Scheduler test failed:', error.message);
    return false;
  }
}

async function testDiscordAlert() {
  console.log('\n🔍 Testing Discord alert...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/pdufa/scheduler/test-alert`);
    console.log('✅ Discord test alert:', response.data.success ? 'SENT' : 'FAILED');
    if (response.data.message) {
      console.log('   Message:', response.data.message);
    }
    return response.data.success;
  } catch (error) {
    console.error('❌ Discord alert test failed:', error.message);
    return false;
  }
}

async function testCache() {
  console.log('\n🔍 Testing cache operations...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/pdufa/cache/clear`);
    console.log('✅ Cache clear:', response.data.success ? 'PASSED' : 'FAILED');
    return response.data.success;
  } catch (error) {
    console.error('❌ Cache test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting PDUFA System Tests...\n');
  
  const results = {
    health: await testHealth(),
    api: await testPDUFAAPI(),
    scheduler: await testScheduler(),
    discord: await testDiscordAlert(),
    cache: await testCache()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed.'}`);
  
  if (!allPassed) {
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Ensure the PDUFA server is running: npm run pdufa:server');
    console.log('2. Check Redis server is running');
    console.log('3. Verify Discord webhook URL is correct');
    console.log('4. Check network connectivity');
  }
  
  return allPassed;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

export {
  testHealth,
  testPDUFAAPI,
  testScheduler,
  testDiscordAlert,
  testCache,
  runAllTests
};
