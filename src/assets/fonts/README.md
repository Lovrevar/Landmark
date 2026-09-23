# Noto Sans (Regular, Bold)

Embedded so jsPDF can render Croatian. jsPDF's built-in fonts are WinAnsi-encoded, which has no
mapping for **č, ć or đ** — and a single unmapped character makes jsPDF re-encode the *whole string*
as UCS-2BE, which the built-in font then draws as noise. `Račun` came out as `R a u n`, and the
`hr-HR` minus sign (U+2212) destroyed any line holding a negative number the same way.

These files were previously fetched from `fonts.gstatic.com` at generation time — about 1.1 MB per
export, with a silent fallback to the broken built-in font whenever the request failed (a firewalled
office, a retired Google URL). They are checked in so an export works offline, so the app has no
third-party runtime origin, and so Vite can emit them as hashed, year-cached assets.

- Source: https://fonts.google.com/noto/specimen/Noto+Sans (the same two files the old loader fetched)
- Licence: SIL Open Font License 1.1 — see [OFL.txt](./OFL.txt). Redistribution is permitted; the
  licence must travel with the files, which is why it is in this directory.
- Loaded by [`src/utils/pdfFont.ts`](../../utils/pdfFont.ts). jsPDF needs raw TTF — it cannot read
  woff2 — so these are not the web-font builds.
