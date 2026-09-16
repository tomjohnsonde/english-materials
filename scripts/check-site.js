const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'reports', 'site-check.json');
const checkExternal = process.argv.includes('--external');
const assetRevision = '20260916.2';
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
    found.push(href.split('#')[0].split('?')[0]);
  }
  return found.filter(Boolean);
}

function externalHrefs(html) {
  const found = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)/gi)) found.push(match[1]);
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
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000) });
        const status = response.status;
        const item = { url, status, destination: response.url, ok: status < 400 };
        if (!item.ok) warnings.push(`External link returned ${status}: ${url}`);
        results.push(item);
      } catch (error) {
        warnings.push(`External link could not be checked: ${url}`);
        results.push({ url, ok: false, error: error.message });
      }
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.url.localeCompare(right.url));
}

async function main() {
  const data = readData();
  const manifest = JSON.parse(fs.readFileSync(file('assets/materials/manifest.json'), 'utf8'));
  const rootFiles = ['index.html', 'grammar.html', 'medical-english.html', 'speaking.html', 'library.html', 'section.html', 'material.html', 'contact.html', 'courses.html', '404.html', 'unavailable.html', 'qr.html', 'robots.txt', 'sitemap.xml'];
  rootFiles.forEach((relative) => exists(relative, 'Required site file is missing'));
  ['assets/styles.css', 'assets/data.js', 'assets/site.js', 'assets/favicon.svg', 'assets/site.webmanifest', 'assets/social-card.png', 'assets/qr-english-materials.png'].forEach((relative) => exists(relative, 'Required site asset is missing'));

  manifest.forEach((item) => {
    exists(item.local, 'Material file is missing');
    if (fs.existsSync(file(item.local)) && !sameBytes(file(item.local), item.bytes)) errors.push(`Material size differs from manifest: ${item.local}`);
    item.sections.forEach((slug) => {
      if (slug !== 'home' && !data.sections.some((section) => section.slug === slug)) errors.push(`Material uses an unknown section (${slug}): ${item.local}`);
    });
  });

  const siteHtml = rootFiles.filter((name) => name.endsWith('.html'));
  const pageExternalUrls = [];
  siteHtml.forEach((page) => {
    const html = fs.readFileSync(file(page), 'utf8');
    if (/myintermediatematerials\.weebly\.com/i.test(html)) errors.push(`Old Weebly URL remains in ${page}`);
    if (!/<meta name="theme-color" content="#111214" \/>/.test(html)) errors.push(`Theme colour metadata is missing in ${page}`);
    if (!html.includes(`assets/favicon.svg?v=${assetRevision}`)) errors.push(`Favicon reference is missing or stale in ${page}`);
    if (!html.includes(`assets/site.webmanifest?v=${assetRevision}`)) errors.push(`Web manifest reference is missing or stale in ${page}`);
    if (!html.includes(`assets/styles.css?v=${assetRevision}`)) errors.push(`Stylesheet cache revision is missing or stale in ${page}`);
    if (!html.includes(`assets/data.js?v=${assetRevision}`) || !html.includes(`assets/site.js?v=${assetRevision}`)) errors.push(`Script cache revision is missing or stale in ${page}`);
    localHrefs(html).forEach((href) => exists(href, `Broken local reference in ${page}`));
    pageExternalUrls.push(...externalHrefs(html));
  });
  if (/<meta name="robots" content="noindex" \/>/.test(fs.readFileSync(file('material.html'), 'utf8'))) errors.push('Material pages are incorrectly marked noindex.');
  ['404.html', 'unavailable.html', 'qr.html'].forEach((page) => {
    if (!/<meta name="robots" content="noindex" \/>/.test(fs.readFileSync(file(page), 'utf8'))) errors.push(`${page} should be marked noindex.`);
  });
  const homeHtml = fs.readFileSync(file('index.html'), 'utf8');
  if (!/<p class="eyebrow">For focused learners<\/p>\s*<h1>English Materials<\/h1>/.test(homeHtml)) errors.push('Home page hero does not use the requested focused-learners wording.');
  if (/Study tip|Suggested activity|Try this sequence/i.test(siteHtml.map((page) => fs.readFileSync(file(page), 'utf8')).join('\n'))) errors.push('A removed recommendation block is still present.');

  data.resources.filter((resource) => resource.href.startsWith('assets/')).forEach((resource) => exists(resource.href, `Resource is missing (${resource.title})`));
  data.navigation.forEach((item) => exists(item.href.split('?')[0], `Navigation page is missing (${item.label})`));
  data.sections.filter((section) => section.available !== false).forEach((section) => exists(section.href.split('?')[0], `Section page is missing (${section.title})`));
  data.sections.filter((section) => section.available !== false).forEach((section) => {
    if (!data.sectionTopics?.[section.slug]) warnings.push(`Section has no search metadata: ${section.title}`);
  });

  const sitemap = fs.readFileSync(file('sitemap.xml'), 'utf8');
  const expectedSitemapEntries = data.sections.filter((section) => section.available !== false).length + manifest.length;
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
    materialCount: manifest.length,
    sitemapUrlCount: sitemapCount,
    errors,
    warnings,
    external
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Checked ${manifest.length} material files and ${sitemapCount} sitemap URLs.`);
  console.log(`Errors: ${errors.length}. Warnings: ${warnings.length}. Report: reports/site-check.json`);
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
