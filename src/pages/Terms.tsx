import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Scale, AlertTriangle, Ban, CreditCard, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

const Terms = () => {
  const lastUpdated = "March 9, 2026";
  const effectiveDate = "March 9, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <SEOHead 
        title="Terms of Service" 
        description="Terms and conditions for using the hunter.ai job search automation platform." 
        path="/terms" 
      />
      <div className="container max-w-4xl mx-auto px-6 py-16">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-8 hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Last updated: {lastUpdated}</span>
            <span>•</span>
            <span>Effective: {effectiveDate}</span>
          </div>
        </div>

        {/* Quick Summary Card */}
        <Card className="mb-12 border-border bg-muted/30">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Key Points
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ You retain ownership of your resume and personal data</li>
              <li>✓ You authorize us to submit applications on your behalf</li>
              <li>✓ You're responsible for the accuracy of your profile information</li>
              <li>✓ We don't guarantee job outcomes or interviews</li>
              <li>✓ You can cancel your subscription at any time</li>
            </ul>
          </CardContent>
        </Card>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              1. Acceptance of Terms
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>
                By accessing or using hunter.ai ("Service," "Platform," "we," "us," or "our"), you agree to be bound 
                by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use 
                the Service.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you ("User," "you," or "your") and 
                hunter.ai Inc. regarding your use of our job search automation platform.
              </p>
              <p>
                You must be at least 16 years old to use this Service. By using the Service, you represent that you 
                meet this age requirement.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Description of Service</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>hunter.ai provides an AI-powered job search and application automation platform that includes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Resume Parsing & Storage:</strong> Upload and securely store your resume data</li>
                <li><strong>Job Discovery:</strong> AI-powered matching with relevant job opportunities</li>
                <li><strong>Application Automation:</strong> Automated submission of job applications on your behalf</li>
                <li><strong>Resume Tailoring:</strong> AI-generated customized resumes for specific positions</li>
                <li><strong>Interview Coaching:</strong> AI-powered preparation for job interviews</li>
                <li><strong>Application Tracking:</strong> Dashboard to monitor application status and history</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. User Accounts & Registration</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <h3 className="text-xl font-medium text-foreground">3.1 Account Creation</h3>
              <p>
                To use certain features, you must create an account with accurate and complete information. 
                You are responsible for maintaining the confidentiality of your account credentials.
              </p>

              <h3 className="text-xl font-medium text-foreground">3.2 Account Security</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You must notify us immediately of any unauthorized access to your account</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>We recommend enabling multi-factor authentication for enhanced security</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">3.3 Account Termination</h3>
              <p>
                You may delete your account at any time through your account settings. Upon deletion, we will 
                remove your personal data within 30 days, except as required by law or for legitimate business purposes.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-primary" />
              4. Application Automation Authorization
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground">
                    IMPORTANT: By enabling automated applications, you expressly authorize hunter.ai to submit job 
                    applications on your behalf using the information you provide.
                  </p>
                </CardContent>
              </Card>

              <h3 className="text-xl font-medium text-foreground">4.1 Your Authorization</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You grant us permission to submit applications to employers matching your preferences</li>
                <li>You authorize us to share your resume and profile data with potential employers</li>
                <li>You confirm that all information in your profile is accurate and truthful</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">4.2 Your Responsibilities</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain accurate and up-to-date profile information</li>
                <li>Review and respond to any applications submitted on your behalf</li>
                <li>Inform us of any job offers or positions you want to exclude from automation</li>
                <li>Comply with all applicable employment laws and regulations</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">4.3 Safe Mode</h3>
              <p>
                We offer a "Safe Mode" feature that requires your approval before submitting any application. 
                We recommend enabling this feature if you want full control over each application.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Ban className="w-6 h-6 text-primary" />
              5. Prohibited Uses
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Impersonate another person or misrepresent your qualifications</li>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Circumvent rate limits or abuse the automated application system</li>
                <li>Scrape, harvest, or collect data from the platform for unauthorized purposes</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use the Service for any purpose other than personal job searching</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Intellectual Property</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <h3 className="text-xl font-medium text-foreground">6.1 Your Content</h3>
              <p>
                You retain all ownership rights to your resume, profile information, and other content you upload 
                ("User Content"). By uploading User Content, you grant us a limited license to use, process, and 
                display your content solely to provide the Service.
              </p>

              <h3 className="text-xl font-medium text-foreground">6.2 Our Content</h3>
              <p>
                The Service, including its design, features, AI models, and all related intellectual property, 
                is owned by hunter.ai Inc. You may not copy, modify, distribute, or reverse engineer any part 
                of the Service.
              </p>

              <h3 className="text-xl font-medium text-foreground">6.3 AI-Generated Content</h3>
              <p>
                Content generated by our AI (tailored resumes, cover letters, interview responses) is provided 
                for your personal use. You own the output and may use it freely for your job search.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              7. Subscription & Payments
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <h3 className="text-xl font-medium text-foreground">7.1 Pricing</h3>
              <p>
                Certain features require a paid subscription. Prices are displayed in USD and may change with 
                30 days' notice. Current subscribers are protected from price increases for the remainder of 
                their billing period.
              </p>

              <h3 className="text-xl font-medium text-foreground">7.2 Billing</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Subscriptions are billed monthly or annually, depending on your plan</li>
                <li>All payments are processed securely through Stripe</li>
                <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">7.3 Cancellation & Refunds</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You may cancel your subscription at any time through account settings</li>
                <li>Cancellation takes effect at the end of the current billing period</li>
                <li>Refunds are provided on a case-by-case basis for technical issues preventing service use</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">8. Disclaimers & Limitations</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <Card className="border-border bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-2">Service Provided "As Is"</h3>
                  <p className="text-sm">
                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A 
                    PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                  </p>
                </CardContent>
              </Card>

              <h3 className="text-xl font-medium text-foreground">8.1 No Guarantee of Employment</h3>
              <p>
                We do not guarantee any job offers, interviews, or employment outcomes. Success depends on 
                many factors beyond our control, including job market conditions, your qualifications, and 
                employer decisions.
              </p>

              <h3 className="text-xl font-medium text-foreground">8.2 Third-Party Job Listings</h3>
              <p>
                We aggregate job listings from third-party sources. We are not responsible for the accuracy, 
                availability, or legitimacy of job postings. Always verify opportunities directly with employers.
              </p>

              <h3 className="text-xl font-medium text-foreground">8.3 Limitation of Liability</h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, HUNTER AI SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, 
                DATA, OR OPPORTUNITIES ARISING FROM YOUR USE OF THE SERVICE.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless hunter.ai, its officers, directors, employees, and 
              agents from any claims, damages, losses, or expenses arising from your use of the Service, 
              your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Gavel className="w-6 h-6 text-primary" />
              10. Dispute Resolution
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <h3 className="text-xl font-medium text-foreground">10.1 Governing Law</h3>
              <p>
                These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.
              </p>

              <h3 className="text-xl font-medium text-foreground">10.2 Arbitration</h3>
              <p>
                Any disputes arising from these Terms or the Service shall be resolved through binding arbitration 
                in accordance with the American Arbitration Association's rules. You waive the right to participate 
                in class actions or class arbitrations.
              </p>

              <h3 className="text-xl font-medium text-foreground">10.3 Exceptions</h3>
              <p>
                Either party may seek injunctive relief in court for intellectual property disputes or unauthorized 
                access to the Service.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these Terms at any time. Material changes will be communicated via email or in-app 
              notification at least 30 days before taking effect. Continued use of the Service after changes 
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">12. Contact</h2>
            <div className="text-muted-foreground leading-relaxed">
              <p>For questions about these Terms:</p>
              <ul className="mt-4 space-y-2">
                <li><strong>Email:</strong> <a href="mailto:legal@usehunter.app" className="text-primary hover:underline">legal@usehunter.app</a></li>
                <li><strong>Support:</strong> <a href="mailto:support@usehunter.app" className="text-primary hover:underline">support@usehunter.app</a></li>
              </ul>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Terms;
