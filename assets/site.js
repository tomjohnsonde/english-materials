(() => {
  const data = globalThis.siteData;
  const page = document.body.dataset.page;
  const materialRoot = 'assets/materials/';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '>': '&gt;', '<': '&lt;', "'": '&#39;', '"': '&quot;' }[character]));
  const isLocalMaterial = (href) => typeof href === 'string' && href.startsWith(materialRoot);
  const materialRoute = (path) => `material.html?file=${encodeURIComponent(path)}`;
  const extensionFor = (path) => path.split('.').pop().toUpperCase();
  const fileSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const titleLowercaseWords = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  const titleAcronyms = { doc: 'DOC', docx: 'DOCX', ielts: 'IELTS', odg: 'ODG', odt: 'ODT', ott: 'OTT', pdf: 'PDF', ppt: 'PPT', uk: 'UK', usa: 'USA', vhs: 'VHS' };
  let manifestRequest;

  function friendlyTitle(value) {
    const words = String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(Boolean);
    return words.map((word, index) => {
      const stripped = word.replace(/[^a-z0-9]/g, '');
      if (titleAcronyms[stripped]) return titleAcronyms[stripped];
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(word)) return word.toUpperCase();
      if (index > 0 && titleLowercaseWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      for (let column = 1; column <= right.length; column += 1) {
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
  }

  function termScore(term, value, weight) {
    if (!value) return 0;
    if (value.includes(term)) return weight;
    const words = value.split(' ');
    if (words.some((word) => word.startsWith(term) || (term.length > 3 && term.startsWith(word)))) return weight * 0.7;
    const distance = term.length >= 6 ? 2 : 1;
    if (term.length >= 5 && words.some((word) => Math.abs(word.length - term.length) <= distance && editDistance(word, term) <= distance)) return weight * 0.35;
    return 0;
  }

  function searchScore(record, rawQuery) {
    const phrase = normalizeSearchText(rawQuery);
    if (!phrase) return 0;
    const terms = [...new Set(phrase.split(' ').filter(Boolean))];
    let score = 0;
    for (const term of terms) {
      const best = Math.max(
        termScore(term, record.searchIndex.title, 100),
        termScore(term, record.searchIndex.sections, 70),
        termScore(term, record.searchIndex.description, 50),
        termScore(term, record.searchIndex.filename, 35),
        termScore(term, record.searchIndex.format, 20)
      );
      if (!best) return -1;
      score += best;
    }
    if (record.searchIndex.title.includes(phrase)) return score + 1000;
    if (record.searchIndex.all.includes(phrase)) return score + 200;
    return score;
  }

  function displayFileTitle(file) {
    const featured = data.resources.find((resource) => resource.href === file.local);
    if (featured) return featured.title;
    const sourceTitle = String(file.title || '').trim();
    if (sourceTitle && !/^(pdf|docx?|odt|ott|odg|jpe?g|png|here)$/i.test(sourceTitle)) return friendlyTitle(sourceTitle);
    return friendlyTitle(file.local.split('/').pop().replace(/^[a-f0-9]{12}--/i, '').replace(/\.[^.]+$/, '').replace(/(?:_orig|_modified)$/i, ''));
  }

  function sectionFor(slug) {
    return data.sections.find((section) => section.slug === slug);
  }

  function availableSections() {
    return data.sections.filter((section) => section.available !== false);
  }

  function sectionPager(slug) {
    const sections = availableSections();
    const current = sections.findIndex((section) => section.slug === slug);
    if (current < 0) return '';
    const previous = sections[current - 1];
    const next = sections[current + 1];
    return `<nav class="section-pager" aria-label="Browse sections">${previous ? `<a class="section-pager__link" href="${previous.href}"><span>← Previous section</span><strong>${escapeHtml(previous.title)}</strong></a>` : '<span></span>'}${next ? `<a class="section-pager__link section-pager__link--next" href="${next.href}"><span>Next section →</span><strong>${escapeHtml(next.title)}</strong></a>` : '<span></span>'}</nav>`;
  }

  function resourceCard(resource, compact = false) {
    const local = isLocalMaterial(resource.href);
    const isExternal = /^https?:\/\//.test(resource.href);
    const href = local ? materialRoute(resource.href) : resource.href;
    const label = local ? 'View material' : resource.href === 'unavailable.html' ? 'View notice' : 'Open resource';
    return `<article class="resource-card ${resource.accent ? 'resource-card--accent' : ''}">
      <p class="resource-card__type">${escapeHtml(resource.type)}</p>
      <h3>${escapeHtml(resource.title)}</h3>
      ${compact ? '' : `<p>${escapeHtml(resource.desc)}</p>`}
      <a href="${href}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${label} ${escapeHtml(resource.title)}${isExternal ? ' in a new tab' : ''}">${label} <span aria-hidden="true">${isExternal ? '↗' : '→'}</span></a>
    </article>`;
  }

  function renderHeader() {
    const header = document.querySelector('[data-site-header]');
    if (!header) return;
    const links = data.navigation.map((item) => `<a ${item.page === page ? 'aria-current="page"' : ''} href="${item.href}">${item.label}</a>`).join('');
    header.innerHTML = `<div class="utility-bar"><div class="container utility-bar__inner"><a class="brand" href="index.html" aria-label="Official learning materials site of Tom Johnson"><span class="brand__dot"></span><span class="brand__full">Intermediate English Materials</span><span class="brand__short">IEM</span></a><span class="official-site">Official site of Tom Johnson</span><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation"><span></span><span></span><span></span><span class="sr-only">Open menu</span></button><form class="site-search" action="library.html" role="search"><label class="sr-only" for="site-search-input">Search materials</label><input id="site-search-input" name="q" type="search" placeholder="Search materials" /><button aria-label="Search" type="submit">⌕</button></form></div></div><nav class="main-nav" id="site-navigation" aria-label="Main navigation"><div class="container main-nav__inner">${links}<a class="main-nav__search" href="library.html#catalogue">Search materials <span aria-hidden="true">⌕</span></a></div></nav>`;
    const toggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('.main-nav');
    toggle.addEventListener('click', () => { const open = nav.classList.toggle('main-nav--open'); toggle.setAttribute('aria-expanded', String(open)); toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu'; });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && nav.classList.contains('main-nav--open')) { nav.classList.remove('main-nav--open'); toggle.setAttribute('aria-expanded', 'false'); toggle.querySelector('.sr-only').textContent = 'Open menu'; toggle.focus(); } });
  }

  function renderFooter() {
    const footer = document.querySelector('[data-site-footer]');
    if (!footer) return;
    footer.innerHTML = `<div class="footer-band"><div class="container footer-band__inner"><p>Intermediate English Materials</p><a href="#main">Back to top ↑</a></div></div><div class="footer-main"><div class="container footer-main__inner"><div><a class="footer-brand" href="index.html">IEM<span>.</span></a><p>Practical English materials<br />for curious intermediate learners.</p></div><a class="footer-contact" href="contact.html">Contact <span aria-hidden="true">→</span></a></div><div class="container footer-legal"><span>© ${new Date().getFullYear()} Intermediate English Materials</span><span>Materials are stored and available directly on this site.</span></div></div>`;
  }

  function renderResourceGrids() {
    document.querySelectorAll('[data-resource-grid]').forEach((grid) => {
      const mode = grid.dataset.resourceGrid;
      const selections = {
        home: data.resources.filter((item) => item.section === 'home'),
        grammar: data.resources.filter((item) => item.section === 'grammar'),
        medical: data.resources.filter((item) => item.section === 'medical'),
        speaking: data.resources.filter((item) => item.section === 'speaking')
      };
      grid.innerHTML = (selections[mode] || []).map((resource) => resourceCard(resource)).join('');
    });
  }

  function renderTopics() {
    const grid = document.querySelector('[data-topic-grid]');
    if (!grid) return;
    grid.innerHTML = data.topics.map((topic) => `<a class="topic-card" href="${topic.href}"><span>${topic.mark}</span><h3>${topic.title}</h3><p>${topic.text}</p><b aria-hidden="true">→</b></a>`).join('');
  }

  function renderSectionDirectory() {
    const directory = document.querySelector('[data-section-directory]');
    if (!directory) return;
    directory.innerHTML = availableSections().map((section) => `<a class="section-directory__item" href="${section.href}"><span class="section-directory__group">${escapeHtml(section.group)}</span><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.desc)}</p><small class="section-directory__count" data-section-count="${section.slug}">Checking materials…</small><b aria-hidden="true">→</b></a>`).join('');
    fetchManifest().then((files) => {
      directory.querySelectorAll('[data-section-count]').forEach((count) => {
        const total = files.filter((file) => file.sections.includes(count.dataset.sectionCount)).length;
        count.textContent = total ? `${total} ${total === 1 ? 'material' : 'materials'}` : 'No local files';
        count.closest('.section-directory__item').classList.toggle('section-directory__item--empty', total === 0);
      });
    }).catch(() => {
      directory.querySelectorAll('[data-section-count]').forEach((count) => { count.textContent = 'View section'; });
    });
  }

  function archiveRecord(file) {
    const featured = data.resources.find((resource) => resource.href === file.local);
    const sections = file.sections.map(sectionFor).filter(Boolean);
    const primary = sections[0];
    const format = extensionFor(file.local);
    const title = displayFileTitle(file);
    const description = featured?.desc || (primary ? `Part of the ${primary.title} archive.` : 'Part of the Intermediate English Materials archive.');
    const sectionText = sections.map((section) => `${section.title} ${section.group}`).join(' ');
    const searchIndex = {
      title: normalizeSearchText(title),
      sections: normalizeSearchText(sectionText),
      description: normalizeSearchText(description),
      filename: normalizeSearchText(file.local),
      format: normalizeSearchText(`${format} ${featured?.type || ''}`)
    };
    return {
      ...file,
      featured,
      format,
      title,
      sections,
      primary,
      description,
      searchIndex: { ...searchIndex, all: Object.values(searchIndex).join(' ') }
    };
  }

  function catalogueItem(record) {
    const sectionText = record.sections.map((section) => section.title).join(', ');
    return `<a class="catalogue-item" href="${materialRoute(record.local)}"><span class="catalogue-item__meta">${escapeHtml(record.format)} · ${escapeHtml(sectionText || 'Archive')}</span><span class="catalogue-item__title">${escapeHtml(record.title)}</span><span class="catalogue-item__desc">${escapeHtml(record.description)}</span><span class="catalogue-item__action">View material <b aria-hidden="true">→</b></span></a>`;
  }

  async function renderLibrary() {
    const grid = document.querySelector('[data-library-grid]');
    if (!grid) return;
    const params = new URLSearchParams(window.location.search);
    const input = document.querySelector('[data-library-search]');
    const controls = document.querySelector('[data-catalogue-controls]');
    const resultNote = document.querySelector('[data-results-note]');
    const more = document.querySelector('[data-catalogue-more]');
    const requestedTopic = params.get('topic') || '';
    let activeSection = params.get('section') || (sectionFor(requestedTopic) ? requestedTopic : 'all');
    let activeFormat = params.get('format') || 'all';
    let query = params.get('q') || '';
    let visible = 24;
    if (!sectionFor(activeSection) || sectionFor(activeSection).available === false) activeSection = 'all';
    if (input) input.value = query;
    try {
      const records = (await fetchManifest()).map(archiveRecord).sort((a, b) => a.title.localeCompare(b.title));
      const formats = [...new Set(records.map((record) => record.format))].sort();
      if (!formats.includes(activeFormat)) activeFormat = 'all';
      controls.innerHTML = `<label class="catalogue-select">Section<select data-section-filter><option value="all">All sections</option>${availableSections().map((section) => `<option value="${section.slug}">${escapeHtml(section.title)}</option>`).join('')}</select></label><label class="catalogue-select">File format<select data-format-filter><option value="all">All formats</option>${formats.map((format) => `<option value="${format}">${escapeHtml(format)}</option>`).join('')}</select></label><button class="filter-button" type="button" data-clear-filters>Clear filters</button>`;
      const sectionSelect = controls.querySelector('[data-section-filter]');
      const formatSelect = controls.querySelector('[data-format-filter]');
      sectionSelect.value = activeSection;
      formatSelect.value = activeFormat;
      const updateUrl = () => {
        const next = new URL(window.location.href);
        next.search = '';
        if (query.trim()) next.searchParams.set('q', query.trim());
        if (activeSection !== 'all') next.searchParams.set('section', activeSection);
        if (activeFormat !== 'all') next.searchParams.set('format', activeFormat);
        history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
      };
      const apply = () => {
        const hasQuery = Boolean(normalizeSearchText(query));
        const hasFilter = activeSection !== 'all' || activeFormat !== 'all';
        const filtered = records.filter((record) =>
          (activeSection === 'all' || record.sections.some((section) => section.slug === activeSection)) &&
          (activeFormat === 'all' || record.format === activeFormat)
        );
        const matches = hasQuery
          ? filtered.map((record) => ({ record, score: searchScore(record, query) })).filter(({ score }) => score >= 0).sort((left, right) => right.score - left.score || left.record.title.localeCompare(right.record.title)).map(({ record }) => record)
          : hasFilter ? filtered : [];
        const showing = matches.slice(0, visible);
        grid.innerHTML = matches.length ? showing.map(catalogueItem).join('') : `<p class="empty-state">${hasQuery || hasFilter ? 'No materials match that search. Try another word, section or file format.' : 'Start with a keyword or choose a section or file format to find materials.'}</p>`;
        resultNote.textContent = matches.length ? `${hasQuery ? 'Best matches: ' : ''}Showing ${showing.length} of ${matches.length} ${matches.length === 1 ? 'material' : 'materials'}` : hasQuery || hasFilter ? 'No materials found' : 'Use search or a filter to find materials';
        more.innerHTML = matches.length > visible ? `<button class="button button--dark" type="button" data-show-more>Show 24 more <span aria-hidden="true">↓</span></button>` : '';
        updateUrl();
      };
      sectionSelect.addEventListener('change', () => { activeSection = sectionSelect.value; visible = 24; apply(); });
      formatSelect.addEventListener('change', () => { activeFormat = formatSelect.value; visible = 24; apply(); });
      controls.querySelector('[data-clear-filters]').addEventListener('click', () => { query = ''; activeSection = 'all'; activeFormat = 'all'; visible = 24; input.value = ''; sectionSelect.value = 'all'; formatSelect.value = 'all'; apply(); });
      input?.addEventListener('input', (event) => { query = event.target.value; visible = 24; apply(); });
      more.addEventListener('click', (event) => { if (!event.target.closest('[data-show-more]')) return; visible += 24; apply(); });
      apply();
    } catch {
      resultNote.textContent = 'The complete catalogue could not load.';
      grid.innerHTML = '<p class="empty-state">Please reload this page. If the problem continues, use the section directory above.</p>';
    }
  }

  function renderSectionPage() {
    const main = document.querySelector('[data-section-page]');
    if (!main) return;
    const slug = new URLSearchParams(window.location.search).get('section');
    const section = sectionFor(slug);
    if (!section) {
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Section not found</h1><p>Please choose a section from the full directory.</p><a class="button button--light" href="library.html">Open directory <span aria-hidden="true">→</span></a></div></section>`;
      return;
    }
    document.title = `${section.title} · Intermediate English Materials`;
    const resources = data.resources.filter((item) => item.section === section.slug);
    main.innerHTML = `<section class="page-intro"><div class="container"><nav class="breadcrumbs breadcrumbs--light" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="library.html">All materials</a><span aria-hidden="true">/</span><span>${escapeHtml(section.title)}</span></nav><p class="eyebrow eyebrow--coral">${escapeHtml(section.group)}</p><h1>${escapeHtml(section.title)}</h1><p>${escapeHtml(section.desc)}</p></div></section><section class="section section--paper"><div class="container"><div class="archive-banner"><div><p class="eyebrow eyebrow--coral">Original archive, improved</p><h2>Choose a material before opening it.</h2><p>The original course structure is retained. Each item now has a clear page with file details, an on-page PDF preview where possible, and simple open or download options.</p></div><a class="button button--dark" href="library.html#catalogue">Search all materials <span aria-hidden="true">→</span></a></div>${resources.length ? `<div class="section-heading"><p class="eyebrow eyebrow--coral">Featured files</p><h2>Start with these materials</h2></div><div class="resource-grid resource-grid--three">${resources.map((resource) => resourceCard(resource)).join('')}</div>` : ''}<section class="local-materials" aria-labelledby="local-materials-title"><p class="eyebrow eyebrow--coral">Complete collection</p><h2 id="local-materials-title">Materials in ${escapeHtml(section.title)}</h2><p class="archive-description">The full list stays hidden until you choose to browse it.</p><div data-local-materials="${section.slug}"><p class="archive-loading">Loading local files…</p></div></section>${sectionPager(section.slug)}</div></section>`;
  }

  function localFileCard(file) {
    const extension = extensionFor(file.local);
    return `<a class="local-file" href="${materialRoute(file.local)}"><span class="local-file__type">${escapeHtml(extension)}</span><span class="local-file__title">${escapeHtml(displayFileTitle(file))}</span><span class="local-file__arrow" aria-hidden="true">→</span></a>`;
  }

  async function fetchManifest() {
    if (!manifestRequest) {
      manifestRequest = fetch('assets/materials/manifest.json').then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
    }
    return manifestRequest;
  }

  async function renderLocalMaterials() {
    const targets = document.querySelectorAll('[data-local-materials]');
    if (!targets.length) return;
    try {
      const files = await fetchManifest();
      targets.forEach((target) => {
        const section = target.dataset.localMaterials;
        const matching = files.filter((file) => file.sections.includes(section)).sort((a, b) => displayFileTitle(a).localeCompare(displayFileTitle(b)));
        if (!matching.length) {
          target.innerHTML = '<p class="archive-empty">This section is part of the original archive, but no downloadable materials were available in the migrated copy.</p>';
          return;
        }
        const title = sectionFor(section)?.title || 'section';
        const total = `${matching.length} ${matching.length === 1 ? 'material' : 'materials'}`;
        const listId = `local-materials-${section}`;
        target.innerHTML = `<button class="local-materials__toggle" type="button" aria-expanded="false" aria-controls="${listId}" data-local-materials-toggle>Show all ${escapeHtml(title)} materials <span>${total}</span><b aria-hidden="true">↓</b></button><div class="local-materials__content" id="${listId}" hidden><div class="local-file-list">${matching.map(localFileCard).join('')}</div></div>`;
        const button = target.querySelector('[data-local-materials-toggle]');
        const content = target.querySelector(`#${listId}`);
        button.addEventListener('click', () => {
          const open = content.hidden;
          content.hidden = !open;
          button.setAttribute('aria-expanded', String(open));
          button.innerHTML = open ? `Hide materials <span>${total}</span><b aria-hidden="true">↑</b>` : `Show all ${escapeHtml(title)} materials <span>${total}</span><b aria-hidden="true">↓</b>`;
        });
      });
    } catch {
      targets.forEach((target) => { target.innerHTML = '<p class="archive-empty">The local file list will appear after the site is published.</p>'; });
    }
  }

  function previewMarkup(file, title) {
    const extension = extensionFor(file.local).toLowerCase();
    if (extension === 'pdf') return `<iframe class="material-preview__frame" src="${file.local}#view=FitH" title="Preview of ${escapeHtml(title)}"></iframe><p class="material-preview__help">Preview not visible? <a href="${file.local}" target="_blank" rel="noopener noreferrer">Open the PDF in a new tab.</a></p>`;
    if (['jpg', 'jpeg', 'png'].includes(extension)) return `<img class="material-preview__image" src="${file.local}" alt="Preview of ${escapeHtml(title)}" />`;
    return `<div class="material-preview__fallback"><span>${escapeHtml(extension.toUpperCase())}</span><h2>This file opens in a separate app.</h2><p>Use the buttons to open or download the original file.</p></div>`;
  }

  function materialPager(files, currentFile, section) {
    const related = files.filter((file) => file.sections.includes(section)).sort((a, b) => displayFileTitle(a).localeCompare(displayFileTitle(b)));
    const current = related.findIndex((file) => file.local === currentFile.local);
    const previous = related[current - 1];
    const next = related[current + 1];
    if (!previous && !next) return '';
    return `<nav class="material-pager" aria-label="Browse materials in this section">${previous ? `<a href="${materialRoute(previous.local)}"><span>← Previous material</span><strong>${escapeHtml(displayFileTitle(previous))}</strong></a>` : '<span></span>'}${next ? `<a class="material-pager__next" href="${materialRoute(next.local)}"><span>Next material →</span><strong>${escapeHtml(displayFileTitle(next))}</strong></a>` : '<span></span>'}</nav>`;
  }

  async function renderMaterialPage() {
    const main = document.querySelector('[data-material-page]');
    if (!main) return;
    const requested = new URLSearchParams(window.location.search).get('file') || '';
    if (!isLocalMaterial(requested)) {
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Material not found</h1><p>Please choose a file from the catalogue.</p><a class="button button--light" href="library.html">Browse materials <span aria-hidden="true">→</span></a></div></section>`;
      return;
    }
    try {
      const files = await fetchManifest();
      const file = files.find((item) => item.local === requested);
      if (!file) throw new Error('Missing file');
      const title = displayFileTitle(file);
      const sections = file.sections.map(sectionFor).filter(Boolean);
      const primary = sections.find((section) => section.slug !== 'home') || sections[0];
      const extension = extensionFor(file.local);
      document.title = `${title} · Intermediate English Materials`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', `${title} — ${extension} material in the Intermediate English Materials archive.`);
      main.innerHTML = `<section class="page-intro material-intro"><div class="container"><nav class="breadcrumbs breadcrumbs--light" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="library.html">All materials</a>${primary ? `<span aria-hidden="true">/</span><a href="${primary.href}">${escapeHtml(primary.title)}</a>` : ''}<span aria-hidden="true">/</span><span>${escapeHtml(title)}</span></nav><p class="eyebrow eyebrow--coral">${escapeHtml(extension)} material</p><h1>${escapeHtml(title)}</h1><p>Review the material here, then open or download the original file when you are ready.</p></div></section><section class="section section--paper"><div class="container"><div class="material-layout"><div class="material-preview">${previewMarkup(file, title)}</div><aside class="material-sidebar"><p class="eyebrow eyebrow--coral">Material details</p><dl><div><dt>Format</dt><dd>${escapeHtml(extension)}</dd></div><div><dt>File size</dt><dd>${escapeHtml(fileSize(file.bytes))}</dd></div>${sections.length ? `<div><dt>In this archive</dt><dd>${sections.map((section) => `<a href="${section.href}">${escapeHtml(section.title)}</a>`).join(', ')}</dd></div>` : ''}</dl><div class="material-actions"><a class="button button--coral" href="${file.local}" target="_blank" rel="noopener noreferrer">Open file <span aria-hidden="true">↗</span></a><a class="text-link" href="${file.local}" download>Download file <span aria-hidden="true">↓</span></a></div>${primary ? `<a class="material-back" href="${primary.href}">← Back to ${escapeHtml(primary.title)}</a>` : '<a class="material-back" href="library.html">← Back to all materials</a>'}</aside></div>${primary ? materialPager(files, file, primary.slug) : ''}</div></section>`;
    } catch {
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Material not found</h1><p>This material is not currently available in the local archive.</p><a class="button button--light" href="library.html">Browse materials <span aria-hidden="true">→</span></a></div></section>`;
    }
  }

  function renderSectionPagers() {
    document.querySelectorAll('[data-section-pager]').forEach((target) => { target.innerHTML = sectionPager(target.dataset.sectionPager); });
  }

  function handleContactForm() {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;
    const status = document.querySelector('[data-form-status]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { status.textContent = 'Please complete your name, email and message.'; status.className = 'form-status form-status--error'; form.reportValidity(); return; }
      const formData = new FormData(form);
      const name = `${formData.get('firstName')} ${formData.get('lastName')}`.trim();
      const subject = 'Message from Intermediate English Materials';
      const body = `Name: ${name}\nEmail: ${formData.get('email')}\n\nMessage:\n${formData.get('message')}`;
      status.textContent = 'Opening your email app with the message ready to send…';
      status.className = 'form-status form-status--success'; form.reset();
      window.location.href = `mailto:tomjohnsonde@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  function handleCopyEmail() {
    const button = document.querySelector('[data-copy-email]');
    if (!button) return;
    const status = document.querySelector('[data-copy-status]');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('tomjohnsonde@gmail.com');
        status.textContent = 'Email address copied.';
      } catch {
        status.textContent = 'Email address: tomjohnsonde@gmail.com';
      }
    });
  }

  renderHeader();
  renderFooter();
  renderResourceGrids();
  renderTopics();
  renderSectionDirectory();
  renderLibrary();
  renderSectionPage();
  renderSectionPagers();
  renderLocalMaterials();
  renderMaterialPage();
  handleContactForm();
  handleCopyEmail();
})();
