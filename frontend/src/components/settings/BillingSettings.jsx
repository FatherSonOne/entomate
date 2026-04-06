import React, { useState, useEffect, useCallback } from 'react'
import { CreditCard, Check, ExternalLink, ArrowUpRight } from 'lucide-react'
import { useEntitlements } from '../../hooks/useEntitlements'
import billingService from '../../services/billingService'

const TIER_NAMES = { free: 'Free', starter: 'Starter', pro: 'Professional', business: 'Business' }

const ENT_PRICES = {
  ent_starter: { monthly: 39, yearly: 390 },
  ent_pro: { monthly: 79, yearly: 790 },
  ent_business: { monthly: 149, yearly: 1490 },
}

const ENT_FEATURES = {
  ent_starter: ['5 users', '5 workflows', '500 runs/mo', '3 integrations', 'Triggers'],
  ent_pro: ['15 users', '25 workflows', '5,000 runs/mo', '10 integrations', 'Webhooks & scheduling'],
  ent_business: ['Unlimited users', 'Unlimited workflows', 'Unlimited runs', 'Unlimited integrations', 'API access', 'Custom functions', 'Priority support'],
}

function formatNumber(n) {
  if (n === null || n === undefined) return 'Unlimited'
  return n.toLocaleString()
}

export default function BillingSettings() {
  const { entitlements, entTier, isTrialing, trialDaysLeft, workspaceId, isLoading: entLoading } = useEntitlements()
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    const load = async () => {
      setLoading(true)
      try {
        const [plansData, invoicesData, subData] = await Promise.all([
          billingService.getAvailablePlans(),
          billingService.getInvoices(workspaceId),
          billingService.getSubscription(workspaceId),
        ])
        setPlans(plansData)
        setInvoices(invoicesData)
        setSubscription(subData)
      } catch (err) {
        console.error('Failed to load billing data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId])

  const handleCheckout = useCallback(async (planId) => {
    if (!workspaceId) return
    setActionLoading(planId)
    try {
      const url = await billingService.createCheckout({ workspaceId, planId, billingCycle })
      window.location.href = url
    } catch (err) {
      console.error('Checkout failed:', err)
    } finally {
      setActionLoading(null)
    }
  }, [workspaceId, billingCycle])

  const handleManageBilling = useCallback(async () => {
    if (!workspaceId) return
    setActionLoading('portal')
    try {
      const url = await billingService.openCustomerPortal(workspaceId)
      window.location.href = url
    } catch (err) {
      console.error('Portal failed:', err)
    } finally {
      setActionLoading(null)
    }
  }, [workspaceId])

  const entPlans = plans.filter(p => p.app === 'entomate')

  if (loading || entLoading) {
    return <div className="text-center text-sm text-gray-500 py-8">Loading billing information...</div>
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-white">
                Entomate {TIER_NAMES[entTier] || 'Free'}
              </h3>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                isTrialing ? 'bg-yellow-500/20 text-yellow-400' :
                subscription?.status === 'past_due' ? 'bg-red-500/20 text-red-400' :
                'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isTrialing ? `Trial - ${trialDaysLeft}d left` :
                 subscription?.status === 'past_due' ? 'Past Due' :
                 subscription ? 'Active' : 'Free'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {subscription?.current_period_end
                ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : 'Free tier'}
            </p>
          </div>
          {subscription && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"
            >
              {actionLoading === 'portal' ? 'Opening...' : <>Manage <ExternalLink className="w-3.5 h-3.5" /></>}
            </button>
          )}
        </div>

        {/* Usage meters */}
        {entitlements && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Workflows', current: entitlements.usage?.workflows || 0, limit: entitlements.max_workflows },
              { label: 'Runs/mo', current: entitlements.usage?.workflow_runs || 0, limit: entitlements.max_workflow_runs_mo },
              { label: 'Integrations', current: entitlements.usage?.integrations || 0, limit: entitlements.max_integrations },
            ].map(m => {
              const pct = m.limit ? Math.min(100, (m.current / m.limit) * 100) : 0
              return (
                <div key={m.label} className="bg-black/20 rounded-lg p-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{m.label}</span>
                    <span className="text-gray-300">{formatNumber(m.current)} / {formatNumber(m.limit)}</span>
                  </div>
                  {m.limit !== null && (
                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981',
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={billingCycle === 'monthly' ? 'font-semibold text-white' : 'text-gray-500'}>Monthly</span>
        <button
          type="button"
          aria-label={`Switch to ${billingCycle === 'monthly' ? 'yearly' : 'monthly'} billing`}
          onClick={() => setBillingCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-10 h-5 rounded-full transition-colors ${billingCycle === 'yearly' ? 'bg-emerald-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <span className={billingCycle === 'yearly' ? 'font-semibold text-white' : 'text-gray-500'}>
          Yearly <span className="text-emerald-400 text-xs">(2 months free)</span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entPlans.map(plan => {
          const pricing = ENT_PRICES[plan.id]
          const features = ENT_FEATURES[plan.id] || []
          const isCurrentPlan = (
            (plan.tier === 1 && entTier === 'starter') ||
            (plan.tier === 2 && entTier === 'pro') ||
            (plan.tier === 3 && entTier === 'business')
          )
          const price = pricing ? (billingCycle === 'yearly' ? Math.round(pricing.yearly / 12) : pricing.monthly) : 0

          return (
            <div key={plan.id} className={`rounded-xl p-5 border ${isCurrentPlan ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-700'} bg-gray-800 relative`}>
              {isCurrentPlan && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase">Current</div>
              )}
              <h4 className="font-semibold text-white">{plan.name}</h4>
              <div className="flex items-baseline gap-1 mt-2 mb-4">
                <span className="text-2xl font-bold text-white">${price}</span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>
              <div className="space-y-2 mb-5">
                {features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCurrentPlan || !!actionLoading}
                className={`w-full py-2 text-sm font-semibold rounded-lg transition-colors ${
                  isCurrentPlan ? 'bg-gray-700 text-gray-500 cursor-default' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {actionLoading === plan.id ? 'Loading...' : isCurrentPlan ? 'Current Plan' : 'Upgrade'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Invoice History */}
      {invoices.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Invoice History</h4>
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-gray-700 last:border-0">
              <span className="text-sm text-gray-300">
                {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : 'N/A'}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">${(inv.amount_paid / 100).toFixed(2)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{inv.status}</span>
                {inv.invoice_url && (
                  <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                    View <ArrowUpRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
