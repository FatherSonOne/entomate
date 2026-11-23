/**
 * Settings › Plan and billing (billing rebuild, Phase 4).
 *
 * Reads GET /api/billing/status: the workspace's plan, its bot hours this
 * month, and the Stripe subscription. Owners and admins buy a plan or a
 * 10-hour pack through Stripe Checkout and manage the subscription in the
 * Stripe Customer Portal; everyone else reads. Checkout returns here with
 * ?billing=success|cancelled; on success the drawer re-reads the status until
 * the Stripe webhook has set the plan.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrg } from '../../contexts/OrgContext'
import { Key, Readout, Signal, Switch, Tag } from '../bench'
import { TENANT_PLAN_LABELS } from '../../constants/plans'
import billingService, {
  CONTACT_EMAIL, FREE_BOT_HOURS, PACK, PAID_PLANS, PLAN_OFFERS, checkoutItem,
} from '../../services/billingService'

const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const POLL_MS = 3000
const POLL_TRIES = 10

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : null)
// Bot hours reset at the start of the UTC month; local time would show the day before in the Americas.
const utcDayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtUtcDay = (iso) => (iso ? utcDayFmt.format(new Date(iso)) : null)
const fmtHours = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
const fmtMoney = (n) => `$${n.toLocaleString()}`
const planLabel = (plan) => TENANT_PLAN_LABELS[plan] || 'Free'

function subscriptionLine(status) {
  const sub = status.subscription
  if (!status.hasSubscription) return 'No subscription'
  if (!sub?.status) return 'Subscription details could not be read from Stripe'
  const cycle = sub.interval === 'year' ? 'Yearly' : sub.interval === 'month' ? 'Monthly' : null
  const end = fmtDate(sub.currentPeriodEnd)
  if (sub.status === 'past_due') return 'Payment past due. Update the card in Manage billing.'
  if (sub.cancelAtPeriodEnd && end) return `Ends ${end}. It does not renew.`
  return [cycle, end && `renews ${end}`].filter(Boolean).join(', ') || 'Active'
}

function subscriptionSignal(sub) {
  if (!sub?.status) return null
  if (sub.status === 'past_due') return { tone: 'brand', text: 'Past due' }
  if (sub.cancelAtPeriodEnd) return { tone: 'ai', text: 'Ending' }
  return { tone: 'mint', text: 'Active' }
}

function HoursReadout({ hours }) {
  if (!hours) return <Readout label="Bot hours left this month" value="—" context="Bot hours could not be read." />
  if (!hours.limited) return <Readout label="Bot hours this month" value="No limit" context={`${fmtHours(hours.used_hours)} hours used`} />

  const included = Number(hours.included_hours)
  const used = Number(hours.used_hours)
  const pct = included > 0 ? Math.min(100, (used / included) * 100) : 100
  const tone = pct >= 100 ? 'brand' : pct >= 80 ? 'ai' : 'ink'
  const pack = Number(hours.pack_hours) > 0 ? ` · ${fmtHours(hours.pack_hours)} extra hours` : ''
  const resets = fmtUtcDay(hours.resets_at)
  return (
    <div>
      <Readout
        label="Bot hours left this month"
        value={fmtHours(hours.remaining_hours)}
        context={`${fmtHours(used)} of ${fmtHours(included)} plan hours used${pack}${resets ? ` · resets ${resets}` : ''}`}
      />
      <div
        className="bs-bill-meter"
        role="img"
        aria-label={`${fmtHours(used)} of ${fmtHours(included)} plan hours used`}
      >
        <i data-tone={tone} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function BillingSettings() {
  const { org, myRole } = useOrg()
  const orgId = org?.id || null
  const [params, setParams] = useSearchParams()
  // Read once: the URL flag is removed below so a reload does not repeat it.
  const [returned] = useState(() => params.get('billing'))
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [waiting, setWaiting] = useState(returned === 'success')
  const [cycle, setCycle] = useState('monthly')
  const [busy, setBusy] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!returned) return
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('billing')
      p.delete('session_id')
      return p
    }, { replace: true })
  }, [returned, setParams])

  useEffect(() => {
    if (!orgId) return undefined
    let live = true
    let timer
    let tries = 0
    const run = async () => {
      try {
        const s = await billingService.getStatus(orgId)
        if (!live) return
        setStatus(s)
        setError(null)
        tries += 1
        if (returned === 'success' && !PAID_PLANS.includes(s.plan) && tries < POLL_TRIES) {
          timer = setTimeout(run, POLL_MS)
        } else {
          setWaiting(false)
        }
      } catch (err) {
        if (!live) return
        setError(err.message || 'Could not load billing.')
        setWaiting(false)
      }
    }
    run()
    return () => { live = false; clearTimeout(timer) }
  }, [orgId, returned, reload])

  const go = useCallback(async (key, open) => {
    setBusy(key)
    setError(null)
    try {
      window.location.assign(await open())
    } catch (err) {
      setError(err.message || 'Could not open Stripe. Try again.')
      setBusy(null)
    }
  }, [])

  if (!orgId) return <p className="bs-set-note">Choose a workspace to see its plan.</p>
  if (!status && error) {
    return (
      <div role="alert">
        <p className="bs-set-note bs-set-err">{error}</p>
        <Key size="sm" onClick={() => { setError(null); setReload((n) => n + 1) }}>Try again</Key>
      </div>
    )
  }
  if (!status) return <p className="bs-set-note">Loading…</p>

  const { plan, hasSubscription, subscription, canManage, configured } = status
  const paid = PAID_PLANS.includes(plan)
  const ecosystem = plan === 'ecosystem'
  const canBuy = canManage && configured && !ecosystem
  const sig = subscriptionSignal(subscription)

  let notice = null
  if (returned === 'success') {
    notice = waiting
      ? 'Payment received. Waiting for Stripe to confirm it…'
      : paid
        ? `Payment received. This workspace is on ${planLabel(plan)}.`
        : 'Payment received, but Stripe has not confirmed it yet. Reload this page in a minute.'
  } else if (returned === 'cancelled') {
    notice = 'Checkout cancelled. Nothing was charged.'
  }

  return (
    <div className="bs-bill">
      {notice && <p className="bs-set-note" role="status">{notice}</p>}
      {error && <p className="bs-set-note bs-set-err" role="alert">{error}</p>}

      <div className="bs-bill-now">
        <Readout label="Plan" value={planLabel(plan)} context={ecosystem ? 'Entomate, Logos Vision and Pulse' : subscriptionLine(status)} />
        <HoursReadout hours={status.botHours} />
      </div>

      {plan === 'free' && (
        <p className="bs-set-note">
          Free includes {FREE_BOT_HOURS} bot hours a month. Solo and Team include more, and can add {PACK.hours}-hour packs.
        </p>
      )}
      {!canManage && <p className="bs-set-note">Only an owner or admin can change the plan. Ask one of them.</p>}
      {canManage && !configured && <p className="bs-set-note">Billing is not turned on for this server yet.</p>}

      {hasSubscription && canManage && (
        <div className="bs-set-row">
          <div className="bs-set-l">
            <b>Billing account</b>
            <span>Card, invoices, plan changes and cancelling are in Stripe’s billing portal.</span>
          </div>
          <div className="bs-set-c">
            {sig && <Signal tone={sig.tone}>{sig.text}</Signal>}
            <Key
              disabled={!!busy || !configured}
              onClick={() => go('portal', () => billingService.openPortal(orgId))}
            >
              {busy === 'portal' ? 'Opening…' : 'Manage billing'}
            </Key>
          </div>
        </div>
      )}

      {paid && (
        <div className="bs-set-row">
          <div className="bs-set-l">
            <b>Extra bot hours</b>
            <span>{PACK.hours} hours for {fmtMoney(PACK.price)}, paid once. They are used after the plan’s hours and do not expire.</span>
          </div>
          {canBuy && (
            <div className="bs-set-c">
              <Key disabled={!!busy} onClick={() => go(PACK.item, () => billingService.startCheckout(orgId, PACK.item))}>
                {busy === PACK.item ? 'Opening…' : `Add ${PACK.hours} hours (${fmtMoney(PACK.price)})`}
              </Key>
            </div>
          )}
        </div>
      )}

      <div className="bs-set-sub">
        <span className="bs-h3">Plans</span>
        <Switch label="Billing cycle" options={CYCLES} value={cycle} onChange={setCycle} />
      </div>

      {PLAN_OFFERS.map((offer) => {
        const current = plan === offer.id
        const amount = offer.price[cycle]
        return (
          <div className="bs-set-row" key={offer.id}>
            <div className="bs-set-l">
              <b>{offer.name}</b>
              <span className="bs-mono">
                {fmtMoney(amount)} a {cycle === 'yearly' ? 'year' : 'month'}
                {cycle === 'yearly' ? ' · 2 months free' : ''}
              </span>
              <span>{offer.what}</span>
            </div>
            <div className="bs-set-c">
              {current && <Tag>Current plan</Tag>}
              {!current && canBuy && hasSubscription && paid && (
                <span className="bs-set-help">Change plans in Manage billing</span>
              )}
              {!current && canBuy && !(hasSubscription && paid) && (
                <Key
                  disabled={!!busy}
                  onClick={() => {
                    const item = checkoutItem(offer.id, cycle)
                    go(item, () => billingService.startCheckout(orgId, item))
                  }}
                >
                  {busy === checkoutItem(offer.id, cycle) ? 'Opening…' : `Choose ${offer.name}`}
                </Key>
              )}
            </div>
          </div>
        )
      })}

      <div className="bs-set-row">
        <div className="bs-set-l">
          <b>Ecosystem bundle</b>
          <span>Entomate, Logos Vision and Pulse together.</span>
        </div>
        <div className="bs-set-c">
          {ecosystem
            ? <Tag>Current plan</Tag>
            : <a className="bs-key sm" href={`mailto:${CONTACT_EMAIL}?subject=Entomate%20ecosystem%20bundle`}>Contact us</a>}
        </div>
      </div>
      {ecosystem && (
        <p className="bs-set-note">
          To change the bundle, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      )}
    </div>
  )
}
