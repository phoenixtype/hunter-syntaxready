import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav skeleton */}
      <nav className="fixed top-0 w-full z-50 bg-background border-b border-border">
        <div className="container max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-24 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </nav>

      {/* Main content skeleton */}
      <main className="pt-24 pb-12">
        <div className="container max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="space-y-2 mb-12">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Button skeleton */}
              <Skeleton className="w-full h-10 rounded-lg" />

              {/* Card skeleton */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="w-28 h-5" />
                  </div>
                  <Skeleton className="w-36 h-3 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center py-2">
                    <Skeleton className="w-16 h-10" />
                    <Skeleton className="w-20 h-3 mt-2" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between">
                          <Skeleton className="w-20 h-3" />
                          <Skeleton className="w-8 h-3" />
                        </div>
                        <Skeleton className="w-full h-2 rounded-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Resume section skeleton */}
              <div className="rounded-lg border border-border bg-card p-8 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-7 w-44" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="border-2 border-dashed border-border rounded-lg p-12">
                  <div className="flex flex-col items-center">
                    <Skeleton className="w-10 h-10 rounded mb-4" />
                    <Skeleton className="w-48 h-4" />
                    <Skeleton className="w-32 h-3 mt-2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Activity log skeleton */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="w-20 h-8 rounded" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="w-16 h-3" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Job feed skeleton */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-28" />
                    <div className="flex gap-2">
                      <Skeleton className="w-24 h-8 rounded" />
                      <Skeleton className="w-8 h-8 rounded" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-lg border border-border space-y-3">
                        <div className="flex justify-between">
                          <div className="space-y-1">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="w-16 h-6 rounded-full" />
                        </div>
                        <div className="flex gap-4">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="w-20 h-9 rounded" />
                          <Skeleton className="w-20 h-9 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardSkeleton;
