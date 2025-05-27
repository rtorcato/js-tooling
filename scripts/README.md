pnpx js-tooling commitmessage
pnpx js-tooling version-bump
pnpx js-tooling genpassword

<!-- run before publish -->
pnpm exec ./scripts/fix-bins.sh

pnpm link --global