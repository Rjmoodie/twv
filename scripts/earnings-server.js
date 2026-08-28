import express from 'express';
import cors from 'cors';
import { earningsScheduler } from '../src/services/api/earnings-scheduler.ts';
import { AlphaVantageAPI } from '../src/services/api/alpha-vantage-api.ts';

const app = express();
const PORT = process.env.EARNINGS_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Earnings Alert Server'
  });
});

// Earnings API endpoints
app.get('/api/earnings', async (req, res) => {
  try {
    const alphaVantageAPI = new AlphaVantageAPI();
    const response = await alphaVantageAPI.getEarningsData();
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/earnings/upcoming', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const upcomingEarnings = await earningsScheduler.getUpcomingEarnings(parseInt(days));
    res.json({
      success: true,
      data: upcomingEarnings,
      count: upcomingEarnings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/earnings/today', async (req, res) => {
  try {
    const alphaVantageAPI = new AlphaVantageAPI();
    const earningsResult = await alphaVantageAPI.getEarningsData();
    const today = new Date().toLocaleDateString('en-CA');
    const todayEarnings = earningsResult.data.filter(item => {
      const itemDate = new Date(item.reportDate);
      const todayDate = new Date(today);
      return itemDate.toDateString() === todayDate.toDateString();
    });
    
    res.json({
      success: true,
      data: todayEarnings,
      count: todayEarnings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/earnings/tomorrow', async (req, res) => {
  try {
    const alphaVantageAPI = new AlphaVantageAPI();
    const earningsResult = await alphaVantageAPI.getEarningsData();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
    const tomorrowEarnings = earningsResult.data.filter(item => {
      const itemDate = new Date(item.reportDate);
      const tomorrowDate = new Date(tomorrowStr);
      return itemDate.toDateString() === tomorrowDate.toDateString();
    });
    
    res.json({
      success: true,
      data: tomorrowEarnings,
      count: tomorrowEarnings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Scheduler management endpoints
app.get('/api/earnings/scheduler/status', async (req, res) => {
  try {
    const status = earningsScheduler.getStatus();
    const config = earningsScheduler.getConfig();
    res.json({
      success: true,
      status,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/earnings/scheduler/check', async (req, res) => {
  try {
    await earningsScheduler.runManualCheck();
    res.json({
      success: true,
      message: 'Manual earnings check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/earnings/scheduler/test-alert', async (req, res) => {
  try {
    const success = await earningsScheduler.sendTestAlert();
    res.json({
      success,
      message: success ? 'Test alert sent successfully' : 'Failed to send test alert',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/earnings/scheduler/validate', async (req, res) => {
  try {
    const validation = await earningsScheduler.validateSystem();
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start scheduler
async function startScheduler() {
  try {
    await earningsScheduler.start();
    console.log('Earnings Scheduler started successfully');
  } catch (error) {
    console.error('Failed to start Earnings Scheduler:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Earnings Alert Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/api/earnings`);
  
  // Start the scheduler
  await startScheduler();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down Earnings Alert Server...');
  await earningsScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down Earnings Alert Server...');
  await earningsScheduler.stop();
  process.exit(0);
});

export default app;
