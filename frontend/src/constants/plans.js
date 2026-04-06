// ============================================
// Tenant Plan Definitions — Entomate
// Matches QntmEcos billing system Stripe tiers
// ============================================

/** @type {readonly ['free', 'starter', 'pro', 'business', 'ecosystem']} */
export const TENANT_PLANS = ['free', 'starter', 'pro', 'business', 'ecosystem']

export const SELF_SERVICE_PLANS = ['free', 'starter', 'pro', 'business', 'ecosystem']

export const TENANT_PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Professional',
  business: 'Business',
  ecosystem: 'Ecosystem',
}

export const TENANT_PLAN_DESCRIPTIONS = {
  free: 'Try it out with basic features',
  starter: 'For small teams getting started',
  pro: 'For growing organizations',
  business: 'For established organizations with advanced needs',
  ecosystem: 'Full suite: Entomate + Logos Vision + Pulse',
}

// Primary limit: workflow runs per month (from billing migration)
export const TENANT_PLAN_LIMITS = {
  free: 100,
  starter: 500,
  pro: 5000,
  business: 50000,
  ecosystem: 50000,
}

// AI request limits per month (from billing migration entitlements)
export const TENANT_PLAN_AI_LIMITS = {
  free: 100,
  starter: 500,
  pro: 2000,
  business: 10000,
  ecosystem: 10000,
}

// Max team members (from billing migration)
export const TENANT_PLAN_MAX_USERS = {
  free: 3,
  starter: 5,
  pro: 15,
  business: null, // unlimited
  ecosystem: null,
}

// Pricing — matches Stripe price objects
export const TENANT_PLAN_PRICING = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 19, yearly: 190 },
  pro: { monthly: 49, yearly: 490 },
  business: { monthly: 99, yearly: 990 },
  ecosystem: { monthly: 149, yearly: 1490 },
}

// Stripe price IDs (test mode) — from billing_system.sql migration
export const STRIPE_PRICE_IDS = {
  ent_starter_monthly: 'price_1TIiAmGb3AGXe9w8pQABSusv',
  ent_starter_yearly: 'price_1TIiAmGb3AGXe9w8MuJUwbsP',
  ent_pro_monthly: 'price_1TIiBGGb3AGXe9w8nLYuctg8',
  ent_pro_yearly: 'price_1TIiBGGb3AGXe9w8coh1rQtf',
  ent_business_monthly: 'price_1TIiBnGb3AGXe9w8RKwqwc6y',
  ent_business_yearly: 'price_1TIiBnGb3AGXe9w8vtrS9kIJ',
  bundle_starter_monthly: 'price_1TIiCdGb3AGXe9w8SgW6qVmw',
  bundle_starter_yearly: 'price_1TIiCdGb3AGXe9w8zlJ7RYIW',
  bundle_pro_monthly: 'price_1TIiDCGb3AGXe9w8KbI0Obiu',
  bundle_pro_yearly: 'price_1TIiDCGb3AGXe9w8G3SwetsI',
  bundle_business_monthly: 'price_1TIiDiGb3AGXe9w8lfTkbx7F',
  bundle_business_yearly: 'price_1TIiDiGb3AGXe9w8qPhrCsxg',
}

// Which apps each plan unlocks
export const TENANT_PLAN_APPS = {
  free: ['Entomate'],
  starter: ['Entomate'],
  pro: ['Entomate'],
  business: ['Entomate'],
  ecosystem: ['Entomate', 'Logos Vision', 'Pulse'],
}

// Features per plan (from billing migration features JSONB)
export const TENANT_PLAN_FEATURES = {
  free: {
    workflows: true,
    triggers: true,
  },
  starter: {
    workflows: true,
    triggers: true,
    basic_integrations: true,
  },
  pro: {
    workflows: true,
    triggers: true,
    basic_integrations: true,
    advanced_integrations: true,
    webhooks: true,
    scheduling: true,
  },
  business: {
    workflows: true,
    triggers: true,
    basic_integrations: true,
    advanced_integrations: true,
    webhooks: true,
    scheduling: true,
    api_access: true,
    custom_functions: true,
    priority_support: true,
  },
  ecosystem: {
    workflows: true,
    triggers: true,
    basic_integrations: true,
    advanced_integrations: true,
    webhooks: true,
    scheduling: true,
    api_access: true,
    custom_functions: true,
    priority_support: true,
    voxer: true,
    email: true,
    contacts: true,
    pipelines: true,
  },
}

// Plan badge color classes
export const PLAN_BADGE_COLORS = {
  ecosystem: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  business: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  pro: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  free: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300',
}

export const ORG_MEMBER_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer']

export const ORG_MEMBER_ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
}
