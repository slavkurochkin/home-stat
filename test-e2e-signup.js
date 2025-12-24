// End-to-end test script for signup flow
// This tests the actual API and verifies the complete flow

const testSignup = async () => {
  console.log('=== Starting E2E Signup Test ===');
  
  const testData = {
    email: `test${Date.now()}@example.com`,
    password: 'admin1234',
    full_name: 'slav'
  };
  
  console.log('Test data:', testData);
  
  try {
    // Test 1: Direct API call to registration endpoint
    console.log('\n1. Testing direct API call to /api/users/register...');
    const response = await fetch('http://localhost:3000/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok && data.token && data.user) {
      console.log('✓ Registration successful!');
      console.log('User ID:', data.user.id);
      console.log('Token received:', data.token.substring(0, 20) + '...');
      
      // Test 2: Verify token works for authenticated request
      console.log('\n2. Testing authenticated request with token...');
      const profileResponse = await fetch('http://localhost:3000/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${data.token}`,
        },
      });
      
      const profileData = await profileResponse.json();
      console.log('Profile response status:', profileResponse.status);
      console.log('Profile data:', profileData);
      
      if (profileResponse.ok) {
        console.log('✓ Authentication successful!');
        console.log('Profile retrieved:', profileData.email);
      } else {
        console.log('✗ Authentication failed');
      }
      
      // Test 3: Test login with the registered user
      console.log('\n3. Testing login with registered credentials...');
      const loginResponse = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testData.email,
          password: testData.password,
        }),
      });
      
      const loginData = await loginResponse.json();
      console.log('Login response status:', loginResponse.status);
      console.log('Login data:', loginData);
      
      if (loginResponse.ok && loginData.token) {
        console.log('✓ Login successful!');
      } else {
        console.log('✗ Login failed');
      }
      
      return { success: true, data };
    } else {
      console.log('✗ Registration failed');
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('✗ Test failed with error:', error);
    return { success: false, error: error.message };
  }
};

// Run the test
testSignup().then(result => {
  console.log('\n=== Test Complete ===');
  console.log('Result:', result);
});

