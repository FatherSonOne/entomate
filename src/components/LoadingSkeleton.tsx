import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200'

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl'
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: ''
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// Card Skeleton
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white border border-gray-100 rounded-[24px] p-6 ${className}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="space-y-2">
        <Skeleton width={100} height={12} variant="rounded" />
        <Skeleton width={200} height={24} variant="rounded" />
      </div>
      <Skeleton width={40} height={40} variant="circular" />
    </div>
    <div className="space-y-3">
      <Skeleton height={16} variant="rounded" />
      <Skeleton height={16} width="80%" variant="rounded" />
      <Skeleton height={16} width="60%" variant="rounded" />
    </div>
  </div>
)

// List Item Skeleton
export const ListItemSkeleton: React.FC = () => (
  <div className="p-4 border border-gray-100 rounded-xl flex items-center gap-4">
    <Skeleton width={48} height={48} variant="circular" />
    <div className="flex-1 space-y-2">
      <Skeleton height={16} width="60%" variant="rounded" />
      <Skeleton height={12} width="40%" variant="rounded" />
    </div>
    <Skeleton width={80} height={32} variant="rounded" />
  </div>
)

// Meeting Card Skeleton
export const MeetingCardSkeleton: React.FC = () => (
  <div className="cmf-card dark">
    <div className="flex justify-between items-start mb-8">
      <div className="space-y-3">
        <Skeleton width={120} height={12} variant="rounded" className="bg-gray-700" />
        <Skeleton width={250} height={32} variant="rounded" className="bg-gray-700" />
      </div>
      <Skeleton width={100} height={32} variant="rounded" className="bg-gray-700" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <Skeleton height={12} variant="rounded" className="bg-gray-700" />
        <Skeleton height={48} variant="rounded" className="bg-gray-800" />
      </div>
      <div className="flex items-end">
        <Skeleton height={48} variant="rounded" className="bg-gray-600 w-full" />
      </div>
    </div>
  </div>
)

// Project Card Skeleton
export const ProjectCardSkeleton: React.FC = () => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton width={150} height={20} variant="rounded" />
        <Skeleton width={100} height={12} variant="rounded" />
      </div>
      <Skeleton width={60} height={24} variant="rounded" />
    </div>
    <Skeleton height={8} variant="rounded" className="w-full" />
    <div className="flex justify-between">
      <Skeleton width={80} height={16} variant="rounded" />
      <Skeleton width={60} height={16} variant="rounded" />
    </div>
  </div>
)

// Chat Message Skeleton
export const ChatMessageSkeleton: React.FC<{ isUser?: boolean }> = ({ isUser = false }) => (
  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${isUser ? 'bg-gray-200' : 'bg-gray-100'}`}>
      <div className="space-y-2">
        <Skeleton height={14} width={200} variant="rounded" />
        <Skeleton height={14} width={150} variant="rounded" />
      </div>
    </div>
  </div>
)

// Full Page Loading
export const PageLoadingSkeleton: React.FC = () => (
  <div className="h-full flex flex-col gap-6 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton width={200} height={28} variant="rounded" />
        <Skeleton width={150} height={16} variant="rounded" />
      </div>
      <Skeleton width={120} height={40} variant="rounded" />
    </div>
    <CardSkeleton />
    <div className="flex-1 bg-white border border-gray-100 rounded-[24px] p-6">
      <div className="space-y-4">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </div>
  </div>
)

// Spinner
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }

  return (
    <div
      className={`${sizeClasses[size]} border-[#2563EB] border-t-transparent rounded-full animate-spin ${className}`}
    />
  )
}

export default Skeleton
