import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-border bg-card">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-20 h-5 ml-2.5" />
        </div>
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
        </div>
        <div className="px-3 py-4 space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-full h-10 rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1">
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <Skeleton className="w-24 h-6" />
          <div className="flex gap-2">
            <Skeleton className="w-20 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </header>

        <main className="p-6 max-w-5xl mx-auto">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="flex-1 h-10 rounded-lg" />
              <Skeleton className="w-28 h-10 rounded-lg" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="p-5 rounded-xl border border-border space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="w-48 h-5" />
                    <Skeleton className="w-32 h-4" />
                  </div>
                </div>
                <Skeleton className="w-full h-4" />
                <div className="flex gap-2">
                  <Skeleton className="w-20 h-8 rounded-lg" />
                  <Skeleton className="w-20 h-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
