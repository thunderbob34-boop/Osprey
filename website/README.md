# Osprey Website

Astro marketing site. Local dev: `npm install && npm run dev`.

## Deployment
Auto-deploys to GitHub Pages via `.github/workflows/deploy-website.yml` on push to `main`.

**One-time setup:** In GitHub → Settings → Pages, set Source to "GitHub Actions"
(this replaces the old "Deploy from a branch /docs" setting). The legacy
`docs/privacy.html` is superseded by the `/privacy` route.
