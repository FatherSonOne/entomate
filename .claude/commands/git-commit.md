---
name: GitCommit
description: Scan for sensitive keys/files, update .gitignore, then commit and push to GitHub main branch
---

<objective>
Perform a secure git commit workflow: detect sensitive files, protect them via .gitignore, then commit all staged changes and push to the main branch.

Execute ALL steps below in order. Do NOT skip any step.
</objective>

<instructions>

## Phase 1: Scan for Sensitive Files & Keys

### 1a. Search for hardcoded secrets in source code
Scan all source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.yaml`, `.yml`, `.env*`, `.cfg`, `.ini`, `.toml`) for patterns that indicate hardcoded secrets:

- API keys: patterns like `sk-`, `pk-`, `AIza`, `AKIA`, `ghp_`, `gho_`, `github_pat_`, `xox`, `Bearer `
- Tokens/secrets: variables named `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*API_KEY`, `*PRIVATE_KEY`, `*ACCESS_KEY`
- Connection strings: `mongodb://`, `postgres://`, `mysql://`, `redis://`, `amqp://` with credentials
- Base64-encoded keys: long alphanumeric strings assigned to key/secret/token variables
- Firebase/GCP/AWS config objects with real values (not environment variable references)

**Exclude** from flagging:
- References to `process.env.*`, `import.meta.env.*`, or `Deno.env.get()` (these are safe environment variable lookups)
- Type definitions and interfaces
- Example/placeholder values like `your-api-key-here`, `xxx`, `<PLACEHOLDER>`
- Values in `.env.example` or `.env.*.example` files
- Comments that mention key names without values

If hardcoded secrets are found:
1. Report each finding with file path and line number
2. **Ask the user** whether to replace each with an environment variable reference before proceeding
3. Do NOT auto-fix — the user must confirm

### 1b. Find sensitive files in the working tree
Search for files that should never be committed:

**File patterns to check:**
- `.env`, `.env.local`, `.env.production`, `.env.staging`, `.env.development` (any `.env*` except `.env.example`)
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.cert`, `*.crt`
- `serviceAccount*.json`, `*-credentials.json`, `firebase-adminsdk*.json`, `google-cloud-key*.json`
- `*.secret`, `*secret*.json`, `*secrets*.json`, `*credentials*.yaml`, `*credentials*.yml`
- `id_rsa`, `id_rsa.pub`, `id_ed25519`, `id_dsa`, `.ssh/` directory contents
- `*.sqlite`, `*.sqlite3`, `*.db` (database files)
- `.htpasswd`, `.htaccess` with credentials
- `docker-compose*.yml` files containing hardcoded passwords (inspect content)
- `terraform.tfstate`, `*.tfvars` (infrastructure state with secrets)

### 1c. Check git history for previously committed secrets
Run: `git log --all --diff-filter=A --name-only --pretty=format:""` and cross-reference against sensitive file patterns above. If sensitive files were previously committed, warn the user that they may need to purge git history (provide guidance but do NOT auto-purge).

## Phase 2: Update .gitignore

### 2a. Read the current `.gitignore`
Read the existing `.gitignore` file at the project root.

### 2b. Ensure all sensitive patterns are covered
Check that `.gitignore` includes rules for ALL of the following categories. Add any that are missing:

**Environment files:**
```
.env
.env.*
!.env.example
!.env.*.example
```

**Secret/key files:**
```
*.pem
*.key
*.p12
*.pfx
*.jks
*.keystore
*.cert
*.crt
serviceAccount*.json
*-credentials.json
firebase-adminsdk*.json
google-cloud-key*.json
*.secret
*secret*.json
*secrets*.json
*credentials*.yaml
*credentials*.yml
```

**SSH keys:**
```
id_rsa
id_rsa.pub
id_ed25519
id_dsa
```

**Infrastructure secrets:**
```
terraform.tfstate
terraform.tfstate.backup
*.tfvars
!*.tfvars.example
```

**Database files:**
```
*.sqlite
*.sqlite3
*.db
```

Only ADD missing rules — do NOT remove or modify existing rules. Group new additions under a clear comment header.

### 2c. Remove any tracked sensitive files from git index
If any sensitive files are currently tracked by git (check with `git ls-files`), run:
```
git rm --cached <file>
```
for each one. Do NOT delete the files from disk — only remove from git tracking.

## Phase 3: Stage, Commit, and Push

### 3a. Show summary to user
Before committing, display a clear summary:
- Files that will be added/modified/deleted
- Any new .gitignore rules added
- Any files removed from git tracking
- The target branch (main)

**Ask the user to confirm** before proceeding with the commit.

### 3b. Stage changes
Stage all relevant changes:
```
git add -A
```

### 3c. Verify nothing sensitive is staged
Run `git diff --cached --name-only` and cross-check against sensitive patterns. If ANY sensitive file is staged, **ABORT** and report the issue.

### 3d. Commit
Create a descriptive commit message summarizing what changed. Use this format:
```
<type>: <concise description>

<optional body with details>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### 3e. Push to main
Push to the main branch:
```
git push origin main
```

If the push is rejected (e.g., remote has new commits), inform the user and suggest pulling first. Do NOT force push.

## Error Handling

- If any step fails, stop and report the error clearly
- Never force-push or use `--no-verify`
- Never auto-fix hardcoded secrets without user confirmation
- If the working tree has merge conflicts, report them and stop
- If on a different branch than main, ask the user whether to switch or push to current branch

</instructions>
