const fs = require('node:fs');
const catalog = JSON.parse(fs.readFileSync('record-catalog.json', 'utf8'));
function update(value) {
  if (Array.isArray(value)) return value.forEach(update);
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item.startsWith('/assets/records/') && item.endsWith('.png')) {
      value[key] = item.replace(/\.png$/, '.webp');
    } else update(item);
  }
}
update(catalog);
fs.writeFileSync('record-catalog.json', JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync('catalog-data.js', 'window.__xiangyinCatalog = ' + JSON.stringify(catalog) + ';\n');
