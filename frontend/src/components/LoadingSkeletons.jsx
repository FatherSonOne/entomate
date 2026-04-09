// LoadingSkeletons.jsx
// Enhanced shimmer-based skeleton loaders for Entomate
// Uses brand gradient shimmer instead of basic pulse animation

import React from 'react'

// ── Base Skeleton Block ──────────────────────────
function Bone({ className = '', style, rounded = false }) {
  return (
    <div
      className={`en-skeleton ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
      style={style}
    />
  )
}

// ── Card Skeleton ────────────────────────────────
export function CardSkeleton({ lines = 3, hasIcon = true, className = '' }) {
  return (
    <div className={`vc p-4 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        {hasIcon && <Bone className="h-10 w-10 flex-shrink-0" rounded />}
        <div className="flex-1 space-y-2">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className="h-3" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  )
}

// ── List Item Skeleton ───────────────────────────
export function ListItemSkeleton({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <Bone className="h-8 w-8 flex-shrink-0" rounded />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5" style={{ width: `${70 + Math.random() * 20}%` }} />
            <Bone className="h-2.5" style={{ width: `${40 + Math.random() * 25}%` }} />
          </div>
          <Bone className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ── Meeting Card Skeleton ────────────────────────
export function MeetingCardSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vc p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Bone className="h-10 w-10" rounded />
              <div className="space-y-1.5">
                <Bone className="h-4 w-40" />
                <Bone className="h-3 w-24" />
              </div>
            </div>
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 mt-2">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-12 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Project Card Skeleton ────────────────────────
export function ProjectCardSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vc p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <Bone className="h-5 w-36" />
              <Bone className="h-3 w-56" />
            </div>
            <Bone className="h-8 w-8" rounded />
          </div>
          {/* Progress bar */}
          <Bone className="h-2 w-full rounded-full mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {[0, 1, 2].map((j) => (
                <Bone key={j} className="h-6 w-6 border-2" rounded style={{ borderColor: 'var(--bg-surface)' }} />
              ))}
            </div>
            <Bone className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Dashboard Stats Skeleton ─────────────────────
export function StatsSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vc p-4">
          <div className="flex items-center gap-3">
            <Bone className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-6 w-14" />
              <Bone className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Table Skeleton ───────────────────────────────
export function TableSkeleton({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`vc overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? '30%' : '20%' }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} className="h-3 flex-1" style={{ maxWidth: j === 0 ? '30%' : '20%', width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Agent Card Skeleton ──────────────────────────
export function AgentCardSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vc p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bone className="h-12 w-12 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Bone className="h-4 w-28" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
          <Bone className="h-3 w-full mb-2" />
          <Bone className="h-3 w-4/5 mb-4" />
          <div className="flex gap-2">
            <Bone className="h-8 w-20 rounded-md" />
            <Bone className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Dashboard Page Skeleton (full layout) ────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-72" />
        </div>
        <Bone className="h-9 w-28 rounded-md" />
      </div>
      {/* Stats */}
      <StatsSkeleton />
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Bone className="h-5 w-32 mb-2" />
          <MeetingCardSkeleton count={3} />
        </div>
        <div className="space-y-4">
          <Bone className="h-5 w-24 mb-2" />
          <ListItemSkeleton count={4} />
        </div>
      </div>
    </div>
  )
}

// ── Meetings Page Skeleton ───────────────────────
export function MeetingsPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-36" />
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-md" />
          <Bone className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <MeetingCardSkeleton count={5} />
    </div>
  )
}

// ── Analytics Page Skeleton ──────────────────────
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-36" />
        <Bone className="h-9 w-40 rounded-md" />
      </div>
      <StatsSkeleton />
      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vc p-5">
          <Bone className="h-5 w-36 mb-4" />
          <Bone className="h-48 w-full rounded-lg" />
        </div>
        <div className="vc p-5">
          <Bone className="h-5 w-32 mb-4" />
          <Bone className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
