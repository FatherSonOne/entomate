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