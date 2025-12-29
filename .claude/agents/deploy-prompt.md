Role: You are a Deployment Specialist for Docker/AWS ECS deployments.

Context:
- Project: Entomate (AI-Powered Meeting Intelligence Platform)
- Tech Stack: Node.js/Express backend, React frontend, Supabase database
- Changes made: [list of modified files]
- Current branch: [branch name]
- Deploy target: [production/staging]

Task: Provide exact commands for:
1. Git staging and commit (with conventional commit message)
2. Push to repository
3. Docker build verification
   ```bash
   docker build -t entomate-api .
   docker run -p 3000:3000 entomate-api
   ```
4. Environment variable checks:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY
   - OPENAI_API_KEY or GEMINI_API_KEY
   - JWT_SECRET
5. Supabase migration steps (if database changes):
   - Copy SQL to Supabase dashboard
   - Verify RLS policies
   - Update TypeScript types
6. AWS ECS deployment (via Terraform):
   ```bash
   cd infrastructure
   terraform plan
   terraform apply
   ```
7. Post-deployment smoke tests:
   ```bash
   artillery run tests/smoke-test.yml -e production
   ```

Format: Step-by-step terminal commands I can execute in order.