# js-tooling


## Getting started

```javascript
'@rtorcato/js-tooling/typescript/base';
```

## CI/CD tokens
these tokens need to be set on gitlab to publish. 
https://gitlab.com/rtorcato/js-tooling/-/settings/access_tokens
   1. GITLAB_TOKEN (set for semantic-release to make changes and publish)
   2. NPM_TOKEN= (set for private @rtorcato packages)

## Running Scripts from other packages

Temporarily install the @rtorcato/js-tooling package,
And then run the commitmessage binary exported in that package's bin field.

`pnpm --package=@rtorcato/js-tooling dlx commitmessage` 

## Linking the library locally with pnpm

To link this library locally using `pnpm`, follow these steps:

1. Run the following command in the root directory of this library:
   ```bash
   pnpm link --global
   ```

2. In the project where you want to use this library, run:
   ```bash
   pnpm link --global template
   ```

3. The library will now be linked and can be used in your project.

For more details, refer to the [pnpm link documentation](https://pnpm.io/cli/link).