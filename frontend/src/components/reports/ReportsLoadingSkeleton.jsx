import { Skeleton } from '../SharedUI'

export default function ReportsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* PDF section skeleton */}
      <div className="vc p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="vc p-4">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-9 w-full mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* CSV section skeleton */}
      <div className="vc p-6">
        <Skeleton className="h-6 w-28 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="vc p-4">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="vc p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-7 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
