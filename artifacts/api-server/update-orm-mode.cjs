const fs = require('fs');
const path = require('path');

const schemaDir = path.resolve(__dirname, '../../lib/db/src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.ts'));

let changedFiles = 0;

for (const file of files) {
  const filePath = path.join(schemaDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('mode: "timestamp"')) {
    const updated = content.replace(/mode: "timestamp"/g, 'mode: "timestamp_ms"');
    fs.writeFileSync(filePath, updated, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Updated ${changedFiles} files to timestamp_ms mode.`);
