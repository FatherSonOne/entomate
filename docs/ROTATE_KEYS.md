Manual Tasks — Production Security Lockdown
Task 1: Rotate All Exposed API Keys
Go to each service and regenerate the key, then update your local .env:

Key	Where to Rotate	What to Look For
OpenAI API key	https://platform.openai.com/api-keys	Starts with sk-proj-...
Google Gemini key	https://aistudio.google.com/apikey	Starts with AIzaSy...
Supabase Anon Key (app)	Supabase Dashboard → Project Settings → API	eyJ... JWT
Supabase Service Key (app)	Same page → Service Role Key	eyJ... JWT
Supabase Anon Key (hub)	Same, for hub project if separate	eyJ... JWT
Supabase Service Key (hub)	Same, for hub project	eyJ... JWT
Gmail App Password	https://myaccount.google.com/apppasswords	16-char code
Admin API Key	Self-generated — run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"	Custom string
After rotating each key: paste the new value into your local .env file. Do NOT commit it.

Task 2: Purge .env from Git History

# 1. Install BFG (if not already)
#    Download from: https://rtyley.github.io/bfg-repo-cleaner/
#    Or via brew: brew install bfg

# 2. Clone a bare copy (safer than running on your working copy)
cd ~/Desktop
git clone --mirror https://github.com/FatherSonOne/entomate.git entomate-mirror

# 3. Run BFG to delete .env from all history
java -jar bfg.jar --delete-files .env entomate-mirror

# 4. Clean up and force push
cd entomate-mirror
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# 5. Back in your working directory, re-sync
cd d:/Dev/entomate
git fetch origin
git reset --hard origin/main
Task 3: Verify .gitignore
Your .gitignore should already have these, but double-check:


.env
.env.local
.env.*.local
Task 4: Fix Pre-Commit Hook (Optional)
The husky + lint-staged hook needs an eslint.config.js at project root. Quick fix:


cd d:/Dev/entomate
npm install -D eslint @eslint/js
Then create eslint.config.js:


import js from '@eslint/js'
export default [
  js.configs.recommended,
  { ignores: ['**/dist/', '**/node_modules/', '**/coverage/'] }
]
Priority order: Task 1 (rotate keys) → Task 2 (purge history) → Task 3 (verify gitignore) → Task 4 (optional eslint).

Tasks 1 and 2 are security-critical — do them before sharing the repo with anyone or deploying to production.