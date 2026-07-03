
const http = require('http');
const req = http.request({
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).accessToken;
    const reportReq = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/reports/sales-summary?fromDate=2020-01-01&toDate=2030-01-01',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => console.log('Status:', res2.statusCode, 'Body:', data2));
    });
    reportReq.end();
  });
});
req.write(JSON.stringify({ username: 'admin', password: '12345678' }));
req.end();

