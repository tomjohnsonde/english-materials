const fs = require('fs');
const path = require('path');
const vm = require('vm');

const model = require('../assets/site.js');
const root = path.resolve(__dirname, '..');
const origin = 'https://tomjohnsonde.github.io/english-materials/';
const sitemapPath = path.join(root, 'sitemap.xml');

function readData() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/data.js'), 'utf8'), sandbox);
  return sandbox.siteData;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function absoluteUrl(relative) {
  return new URL(relative, origin).href;
}

const data = readData();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/materials/manifest.json'), 'utf8'));
const staticPages = ['index.html', 'grammar.html', 'medical-english.html', 'speaking.html', 'library.html', 'contact.html', 'courses.html'];
const urls = new Set([
  origin,
  ...staticPages.filter((page) => page !== 'index.html').map(absoluteUrl),
  ...data.sections.filter((section) => section.available !== false).map((section) => absoluteUrl(section.href)),
  ...manifest.filter((file) => !file.canonical).map((file) => absoluteUrl(model.materialRoute(file.local)))
]);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].sort().map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(sitemapPath) || fs.readFileSync(sitemapPath, 'utf8') !== xml) {
    console.error('sitemap.xml is out of date. Run: node scripts/generate-sitemap.js');
    process.exit(1);
  }
  console.log(`Sitemap is current (${urls.size} URLs).`);
} else {
  fs.writeFileSync(sitemapPath, xml);
  console.log(`Generated sitemap.xml with ${urls.size} URLs.`);
}
