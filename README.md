# Matt Wayne — Coin Sniping Strategy

This project reproduces the supplied `mattwayne.io` website snapshot. The archived copy, colors, typography, page structure, media, and outbound destinations are preserved in `public/`.

The archive's pre-rendered HTML referenced hydration chunks that were not included in the ZIP. Those unavailable scripts caused the page to render an error screen, so the deployed page uses the original rendered markup and styling without that broken runtime. The existing “See More Proof” control now opens the Whop reviews destination already present in the archive.

## Local preview

Serve `public/` on port 3000 (for example, `python3 -m http.server 3000 --bind 0.0.0.0 --directory public`).

## Static deployment

The Webdev build copies `public/` into `dist/`; the resulting `dist/index.html` is the production entry point. No third-party package installation is required for the static build.
