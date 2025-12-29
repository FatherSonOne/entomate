🔄 Part 3: Orchestrated Workflows (Multi-Agent Sequences)
Workflow 1: New Feature Development
Use this exact sequence when adding any new feature:

Step 1: PROJECT ARCHITECT
└─> "I need to add [feature name] to [project name]"
    └─> Get: Implementation plan with file list

Step 2: CODE BUILDER (for each file in plan)
└─> "Build [component/service] according to step [X] of the plan"
    └─> Get: Complete code for one file

Step 3: QUALITY CHECKER (after each file)
└─> "Review this code I just built: [paste code]"
    └─> Get: Issues and fixes

Step 4: Repeat Steps 2-3 until all files done

Step 5: DEPLOYMENT SPECIALIST
└─> "I'm ready to deploy [feature name]"
    └─> Get: Git commands and deployment steps

Step 6: LEARNING RECORDER
└─> "Document what we learned building [feature]"
    └─> Get: Knowledge base entry
Workflow 2: Bug Fix Cycle
Use when something breaks:

Step 1: QUALITY CHECKER
└─> "I'm getting this error: [error message]"
    └─> Get: Diagnosis and potential causes

Step 2: CODE BUILDER
└─> "Fix the issue in [filename] related to [problem]"
    └─> Get: Corrected code

Step 3: QUALITY CHECKER
└─> "Verify this fix doesn't create new issues: [paste fix]"
    └─> Get: Validation and edge cases

Step 4: DEPLOYMENT SPECIALIST
└─> "Deploy this bug fix to production"
    └─> Get: Deployment commands

Step 5: LEARNING RECORDER
└─> "Record this bug and solution: [details]"
    └─> Get: Documentation for future prevention
Workflow 3: Database Schema Changes
Critical workflow for Supabase changes:

Step 1: PROJECT ARCHITECT
└─> "I need to modify the database for [reason]"
    └─> Get: Schema change plan with migration strategy

Step 2: CODE BUILDER
└─> "Write the SQL migration for [change]"
    └─> Get: SQL script

Step 3: QUALITY CHECKER
└─> "Review this SQL for RLS policy impacts: [paste SQL]"
    └─> Get: Security review

Step 4: CODE BUILDER
└─> "Update TypeScript types to match new schema"
    └─> Get: Updated types.ts

Step 5: CODE BUILDER
└─> "Update services to use new schema"
    └─> Get: Modified service files

Step 6: DEPLOYMENT SPECIALIST
└─> "Deploy database changes safely"
    └─> Get: Step-by-step migration procedure

Step 7: LEARNING RECORDER
└─> "Document this schema change pattern"
    └─> Get: Migration documentation