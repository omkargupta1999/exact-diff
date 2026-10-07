# Security policy

## Supported versions

Security fixes are released for the latest version only.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include what an attacker could do, the steps or files to reproduce it, and the browser or desktop build
you used. You can expect an acknowledgement within a week.

## Security model

- The page sets a Content-Security-Policy with `default-src 'none'` and `connect-src 'none'`; it loads
  nothing from the network and cannot send data anywhere.
- Compared text is always HTML-escaped and never executed. Invisible, control and bidirectional
  characters are displayed as labelled badges.
- Only user settings are stored (in `localStorage`); compared text is not persisted.
- The desktop build runs Electron with `contextIsolation`, `sandbox` and no Node.js integration in the
  page, cancels all network requests in the main process, and blocks navigation and pop-ups.
- Release files are built by GitHub Actions with SHA-pinned actions and published with SHA-256
  checksums and a signed build provenance attestation (`gh attestation verify <file> --repo YOUR-USERNAME/exact-diff`).

Things that are in scope: anything that executes compared text, sends data off the machine, hides a
real difference in Strict mode, or weakens the protections above.
