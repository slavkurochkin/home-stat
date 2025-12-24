// Test script to verify API Gateway connectivity
// Run this in browser console: import('./test-connection.js').then(m => m.test())

export async function test() {
  console.log('Testing API Gateway connectivity...');
  
  try {
    // Test 1: Direct fetch to API Gateway
    console.log('Test 1: Direct fetch to http://localhost:3000/health');
    const directResponse = await fetch('http://localhost:3000/health');
    console.log('Direct response status:', directResponse.status);
    const directData = await directResponse.json();
    console.log('Direct response data:', directData);
  } catch (error) {
    console.error('Direct fetch failed:', error);
  }
  
  try {
    // Test 2: Through Vite proxy
    console.log('Test 2: Through Vite proxy /api/test');
    const proxyResponse = await fetch('/api/test');
    console.log('Proxy response status:', proxyResponse.status);
    const proxyData = await proxyResponse.json();
    console.log('Proxy response data:', proxyData);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
  }
  
  try {
    // Test 3: Health check through proxy
    console.log('Test 3: Health check through proxy /api/health');
    const healthResponse = await fetch('/api/health');
    console.log('Health response status:', healthResponse.status);
    const healthData = await healthResponse.json();
    console.log('Health response data:', healthData);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

