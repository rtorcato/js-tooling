---
title: Tailwind CSS
description: Tailwind CSS v4 scaffold (PostCSS plugin + CSS entry) for frontend projects.
---

[Tailwind CSS](https://tailwindcss.com) v4 is **CSS-first** — there is no
`tailwind.config.js` and content is auto-detected. js-tooling scaffolds the two
files a v4 setup needs: a PostCSS config that loads the Tailwind plugin, and a
CSS entry that imports Tailwind.

The setup wizard offers it **only for frontend project types** (`web-app`,
`react-app`, `nextjs-app`), and `doctor` only reports on it when `tailwindcss`
is already a dependency.

## Usage

Scaffold it into an existing project:

```bash
npx @rtorcato/js-tooling fix tailwind
```

`setup` also offers it interactively for frontend projects. The fixer is
**safe-add** — it never overwrites an existing `postcss.config.mjs` or CSS
entry, so it can also repair a half-wired setup.

## Generated files

`postcss.config.mjs`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

`src/styles/globals.css`:

```css
@import "tailwindcss";
```

Import `src/styles/globals.css` from your app entry point. Customize theme
tokens directly in that CSS file with `@theme` — no JavaScript config needed.

## Peer dependencies

`setup` adds these to `devDependencies`; add them manually when running only the
fixer:

```json
{
  "devDependencies": {
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

Vite projects can use `@tailwindcss/vite` instead of the PostCSS plugin —
`doctor` recognizes either. Then `doctor` reports `Tailwind — ok`.
