const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const model = require('../assets/site.js');

const root = path.resolve(__dirname, '..');
const checkExternal = process.argv.includes('--external');
const reportPath = path.join(root, 'reports', checkExternal ? 'external-links.json' : 'site-check.json');
const errors = [];
const warnings = [];

function file(relative) {
  return path.join(root, relative);
}

function exists(relative, label) {
  if (!fs.existsSync(file(relative))) errors.push(`${label}: ${relative}`);
}

function readData() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file('assets/data.js'), 'utf8'), sandbox);
  return sandbox.siteData;
}

function localHrefs(html) {
  const found = [];
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(href)) continue;
    found.push(decodeURIComponent(href.split('#')[0].split('?')[0].replace(/^\/english-materials\//, '')));
  }
  return found.filter(Boolean);
}

function externalHrefs(html) {
  const found = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)/gi)) found.push(match[1].replaceAll('&amp;', '&'));
  return found;
}

function sameBytes(actual, expected) {
  return fs.statSync(actual).size === expected;
}

async function externalReport(urls) {
  const results = [];
  const queue = [...urls];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'EnglishMaterials-LinkCheck/1.0' } });
        const status = response.status;
        let excerpt = '';
        if (response.body) {
          const reader = response.body.getReader();
          const chunks = [];
          let bytes = 0;
          try {
            while (bytes < 65536) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value); bytes += value.length;
            }
            excerpt = Buffer.concat(chunks).subarray(0, 65536).toString('utf8');
          } finally { await reader.cancel().catch(() => {}); }
        }
        const title = excerpt.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim();
        const blocked = [401, 403, 429].includes(status) || /captcha|just a moment|access denied|checking your browser/i.test(title || '');
        const softError = status < 400 && /page not found|404 not found|domain for sale/i.test(title || '');
        const outcome = blocked ? 'manual-review' : status >= 400 || softError ? 'unavailable' : 'reachable';
        const item = { url, status, destination: response.url, title, outcome, ok: outcome === 'reachable', contentVerified: false };
        if (outcome === 'unavailable') errors.push(`External link unavailable (${status}): ${url}`);
        else if (!item.ok) warnings.push(`External link ${outcome} (${status}): ${url}`);
        results.push(item);
      } catch (error) {
        warnings.push(`External link could not be checked: ${url}`);
        results.push({ url, ok: false, outcome: 'check-failed', contentVerified: false, error: error.cause?.code || error.message });
      }
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.url.localeCompare(right.url));
}

async function main() {
  const data = readData();
  const dataSource = fs.readFileSync(file('assets/data.js'), 'utf8');
  if (/myintermediatematerials\.weebly\.com|tomsmaterials\.weebly\.com/i.test(dataSource)) errors.push('Old Weebly URL remains in assets/data.js');
  const manifest = JSON.parse(fs.readFileSync(file('assets/materials/manifest.json'), 'utf8'));
  const rootFiles = ['index.html', 'grammar.html', 'medical-english.html', 'speaking.html', 'library.html', 'section.html', 'material.html', 'contact.html', 'courses.html', '404.html', 'unavailable.html', 'qr.html', 'robots.txt', 'sitemap.xml'];
  rootFiles.forEach((relative) => exists(relative, 'Required site file is missing'));
  ['assets/styles.css', 'assets/data.js', 'assets/site.js', 'assets/favicon.svg', 'assets/site.webmanifest', 'assets/social-card.png', 'assets/qr-english-materials.png'].forEach((relative) => exists(relative, 'Required site asset is missing'));

  manifest.forEach((item) => {
    if (!String(item.title || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '')) errors.push(`Material has an empty title: ${item.local}`);
    exists(item.local, 'Material file is missing');
    if (fs.existsSync(file(item.local)) && !sameBytes(file(item.local), item.bytes)) errors.push(`Material size differs from manifest: ${item.local}`);
    item.sections.forEach((slug) => {
      if (slug !== 'home' && !data.sections.some((section) => section.slug === slug)) errors.push(`Material uses an unknown section (${slug}): ${item.local}`);
    });
  });
  const hashes = new Map();
  manifest.forEach((item) => {
    if (!fs.existsSync(file(item.local))) return;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file(item.local))).digest('hex');
    const canonical = item.canonical || item.local;
    if (item.canonical) {
      const target = manifest.find((candidate) => candidate.local === item.canonical);
      if (!target || target.canonical) errors.push(`Invalid canonical material: ${item.local}`);
      else if (!fs.readFileSync(file(item.local)).equals(fs.readFileSync(file(target.local)))) errors.push(`Alias is not an identical file: ${item.local}`);
    }
    if (hashes.has(hash) && hashes.get(hash) !== canonical) errors.push(`Duplicate file has no shared canonical record: ${item.local}`);
    hashes.set(hash, canonical);
  });
  const records = model.catalogueRecords(manifest);
  if (model.filterRecords(records).some((record) => record.available === false)) errors.push('Unavailable resources appear in the default catalogue.');
  if (model.filterRecords(records, { query: 'B1' }).some((record) => record.level !== 'B1')) errors.push('B1 search contains an unlabelled level.');

  const siteHtml = fs.readdirSync(root).filter((name) => name.endsWith('.html')); 
  const pageExternalUrls = [];
  siteHtml.forEach((page) => {
    const html = fs.readFileSync(file(page), 'utf8');
    if (!/<header data-site-header>[\s\S]*?<nav/.test(html)) errors.push(`Static navigation is missing in ${page}`);
    if (!html.includes(`site.js?v=${model.assetRevision}`) || !html.includes(`styles.css?v=${model.assetRevision}`) || !html.includes(`data.js?v=${model.assetRevision}`)) errors.push(`Asset versions are inconsistent in ${page}`);
    if (/myintermediatematerials\.weebly\.com/i.test(html)) errors.push(`Old Weebly URL remains in ${page}`);
    if (!/<meta name="theme-color" content="#111214" \/>/.test(html)) errors.push(`Theme colour metadata is missing in ${page}`);
    if (!/assets\/favicon\.svg\?v=[^"']+/.test(html)) errors.push(`Favicon cache revision is missing in ${page}`);
    if (!/assets\/site\.webmanifest\?v=[^"']+/.test(html)) errors.push(`Web manifest cache revision is missing in ${page}`);
    if (!/assets\/styles\.css\?v=[^"']+/.test(html)) errors.push(`Stylesheet cache revision is missing in ${page}`);
    if (!/assets\/data\.js\?v=[^"']+/.test(html) || !/assets\/site\.js\?v=[^"']+/.test(html)) errors.push(`Script cache revision is missing in ${page}`);
    localHrefs(html).forEach((href) => exists(href, `Broken local reference in ${page}`));
    for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
      match[1].split(',').forEach((candidate) => exists(candidate.trim().split(/\s+/)[0], `Broken responsive image in ${page}`));
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    if (new Set(ids).size !== ids.length) errors.push(`Duplicate HTML IDs in ${page}`);
    pageExternalUrls.push(...externalHrefs(html));
  });
  if (/<meta name="robots" content="noindex" \/>/.test(fs.readFileSync(file('material.html'), 'utf8'))) errors.push('Material pages are incorrectly marked noindex.');
  ['404.html', 'unavailable.html', 'qr.html'].forEach((page) => {
    if (!/<meta name="robots" content="noindex" \/>/.test(fs.readFileSync(file(page), 'utf8'))) errors.push(`${page} should be marked noindex.`);
  });
  const homeHtml = fs.readFileSync(file('index.html'), 'utf8');
  if (!/class="teacher-intro"[\s\S]*Learn English with confidence\.[\s\S]*data-resource-grid="home"[\s\S]*class="material-finder"[\s\S]*<h2 id="material-finder-title">Find materials<\/h2>[\s\S]*class="materials-search"/.test(homeHtml)) errors.push('Home page should show featured resources before a compact, searchable materials panel.');
  if (/Find your route|Choose a topic|data-topic-grid/.test(homeHtml)) errors.push('The removed topic-routing block is still present on the home page.');
  if (/Study tip|Suggested activity|Try this sequence/i.test(siteHtml.map((page) => fs.readFileSync(file(page), 'utf8')).join('\n'))) errors.push('A removed recommendation block is still present.');

  data.resources.filter((resource) => resource.href.startsWith('assets/')).forEach((resource) => exists(resource.href, `Resource is missing (${resource.title})`));
  data.navigation.forEach((item) => exists(item.href.split('?')[0], `Navigation page is missing (${item.label})`));
  data.sections.filter((section) => section.available !== false).forEach((section) => exists(section.href.split('?')[0], `Section page is missing (${section.title})`));
  data.sections.filter((section) => section.available !== false).forEach((section) => {
    if (!data.sectionTopics?.[section.slug]) warnings.push(`Section has no search metadata: ${section.title}`);
  });

  const sitemap = fs.readFileSync(file('sitemap.xml'), 'utf8');
  const expectedSitemapEntries = data.sections.filter((section) => section.available !== false).length + model.uniqueFiles(manifest).length;
  const sitemapCount = (sitemap.match(/<url>/g) || []).length;
  if (sitemapCount < expectedSitemapEntries) errors.push(`Sitemap has too few URLs (${sitemapCount}; expected at least ${expectedSitemapEntries}).`);
  if (/myintermediatematerials\.weebly\.com/i.test(sitemap)) errors.push('Old Weebly URL remains in sitemap.xml');

  const externalUrls = [...new Set([
    ...data.resources.filter((resource) => /^https?:\/\//.test(resource.href)).map((resource) => resource.href),
    ...pageExternalUrls
  ])];
  const external = checkExternal
    ? await externalReport(externalUrls)
    : [];
  const report = {
    generatedAt: new Date().toISOString(),
    externalLinksChecked: checkExternal,
    legacyHttpLinks: externalUrls.filter((url) => url.startsWith('http://')),
    materialCount: manifest.length,
    uniqueMaterialCount: model.uniqueFiles(manifest).length,
    availableCatalogueCount: model.filterRecords(records).length,
    sitemapUrlCount: sitemapCount,
    errors,
    warnings,
    external
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Checked ${manifest.length} material files and ${sitemapCount} sitemap URLs.`);
  console.log(`Errors: ${errors.length}. Warnings: ${warnings.length}. Report: reports/${path.basename(reportPath)}`);
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
