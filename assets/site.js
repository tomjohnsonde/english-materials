(() => {
  const data = globalThis.siteData;
  const page = document.body.dataset.page;
  const escapeHtml = (value) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  function resourceCard(resource, compact = false) {
    const isExternal = /^https?:\/\//.test(resource.href);
    return `<article class="resource-card ${resource.accent ? 'resource-card--accent' : ''}">
      <p class="resource-card__type">${escapeHtml(resource.type)}</p>
      <h3>${escapeHtml(resource.title)}</h3>
      ${compact ? '' : `<p>${escapeHtml(resource.desc)}</p>`}
      <a href="${resource.href}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="Open ${escapeHtml(resource.title)}${isExternal ? ' in a new tab' : ''}">Open resource <span aria-hidden="true">↗</span></a>
    </article>`;
  }

  function renderHeader() {
    const header = document.querySelector('[data-site-header]');
    if (!header) return;
    const links = data.navigation.map((item) => `<a ${item.page === page ? 'aria-current="page"' : ''} href="${item.href}">${item.label}</a>`).join('');
    header.innerHTML = `<div class="utility-bar"><div class="container utility-bar__inner"><a class="brand" href="index.html" aria-label="Official learning materials site of Tom Johnson"><span class="brand__dot"></span><span class="brand__full">Intermediate English Materials</span><span class="brand__short">IEM</span></a><span class="official-site">Official site of Tom Johnson</span><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation"><span></span><span></span><span></span><span class="sr-only">Open menu</span></button><form class="site-search" action="library.html" role="search"><label class="sr-only" for="site-search-input">Search materials</label><input id="site-search-input" name="q" type="search" placeholder="Search materials" /><button aria-label="Search" type="submit">⌕</button></form></div></div><nav class="main-nav" id="site-navigation" aria-label="Main navigation"><div class="container main-nav__inner">${links}<a class="main-nav__contact" href="contact.html">Contact Tom <span aria-hidden="true">→</span></a></div></nav>`;
    const toggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('.main-nav');
    toggle.addEventListener('click', () => { const open = nav.classList.toggle('main-nav--open'); toggle.setAttribute('aria-expanded', String(open)); });
  }

  function renderFooter() {
    const footer = document.querySelector('[data-site-footer]');
    if (!footer) return;
    footer.innerHTML = `<div class="footer-band"><div class="container footer-band__inner"><p>Intermediate English Materials</p><a href="#main">Back to top ↑</a></div></div><div class="footer-main"><div class="container footer-main__inner"><div><a class="footer-brand" href="index.html">IEM<span>.</span></a><p>Practical English materials<br />for curious intermediate learners.</p></div><div class="footer-links"><p>Explore</p>${data.navigation.map((item) => `<a href="${item.href}">${item.label}</a>`).join('')}</div><div class="footer-links"><p>Site information</p><a href="library.html#section-directory">All 20 sections</a><a href="contact.html">Contact Tom</a><a href="mailto:tomjohnsonde@gmail.com">Email Tom</a></div></div><div class="container footer-legal"><span>© ${new Date().getFullYear()} Intermediate English Materials</span><span>Materials are stored and available directly on this site.</span></div></div>`;
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
    directory.innerHTML = data.sections.map((section) => `<a class="section-directory__item" href="${section.href}"><span>${escapeHtml(section.group)}</span><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.desc)}</p><b aria-hidden="true">→</b></a>`).join('');
  }

  function renderLibrary() {
    const grid = document.querySelector('[data-library-grid]');
    if (!grid) return;
    const params = new URLSearchParams(window.location.search);
    const input = document.querySelector('[data-library-search]');
    const filterBar = document.querySelector('[data-filter-bar]');
    const resultNote = document.querySelector('[data-results-note]');
    const topics = ['all', 'grammar', 'medical', 'speaking', 'writing', 'vocabulary'];
    const labels = { all: 'All', grammar: 'Grammar', medical: 'Medical', speaking: 'Speaking', writing: 'Writing & emails', vocabulary: 'Vocabulary' };
    let activeTopic = params.get('topic') || 'all';
    let query = params.get('q') || '';
    if (!topics.includes(activeTopic)) activeTopic = 'all';
    if (input) input.value = query;
    filterBar.innerHTML = topics.map((topic) => `<button type="button" class="filter-button ${topic === activeTopic ? 'is-active' : ''}" data-topic="${topic}">${labels[topic]}</button>`).join('');
    const apply = () => {
      const lowercaseQuery = query.trim().toLowerCase();
      const resources = data.resources.filter((item) => (activeTopic === 'all' || item.topic === activeTopic) && (!lowercaseQuery || `${item.title} ${item.type} ${item.desc} ${item.topic}`.toLowerCase().includes(lowercaseQuery)));
      grid.innerHTML = resources.length ? resources.map((resource) => resourceCard(resource)).join('') : `<p class="empty-state">No materials match that search. Try another topic or a shorter word.</p>`;
      resultNote.textContent = `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'} available`;
      filterBar.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.topic === activeTopic));
    };
    filterBar.addEventListener('click', (event) => { const button = event.target.closest('button[data-topic]'); if (!button) return; activeTopic = button.dataset.topic; apply(); });
    input?.addEventListener('input', (event) => { query = event.target.value; apply(); });
    apply();
  }

  function renderSectionPage() {
    const main = document.querySelector('[data-section-page]');
    if (!main) return;
    const slug = new URLSearchParams(window.location.search).get('section');
    const section = data.sections.find((item) => item.slug === slug);
    if (!section) {
      main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">Materials archive</p><h1>Section not found</h1><p>Please choose a section from the full directory.</p><a class="button button--light" href="library.html">Open directory <span aria-hidden="true">→</span></a></div></section>`;
      return;
    }
    document.title = `${section.title} · Intermediate English Materials`;
    const resources = data.resources.filter((item) => item.section === section.slug);
    main.innerHTML = `<section class="page-intro"><div class="container"><p class="eyebrow eyebrow--coral">${escapeHtml(section.group)}</p><h1>${escapeHtml(section.title)}</h1><p>${escapeHtml(section.desc)}</p></div></section><section class="section section--paper"><div class="container"><div class="archive-banner"><div><p class="eyebrow eyebrow--coral">Full local archive</p><h2>Everything is stored on this site.</h2><p>Choose a featured resource or download a file from the complete section archive below.</p></div><a class="button button--dark" href="library.html">Browse all materials <span aria-hidden="true">→</span></a></div>${resources.length ? `<div class="section-heading"><p class="eyebrow eyebrow--coral">Featured files</p><h2>Start with these materials</h2></div><div class="resource-grid resource-grid--three">${resources.map((resource) => resourceCard(resource)).join('')}</div>` : ''}<section class="local-materials" aria-labelledby="local-materials-title"><p class="eyebrow eyebrow--coral">All copied files</p><h2 id="local-materials-title">Complete section archive</h2><div data-local-materials="${section.slug}"><p class="archive-loading">Loading local files…</p></div></section></div></section>`;
  }

  function localFileCard(file) {
    const extension = file.local.split('.').pop().toUpperCase();
    return `<a class="local-file" href="${file.local}" download><span class="local-file__type">${escapeHtml(extension)}</span><span class="local-file__title">${escapeHtml(file.title || 'Download file')}</span><span class="local-file__arrow" aria-hidden="true">↓</span></a>`;
  }

  async function renderLocalMaterials() {
    const targets = document.querySelectorAll('[data-local-materials]');
    if (!targets.length) return;
    try {
      const response = await fetch('assets/materials/manifest.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const files = await response.json();
      targets.forEach((target) => {
        const section = target.dataset.localMaterials;
        const matching = files.filter((file) => file.sections.includes(section));
        target.innerHTML = matching.length ? `<div class="local-file-list">${matching.map(localFileCard).join('')}</div>` : `<p class="archive-empty">No local files are listed for this section.</p>`;
      });
    } catch {
      targets.forEach((target) => { target.innerHTML = '<p class="archive-empty">The local file list will appear after the site is published. The direct links above are still available.</p>'; });
    }
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

  renderHeader();
  renderFooter();
  renderResourceGrids();
  renderTopics();
  renderSectionDirectory();
  renderLibrary();
  renderSectionPage();
  renderLocalMaterials();
  handleContactForm();
})();
