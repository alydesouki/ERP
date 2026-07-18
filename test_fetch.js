const fetch = require('node-fetch'); // wait, fetch is native in Node 18+

async function run() {
  try {
    const res = await fetch("http://localhost:5001/api/dashboard/debug-kpis");
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
