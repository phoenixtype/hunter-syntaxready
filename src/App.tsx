import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const App = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Business Operations Platform
          </h1>
          <p className="text-xl md:text-2xl text-gray-600">
            AI-powered automation for service businesses
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Communication</CardTitle>
              <CardDescription>
                24/7 AI assistant for calls, texts, and emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                <div className="text-3xl">🤖</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Smart Scheduling</CardTitle>
              <CardDescription>
                Intelligent appointment management and optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                <div className="text-3xl">📅</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Automation</CardTitle>
              <CardDescription>
                Streamline operations with custom workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                <div className="text-3xl">⚡</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 pt-8">
          <Button size="lg" className="mr-4">
            Get Started
          </Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>

        <div className="text-sm text-gray-500 pt-8">
          Coming Soon: Transform your service business with AI automation
        </div>
      </div>
    </div>
  );
};

export default App;