import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex flex-col w-[272px] border-r border-border bg-card">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Skeleton className="w-9 h-9 rounded-md" />
          <Skeleton className="w-20 h-5 ml-3" />
        </div>
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
        </div>
        <div className="px-3 py-4 space-y-1">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="w-full h-11 rounded-md" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6">
          <Skeleton className="w-20 h-5" />
          <div className="flex gap-2">
            <Skeleton className="w-24 h-8 rounded-md" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="lg:hidden flex border-b border-border">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 py-3">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-10 h-3" />
            </div>
          ))}
        </div>

        <main className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
          {/* Welcome card skeleton */}
          <div className="rounded-md border border-border p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="w-48 h-5" />
                <Skeleton className="w-32 h-3" />
              </div>
              <Skeleton className="w-10 h-6 rounded-full" />
            </div>
            <Skeleton className="w-full h-1.5 rounded-full" />
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="w-40 h-4" />
                </div>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="flex gap-2 mb-4">
            <Skeleton className="flex-1 h-11 rounded-md" />
            <Skeleton className="w-28 h-11 rounded-md" />
            <Skeleton className="w-11 h-11 rounded-md" />
          </div>

          {/* Job cards */}
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 rounded-md border border-border mb-3 space-y-3">
              <div className="flex gap-3.5">
                <Skeleton className="w-11 h-11 rounded-md hidden sm:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-3/5 h-5" />
                  <Skeleton className="w-2/5 h-3.5" />
                </div>
              </div>
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-4/5 h-4" />
              <div className="flex gap-2">
                <Skeleton className="w-20 h-9 rounded-md" />
                <Skeleton className="w-20 h-9 rounded-md" />
                <Skeleton className="w-16 h-9 rounded-md" />
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
