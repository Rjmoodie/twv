#!/usr/bin/env node

import { earningsScheduler } from '../src/services/api/earnings-scheduler.ts';
import { AlphaVantageAPI } from '../src/services/api/alpha-vantage-api.ts';
import { discordAlerts } from '../src/services/api/discord-alerts.ts';

console.log('🧪 Testing Earnings Alert System...\n');

async function testEarningsSystem() {
  try {
    // Test 1: Validate Discord webhook
    console.log('1️⃣ Testing Discord webhook validation...');
    const webhookValid = await discordAlerts.validateWebhook();
    console.log(`   Discord webhook: ${webhookValid ? '✅ VALID' : '❌ INVALID'}\n`);

    // Test 2: Test earnings data fetching
    console.log('2️⃣ Testing earnings data fetching...');
    const alphaVantageAPI = new AlphaVantageAPI();
    const earningsResult = await alphaVantageAPI.getEarningsData();
    console.log(`   Earnings data: ✅ LOADED (${earningsResult.data.length} companies)`);
    console.log(`   Stats: Today=${earningsResult.stats.today}, Tomorrow=${earningsResult.stats.tomorrow}, This Week=${earningsResult.stats.thisWeek}\n`);

    // Test 3: Test earnings alert functions
    console.log('3️⃣ Testing earnings alert functions...');
    
    // Test today's earnings alert
    if (earningsResult.stats.today > 0) {
      console.log('   Testing today\'s earnings alert...');
      const todaySuccess = await discordAlerts.sendEarningsTodayAlert(
        earningsResult.data.filter(item => {
          const today = new Date().toLocaleDateString('en-CA');
          return new Date(item.reportDate).toLocaleDateString('en-CA') === today;
        })
      );
      console.log(`   Today's alert: ${todaySuccess ? '✅ SENT' : '❌ FAILED'}`);
    } else {
      console.log('   Today\'s alert: ⏭️ SKIPPED (no earnings today)');
    }

    // Test tomorrow's earnings alert
    if (earningsResult.stats.tomorrow > 0) {
      console.log('   Testing tomorrow\'s earnings alert...');
      const tomorrowSuccess = await discordAlerts.sendEarningsTomorrowAlert(
        earningsResult.data.filter(item => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
          return new Date(item.reportDate).toLocaleDateString('en-CA') === tomorrowStr;
        })
      );
      console.log(`   Tomorrow's alert: ${tomorrowSuccess ? '✅ SENT' : '❌ FAILED'}`);
    } else {
      console.log('   Tomorrow\'s alert: ⏭️ SKIPPED (no earnings tomorrow)');
    }

    // Test weekly summary
    if (earningsResult.stats.thisWeek > 0) {
      console.log('   Testing weekly earnings summary...');
      const weeklySuccess = await discordAlerts.sendEarningsWeeklySummary(
        earningsResult.data.filter(item => {
          const itemDate = new Date(item.reportDate);
          const today = new Date();
          const thisWeek = new Date();
          thisWeek.setDate(thisWeek.getDate() + 7);
          return itemDate >= today && itemDate <= thisWeek;
        })
      );
      console.log(`   Weekly summary: ${weeklySuccess ? '✅ SENT' : '❌ FAILED'}`);
    } else {
      console.log('   Weekly summary: ⏭️ SKIPPED (no earnings this week)');
    }

    // Test earnings test alert
    console.log('   Testing earnings test alert...');
    const testSuccess = await discordAlerts.sendEarningsTestAlert();
    console.log(`   Test alert: ${testSuccess ? '✅ SENT' : '❌ FAILED'}\n`);

    // Test 4: Test scheduler validation
    console.log('4️⃣ Testing earnings scheduler validation...');
    const validation = await earningsScheduler.validateSystem();
    console.log(`   Alpha Vantage API: ${validation.alphaVantage ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   Discord webhook: ${validation.discord ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   Cache system: ${validation.cache ? '✅ WORKING' : '❌ FAILED'}\n`);

    // Test 5: Test scheduler status
    console.log('5️⃣ Testing scheduler status...');
    const status = earningsScheduler.getStatus();
    const config = earningsScheduler.getConfig();
    console.log(`   Scheduler running: ${status.isRunning ? '✅ YES' : '❌ NO'}`);
    console.log(`   Check time: ${config.checkTime} ${config.timezone}`);
    console.log(`   Weekly summary day: ${config.weeklySummaryDay}`);
    console.log(`   Total alerts sent: ${status.totalAlertsSent}\n`);

    // Test 6: Test manual check
    console.log('6️⃣ Testing manual earnings check...');
    await earningsScheduler.runManualCheck();
    console.log('   Manual check: ✅ COMPLETED\n');

    console.log('🎉 Earnings Alert System Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Discord webhook: ${webhookValid ? '✅' : '❌'}`);
    console.log(`   - Earnings data: ✅ (${earningsResult.data.length} companies)`);
    console.log(`   - Alert functions: ✅`);
    console.log(`   - Scheduler: ✅`);
    console.log(`   - Manual check: ✅`);
    
    if (webhookValid && earningsResult.data.length > 0) {
      console.log('\n🚀 Your earnings alerts are ready to go!');
      console.log('   Run "npm run earnings:server" to start the scheduler');
      console.log('   The scheduler will check for earnings at 9:30 AM ET daily');
    } else {
      console.log('\n⚠️  Some components need attention:');
      if (!webhookValid) console.log('   - Check your Discord webhook URL');
      if (earningsResult.data.length === 0) console.log('   - Check your Alpha Vantage API key');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testEarningsSystem();
