// billingService.js — Entomate plans and the backend billing routes
// (backend/routes/billing.js). Stripe Checkout and the Customer Portal open on
// Stripe's pages; the webhook is the only writer of the workspace's plan.
import { billingApi } from './api'

/** Plans a workspace can buy itself. The ecosystem bundle is sold by contact only. */
export const PAID_PLANS = ['solo', 'team']

export const PLAN_OFFERS = [
  {
    id: 'solo',
    name: 'Solo',
    price: { monthly: 20, yearly: 200 },
    what: '1 seat · 15 bot hours a month · unlimited browser recordings',
  },
  {
    id: 'team',
    name: 'Team',
    price: { monthly: 100, yearly: 1000 },
    what: 'Unlimited seats · 75 bot hours a month, shared by the workspace · unlimited browser recordings',
  },
]

export const FREE_BOT_HOURS = 2
export const PACK = { item: 'bot_pack_10', hours: 10, price: 10 }
export const CONTACT_EMAIL = 'fm1@qntmecos.com'

/** The Stripe Checkout item for a plan and billing cycle, e.g. solo_yearly. */
export const checkoutItem = (planId, cycle) => `${planId}_${cycle}`

const billingService = {
  getStatus: (workspaceId) => billingApi.getStatus(workspaceId),

  /** Returns the Stripe Checkout URL. */
  async startCheckout(workspaceId, item) {
    const { url } = await billingApi.checkout(workspaceId, item)
    return url
  },

  /** Returns the Stripe Customer Portal URL. */
  async openPortal(workspaceId) {
    const { url } = await billingApi.portal(workspaceId)
    return url
  },
}

export default billingService
