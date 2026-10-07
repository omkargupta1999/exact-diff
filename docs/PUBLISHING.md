# Publishing Exact Diff on GitHub — step by step

This guide takes the project from a folder on your computer to a public repository with a live web
app, automatic tests and downloadable releases. Do the steps in order; each one says how to check it worked.

## 0. Before you start

You need:

- A GitHub account.
- `git` (`git --version`).
- Node.js 22.12 or newer (`node -v`). If you have an older one, install the LTS with nvm:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
  source ~/.bashrc && nvm install --lts
  ```
- Optional: the GitHub CLI `gh` (makes steps 3 and 8 one command).

> **Employer check.** If any of this was written on work time or work equipment, confirm your
> employment agreement lets you publish it under your own name before making the repository public.

## 1. Put your GitHub username into the project

The files use the placeholder `YOUR-USERNAME`. Replace it everywhere (run in the project folder):

```bash
# Linux
grep -rl 'YOUR-USERNAME' --exclude-dir=node_modules --exclude-dir=.git . | xargs sed -i 's/YOUR-USERNAME/your-github-name/g'
# macOS
grep -rl 'YOUR-USERNAME' --exclude-dir=node_modules --exclude-dir=.git . | xargs sed -i '' 's/YOUR-USERNAME/your-github-name/g'
```

Check: `grep -r 'YOUR-USERNAME' --exclude-dir=node_modules .` prints nothing.

## 2. Test it locally

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:unit
npx playwright test --project=chromium
```

Check: all tests pass. `npm run build` prints the file sizes.

## 3. Create the repository on GitHub

**With the website:** GitHub → **New repository** → name `exact-diff`, **Public**, and do **not** add a
README, licence or .gitignore (the project already has them).

**Or with gh:** `gh repo create exact-diff --public --description "Character-exact, offline text comparison"`

## 4. Push the code

```bash
git init -b main
git add .
git commit -m "feat: Exact Diff 1.0.0"
git remote add origin https://github.com/your-github-name/exact-diff.git
git push -u origin main
```

Check: the files appear on GitHub, and the **Actions** tab shows *CI* and *CodeQL* running.

## 5. Turn on GitHub Pages (the live web app)

Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The *Deploy web app to GitHub Pages* workflow runs after CI passes on `main`. If CI already finished
before you changed this setting, open **Actions → Deploy web app to GitHub Pages → Run workflow**.

Check: `https://your-github-name.github.io/exact-diff/` opens the app.

## 6. Turn on the security features (all free for public repositories)

Repository → **Settings**:

- **Security → Advanced Security (or Code security):** enable *Dependabot alerts*, *Dependabot security updates*,
  *Secret protection / secret scanning* and *Private vulnerability reporting*.
- **Rules → Rulesets → New branch ruleset** for `main`: require a pull request, and require status
  checks to pass (pick the three *Test* jobs and *Desktop package builds* once they have run once).

The exact menu names change from time to time; GitHub's settings search finds each one by name.

## 7. Publish the first release

The version is already 1.0.0, so tag the current commit:

```bash
git tag -a v1.0.0 -m "Exact Diff 1.0.0"
git push origin v1.0.0
```

The **Release** workflow then: runs all tests → builds the single HTML file and web zip → builds the
Windows, Linux and macOS desktop packages → writes `SHA256SUMS.txt` → signs build provenance →
publishes the release with generated notes.

Check: **Releases** shows *v1.0.0* with about nine files attached.

For later versions:

```bash
npm version patch      # or minor / major: updates all version numbers, commits, tags
git push --follow-tags
```

## 8. Make it look good on your profile and portfolio

- Repository **About** (gear icon on the main page): description, website = your Pages URL,
  topics such as `diff`, `text-compare`, `offline`, `pwa`, `devtools`, `privacy`, `javascript`.
- **Settings → General → Social preview:** upload `docs/images/social-preview.png`.
- Pin the repository on your GitHub profile (**Customize your pins**).
- On your portfolio, link both the live app and the repository, use a screenshot from `docs/images/`,
  and describe what you built: an offline diff engine (Patience + Myers), a privacy-first design enforced
  by CSP, a PWA, cross-platform desktop packaging, and a CI/CD pipeline with cross-browser tests,
  CodeQL, SHA-pinned actions and SLSA provenance.

## 9. Optional: sign the desktop apps

Unsigned apps trigger warnings. To sign them, add repository secrets and electron-builder picks them up:

- **Windows:** `CSC_LINK` (base64 of a `.pfx` code-signing certificate) and `CSC_KEY_PASSWORD`.
- **macOS:** an Apple Developer ID certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`) plus notarisation
  credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

Then pass them as `env:` to the desktop job in `.github/workflows/release.yml` and remove
`CSC_IDENTITY_AUTO_DISCOVERY: 'false'`. See electron-builder's code-signing documentation.

## Troubleshooting

| Problem | Fix |
|---|---|
| `EBADENGINE Unsupported engine` | Node is older than 22.12; install the LTS with nvm (step 0), then `rm -rf node_modules && npm ci`. |
| Pages shows 404 | Step 5 not done, or the deploy workflow has not run yet. Run it manually from Actions. |
| Release job fails at *Check that the tag matches package.json* | Tag and version differ. Use `npm version …` to create tags. |
| macOS build fails or the app is reported as damaged | Unsigned Apple-silicon apps may be blocked; run `xattr -cr "/Applications/Exact Diff.app"` or sign it (step 9). |
| A Firefox or WebKit test fails in CI | Download the *playwright-report* artifact from the failed run and open `index.html` to see the trace. |
