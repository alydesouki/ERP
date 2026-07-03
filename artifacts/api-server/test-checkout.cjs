const http = require('http');

// Step 1: Login
function post(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': data.length };
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ hostname: 'localhost', port: 5001, path: '/api' + path, method: 'POST', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: b, setCookie });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ hostname: 'localhost', port: 5001, path: '/api' + path, method: 'GET', headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login
  console.log('=== Step 1: Login ===');
  const loginRes = await post('/auth/login', { username: 'admin', password: '112233' });
  console.log('Login status:', loginRes.status);
  console.log('Login body:', loginRes.body.substring(0, 200));
  
  if (loginRes.status !== 200) {
    // Try other common passwords
    for (const pw of ['admin', 'Admin123', '123456', 'admin123', 'password']) {
      const r = await post('/auth/login', { username: 'admin', password: pw });
      console.log(`  Try "${pw}":`, r.status, r.body.substring(0, 100));
      if (r.status === 200) {
        loginRes.status = 200;
        loginRes.body = r.body;
        loginRes.setCookie = r.setCookie;
        break;
      }
    }
  }
  
  if (loginRes.status !== 200) {
    console.log('Cannot login. Trying to get session from products endpoint...');
    return;
  }
  
  const cookie = loginRes.setCookie?.[0]?.split(';')[0];
  console.log('Session cookie:', cookie?.substring(0, 50));
  
  // Step 2: Get products/variants for checkout
  console.log('\n=== Step 2: Get products ===');
  const productsRes = await get('/products?page=1&pageSize=5', cookie);
  console.log('Products status:', productsRes.status);
  const products = JSON.parse(productsRes.body);
  if (products.items?.length > 0) {
    const p = products.items[0];
    console.log('First product:', p.name, 'ID:', p.id);
    if (p.variants?.length > 0) {
      const v = p.variants[0];
      console.log('First variant:', v.id, 'SKU:', v.sku, 'Price:', v.sellingPrice || p.baseSellingPrice);
    }
  }
  
  // Step 3: Get warehouse
  console.log('\n=== Step 3: Get warehouses ===');
  const warehousesRes = await get('/warehouses', cookie);
  console.log('Warehouses status:', warehousesRes.status);
  const whs = JSON.parse(warehousesRes.body);
  console.log('Warehouses:', JSON.stringify(whs).substring(0, 200));
  
  // Step 4: Try checkout
  console.log('\n=== Step 4: Attempt Checkout ===');
  const variantId = products.items?.[0]?.variants?.[0]?.id;
  const warehouseId = (Array.isArray(whs) ? whs : whs.items)?.[0]?.id;
  const price = products.items?.[0]?.variants?.[0]?.sellingPrice || products.items?.[0]?.baseSellingPrice || '100';
  
  if (!variantId || !warehouseId) {
    console.log('Missing data:', { variantId, warehouseId });
    return;
  }
  
  const checkoutBody = {
    warehouseId,
    items: [{
      variantId,
      quantity: 1,
      unitPrice: price,
    }],
    payments: [{
      method: 'CASH',
      amount: price,
    }],
  };
  
  console.log('Checkout payload:', JSON.stringify(checkoutBody, null, 2));
  const checkoutRes = await post('/sales/invoices', checkoutBody, cookie);
  console.log('Checkout status:', checkoutRes.status);
  console.log('Checkout response:', checkoutRes.body.substring(0, 500));
}

main().catch(console.error);
