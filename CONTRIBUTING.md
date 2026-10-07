# Contributing to Exact Diff

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Ground rules

- **No network access, ever.** The app must keep working offline and must not make requests.
  Do not add CDNs, analytics, fonts or remote resources.
- **No runtime dependencies.** `src/index.html` stays a single self-contained file with vanilla JavaScript.
- **Exactness first.** A change must never hide a real difference in Strict mode.

## Set up

```bash
git clone https://github.com/YOUR-USERNAME/exact-diff.git
cd exact-diff
npm ci
npx playwright install chromium
npm test
```

Edit `src/index.html` and reload it in a browser; there is no build step for development.

## Before you open a pull request

1. Add or update tests: diff-engine behaviour in `tests/unit/`, user-visible behaviour in `tests/e2e/`.
2. Run `npm run test:unit` and `npx playwright test --project=chromium` (CI also runs Firefox and WebKit).
3. Add a line under **Unreleased** in `CHANGELOG.md` for user-visible changes.
4. Use clear commit messages; [Conventional Commits](https://www.conventionalcommits.org/) style
   (`fix: …`, `feat: …`, `docs: …`) is preferred.

## Reporting bugs

Open an issue with the two inputs (or a minimal version of them), what you expected and what you saw.
For whitespace problems, attach the files rather than pasting them, so line endings and invisible
characters survive.

Security problems: please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
