// Run: pnpm node gen-hash.cjs from api-server dir
const bcrypt = require("bcryptjs");
bcrypt.hash("admin123", 12).then(h => {
  console.log(h);
  process.exit(0);
});
