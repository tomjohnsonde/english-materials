# Intermediate English Materials

Static GitHub Pages website for Tom Johnson’s English-learning resources. Sections, menu order and all original material addresses are retained.

## Build and validate

Node.js 22 or newer is required. No package installation is needed.

```sh
npm run build
npm run check
npm run check:external
```

The build updates shared navigation, resource cards, downloadable lists, 214 complete material pages, 14 section pages and the sitemap. Run it after editing `assets/data.js`, `assets/materials/manifest.json`, shared markup in `assets/site.js` or the page templates. Increase `assetRevision` in `assets/site.js` for a new release. Generated `material-*.html` and `section-*.html` files must be uploaded with the rest of the site; edit their sources instead of the generated HTML.

The 28 tests cover search, filters, contact handling, failures, all 221 legacy detail URLs, duplicate aliases, static metadata, companion files and course dates. Tests use lightweight DOM simulations, not a full browser. The validator checks all HTML files, local links, original material sizes/hashes, duplicate aliases, responsive images, asset revisions and sitemap entries.

GitHub Actions runs validation on updates and weekly. External checks follow redirects and inspect a bounded response. Confirmed HTTP errors and recognised missing-page responses fail the check. Authentication, CAPTCHA and rate limiting are reported for manual review rather than assumed broken. A successful response confirms reachability, not the accuracy or completeness of the exercise. Reports are kept separately in `reports/site-check.json` and `reports/external-links.json`.

## Materials

All 221 original binary files remain unchanged, representing 214 unique materials and seven identical aliases. All 214 unique records now have descriptions based on their document content, including OCR of scanned worksheets. PDF page counts, activity types, learning skills, suggested practice times and known companion files are included. This catalogue review is not a full proofreading or answer validation of every exercise.

Unknown CEFR levels and unverified answer-key status are left absent. Timing is a suggested practice session, not a certified lesson duration. Reference sheets, blank forms and charts are distinguished from exercises. Where a recording is missing, the detail page says so before the learner starts. Verified content corrections appear beside the download controls with official sources where appropriate. Original documents are preserved.

`reports/material-review.json` records the scope, file hashes and extraction method for the catalogue review. `reports/static-html-review.json` records a separate parsed-HTML check of headings, labels, local fragments, image text and file integrity.

## Addresses and search previews

New detail links use `material-<original-filename>.html`; generic sections use `section-<slug>.html`. Their HTML includes the actual heading, description, canonical address, Open Graph/Twitter metadata and structured data before JavaScript runs. Downloads and section lists work without JavaScript. Section organisation and navigation remain the same.

Old `material.html?file=…` and `section.html?section=…` addresses still render the requested content using JavaScript. They point to the new canonical addresses. Static hosting cannot personalise initial HTML for different query strings, so old shared links can retain generic social previews; share the new detail links for specific previews. No client redirect or deleted old file is required.

## Contact and courses

The contact form prepares an email draft; it never claims to send the message. Text remains on the page. Clipboard failure exposes selectable text. Direct email links work without JavaScript. No form service or analytics service is installed.

Course badges describe whether the saved dates are upcoming, in progress or past, using the Europe/Berlin date. They do not imply that registration is available or that a course actually took place. Official listings remain the source for current availability.

## Publishing

Upload the complete release to the root of `tomjohnsonde/english-materials`, with `index.html` at the root. GitHub Pages uses `main` and `/(root)`. The deployment prefix is `/english-materials/`. Upload all generated detail pages; do not upload previous ZIP files, backups, `.git` or unrelated folders.

Use the full ZIP for a complete copy or the update ZIP over the existing site. This local review did not publish changes.

## Verification limits

The in-app browser failed its administrative policy check, so no real desktop/mobile layout, accessibility-tree or performance measurements were completed in this session. Do not treat the DOM simulations or file-size measurements as browser or Lighthouse results.

When browser access is restored, check widths 320, 390, 768 and 1280, enlarged text, keyboard focus, mobile PDF opening, course-table scrolling, search filters and contact behaviour. Protected third-party resources require their ordinary access flow. Live indexing and refreshed social previews can only be confirmed after deployment; Search Console also requires property access.
