const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require('../assets/data.js');
const model = require('../assets/site.js');
const manifest = require('../assets/materials/manifest.json');
const check = process.argv.includes('--check');
const escape = model.escapeHtml;
const files = model.uniqueFiles(manifest);
const records = model.filterRecords(model.catalogueRecords(manifest));
const sections = data.sections.filter((section) => section.available !== false);
let changed = 0;

const directory = sections.map((section) => {
  const local = files.filter((file) => file.sections.includes(section.slug)).length;
  const online = new Set(data.resources.filter((resource) => resource.section === section.slug && /^https?:/.test(resource.href)).map((resource) => resource.href)).size;
  const count = [local ? `${local} files` : '', online ? `${online} online activities` : ''].filter(Boolean).join(' · ');
  return `<a class="section-directory__item" href="${escape(section.href)}"><span class="section-directory__group">${escape(section.group)}</span><h3>${escape(section.title)}</h3><p>${escape(section.desc)}</p><small class="section-directory__count" data-section-count="${section.slug}">${count || 'No materials yet'}</small><b aria-hidden="true">→</b></a>`;
}).join('');

const fileList = `<!-- generated:file-list --><details class="fallback-materials" id="file-list" data-static-library><summary>Complete list: ${files.length} files and ${records.length - files.length} online activities</summary><p>This list works without search. File links open the original document directly. Online activities open in a new tab.</p><ul>${records.map((record) => `<li><a href="${escape(record.externalResource ? record.href : record.local)}"${record.externalResource ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(record.title)}</a> — ${escape(record.format)}${record.externalResource ? ' (new tab)' : ''}</li>`).join('')}</ul></details><!-- /generated:file-list -->`;

for (const name of fs.readdirSync(root).filter((name) => name.endsWith('.html') && !/^(?:material|section)-/.test(name))) {
  const filePath = path.join(root, name);
  const original = fs.readFileSync(filePath, 'utf8');
  const page = original.match(/data-page="([^"]+)"/)?.[1] || '';
  let html = original
    .replace(/<header data-site-header>[\s\S]*?<\/header>/, `<header data-site-header>${model.headerMarkup(page)}</header>`)
    .replace(/<footer data-site-footer>[\s\S]*?<\/footer>/, `<footer data-site-footer>${model.footerMarkup(2026)}</footer>`)
    .replace(/(assets\/(?:styles\.css|site\.js|data\.js))\?v=[^"']+/g, `$1?v=${model.assetRevision}`)
    .replace(/(<div class="resource-grid[^"]*" data-resource-grid="([^"]+)">)[\s\S]*?<\/div>/g, (_, opening, section) => `${opening}${data.resources.filter((resource) => resource.section === section).map((resource) => model.resourceCard(resource)).join('')}</div>`)
    .replace(/(<div class="section-directory__grid" data-section-directory>)[\s\S]*?<\/div>/, `$1${directory}</div>`);

  if (page === 'library') {
    if (html.includes('<!-- generated:file-list -->')) html = html.replace(/<!-- generated:file-list -->[\s\S]*?<!-- \/generated:file-list -->/, fileList);
    else html = html.replace('<div class="catalogue-more" data-catalogue-more></div>', `<div class="catalogue-more" data-catalogue-more></div>${fileList}`);
  }
  if (['material', 'section'].includes(page)) {
    const fallback = page === 'material'
      ? '<section class="page-intro"><div class="container"><h1>English learning material</h1><p>The material details will load here. You can also open any file directly from the complete list.</p><a class="button button--light" href="library.html#file-list">Open the complete file list →</a></div></section>'
      : `<section class="page-intro"><div class="container"><h1>English learning sections</h1><p>Choose a section below or open the complete file list.</p><a class="button button--light" href="library.html#file-list">Browse all files →</a></div></section><section class="section section--dark"><div class="container"><div class="section-directory__grid">${directory}</div></div></section>`;
    html = html.replace(new RegExp(`(<main id="main" data-${page}-page>)[\\s\\S]*?<\\/main>`), `$1${fallback}</main>`);
  }
  html = staticFiles(html);
  if (name === '404.html') {
    html = html.replace(/\b(href|src|action)="(?!https?:|mailto:|#|\/)([^\"]+)"/g, '$1="/english-materials/$2"');
  }
  if (html !== original) {
    changed += 1;
    if (!check) fs.writeFileSync(filePath, html);
    else console.error(`Static content is out of date: ${name}`);
  }
}
if (check && changed) process.exitCode = 1;
console.log(check ? `Static content checked (${changed} differences).` : `Updated ${changed} static pages.`);

// Detail pages use the same markup as the legacy query routes. Social crawlers
// receive the actual title and description without needing JavaScript.
function staticFiles(html) {
  return html.replace(/<!-- generated:local:([^ ]+) -->[\s\S]*?<!-- \/generated:local -->|<div data-local-materials="([^"]+)"[^>]*>[\s\S]*?<\/div>/g, (_, generatedSlug, rawSlug) => {
    const slug = generatedSlug || rawSlug;
    const matching = files.filter((file) => file.sections.includes(slug)).sort((a, b) => model.displayFileTitle(a).localeCompare(model.displayFileTitle(b)));
    return `<!-- generated:local:${escape(slug)} --><div data-local-materials="${escape(slug)}" data-static-files="true">${matching.length ? `<details class="fallback-materials"><summary>Show all ${matching.length} materials</summary><div class="local-file-list">${matching.map(model.localFileCard).join('')}</div></details>` : '<p>Choose an online activity above to start practising.</p>'}</div><!-- /generated:local -->`;
  });
}
function detailPage(template, title, description, route, markup, schema) {
  const url = new URL(route, 'https://tomjohnsonde.github.io/english-materials/').href;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)} · Intermediate English Materials</title>`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*/g, `$1${escape(description)}`)
    .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*/g, `$1${escape(title)} · Intermediate English Materials`)
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<meta property="og:url"[^>]*>/g, '')
    .replace('</head>', `    <link rel="canonical" href="${escape(url)}" />\n    <meta property="og:url" content="${escape(url)}" />\n    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...schema, url }).replace(/</g, '\\u003c')}</script>\n  </head>`)
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
    .replace(/(<main id="main" data-(?:material|section)-page)[^>]*>[\s\S]*?<\/main>/, `$1 data-static-detail="true">${staticFiles(markup)}</main>`);
}
const generated = new Set();
function writeGenerated(name, html) {
  generated.add(name);
  const filePath = path.join(root, name);
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== html) {
    changed++;
    if (check) { console.error(`Static detail is out of date: ${name}`); process.exitCode = 1; }
    else fs.writeFileSync(filePath, html);
  }
}
const materialTemplate = fs.readFileSync(path.join(root, 'material.html'), 'utf8');
const sectionTemplate = fs.readFileSync(path.join(root, 'section.html'), 'utf8');
for (const file of files) {
  const record = model.archiveRecord(file);
  writeGenerated(model.materialRoute(file.local), detailPage(materialTemplate, record.title, record.description, model.materialRoute(file.local), model.materialMarkup(manifest, file), {
    '@type': 'LearningResource', name: record.title, description: record.description, inLanguage: 'en',
    learningResourceType: file.activityType || 'Learning material',
    ...(file.level ? { educationalLevel: file.level } : {}),
    ...(file.estimatedMinutes ? { timeRequired: `PT${file.estimatedMinutes}M` } : {}),
    encoding: { '@type': 'MediaObject', contentUrl: new URL(file.local, 'https://tomjohnsonde.github.io/english-materials/').href, encodingFormat: record.format }
  }));
}
for (const section of sections.filter((section) => section.legacyHref)) {
  writeGenerated(section.href, detailPage(sectionTemplate, section.title, section.desc, section.href, model.sectionMarkup(section), {
    '@type': 'CollectionPage', name: section.title, description: section.desc, inLanguage: 'en'
  }));
}
console.log(`Checked ${generated.size} complete detail pages with static metadata.`);
