const http = require('http');

const data = JSON.stringify({
  username: 'admin',
  12345678: 'password'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    if (!json.accessToken) {
      console.error('Failed to login:', json);
      return;
    }
    const token = json.accessToken;
    
    // Now fetch reports with date range
    const reportReq = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/reports/sales-summary?fromDate=2020-01-01&toDate=2030-01-01',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }, (res2) => {
      let rBody = '';
      res2.on('data', chunk => rBody += chunk);
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        console.log('Body:', JSON.stringify(JSON.parse(rBody), null, 2));
      });
    });
    reportReq.end();
  });
});
req.write(data);
req.end();
