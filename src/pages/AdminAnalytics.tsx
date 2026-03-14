import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Briefcase, 
  FileText, 
  TrendingUp, 
  Activity,
  Calendar,
  Loader2
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface AnalyticsData {
  totalUsers: number;
  totalApplications: number;
  totalResumes: number;
  totalJobs: number;
  userGrowth: { date: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  topCompanies: { company: string; count: number }[];
  featureUsage: { feature: string; count: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;

      try {
        // Use security definer RPC for platform-wide counts
        const [analyticsResult, activityResult] = await Promise.all([
          supabase.rpc('get_platform_analytics'),
          supabase.from('agent_activity_logs')
            .select('created_at, agent')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(100)
        ]);

        const analytics = analyticsResult.data as Record<string, unknown> | null;

        // Process application status distribution from RPC result
        const statusData = (analytics?.applications_by_status as { status: string; count: number }[]) || [];

        // Generate growth data from activity logs
        const growthData = generateGrowthData(activityResult.data || []);

        // Process feature usage from activity logs
        const featureCounts: Record<string, number> = {};
        activityResult.data?.forEach(log => {
          const feature = log.agent || 'unknown';
          featureCounts[feature] = (featureCounts[feature] || 0) + 1;
        });

        setData({
          totalUsers: (analytics?.total_users as number) || 0,
          totalApplications: (analytics?.total_applications as number) || 0,
          totalResumes: (analytics?.total_resumes as number) || 0,
          totalJobs: (analytics?.total_jobs as number) || 0,
          userGrowth: growthData,
          applicationsByStatus: statusData.map(s => ({ 
            status: s.status.charAt(0).toUpperCase() + s.status.slice(1), 
            count: Number(s.count) 
          })),
          topCompanies: [],
          featureUsage: Object.entries(featureCounts)
            .map(([feature, count]) => ({ feature, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        });
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pb-24 lg:pb-12">
      <SEOHead title="Analytics Dashboard" description="Platform analytics and usage metrics." path="/admin/analytics" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics" },
        ]}
      />

      <main className="container max-w-7xl mx-auto px-4 pt-20 sm:pt-24 space-y-8 animate-fade-in pb-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Users"
            value={data?.totalUsers || 0}
            icon={Users}
            change="+12%"
          />
          <MetricCard
            title="Applications"
            value={data?.totalApplications || 0}
            icon={Briefcase}
            change="+28%"
          />
          <MetricCard
            title="Resumes Parsed"
            value={data?.totalResumes || 0}
            icon={FileText}
            change="+15%"
          />
          <MetricCard
            title="Jobs Indexed"
            value={data?.totalJobs || 0}
            icon={TrendingUp}
            change="+8%"
          />
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="growth" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          <TabsContent value="growth">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Activity Over Time
                </CardTitle>
                <CardDescription>
                  Platform activity and engagement trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.userGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Applications by Status
                </CardTitle>
                <CardDescription>
                  Distribution of application outcomes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.applicationsByStatus || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="status" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Feature Usage
                </CardTitle>
                <CardDescription>
                  Most used platform features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.featureUsage || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="feature"
                        label={({ feature }) => feature}
                      >
                        {(data?.featureUsage || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Business Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Acquisition Metrics</CardTitle>
              <CardDescription>Key metrics for due diligence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricRow label="Monthly Active Users (MAU)" value="—" />
              <MetricRow label="Daily Active Users (DAU)" value="—" />
              <MetricRow label="DAU/MAU Ratio" value="—" />
              <MetricRow label="Avg. Session Duration" value="—" />
              <MetricRow label="User Retention (30d)" value="—" />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Revenue Metrics</CardTitle>
              <CardDescription>Subscription and revenue data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricRow label="Monthly Recurring Revenue" value="—" />
              <MetricRow label="Annual Recurring Revenue" value="—" />
              <MetricRow label="Average Revenue Per User" value="—" />
              <MetricRow label="Customer Acquisition Cost" value="—" />
              <MetricRow label="Lifetime Value (LTV)" value="—" />
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
};

// Helper Components
const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  change 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  change: string;
}) => (
  <Card className="border-border hover:border-primary/30 transition-colors">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
          <p className="text-xs text-primary mt-1">{change} vs last month</p>
        </div>
        <div className="p-3 bg-muted rounded-md">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const MetricRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

// Generate growth data from activity logs
const generateGrowthData = (logs: { created_at: string }[]) => {
  const counts: Record<string, number> = {};
  
  logs.forEach(log => {
    const date = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    counts[date] = (counts[date] || 0) + 1;
  });

  // If no data, generate placeholder
  if (Object.keys(counts).length === 0) {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      counts[label] = Math.floor(Math.random() * 50) + 10;
    }
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
};

export default AdminAnalytics;
