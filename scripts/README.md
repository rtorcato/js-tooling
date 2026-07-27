pnpx repo-tooling commitmessage
pnpx repo-tooling version-bump
pnpx repo-tooling genpassword

<!-- run before publish -->
pnpm exec ./scripts/fix-bins.sh

pnpm link --global