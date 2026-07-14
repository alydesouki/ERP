const API_BASE = "http://localhost:5001/api";

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password" })
  });
  const data = await res.json();
  const token = data.accessToken;
  return token;
}

async function testTreasury(token) {
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  const res = await fetch(`${API_BASE}/treasury/accounts`, { headers });
  const accountsData = await res.json();
  const acc1 = accountsData.items[0].id;
  const acc2 = accountsData.items[1].id;

  console.log("Treasury Account 1 balance:", accountsData.items[0].balance);
  console.log("Treasury Account 2 balance:", accountsData.items[1].balance);

  console.log("Testing transfer...");
  const tRes = await fetch(`${API_BASE}/treasury/transfers`, {
    method: "POST",
    headers,
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
    headers,
    body: JSON.stringify({
      treasuryAccountId: acc1,
      direction: "IN",
      amount: 5,
      reason: "Test adjust"
    })
  });
  console.log("Adjustment response:", aRes.status, await aRes.text());
}

async function testPayroll(token) {
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // 1. create employee
  console.log("Creating employee...");
  const empRes = await fetch(`${API_BASE}/finance/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Test Employee " + Date.now(),
      monthlySalary: 2000
    })
  });
  const emp = await empRes.json();
  const empId = emp.id;

  // 2. give advance
  console.log("Giving advance of 100 to employee...");
  // Need to get a treasury account to fund the advance
  const accRes = await fetch(`${API_BASE}/treasury/accounts`, { headers });
  const accData = await accRes.json();
  const treasuryAccountId = accData.items[0].id;

  const advRes = await fetch(`${API_BASE}/finance/advances`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empId,
      amount: 100,
      advanceDate: new Date().toISOString(),
      treasuryAccountId,
      notes: "Test advance"
    })
  });
  console.log("Advance response:", advRes.status, await advRes.text());

  // 3. create payroll
  console.log("Creating payroll...");
  const payRes = await fetch(`${API_BASE}/finance/salaries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      employeeId: empId,
      periodMonth: "2026-07-test" + Date.now(),
      payPeriodType: "MONTHLY",
      baseSalary: 2000,
      bonuses: 0,
      advanceDeduction: 100,
      otherDeductions: 0
    })
  });
  console.log("Payroll generation response:", payRes.status);
  const payData = await payRes.json();
  console.log(payData);

  // 4. check employee advance balance
  const empCheckRes = await fetch(`${API_BASE}/finance/employees`, { headers });
  const empCheckData = await empCheckRes.json();
  const finalEmp = empCheckData.items.find(e => e.id === empId);
  console.log("Employee outstanding advance balance (before payment):", finalEmp.advanceBalance);

  // 5. Pay the salary to update the advance balance
  console.log("Paying salary...");
  const payActionRes = await fetch(`${API_BASE}/finance/salaries/${payData.id}/pay`, {
    method: "POST",
    headers,
    body: JSON.stringify({ treasuryAccountId })
  });
  console.log("Salary payment response:", payActionRes.status, await payActionRes.text());

  // 6. check employee advance balance again
  const empFinalRes = await fetch(`${API_BASE}/finance/employees`, { headers });
  const empFinalData = await empFinalRes.json();
  const absolutelyFinalEmp = empFinalData.items.find(e => e.id === empId);
  console.log("Employee outstanding advance balance (after payment):", absolutelyFinalEmp.advanceBalance);

}

async function run() {
  const token = await login();
  if (!token) {
    console.error("Login failed");
    return;
  }
  console.log("Logged in");
  await testTreasury(token);
  await testPayroll(token);
}

run();
