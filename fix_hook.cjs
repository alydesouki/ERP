const fs = require('fs');

let content = fs.readFileSync('lib/api-client-react/src/generated/api.ts', 'utf8');

const regex = /export const getAdjustSupplierBalanceUrl = \(id: string,\) => \/api\/suppliers\/\/adjust/g;
content = content.replace(regex, 'export const getAdjustSupplierBalanceUrl = (id: string,) => /api/suppliers/{id}/adjust');

fs.writeFileSync('lib/api-client-react/src/generated/api.ts', content);
console.log('Fixed api.ts');
