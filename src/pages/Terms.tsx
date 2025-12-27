import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-3xl mx-auto px-6 py-16">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold tracking-tight mb-8">Terms of Service</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: December 27, 2025</p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Hunter AI, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hunter AI provides an automated job search and application platform. Our AI agents 
              discover job opportunities, prepare tailored applications, and assist with interview preparation.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the accuracy of your profile information. 
              You agree not to use our service for any unlawful purpose or to submit false information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Application Automation</h2>
            <p className="text-muted-foreground leading-relaxed">
              By enabling automated applications, you authorize Hunter AI to submit job applications 
              on your behalf using the information you provide. You remain responsible for all 
              applications submitted through your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hunter AI is provided "as is" without warranties. We are not responsible for 
              job outcomes, application rejections, or any decisions made by employers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at legal@hunter-ai.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
