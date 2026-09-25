# README diagrams

| Source (edit this)    | Rendered for the README                                 |
| --------------------- | ------------------------------------------------------- |
| `without-vs-with.svg` | `without-vs-with-light.png`, `without-vs-with-dark.png` |
| `architecture.svg`    | `architecture-light.png`, `architecture-dark.png`       |

The SVGs are the source. Colors come from CSS variables: the root element has
`class="theme-light"`, and switching it to `theme-dark` gives the dark version. The README uses
PNGs (2× scale) because they render the same on GitHub and npmjs.com, and `<picture>` picks the
dark one in dark mode.

To re-render after editing an SVG, open it in a Chromium browser, or run headless (example for
Edge on Windows; `google-chrome` works the same on macOS/Linux):

```bash
sed 's/class="theme-light"/class="theme-dark"/' architecture.svg > /tmp/architecture-dark.svg
msedge --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=960,600 \
  --user-data-dir=/tmp/edge --screenshot=architecture-dark.png file:///tmp/architecture-dark.svg
```

Use the SVG's own `width`/`height` for `--window-size`. When the architecture changes (a new
service or step), update `architecture.svg` and [docs/architecture.md](../../docs/architecture.md)
together.
