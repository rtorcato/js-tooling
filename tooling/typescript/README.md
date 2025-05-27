# `tsconfig`

These are base shared `tsconfig.json` files from which all other `tsconfig.json`'s inherit.

## Usage

1. **Install this package** (if published as a package):
   ```sh
   pnpm add -D @your-org/tsconfig
   # or
   npm install --save-dev @your-org/tsconfig
   # or
   yarn add -D @your-org/tsconfig
   ```

2. **Extend the relevant config in your project `tsconfig.json`:**
   ```jsonc
   {
     "extends": "./path/to/tooling/typescript/tsconfig.base.json", // or tsconfig.react.jsonc, etc.
     // ...your overrides
   }
   ```
   Replace the path with the config that matches your project type:
   - `tsconfig.base.jsonc`: General base config
   - `tsconfig.build.jsonc`: For npm package/library builds
   - `tsconfig.react.jsonc`: For React apps
   - `tsconfig.next.jsonc`: For Next.js apps
   - `tsconfig.node.jsonc`: For Node.js/Express APIs
   - `tsconfig.express.jsonc`: (If used) For Express APIs

3. **Customizing:**
   You can override or add any settings in your own `tsconfig.json` as needed.

## Example

```jsonc
{
  "extends": "../tooling/typescript/tsconfig.react.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

## Notes
- These configs are meant to be shared and extended, not used directly.
- Pick the config that matches your project type for best results.

