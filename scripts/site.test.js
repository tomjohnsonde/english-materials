const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const model = require('../assets/site.js');
const manifest = require('../assets/materials/manifest.json');
const records = model.catalogueRecords(manifest);

function context(extra = {}) {
  const sandbox = { URL, URLSearchParams, setTimeout, clearTimeout, module: { exports: {} }, ...extra };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/data.js'), 'utf8'), sandbox);
  sandbox.module = { exports: {} };
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/site.js'), 'utf8'), sandbox);
  return { api: sandbox.module.exports, sandbox };
}

function element() {
  return {
    value: '', textContent: '', innerHTML: '', hidden: true, open: false, disabled: true,
    handlers: {}, attributes: {}, children: [], focused: false,
    addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; }, select() { this.selected = true; },
    scrollIntoView() { this.scrolled = true; }
  };
}

test('the catalogue keeps all old files and suppresses exact duplicates', () => {
  assert.equal(manifest.length, 221);
  assert.equal(model.uniqueFiles(manifest).length, 214);
  assert.equal(new Set(model.uniqueFiles(manifest).map((file) => file.local)).size, 214);
  for (const file of manifest) assert.ok(fs.existsSync(path.join(root, file.local)));
  const paths = model.filterRecords(records).map((record) => record.local || record.href);
  assert.equal(new Set(paths).size, paths.length);
});

test('unavailable links have their own filter and are absent from ordinary results', () => {
  assert.equal(model.filterRecords(records).length, 321);
  assert.equal(model.filterRecords(records, { format: 'ONLINE' }).length, 107);
  const unavailable = model.filterRecords(records, { format: 'UNAVAILABLE' });
  assert.equal(unavailable.length, 5);
  assert.ok(unavailable.every((record) => record.available === false && !model.catalogueItem(record).includes('ONLINE ·')));
});

test('level search does not match encoded game data or random URL identifiers', () => {
  const b1 = model.filterRecords(records, { query: 'B1' });
  assert.deepEqual(b1.map((record) => record.title), ['Listening skills']);
  const b2 = model.filterRecords(records, { level: 'B2' });
  assert.ok(b2.length > 0);
  assert.ok(b2.every((record) => record.level === 'B2'));
  assert.equal(model.filterRecords(records, { query: 'B1', level: 'B2' }).length, 0);
});

test('search keeps typo tolerance and uses all terms and filters', () => {
  assert.ok(model.filterRecords(records, { query: 'conditonals' }).some((record) => /conditionals/i.test(record.title)));
  const filtered = model.filterRecords(records, { query: 'present perfect', section: 'grammar', format: 'PDF' });
  assert.ok(filtered.some((record) => /present perfect/i.test(record.title)));
  assert.ok(filtered.every((record) => record.format === 'PDF' && record.sections.some((section) => section.slug === 'grammar')));
});

test('non-Latin input is preserved and never silently treated as an empty search', () => {
  assert.equal(model.normalizeSearchText('грамматика'), 'грамматика');
  assert.equal(model.filterRecords(records, { query: 'грамматика' }).length, 0);
  assert.equal(model.filterRecords(records, { query: '!!!' }).length, 0);
  assert.equal(model.normalizeSearchText('Mülheim'), 'mulheim');
});

test('blank invisible titles fall back to readable file names', () => {
  assert.equal(model.displayFileTitle({ title: '\u200b', local: 'assets/materials/a-useful-exercise.pdf' }), 'A Useful Exercise');
  assert.ok(records.every((record) => record.title.replace(/[\s\u200B-\u200D\uFEFF]/g, '')));
});

test('enquiries preserve punctuation and reject whitespace-only fields', () => {
  const fields = Object.freeze({ fullName: '  Test & Example  ', email: 'example+tag@example.invalid', message: 'Question?\nA + B & C' });
  const enquiry = model.prepareEnquiry(fields);
  const params = new URL(enquiry.href).searchParams;
  assert.equal(params.get('body'), 'Name: Test & Example\nEmail: example+tag@example.invalid\n\nMessage:\nQuestion?\nA + B & C');
  assert.equal(fields.fullName, '  Test & Example  ');
  assert.equal(model.prepareEnquiry({ ...fields, message: '  ' }), null);
});

function contact(valid = true, clipboard = async () => {}) {
  const form = element(), status = element(), copy = element(), preview = element(), previewText = element(), submit = element();
  const values = { fullName: 'Local test', email: 'local@example.invalid', message: 'Keep this message' };
  form.checkValidity = () => valid;
  form.reportValidity = () => { form.validationShown = true; };
  form.reset = () => { throw new Error('The form must never be reset before sending'); };
  form.querySelector = (selector) => ({ '[data-copy-enquiry]': copy, '[data-enquiry-preview]': preview, '[data-enquiry-text]': previewText })[selector];
  form.querySelectorAll = () => [submit, copy];
  const location = {};
  const { api } = context({
    document: { body: { dataset: { page: 'contact' } }, querySelector: (selector) => selector === '[data-contact-form]' ? form : status },
    FormData: class { *[Symbol.iterator]() { yield* Object.entries(values); } },
    window: { location }, navigator: { clipboard: { writeText: clipboard } }
  });
  api.handleContactForm();
  return { form, status, copy, preview, previewText, submit, values, location };
}

test('preparing an email retains the message and never claims it was sent', () => {
  const ui = contact();
  let prevented = false;
  ui.form.handlers.submit({ preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(ui.values.message, 'Keep this message');
  assert.match(ui.location.href, /^mailto:/);
  assert.match(ui.status.textContent, /Send it from your email app/);
  assert.equal(ui.submit.disabled, false);
});

test('invalid enquiries neither open an email app nor discard input', () => {
  const ui = contact(false);
  ui.form.handlers.submit({ preventDefault() {} });
  assert.equal(ui.location.href, undefined);
  assert.equal(ui.values.message, 'Keep this message');
  assert.ok(ui.form.validationShown);
});

test('clipboard failure exposes the complete email for manual copying', async () => {
  const ui = contact(true, async () => { throw new Error('Denied'); });
  await ui.copy.handlers.click();
  assert.equal(ui.preview.hidden, false);
  assert.match(ui.previewText.value, /Keep this message/);
  assert.ok(ui.previewText.focused && ui.previewText.selected);
});

test('a failed manifest request can be retried and a successful response is shared', async () => {
  let calls = 0;
  const { api } = context({ fetch: async () => { calls++; if (calls === 1) throw new Error('offline'); return { ok: true, json: async () => manifest }; } });
  await assert.rejects(api.fetchManifest(), /offline/);
  assert.equal((await api.fetchManifest()).length, 221);
  await api.fetchManifest();
  assert.equal(calls, 2);
});

function material(query, fail = false) {
  const main = element(), metas = new Map();
  main.querySelector = () => element();
  const doc = {
    body: { dataset: { page: 'material' } }, head: { append(node) { metas.set(`${node.attributes.name || node.attributes.property || node.attributes.rel}`, node); } },
    createElement: element,
    querySelector(selector) {
      if (selector === '[data-material-page]') return main;
      const key = selector.match(/(?:name|property|rel)="([^"]+)"/)?.[1];
      return metas.get(key);
    }
  };
  const { api } = context({ document: doc, window: { location: { search: query } }, fetch: async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => manifest }; } });
  return { api, main, metas };
}

test('unknown materials are noindex, including traversal-shaped requests', async () => {
  for (const file of ['assets/materials/missing.pdf', 'assets/materials/../../contact.html', 'https://example.invalid/a.pdf']) {
    const ui = material(`?file=${encodeURIComponent(file)}`);
    await ui.api.renderMaterialPage();
    assert.equal(ui.metas.get('robots').attributes.content, 'noindex');
    assert.match(ui.main.innerHTML, /Material not found/);
  }
});

test('network failure is recoverable and does not label an existing file as missing', async () => {
  const ui = material(`?file=${encodeURIComponent(manifest[0].local)}`, true);
  await ui.api.renderMaterialPage();
  assert.match(ui.main.innerHTML, /Unable to load this material/);
  assert.match(ui.main.innerHTML, /data-retry-material/);
  assert.equal(ui.metas.has('robots'), false);
});

test('old duplicate routes resolve to a canonical detail and put actions before preview in DOM', async () => {
  const alias = manifest.find((file) => file.canonical);
  const ui = material(`?file=${encodeURIComponent(alias.local)}`);
  await ui.api.renderMaterialPage();
  assert.ok(ui.metas.get('canonical').attributes.href.endsWith(model.materialRoute(alias.canonical)));
  assert.ok(ui.main.innerHTML.indexOf('class="material-sidebar"') < ui.main.innerHTML.indexOf('class="material-preview"'));
  assert.match(ui.main.innerHTML, /download/);
});

async function library(url, fail = false) {
  const elements = Object.fromEntries(['[data-library-grid]', '[data-library-search]', '[data-catalogue-controls]', '[data-results-note]', '[data-search-summary]', '[data-search-jump]', '[data-catalogue-more]', '[data-static-library]', '[data-section-filter]', '[data-format-filter]', '[data-level-filter]', '[data-clear-filters]', '#catalogue'].map((key) => [key, element()]));
  elements['[data-catalogue-controls]'].querySelector = (key) => elements[key];
  elements['[data-library-grid]'].querySelector = () => element();
  const location = new URL(url);
  const { api } = context({ document: { body: { dataset: { page: 'library' } }, querySelector: (key) => elements[key] }, window: { location }, history: { replaceState() {} }, fetch: async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => manifest }; } });
  await api.renderLibrary();
  return elements;
}

test('the library shows initial results and a nearby count', async () => {
  const ui = await library('https://example.invalid/library.html');
  assert.match(ui['[data-results-note]'].textContent, /Showing 24 of 321/);
  assert.equal(ui['[data-search-summary]'].textContent, '321 resources found.');
  assert.equal(ui['[data-static-library]'].hidden, true);
});

test('a search link jumps to results and non-Latin queries get a useful empty state', async () => {
  const ui = await library('https://example.invalid/library.html?q=грамматика');
  assert.equal(ui['[data-results-note]'].textContent, 'No resources found');
  assert.match(ui['[data-search-summary]'].textContent, /English topic/);
  assert.equal(ui['#catalogue'].scrolled, true);
});

test('library failure and explicit file-list links retain a usable static list', async () => {
  const failed = await library('https://example.invalid/library.html', true);
  assert.equal(failed['[data-static-library]'].hidden, false);
  assert.equal(failed['[data-static-library]'].open, true);
  assert.match(failed['[data-library-grid]'].innerHTML, /data-retry-library/);
  const direct = await library('https://example.invalid/library.html#file-list');
  assert.equal(direct['[data-static-library]'].hidden, false);
});

test('static HTML has navigation, direct file access and safe form defaults', () => {
  const libraryHtml = fs.readFileSync(path.join(root, 'library.html'), 'utf8');
  assert.match(libraryHtml, /<header data-site-header>[\s\S]*aria-label="Main navigation"/);
  assert.match(libraryHtml, /data-static-library/);
  for (const file of model.uniqueFiles(manifest)) assert.ok(libraryHtml.includes(`href="${model.escapeHtml(file.local)}"`));
  const contactHtml = fs.readFileSync(path.join(root, 'contact.html'), 'utf8');
  assert.match(contactHtml, /type="submit" disabled/);
  const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
  assert.doesNotMatch(notFound, /(?:href|src|action)="(?:assets\/|index\.html|library\.html)/);
});

test('the portrait uses small responsive files and all named variants exist', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<picture>/);
  assert.doesNotMatch(html, /src="assets\/tom-johnson-illustrated-portrait.png"/);
  for (const file of ['tom-johnson-320.webp', 'tom-johnson-640.webp', 'tom-johnson-640.jpg']) assert.ok(fs.statSync(path.join(root, 'assets', file)).size < 150000);
});

test('small card labels retain sufficient contrast with the coral background', () => {
  const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
  assert.doesNotMatch(css, /outline:\s*0[;}]/);
  const coral = css.match(/--coral:#([a-f0-9]{6})/i)[1];
  const luminance = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  assert.ok(1.05 / (luminance(coral) + .05) >= 4.5);
  assert.match(css, /\.resource-card__type\s*\{[^}]*opacity:1/);
  assert.match(css, /\.resource-card p:not\(\.resource-card__type\)\s*\{[^}]*opacity:1/);
});

test('every canonical material has complete HTML and social metadata before JavaScript runs', () => {
  for (const file of model.uniqueFiles(manifest)) {
    const record = model.archiveRecord(file);
    const route = model.materialRoute(file.local);
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    assert.ok(html.includes(`<h1>${model.escapeHtml(record.title)}</h1>`), route);
    assert.ok(html.includes(`<meta property="og:description" content="${model.escapeHtml(record.description)}"`), route);
    assert.ok(html.includes(`rel="canonical" href="https://tomjohnsonde.github.io/english-materials/${route}"`), route);
    assert.ok(html.includes(`href="${file.local}" download`), route);
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema.name, record.title);
    assert.equal(schema.encoding.contentUrl, new URL(file.local, 'https://tomjohnsonde.github.io/english-materials/').href);
    assert.ok(!html.includes('The material details will load here'));
  }
});

test('all 221 legacy material URLs still render the expected canonical file', async () => {
  for (const file of manifest) {
    const ui = material(`?file=${encodeURIComponent(file.local)}`);
    await ui.api.renderMaterialPage();
    assert.equal(ui.metas.get('robots').attributes.content, 'index, follow', file.local);
    assert.ok(ui.main.innerHTML.includes(`href="${file.canonical || file.local}" download`), file.local);
    assert.ok(ui.metas.get('canonical').attributes.href.endsWith(model.materialRoute(file.local)));
  }
});

test('section pages and core teaching sections expose files without a manifest request', () => {
  const data = require('../assets/data.js');
  for (const section of data.sections.filter((item) => item.available !== false)) {
    const html = fs.readFileSync(path.join(root, section.href), 'utf8');
    if (section.legacyHref) {
      assert.match(html, /data-static-detail="true"/);
      assert.ok(html.includes(`<h1>${model.escapeHtml(section.title)}</h1>`));
    }
    for (const file of model.uniqueFiles(manifest).filter((file) => file.sections.includes(section.slug))) {
      assert.ok(html.includes(`href="${model.materialRoute(file.local)}"`), `${section.slug}: ${file.local}`);
    }
  }
});

test('all unique materials have reviewed descriptions; unsupported levels and answer keys are not invented', () => {
  for (const file of model.uniqueFiles(manifest)) {
    assert.ok(file.description.length > 50, file.local);
    assert.equal(file.reviewScope, 'description-and-activity');
    assert.ok(file.activityType);
    if (file.level) assert.ok(file.levelSource);
    if (file.estimatedMinutes) assert.ok(model.learningDetails(file).some((item) => item.includes('(suggested)')));
    for (const related of file.relatedFiles || []) assert.ok(manifest.some((item) => item.local === related));
  }
  const blank = manifest.find((file) => file.local.endsWith('ielts-listening-answer-sheet.pdf'));
  assert.notEqual(blank.answers, true);
  const conditional = manifest.find((file) => file.local.endsWith('first-and-second-conditionals-rules.pdf'));
  assert.equal(conditional.answers, true);
});

test('content corrections and missing recordings are visible before a file is opened', () => {
  for (const filename of ['ielts-writing-task-1-types-of-charts.pdf', 'task-1-proportional-numbers-answers.pdf', 'politics-war-peace.pdf', 'ielts-listening-test-1.pdf']) {
    const file = manifest.find((item) => item.local.endsWith(`/${filename}`));
    const html = fs.readFileSync(path.join(root, model.materialRoute(file.local)), 'utf8');
    const note = model.escapeHtml(file.contentNote || file.requirements);
    assert.ok(html.includes(note));
    assert.ok(html.indexOf(note) < html.indexOf('class="material-preview"'));
  }
});

test('course date labels advance at both boundaries without implying availability', () => {
  assert.equal(model.courseStatus('2026-09-09', '2026-12-16', '2026-09-08'), 'Scheduled');
  assert.equal(model.courseStatus('2026-09-09', '2026-12-16', '2026-09-09'), 'Dates in progress');
  assert.equal(model.courseStatus('2026-09-09', '2026-12-16', '2026-12-16'), 'Dates in progress');
  assert.equal(model.courseStatus('2026-09-09', '2026-12-16', '2026-12-17'), 'Past dates');
});

test('restricted external activities include access notes and working local alternatives where known', () => {
  const resources = require('../assets/data.js').resources;
  const wisc = resources.filter((resource) => resource.href.includes('wisc-online.com'));
  assert.equal(wisc.length, 3);
  for (const resource of wisc) {
    assert.match(model.resourceCard(resource), /browser verification/);
    assert.ok(fs.existsSync(path.join(root, model.materialRoute(resource.alternative.href))));
  }
});

test('unrelated search words cannot match short words such as a, an or in', () => {
  assert.equal(model.filterRecords(records, { query: 'antidisestablishmentarianxyz' }).length, 0);
  assert.ok(model.filterRecords(records, { query: 'collocation' }).length > 0);
  assert.ok(model.filterRecords(records, { query: 'conditonals' }).length > 0);
});
