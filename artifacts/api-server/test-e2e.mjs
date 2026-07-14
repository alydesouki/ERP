const API_BASE = "http://localhost:5001/api";

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password" })
  });
  const data = await res.json();
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return cookie;
}

async function testTreasury(cookie) {
  const res = await fetch(`${API_BASE}/treasury/accounts`, { headers: { Cookie: cookie } });
  const data = await res.json();
  const acc1 = data[0].id;
  const acc2 = data[1].id;

  console.log("Testing transfer...");
  const tRes = await fetch(`${API_BASE}/treasury/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      fromAccountId: acc1,
      toAccountId: acc2,
      amount: 5,
      description: "Test transfer"
    })
  });
  console.log("Transfer response:", tRes.status, await tRes.text());

  console.log("Testing adjustment...");
  const aRes = await fetch(`${API_BASE}/treasury/adjustments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      treasuryAccountId: acc1,
      direction: "IN",
      amount: 5,
      reason: "Test adjust"
    })
  });
  console.log("Adjustment response:", aRes.status, await aRes.text());
}

async function run() {
  const cookie = await login();
  if (!cookie) {
    console.error("Login failed");
    return;
  }
  console.log("Logged in");
  await testTreasury(cookie);
}

run();
