import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

const Privacy = () => {
  const lastUpdated = "March 9, 2026";
  const effectiveDate = "March 9, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <SEOHead 
        title="Privacy Policy" 
        description="How Hunter AI collects, uses, and protects your personal data. GDPR and CCPA compliant." 
        path="/privacy" 
      />
      <div className="container max-w-4xl mx-auto px-6 py-16">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-8 hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Last updated: {lastUpdated}</span>
            <span>•</span>
            <span>Effective: {effectiveDate}</span>
          </div>
        </div>

        {/* Quick Summary Card */}
        <Card className="mb-12 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Privacy at a Glance
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ We never sell your personal data to third parties</li>
              <li>✓ All data is encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
              <li>✓ You can export or delete your data at any time</li>
              <li>✓ GDPR and CCPA compliant</li>
              <li>✓ SOC 2 Type II security practices</li>
            </ul>
          </CardContent>
        </Card>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" />
              1. Information We Collect
            </h2>
            
            <h3 className="text-xl font-medium">1.1 Information You Provide</h3>
            <ul className="text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
              <li><strong>Resume Data:</strong> Work history, education, skills, and contact information from uploaded resumes</li>
              <li><strong>Job Preferences:</strong> Target roles, salary expectations, location preferences, and remote work settings</li>
              <li><strong>Communication Data:</strong> Messages, feedback, and support requests you send us</li>
            </ul>

            <h3 className="text-xl font-medium">1.2 Information Collected Automatically</h3>
            <ul className="text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Features used, time spent, and interaction patterns (anonymized)</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
            </ul>

            <h3 className="text-xl font-medium">1.3 Information We Do Not Collect</h3>
            <ul className="text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
              <li>Social Security numbers or government-issued ID numbers</li>
              <li>Financial account information (bank accounts, credit cards)</li>
              <li>Protected health information (PHI)</li>
              <li>Biometric data</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              2. How We Use Your Information
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>We use your information exclusively to provide, maintain, and improve our job search automation services:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Job Matching:</strong> Analyze your resume and preferences to identify relevant opportunities</li>
                <li><strong>Application Automation:</strong> Submit tailored applications on your behalf with your explicit consent</li>
                <li><strong>Resume Optimization:</strong> Generate customized resumes and cover letters for specific positions</li>
                <li><strong>Interview Preparation:</strong> Provide AI-powered coaching based on target roles</li>
                <li><strong>Service Improvement:</strong> Analyze aggregate, anonymized usage patterns to enhance features</li>
                <li><strong>Communication:</strong> Send job alerts, application updates, and service notifications</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary" />
              3. Data Security & Retention
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <h3 className="text-xl font-medium text-foreground">3.1 Security Measures</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>All data encrypted in transit using TLS 1.3</li>
                <li>Data at rest encrypted using AES-256</li>
                <li>Row-level security (RLS) ensures data isolation between users</li>
                <li>Regular security audits and penetration testing</li>
                <li>Multi-factor authentication available for all accounts</li>
                <li>SOC 2 Type II compliant infrastructure</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">3.2 Data Retention</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
                <li><strong>Inactive Accounts:</strong> Data retained for 24 months after last login</li>
                <li><strong>Deleted Accounts:</strong> All personal data purged within 30 days of deletion request</li>
                <li><strong>Anonymized Analytics:</strong> May be retained indefinitely for service improvement</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              4. Data Sharing & Third Parties
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p><strong>We never sell your personal data.</strong> We may share information only in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Job Applications:</strong> When you authorize us to apply on your behalf, we share relevant resume data with employers</li>
                <li><strong>Service Providers:</strong> Trusted partners who help operate our service (hosting, analytics) under strict confidentiality agreements</li>
                <li><strong>Legal Requirements:</strong> When required by law, subpoena, or to protect our legal rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with prior notice to users)</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground">4.1 Third-Party Services</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Supabase:</strong> Database and authentication (US-based, SOC 2 compliant)</li>
                <li><strong>Google AI:</strong> Resume parsing and content generation (data processed per Google's AI data usage policies)</li>
                <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Your Rights (GDPR & CCPA)</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>Depending on your location, you have the following rights regarding your personal data:</p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-border">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">GDPR Rights (EU/EEA)</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Right to access your data</li>
                      <li>• Right to rectification</li>
                      <li>• Right to erasure ("right to be forgotten")</li>
                      <li>• Right to data portability</li>
                      <li>• Right to restrict processing</li>
                      <li>• Right to object to processing</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">CCPA Rights (California)</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Right to know what data is collected</li>
                      <li>• Right to delete personal information</li>
                      <li>• Right to opt-out of data sales (we don't sell data)</li>
                      <li>• Right to non-discrimination</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <p>
                To exercise any of these rights, visit your <Link to="/settings" className="text-primary hover:underline">Account Settings</Link> or 
                contact us at <a href="mailto:privacy@usehunter.app" className="text-primary hover:underline">privacy@usehunter.app</a>.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Cookies & Tracking</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>We use minimal cookies necessary for the service to function:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Essential Cookies:</strong> Authentication tokens and session management (required)</li>
                <li><strong>Preference Cookies:</strong> Theme settings and UI preferences (optional)</li>
              </ul>
              <p>We do not use advertising cookies or cross-site tracking technologies.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">7. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hunter AI is not intended for users under 16 years of age. We do not knowingly collect personal 
              information from children. If you believe we have collected data from a minor, please contact us 
              immediately and we will delete the information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">8. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data may be transferred to and processed in the United States. We ensure appropriate safeguards 
              are in place through Standard Contractual Clauses (SCCs) and compliance with applicable data protection 
              frameworks.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes via email 
              or in-app notification at least 30 days before they take effect. Continued use of the service after 
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              10. Contact Us
            </h2>
            <div className="text-muted-foreground leading-relaxed">
              <p>For privacy-related inquiries or to exercise your data rights:</p>
              <ul className="mt-4 space-y-2">
                <li><strong>Email:</strong> <a href="mailto:privacy@usehunter.app" className="text-primary hover:underline">privacy@usehunter.app</a></li>
                <li><strong>Data Protection Officer:</strong> <a href="mailto:dpo@usehunter.app" className="text-primary hover:underline">dpo@usehunter.app</a></li>
                <li><strong>Response Time:</strong> We respond to all requests within 30 days</li>
              </ul>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Privacy;
