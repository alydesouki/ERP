async function run() {
  try {
    const res = await fetch("http://localhost:8000/api/dashboard/kpis", {
      headers: {
        // Need to bypass auth or login first.
        // Wait, the API requires a JWT token.
      }
    });
    console.log(res.status);
  } catch (err) {
    console.error(err);
  }
}
run();
