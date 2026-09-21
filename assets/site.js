(() => {
  const data = globalThis.siteData || (typeof module !== 'undefined' ? require('./data.js') : undefined);
  const page = globalThis.document?.body?.dataset.page || '';
  const materialRoot = 'assets/materials/';
  const siteOrigin = data.siteUrl;
  const assetRevision = '20260920.7';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '>': '&gt;', '<': '&lt;', "'": '&#39;', '"': '&quot;' }[character]));
  const isLocalMaterial = (href) => typeof href === 'string' && href.startsWith(materialRoot);
  const isExternalResource = (href) => typeof href === 'string' && /^https?:\/\//i.test(href);
  const materialRoute = (path) => `material-${(data.materialAliases?.[path] || path).split('/').pop()}.html`;
  const extensionFor = (path) => path.split('.').pop().toUpperCase();
  const fileSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const titleLowercaseWords = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  const titleAcronyms = { doc: 'DOC', docx: 'DOCX', ielts: 'IELTS', odg: 'ODG', odt: 'ODT', ott: 'OTT', pdf: 'PDF', ppt: 'PPT', uk: 'UK', usa: 'USA', vhs: 'VHS' };
  let manifestRequest;

  function uniqueFiles(files) {
    return files.filter((file) => !file.canonical || file.canonical === file.local);
  }

  function materialDescription(file, title, sections) {
    if (file.description) return file.description;
    if (/answer sheet/i.test(title)) return `A response sheet for ${title.replace(/answer sheet/i, '').trim() || 'your exercises'}. Use it to record your own answers.`;
    if (/\b(answers|answer key|solutions)\b/i.test(title)) return `Check your work with ${title}. Open the file to compare your responses.`;
    const skill = sections[0]?.title || 'English';
    return `${title}: ${skill.toLowerCase()} practice. Open the material to read the instructions and work through the activity.`;
  }

  function learningDetails(record) {
    const details = [];
    if (record.activityType) details.push(record.activityType);
    if (record.pages) details.push(`${record.pages} ${record.pages === 1 ? 'page' : 'pages'}`);
    if (record.level) details.push(record.level);
    if (record.estimatedMinutes) details.push(`About ${record.estimatedMinutes} min (suggested)`);
    if (record.skills?.length) details.push(record.skills.join(' / '));
    if (record.answers === true) details.push('Answers included');
    if (record.answers === false) details.push('No answer key');
    return details;
  }

  function catalogueRecords(files) {
    const online = new Map();
    data.resources.filter((resource) => !isLocalMaterial(resource.href)).forEach((resource) => {
      const key = resource.href === 'unavailable.html' ? `unavailable:${resource.title}` : resource.href;
      const existing = online.get(key);
      if (existing) existing.sectionSlugs = [...new Set([...existing.sectionSlugs, resource.section])];
      else online.set(key, { ...resource, sectionSlugs: [resource.section] });
    });
    return [...uniqueFiles(files).map(archiveRecord), ...[...online.values()].map(resourceRecord)]
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  function filterRecords(records, { query = '', section = 'all', format = 'all', level = 'all' } = {}) {
    const filtered = records.filter((record) =>
      (record.available !== false || format === 'UNAVAILABLE') &&
      (section === 'all' || record.sections.some((item) => item.slug === section)) &&
      (format === 'all' || record.format === format) &&
      (level === 'all' || record.level === level)
    );
    if (!query.trim()) return filtered;
    if (!normalizeSearchText(query)) return [];
    return filtered.map((record) => ({ record, score: searchScore(record, query) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title))
      .map(({ record }) => record);
  }

  function prepareEnquiry({ fullName, email, message }) {
    const name = String(fullName || '').trim();
    const address = String(email || '').trim();
    const text = String(message || '').trim();
    if (!name || !address || !text) return null;
    const subject = 'New enquiry from the English Materials website';
    const body = `Name: ${name}\nEmail: ${address}\n\nMessage:\n${text}`;
    return { subject, body, text: `To: tomjohnsonde@gmail.com\nSubject: ${subject}\n\n${body}`, href: `mailto:tomjohnsonde@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
  }

  function upsertMeta(attribute, name, content) {
    let meta = document.querySelector(`meta[${attribute}="${name}"]`);
    if (!meta && document.head) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.append(meta);
    }
    meta?.setAttribute('content', content);
  }

  function setPageMetadata({ title, description, relativeUrl }) {
    const absoluteUrl = new URL(relativeUrl, siteOrigin).href;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', absoluteUrl);
    upsertMeta('property', 'og:image', `${siteOrigin}assets/social-card.png`);
    upsertMeta('property', 'og:image:alt', 'English Materials — practical English resources for focused learners');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', `${siteOrigin}assets/social-card.png`);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical && document.head) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.append(canonical);
    }
    canonical?.setAttribute('href', absoluteUrl);
  }

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
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
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
    if (words.some((word) => word.startsWith(term) || (word.length >= 4 && term.startsWith(word)))) return weight * 0.7;
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
      if (/^[abc][12]$/.test(term)) {
        if (record.level?.toLowerCase() !== term) return -1;
        score += 100;
        continue;
      }
      const best = Math.max(
        termScore(term, record.searchIndex.title, 100),
        termScore(term, record.searchIndex.sections, 70),
        termScore(term, record.searchIndex.description, 50),
        termScore(term, record.searchIndex.tags, 65),
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
    const sourceTitle = String(file.title || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (sourceTitle && !/^(pdf|docx?|odt|ott|odg|jpe?g|png|here)$/i.test(sourceTitle)) return friendlyTitle(sourceTitle);
    return friendlyTitle(file.local.split('/').pop().replace(/^[a-f0-9]{12}--/i, '').replace(/\.[^.]+$/, '').replace(/(?:_orig|_modified)$/i, ''));
  }

  function sectionFor(slug) {
    return data.sections.find((section) => section.slug === slug);
  }

  function materialTags(sections, title) {
    const sectionTags = sections.flatMap((section) => data.sectionTopics?.[section.slug] || []);
    const titleTags = [];
    const normalized = normalizeSearchText(title);
    const keywords = [
      ['conditionals', 'conditionals'], ['phrasal', 'phrasal verbs'], ['email', 'emails'], ['telephone', 'telephone English'],
      ['listening', 'listening'], ['reading', 'reading'], ['writing', 'writing'], ['vocabulary', 'vocabulary'],
      ['grammar', 'grammar'], ['business', 'business English'], ['medical', 'medical English'], ['finance', 'finance'],
      ['pronunciation', 'pronunciation'], ['spelling', 'spelling'], ['collocation', 'collocations'], ['ielts', 'IELTS']
    ];
    keywords.forEach(([needle, tag]) => { if (normalized.includes(needle)) titleTags.push(tag); });
    return [...new Set([...sectionTags, ...titleTags])].slice(0, 6);
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
      <p class="resource-card__type">${resource.href === 'unavailable.html' ? 'Currently unavailable' : escapeHtml(resource.type)}</p>
      <h3>${escapeHtml(resource.title)}</h3>
      ${compact ? '' : `<p>${escapeHtml(resource.desc)}</p>`}${resource.accessNote ? `<p class="resource-access-note">${escapeHtml(resource.accessNote)}</p>` : ''}
      <a href="${href}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${label} ${escapeHtml(resource.title)}${isExternal ? ' in a new tab' : ''}">${label} <span aria-hidden="true">${isExternal ? '↗' : '→'}</span></a>${resource.alternative ? `<a class="resource-alternative" href="${escapeHtml(isLocalMaterial(resource.alternative.href) ? materialRoute(resource.alternative.href) : resource.alternative.href)}">${escapeHtml(resource.alternative.title)} →</a>` : ''}
    </article>`;
  }

  function headerMarkup(currentPage) {
    const activePage = ['material', 'section'].includes(currentPage) ? 'library' : currentPage;
    const links = data.navigation.map((item) => `<a${item.page === 'contact' ? ' class="main-nav__contact"' : ''} ${item.page === activePage ? 'aria-current="page"' : ''} href="${item.href}">${item.label}</a>`).join('');
    return `<div class="utility-bar"><div class="container utility-bar__inner"><a class="brand" href="index.html" aria-label="Official learning materials site of Tom Johnson"><span class="brand__dot"></span><span class="brand__full">Intermediate English Materials</span><span class="brand__short">IEM</span></a><span class="official-site">Official site of Tom Johnson</span><form class="site-search" action="library.html#catalogue" role="search"><label class="sr-only" for="site-search-input">Search materials</label><input id="site-search-input" name="q" type="search" placeholder="Search materials" /><button aria-label="Search" type="submit">⌕</button></form><a class="mobile-header-action" href="library.html" aria-label="Search all materials"><span aria-hidden="true">⌕</span><span>Search</span></a></div></div><nav class="main-nav" id="site-navigation" aria-label="Main navigation"><div class="container main-nav__inner">${links}</div></nav>`;
  }

  function renderHeader() {
    const header = document.querySelector('[data-site-header]');
    if (header && !header.children.length) header.innerHTML = headerMarkup(page);
  }

  function footerMarkup(year = new Date().getFullYear()) {
    return `<div class="footer-band"><div class="container footer-band__inner"><p>Intermediate English Materials</p><a href="#main">Back to top ↑</a></div></div><div class="footer-main"><div class="container footer-main__inner"><div><a class="footer-brand" href="index.html">IEM<span>.</span></a><p>Practical English materials<br />for curious intermediate learners.</p></div></div><div class="container footer-legal"><span>© ${year} Intermediate English Materials</span><span>Downloadable materials and selected online activities.</span></div></div>`;
  }

  function renderFooter() {
    const footer = document.querySelector('[data-site-footer]');
    if (footer && !footer.children.length) footer.innerHTML = footerMarkup();
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
        const total = uniqueFiles(files).filter((file) => file.sections.includes(count.dataset.sectionCount)).length;
        const onlineResources = new Set(data.resources.filter((resource) => resource.section === count.dataset.sectionCount && isExternalResource(resource.href)).map((resource) => resource.href)).size;
        count.textContent = [total ? `${total} ${total === 1 ? 'file' : 'files'}` : '', onlineResources ? `${onlineResources} ${onlineResources === 1 ? 'online activity' : 'online activities'}` : ''].filter(Boolean).join(' · ') || 'No materials yet';
        count.closest('.section-directory__item').classList.toggle('section-directory__item--empty', total === 0 && !onlineResources);
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
    const description = file.description || featured?.desc || materialDescription(file, title, sections);
    const sectionText = sections.map((section) => `${section.title} ${section.group}`).join(' ');
    const tags = materialTags(sections, title);
    const searchIndex = {
      title: normalizeSearchText(title),
      sections: normalizeSearchText(sectionText),
      description: normalizeSearchText(description),
      tags: normalizeSearchText(tags.join(' ')),
      filename: normalizeSearchText([file.local.split('/').pop(), ...(file.aliases || [])].join(' ')),
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
      tags,
      searchIndex: { ...searchIndex, all: Object.values(searchIndex).join(' ') }
    };
  }

  function resourceRecord(resource) {
    const sections = (resource.sectionSlugs || [resource.section]).map(sectionFor).filter(Boolean);
    const primary = sections[0];
    const title = String(resource.title || 'Online resource').trim();
    const description = resource.desc || (primary ? `Online activity in the ${primary.title} section.` : 'Online resource retained from the original archive.');
    const sectionText = sections.map((section) => `${section.title} ${section.group}`).join(' ');
    const tags = materialTags(sections, title);
    const searchIndex = {
      title: normalizeSearchText(title),
      sections: normalizeSearchText(sectionText || resource.section || 'Featured resources'),
      description: normalizeSearchText(description),
      tags: normalizeSearchText(`${tags.join(' ')} ${resource.type || ''}`),
      filename: '',
      format: normalizeSearchText(`${isExternalResource(resource.href) ? 'online' : 'unavailable'} ${resource.type || 'resource'}`)
    };
    return {
      ...resource,
      resource,
      externalResource: true,
      isExternal: isExternalResource(resource.href),
      format: isExternalResource(resource.href) ? 'ONLINE' : 'UNAVAILABLE',
      available: isExternalResource(resource.href),
      title,
      description,
      sections,
      primary,
      tags,
      searchIndex: { ...searchIndex, all: Object.values(searchIndex).join(' ') }
    };
  }

  function catalogueItem(record) {
    const externalResource = Boolean(record.externalResource);
    const online = externalResource && record.isExternal;
    const sectionText = record.sections.map((section) => section.title).join(', ');
    const href = externalResource ? record.href : materialRoute(record.local);
    const label = externalResource ? (online ? 'Open resource' : 'View notice') : 'View material';
    const target = online ? ' target="_blank" rel="noopener noreferrer"' : '';
    const meta = record.available === false ? 'Currently unavailable' : externalResource ? `ONLINE · ${record.resource?.type || 'Online resource'}` : `${record.format} · ${sectionText || 'English practice'}`;
    const details = learningDetails(record);
    return `<a class="catalogue-item${online ? ' catalogue-item--online' : ''}" href="${escapeHtml(href)}"${target}><span class="catalogue-item__meta">${escapeHtml(meta)}</span><span class="catalogue-item__title">${escapeHtml(record.title)}</span><span class="catalogue-item__desc">${escapeHtml(record.description)}</span>${details.length ? `<span class="catalogue-item__details">${escapeHtml(details.join(' · '))}</span>` : ''}${record.accessNote ? `<span class="catalogue-item__details">${escapeHtml(record.accessNote)}</span>` : ''}<span class="catalogue-item__action">${label}${online ? '<span class="sr-only"> (opens in a new tab)</span>' : ''} <b aria-hidden="true">${online ? '↗' : '→'}</b></span></a>`;
  }

  async function renderLibrary() {
    const grid = document.querySelector('[data-library-grid]');
    if (!grid) return;
    const params = new URLSearchParams(window.location.search);
    const input = document.querySelector('[data-library-search]');
    const controls = document.querySelector('[data-catalogue-controls]');
    const resultNote = document.querySelector('[data-results-note]');
    const summary = document.querySelector('[data-search-summary]');
    const jump = document.querySelector('[data-search-jump]');
    const more = document.querySelector('[data-catalogue-more]');
    const fallback = document.querySelector('[data-static-library]');
    let activeSection = params.get('section') || params.get('topic') || 'all';
    let activeFormat = params.get('format') || 'all';
    let activeLevel = params.get('level') || 'all';
    let query = params.get('q') || '';
    let visible = 24;
    let timer;
    if (!sectionFor(activeSection) || sectionFor(activeSection).available === false) activeSection = 'all';
    if (input) input.value = query;
    try {
      const records = catalogueRecords(await fetchManifest());
      const formats = [...new Set(records.map((record) => record.format))].sort();
      const levels = [...new Set(records.map((record) => record.level).filter(Boolean))].sort();
      if (!formats.includes(activeFormat)) activeFormat = 'all';
      if (!levels.includes(activeLevel)) activeLevel = 'all';
      controls.innerHTML = `<label class="catalogue-select">Section<select data-section-filter><option value="all">All sections</option>${availableSections().map((section) => `<option value="${section.slug}">${escapeHtml(section.title)}</option>`).join('')}</select></label><label class="catalogue-select">Resource type<select data-format-filter><option value="all">All available types</option>${formats.map((format) => `<option value="${format}">${format === 'UNAVAILABLE' ? 'Unavailable resources' : format === 'ONLINE' ? 'Online activities' : format}</option>`).join('')}</select></label><label class="catalogue-select">Level<select data-level-filter><option value="all">All levels / unspecified</option>${levels.map((level) => `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`).join('')}</select><span class="filter-help">Only labelled levels are included.</span></label><button class="filter-button" type="button" data-clear-filters>Show all materials</button>`;
      const sectionSelect = controls.querySelector('[data-section-filter]');
      const formatSelect = controls.querySelector('[data-format-filter]');
      const levelSelect = controls.querySelector('[data-level-filter]');
      sectionSelect.value = activeSection;
      formatSelect.value = activeFormat;
      levelSelect.value = activeLevel;
      const updateUrl = () => {
        const next = new URL(window.location.href);
        next.search = '';
        if (query.trim()) next.searchParams.set('q', query.trim());
        if (activeSection !== 'all') next.searchParams.set('section', activeSection);
        if (activeFormat !== 'all') next.searchParams.set('format', activeFormat);
        if (activeLevel !== 'all') next.searchParams.set('level', activeLevel);
        history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
      };
      const apply = () => {
        if (input && input.value !== query) input.value = query;
        const matches = filterRecords(records, { query, section: activeSection, format: activeFormat, level: activeLevel });
        const showing = matches.slice(0, visible);
        const emptyMessage = /[^\x00-\x7F]/.test(query) ? 'No matching resources. Try an English topic such as “grammar” or choose a section below.' : 'No resources match these choices. Try another keyword, section, level or resource type.';
        grid.innerHTML = matches.length ? showing.map(catalogueItem).join('') : `<p class="empty-state">${emptyMessage}</p>`;
        resultNote.textContent = matches.length ? `${query.trim() ? 'Best matches: ' : ''}Showing ${showing.length} of ${matches.length} ${matches.length === 1 ? 'resource' : 'resources'}` : 'No resources found';
        if (summary) summary.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'resource' : 'resources'} found.` : emptyMessage;
        if (jump) jump.textContent = matches.length ? 'View results ↓' : 'View filters ↓';
        more.innerHTML = matches.length > visible ? `<button class="button button--dark" type="button" data-show-more>Show ${Math.min(24, matches.length - visible)} more <span aria-hidden="true">↓</span></button>` : '';
        updateUrl();
      };
      const change = () => { clearTimeout(timer); visible = 24; apply(); };
      sectionSelect.addEventListener('change', () => { activeSection = sectionSelect.value; change(); });
      formatSelect.addEventListener('change', () => { activeFormat = formatSelect.value; change(); });
      levelSelect.addEventListener('change', () => { activeLevel = levelSelect.value; change(); });
      controls.querySelector('[data-clear-filters]').addEventListener('click', () => {
        query = ''; activeSection = 'all'; activeFormat = 'all'; activeLevel = 'all';
        input.value = ''; sectionSelect.value = 'all'; formatSelect.value = 'all'; levelSelect.value = 'all'; change();
      });
      input.addEventListener('input', (event) => { query = event.target.value; clearTimeout(timer); timer = setTimeout(change, 160); });
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault(); change(); document.querySelector('#catalogue')?.focus(); document.querySelector('#catalogue')?.scrollIntoView();
      });
      more.addEventListener('click', (event) => {
        if (!event.target.closest('[data-show-more]')) return;
        const nextIndex = visible;
        visible += 24; apply();
        grid.querySelectorAll('.catalogue-item')[nextIndex]?.focus();
      });
      if (fallback) { fallback.hidden = window.location.hash !== '#file-list'; fallback.open = window.location.hash === '#file-list'; }
      apply();
      if (params.has('q') || params.has('section') || params.has('format') || params.has('level') || window.location.hash === '#catalogue') {
        document.querySelector('#catalogue')?.scrollIntoView({ behavior: 'instant' });
      }
    } catch {
      resultNote.textContent = 'The searchable catalogue could not load.';
      if (summary) summary.textContent = 'Search is temporarily unavailable. The file list below still works.';
      grid.innerHTML = '<div class="empty-state"><p>Please try again, or use the complete file list below.</p><button class="button button--dark" type="button" data-retry-library>Try again</button></div>';
      if (fallback) { fallback.hidden = false; fallback.open = true; }
      grid.querySelector('[data-retry-library]')?.addEventListener('click', () => { renderLibrary(); });
    }
  }

  function renderSectionPage() {
    const main = document.querySelector('[data-section-page]');
    if (!main || main.dataset?.staticDetail) return;
    const slug = new URLSearchParams(window.location.search).get('section');
    const section = sectionFor(slug);
    if (!section || section.available === false) {
      upsertMeta('name', 'robots', 'noindex');
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Section not found</h1><p>Please choose a section from the full directory.</p><a class="button button--light" href="library.html">Open directory <span aria-hidden="true">→</span></a></div></section>`;
      return;
    }
    setPageMetadata({
      title: `${section.title} · Intermediate English Materials`,
      description: `${section.desc} Browse original local materials and online activities from Tom Johnson.`,
      relativeUrl: section.href
    });
    main.innerHTML = sectionMarkup(section);
  }

  function sectionMarkup(section) {
    const resources = data.resources.filter((item) => item.section === section.slug);
    const localResources = resources.filter((item) => isLocalMaterial(item.href));
    const externalResources = resources.filter((item) => !isLocalMaterial(item.href));
    const resourceIntro = localResources.length && externalResources.length
      ? 'Choose a featured worksheet or a trusted online activity before browsing the full archive.'
      : externalResources.length
        ? 'Choose an online activity. External activities open in a new tab.'
        : 'Choose a featured material to see its details first, then open or download it when you are ready.';
    return `<section class="page-intro"><div class="container"><nav class="breadcrumbs breadcrumbs--light" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="library.html">All materials</a><span aria-hidden="true">/</span><span>${escapeHtml(section.title)}</span></nav><p class="eyebrow eyebrow--coral">${escapeHtml(section.group)}</p><h1>${escapeHtml(section.title)}</h1><p>${escapeHtml(section.desc)}</p></div></section><section class="section section--paper"><div class="container"><div class="archive-banner"><div><p class="eyebrow eyebrow--coral">Ready to practise</p><h2>Choose your next activity.</h2><p>Browse the exercises in this section. Check the file type and learning details, then open or download a material.</p></div><a class="button button--dark" href="library.html#catalogue">Search all materials <span aria-hidden="true">→</span></a></div>${resources.length ? `<div class="section-heading section-heading--split"><div><p class="eyebrow eyebrow--coral">${externalResources.length ? 'Topics & online activities' : 'Featured topics'}</p><h2>Choose a topic</h2></div><p>${resourceIntro}</p></div><div class="resource-grid resource-grid--three">${resources.map((resource) => resourceCard(resource)).join('')}</div>` : ''}<section class="local-materials" aria-labelledby="local-materials-title"><p class="eyebrow eyebrow--coral">Complete collection</p><h2 id="local-materials-title">Materials in ${escapeHtml(section.title)}</h2><p class="archive-description">Open the list to browse all downloadable files in this section.</p><div data-local-materials="${section.slug}"><p class="archive-loading">Loading local files…</p></div></section>${sectionPager(section.slug)}</div></section>`;
  }

  function localFileCard(file) {
    const extension = extensionFor(file.local);
    return `<a class="local-file" href="${materialRoute(file.local)}"><span class="local-file__type">${escapeHtml(extension)}</span><span class="local-file__title">${escapeHtml(displayFileTitle(file))}</span><span class="local-file__arrow" aria-hidden="true">→</span></a>`;
  }

  async function fetchManifest() {
    if (!manifestRequest) {
      manifestRequest = fetch(`assets/materials/manifest.json?v=${assetRevision}`).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }).catch((error) => { manifestRequest = null; throw error; });
    }
    return manifestRequest;
  }

  async function renderLocalMaterials() {
    const targets = [...document.querySelectorAll('[data-local-materials]')].filter((target) => !target.dataset.staticFiles);
    if (!targets.length) return;
    try {
      const files = await fetchManifest();
      targets.forEach((target) => {
        const section = target.dataset.localMaterials;
        const matching = uniqueFiles(files).filter((file) => file.sections.includes(section)).sort((a, b) => displayFileTitle(a).localeCompare(displayFileTitle(b)));
        if (!matching.length) {
          target.innerHTML = '<p class="archive-empty">This section uses online activities. Choose one of the links above to start practising.</p>';
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
      targets.forEach((target) => {
        if (target.querySelector('a')) return;
        target.innerHTML = '<div class="archive-empty"><p>The file list could not load. Please try again or open the complete file list.</p><button class="filter-button" type="button" data-retry-files>Try again</button> <a class="text-link" href="library.html#file-list">Browse files</a></div>';
        target.querySelector('[data-retry-files]')?.addEventListener('click', renderLocalMaterials);
      });
    }
  }

  function previewMarkup(file, title) {
    const extension = extensionFor(file.local).toLowerCase();
    if (extension === 'pdf') return `<iframe class="material-preview__frame" src="${file.local}#view=FitH" title="Preview of ${escapeHtml(title)}"></iframe><p class="material-preview__help">Preview not visible? <a href="${file.local}" target="_blank" rel="noopener noreferrer">Open the PDF in a new tab.</a></p>`;
    if (['jpg', 'jpeg', 'png'].includes(extension)) return `<img class="material-preview__image" src="${file.local}" alt="Preview of ${escapeHtml(title)}" />`;
    return `<div class="material-preview__fallback"><span>${escapeHtml(extension.toUpperCase())}</span><h2>This file opens in a separate app.</h2><p>Use the buttons to open or download the original file.</p></div>`;
  }

  function materialPager(files, currentFile, section) {
    const related = uniqueFiles(files).filter((file) => file.sections.includes(section)).sort((a, b) => displayFileTitle(a).localeCompare(displayFileTitle(b)));
    const current = related.findIndex((file) => file.local === (currentFile.canonical || currentFile.local));
    const previous = related[current - 1];
    const next = related[current + 1];
    if (!previous && !next) return '';
    return `<nav class="material-pager" aria-label="Browse materials in this section">${previous ? `<a href="${materialRoute(previous.local)}"><span>← Previous material</span><strong>${escapeHtml(displayFileTitle(previous))}</strong></a>` : '<span></span>'}${next ? `<a class="material-pager__next" href="${materialRoute(next.local)}"><span>Next material →</span><strong>${escapeHtml(displayFileTitle(next))}</strong></a>` : '<span></span>'}</nav>`;
  }

  function materialNotes(file, files) {
    const notes = [file.requirements, file.contentNote].filter(Boolean);
    const source = file.contentNoteSource;
    const online = file.relatedResources || [];
    const related = (file.relatedFiles || []).map((local) => files.find((item) => item.local === local)).filter(Boolean);
    return `${notes.length ? `<div class="material-notes"><h2>Before you start</h2>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}${source ? `<p><a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}<span class="sr-only"> (opens in a new tab)</span> ↗</a></p>` : ''}</div>` : ''}${online.length ? `<div class="material-related"><h2>Companion activity</h2><ul>${online.map((item) => `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}<span class="sr-only"> (opens in a new tab)</span> ↗</a></li>`).join('')}</ul></div>` : ''}${related.length ? `<div class="material-related"><h2>Companion files</h2><ul>${related.map((item) => `<li><a href="${materialRoute(item.local)}">${escapeHtml(displayFileTitle(item))} (${extensionFor(item.local)})</a></li>`).join('')}</ul></div>` : ''}`;
  }

  function courseStatus(start, end, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return 'Check dates';
    return today < start ? 'Scheduled' : today > end ? 'Past dates' : 'Dates in progress';
  }

  function renderCourseStatuses() {
    document.querySelectorAll('[data-course-start]').forEach((badge) => {
      const status = courseStatus(badge.dataset.courseStart, badge.dataset.courseEnd);
      badge.textContent = status;
      badge.classList.toggle('course-badge--current', status === 'Dates in progress');
    });
  }

  function materialMarkup(files, file) {
      const title = displayFileTitle(file);
      const sections = file.sections.map(sectionFor).filter(Boolean);
      const primary = sections.find((section) => section.slug !== 'home') || sections[0];
      const extension = extensionFor(file.local);
      const tags = materialTags(sections, title);
      const record = archiveRecord(file);
    return `<section class="page-intro material-intro"><div class="container"><nav class="breadcrumbs breadcrumbs--light" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="library.html">All materials</a>${primary ? `<span aria-hidden="true">/</span><a href="${primary.href}">${escapeHtml(primary.title)}</a>` : ''}<span aria-hidden="true">/</span><span>${escapeHtml(title)}</span></nav><p class="eyebrow eyebrow--coral">${escapeHtml(extension)} material</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(record.description)}</p></div></section><section class="section section--paper"><div class="container"><div class="material-layout"><aside class="material-sidebar"><p class="eyebrow eyebrow--coral">Material details</p>${learningDetails(record).length ? `<p class="learning-details">${escapeHtml(learningDetails(record).join(" · "))}</p>` : ""}<div class="material-actions"><a class="button button--coral" href="${file.local}" target="_blank" rel="noopener noreferrer">Open file <span aria-hidden="true">↗</span></a><a class="text-link" href="${file.local}" download>Download file <span aria-hidden="true">↓</span></a></div>${materialNotes(file, files)}<dl><div><dt>Format</dt><dd>${escapeHtml(extension)}</dd></div><div><dt>File size</dt><dd>${escapeHtml(fileSize(file.bytes))}</dd></div>${tags.length ? `<div><dt>Topics</dt><dd class="material-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</dd></div>` : ''}${sections.length ? `<div><dt>Related sections</dt><dd>${sections.map((section) => `<a href="${section.href}">${escapeHtml(section.title)}</a>`).join(', ')}</dd></div>` : ''}</dl>${primary ? `<a class="material-back" href="${primary.href}">← Back to ${escapeHtml(primary.title)}</a>` : '<a class="material-back" href="library.html">← Back to all materials</a>'}</aside><div class="material-preview">${previewMarkup(file, title)}</div></div>${primary ? materialPager(files, file, primary.slug) : ''}</div></section>`;
  }

  async function renderMaterialPage() {
    const main = document.querySelector('[data-material-page]');
    if (!main || main.dataset?.staticDetail) return;
    const requested = new URLSearchParams(window.location.search).get('file') || '';
    if (!isLocalMaterial(requested)) {
      upsertMeta('name', 'robots', 'noindex');
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Material not found</h1><p>Please choose a file from the catalogue.</p><a class="button button--light" href="library.html">Browse materials <span aria-hidden="true">→</span></a></div></section>`;
      return;
    }
    try {
      const files = await fetchManifest();
      const originalFile = files.find((item) => item.local === requested);
      if (!originalFile) {
        upsertMeta('name', 'robots', 'noindex');
        main.innerHTML = '<section class="page-intro"><div class="container"><h1>Material not found</h1><p>This link does not match a material in the collection.</p><a class="button button--light" href="library.html">Browse materials →</a></div></section>';
        return;
      }
      const file = files.find((item) => item.local === originalFile.canonical) || originalFile;
      upsertMeta('name', 'robots', 'index, follow');
      const record = archiveRecord(file);
      setPageMetadata({ title: `${record.title} · Intermediate English Materials`, description: record.description, relativeUrl: materialRoute(file.local) });
      main.innerHTML = materialMarkup(files, file);
    } catch {
      main.innerHTML = '<section class="page-intro"><div class="container"><h1>Unable to load this material</h1><p>Please try again. You can also find and open the file from the complete file list.</p><button class="button button--light" type="button" data-retry-material>Try again</button> <a class="text-link text-link--light" href="library.html#file-list">Browse files →</a></div></section>';
      main.querySelector('[data-retry-material]')?.addEventListener('click', renderMaterialPage);
    }
  }

  function renderSectionPagers() {
    document.querySelectorAll('[data-section-pager]').forEach((target) => { target.innerHTML = sectionPager(target.dataset.sectionPager); });
  }

  function handleContactForm() {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;
    const status = document.querySelector('[data-form-status]');
    const copy = form.querySelector('[data-copy-enquiry]');
    const preview = form.querySelector('[data-enquiry-preview]');
    const previewText = form.querySelector('[data-enquiry-text]');
    const readEnquiry = () => {
      const formData = new FormData(form);
      const enquiry = prepareEnquiry(Object.fromEntries(formData));
      if (!form.checkValidity() || !enquiry) {
        status.textContent = 'Please enter your name, a valid email address and a message.';
        status.className = 'form-status form-status--error'; form.reportValidity(); return null;
      }
      return enquiry;
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const enquiry = readEnquiry();
      if (!enquiry) return;
      status.textContent = 'Your email is prepared. Send it from your email app. If the app does not open, choose “Copy email text”. Your message stays here.';
      status.className = 'form-status';
      window.location.href = enquiry.href;
    });
    copy?.addEventListener('click', async () => {
      const enquiry = readEnquiry();
      if (!enquiry) return;
      try {
        await navigator.clipboard.writeText(enquiry.text);
        status.textContent = 'Email text copied. Paste it into your email app and send it to Tom.';
        status.className = 'form-status form-status--success';
      } catch {
        preview.hidden = false;
        previewText.value = enquiry.text;
        previewText.focus(); previewText.select();
        status.textContent = 'Select and copy the prepared email below, then paste it into your email app.';
        status.className = 'form-status';
      }
    });
    form.querySelectorAll('button[disabled]').forEach((button) => { button.disabled = false; });
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { assetRevision, materialNotes, courseStatus, materialMarkup, sectionMarkup, localFileCard, escapeHtml, normalizeSearchText, searchScore, displayFileTitle, uniqueFiles, catalogueRecords, filterRecords, archiveRecord, resourceRecord, catalogueItem, resourceCard, learningDetails, materialDescription, prepareEnquiry, headerMarkup, footerMarkup, materialPager, isLocalMaterial, materialRoute, handleContactForm, fetchManifest, renderMaterialPage, renderLibrary };
    return;
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
  renderCourseStatuses();
  handleCopyEmail();
})();
