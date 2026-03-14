import { Skeleton } from "@/components/ui/skeleton";

export function JobFeedSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-2">
        <Skeleton className="flex-[2] h-11 rounded-lg" />
        <Skeleton className="flex-1 h-11 rounded-lg" />
        <Skeleton className="w-28 h-11 rounded-lg" />
        <Skeleton className="w-11 h-11 rounded-lg" />
      </div>
      <Skeleton className="w-32 h-4" />
      {[1, 2, 3].map(i => (
        <div key={i} className="p-5 rounded-md border border-border space-y-3">
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
            <Skeleton className="w-24 h-9 rounded-lg" />
            <Skeleton className="w-20 h-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrackerSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="space-y-1.5">
          <Skeleton className="w-32 h-6" />
          <Skeleton className="w-48 h-4" />
        </div>
        <Skeleton className="w-40 h-9 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="w-24 h-6 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-md border border-border space-y-2">
          <div className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="w-2/5 h-4" />
              <Skeleton className="w-1/3 h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolsSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-1.5">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-64 h-4" />
      </div>
      {[1, 2].map(cat => (
        <div key={cat} className="space-y-3">
          <Skeleton className="w-16 h-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1.5">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-48 h-4" />
      </div>
      <Skeleton className="w-56 h-9 rounded-lg" />
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="w-40 h-5" />
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-48 h-3" />
          </div>
        </div>
        <Skeleton className="w-full h-20 rounded-md" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
