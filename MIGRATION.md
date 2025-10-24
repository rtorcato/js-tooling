# 🔄 GitLab to GitHub Migration Guide

This repository is being migrated from GitLab to GitHub. Here's what you need to know:

## 📋 Migration Checklist

### ✅ **Automated Setup (Already Done)**
- [x] GitHub Actions workflow created (`.github/workflows/ci.yml`)
- [x] GitHub-compatible semantic-release configuration
- [x] Updated dependencies and exports
- [x] Environment variable mapping

### 🔧 **Manual Steps Required**

#### 1. **Create GitHub Repository**
```bash
# Option A: Using GitHub CLI (recommended)
gh repo create rtorcato/js-tooling --public --description "JavaScript and TypeScript tooling for Node.js, React, Next.js, and Vitest"

# Option B: Create manually on GitHub.com
# Go to https://github.com/new and create the repository
```

#### 2. **Set Repository Secrets**
Add these secrets in GitHub repository settings:
- `NPM_TOKEN`: Your npm authentication token for publishing
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

```bash
# Set NPM_TOKEN using GitHub CLI
gh secret set NPM_TOKEN --body "your-npm-token-here"
```

#### 3. **Update Git Remote**
```bash
# Add GitHub as new remote
git remote add github https://github.com/rtorcato/js-tooling.git

# Or change origin to GitHub
git remote set-url origin https://github.com/rtorcato/js-tooling.git

# Push to GitHub
git push -u github main --tags
```

#### 4. **Update Release Configuration**
Choose between GitLab and GitHub semantic-release configs:

**For GitHub (recommended):**
```javascript
// release.config.mjs
import semanticRelease from './tooling/semantic-release/github.mjs'
export default { ...semanticRelease }
```

**For GitLab (current):**
```javascript
// release.config.mjs  
import semanticRelease from './tooling/semantic-release/index.mjs'
export default { ...semanticRelease }
```

#### 5. **Update Package URLs**
Update these in `package.json`:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/rtorcato/js-tooling.git"
  },
  "homepage": "https://github.com/rtorcato/js-tooling#readme",
  "bugs": {
    "url": "https://github.com/rtorcato/js-tooling/issues"
  }
}
```

## 🔄 **Key Differences: GitLab vs GitHub**

| Feature | GitLab | GitHub |
|---------|--------|--------|
| **CI/CD** | `.gitlab-ci.yml` | `.github/workflows/ci.yml` |
| **Secrets** | CI/CD Variables | Repository Secrets |
| **Token Variable** | `GITLAB_TOKEN` | `GITHUB_TOKEN` |
| **Semantic Release Plugin** | `@semantic-release/gitlab` | `@semantic-release/github` |
| **Repository URL** | `gitlab.com/rtorcato/js-tooling` | `github.com/rtorcato/js-tooling` |

## 🚀 **GitHub Actions Features**

The new GitHub Actions workflow includes:
- **Better caching**: More efficient dependency caching
- **Parallel jobs**: Faster CI/CD execution
- **Matrix builds**: Can easily test multiple Node.js versions
- **Rich UI**: Better visualization of pipeline status
- **Security**: Built-in security scanning and dependency updates

## 🔧 **Environment Variables Mapping**

| GitLab CI | GitHub Actions |
|-----------|----------------|
| `CI_COMMIT_BRANCH` | `github.ref_name` |
| `CI_COMMIT_SHA` | `github.sha` |
| `CI_COMMIT_MESSAGE` | `github.event.head_commit.message` |
| `GITLAB_TOKEN` | `secrets.GITHUB_TOKEN` |
| `NPM_TOKEN` | `secrets.NPM_TOKEN` |

## 📦 **Updated CLI Generator**

The CLI will now generate GitHub-compatible configurations by default:
- GitHub Actions workflows
- GitHub-compatible semantic-release config
- Proper repository URLs and links

## 🎯 **Next Steps After Migration**

1. Test the GitHub Actions pipeline
2. Verify npm publishing works
3. Update documentation and badges
4. Set up branch protection rules
5. Configure issue/PR templates
6. Set up GitHub Pages (if needed)

## 🆘 **Rollback Plan**

If you need to rollback to GitLab:
1. Keep the `.gitlab-ci.yml` file
2. Switch back to `release.config.mjs` (GitLab version)
3. Update git remote back to GitLab
4. Remove GitHub-specific files

---

**Need Help?** Check the GitHub Actions documentation or open an issue!