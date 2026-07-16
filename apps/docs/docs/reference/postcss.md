---
title: PostCSS
description: Minimal PostCSS config (autoprefixer) for non-Tailwind CSS pipelines.
---

[PostCSS](https://postcss.org) transforms CSS with JavaScript plugins. This
preset scaffolds a minimal `postcss.config.mjs` with
[autoprefixer](https://github.com/postcss/autoprefixer) — vendor prefixing
driven by your [browserslist](https://github.com/browserslist/browserslist).

:::note Tailwind users
Tailwind CSS **v4** ships its own PostCSS plugin (`@tailwindcss/postcss`), which
autoprefixes on its own — so if you use the [Tailwind preset](./tailwind) you
already have a `postcss.config.mjs` and don't need this one. This preset is for
CSS pipelines **without** Tailwind. It's **safe-add**, so running it never
overwrites a Tailwind-generated config.
:::

## Usage

```bash
npx @rtorcato/js-tooling fix postcss
```

## Generated `postcss.config.mjs`

```js
export default {
  plugins: {
    autoprefixer: {},
  },
}
```

Add more PostCSS plugins (e.g. `postcss-nesting`, `postcss-preset-env`) to the
`plugins` object as your pipeline needs them.

## Peer dependencies

```json
{
  "devDependencies": {
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

Autoprefixer targets the browsers in your `browserslist` (set in `package.json`
or `.browserslistrc`); without one it falls back to its defaults.
