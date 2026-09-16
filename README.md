# Intermediate English Materials

Static GitHub Pages website for Tom Johnson’s English-learning resource library.

## Publishing

Upload the complete contents of this folder to the root of the `english-materials` GitHub repository. Keep `index.html` in the repository root. In **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`.

## Built-in checks

The site contains a GitHub Action at `.github/workflows/site-check.yml`. It runs after every update and once each week.

It verifies the local pages, navigation, sitemap and all 214 downloaded materials. It also produces a separate report for external source links. A third-party website blocking an automated check is reported as a warning; it does not remove or rewrite the original resource.

To run the local checks manually, use any current Node.js version:

```text
node scripts/generate-sitemap.js --check
node scripts/check-site.js
node scripts/check-site.js --external
```

## Final publishing check

Before publishing a meaningful design update, quickly check the home page, library search and one material page on a desktop browser, a phone, and with keyboard-only navigation.

## Analytics

No analytics service is installed. Add one only after choosing a privacy-friendly provider and creating its site identifier; GitHub Pages does not provide visitor statistics by itself.
