import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Scale, Shield, Users, CreditCard, AlertTriangle, Globe, Lock } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <Scale className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
          <p className="text-muted-foreground mt-2">
            Effective Date: July 1, 2025<br />
            Last Updated: July 14, 2025
          </p>
        </CardHeader>
      </Card>

      {/* Introduction */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground leading-relaxed">
            Welcome to SomaTech ("Company", "we", "our", "us"). These Terms of Service ("Terms") govern your access to and use of our website (<a href="https://www.somatech.pro" className="text-blue-600 hover:text-blue-800">https://www.somatech.pro</a>), tools, calculators, content, dashboards, and services (collectively, the "Services").
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            By using SomaTech, you agree to these Terms. If you do not agree, please do not use the Services.
          </p>
        </CardContent>
      </Card>

      {/* Eligibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            1. Eligibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You must be at least 18 years old and legally capable of entering into a binding agreement to use SomaTech. If you're using the Services on behalf of an entity, you represent that you have the authority to bind that entity.
          </p>
        </CardContent>
      </Card>

      {/* Use of Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            2. Use of Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            SomaTech provides tools and features for:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Business valuation and financial modeling</li>
            <li>Real estate investment analysis (e.g., BRRRR model)</li>
            <li>Stock analysis and company financial metrics</li>
            <li>Personal finance tools (e.g., retirement planning, cash flow simulation)</li>
            <li>User-generated funding pages and small business listings</li>
          </ul>
          <p className="text-muted-foreground">
            You agree to use the Services only for lawful purposes and in compliance with these Terms. Misuse, unauthorized access, or exploitation of the Services is strictly prohibited.
          </p>
        </CardContent>
      </Card>

      {/* User Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            3. User Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To access certain features, you may be required to create an account. You are responsible for maintaining the security of your credentials and all activity under your account.
          </p>
          <p className="text-muted-foreground">
            By registering, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Provide accurate and complete information</li>
            <li>Not share your account access or password</li>
            <li>Notify us immediately of any unauthorized access</li>
          </ul>
        </CardContent>
      </Card>

      {/* Payments and Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            4. Payments and Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Some features may require payment, including:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Access to premium calculators and reports</li>
            <li>Business or real estate valuation services</li>
            <li>Downloadable templates or educational materials</li>
          </ul>
          <p className="text-muted-foreground">
            All fees will be clearly presented at checkout. If you choose a subscription plan, it may auto-renew unless canceled before the renewal date. Payments are securely processed via third-party services (e.g., Stripe).
          </p>
        </CardContent>
      </Card>

      {/* User-Generated Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            5. User-Generated Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You may post content such as funding campaigns, business profiles, or feedback. By doing so, you grant SomaTech a worldwide, royalty-free, non-exclusive license to display and use your content in connection with the Services.
          </p>
          <p className="text-muted-foreground">
            You must not post:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Misleading, fraudulent, or deceptive content</li>
            <li>Content violating any third-party rights or applicable laws</li>
            <li>Private or sensitive data without consent</li>
          </ul>
        </CardContent>
      </Card>

      {/* Disclaimers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            6. Disclaimers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            SomaTech provides informational and educational tools only. We are not a licensed financial advisor, tax consultant, or investment broker.
          </p>
          <p className="text-muted-foreground font-medium">
            Nothing on the platform constitutes financial, legal, tax, or investment advice. Always consult with licensed professionals before making decisions based on our content or tools.
          </p>
        </CardContent>
      </Card>

      {/* Third-Party Services */}
      <Card>
        <CardHeader>
          <CardTitle>7. Third-Party Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Some tools may rely on third-party APIs or data sources. We are not responsible for the accuracy or reliability of third-party data or services.
          </p>
          <p className="text-muted-foreground">
            Any interactions between users and third parties are conducted at your own risk.
          </p>
        </CardContent>
      </Card>

      {/* Intellectual Property */}
      <Card>
        <CardHeader>
          <CardTitle>8. Intellectual Property</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            All SomaTech content, designs, software, tools, and branding are protected by intellectual property laws. You may not copy, distribute, modify, or create derivative works without express written consent.
          </p>
        </CardContent>
      </Card>

      {/* Termination */}
      <Card>
        <CardHeader>
          <CardTitle>9. Termination</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We reserve the right to suspend or terminate your access to SomaTech for any reason, including violation of these Terms, without notice or liability.
          </p>
        </CardContent>
      </Card>

      {/* Limitation of Liability */}
      <Card>
        <CardHeader>
          <CardTitle>10. Limitation of Liability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            To the maximum extent permitted by law, SomaTech shall not be liable for indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, business interruption, or financial losses arising out of your use of the Services.
          </p>
        </CardContent>
      </Card>

      {/* Privacy Policy */}
      <Card>
        <CardHeader>
          <CardTitle>11. Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please refer to our Privacy Policy for information on how we collect, use, and protect your personal data.
          </p>
        </CardContent>
      </Card>

      {/* Modifications */}
      <Card>
        <CardHeader>
          <CardTitle>12. Modifications to Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We may update these Terms from time to time. Updates will be posted with a revised "Last Updated" date. Continued use of the Services after updates indicates your acceptance of the new Terms.
          </p>
        </CardContent>
      </Card>

      {/* User Conduct Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SomaTech User Conduct Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            To protect the integrity of our platform and foster a professional, inclusive environment, all users must agree to the following:
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Be Honest and Transparent</h4>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Provide accurate business, financial, and personal information</li>
                <li>Do not impersonate another person or business</li>
                <li>Disclose affiliations and avoid misrepresentation</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Use Respectfully</h4>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Do not post content that is discriminatory, offensive, or fraudulent</li>
                <li>Do not engage in harassment, hate speech, or abuse toward others</li>
                <li>Respect others' intellectual property and privacy</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Use the Platform Lawfully</h4>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Do not use SomaTech for money laundering, fraud, or illegal activity</li>
                <li>Do not attempt to bypass payment or reporting features</li>
                <li>Do not upload viruses, malicious scripts, or spam content</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">4. Respect Funding Campaign Rules</h4>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>All campaigns must be honest, legal, and for real purposes</li>
                <li>You are solely responsible for how funds are used</li>
                <li>Misuse of funds may result in account suspension or legal action</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">5. No Unauthorized Commercial Use</h4>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Do not scrape, sell, or reproduce SomaTech data without permission</li>
                <li>Do not resell access to our tools or reports unless authorized</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">6. Reporting Violations</h4>
              <p className="text-muted-foreground">
                If you encounter violations of these guidelines, please report them to our support team immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refund Policy */}
      <Card>
        <CardHeader>
          <CardTitle>SomaTech Refund Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">1. Digital Products and Subscriptions</h4>
            <p className="text-muted-foreground mb-4">
              Due to the digital and personalized nature of our services (e.g., business valuation reports, calculators, dashboards, financial insights), all purchases are generally non-refundable once delivered or accessed.
            </p>
            <p className="text-muted-foreground mb-2">
              However, we may issue a refund under the following conditions:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>You were charged in error (e.g., duplicate charge)</li>
              <li>You experience technical failure that prevents access despite our support attempts</li>
              <li>You cancel a subscription within 3 days of purchase and have not used premium features</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Cancellation Policy</h4>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>You may cancel a subscription at any time. Access will continue until the end of the current billing period.</li>
              <li>No partial-month refunds will be issued after cancellation.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Special Exceptions</h4>
            <p className="text-muted-foreground">
              Refund requests related to billing errors, fraud, or customer dissatisfaction are handled on a case-by-case basis. Email us at <a href="mailto:support@somatech.pro" className="text-blue-600 hover:text-blue-800">support@somatech.pro</a> within 7 days of your charge.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Fundraising/Donations</h4>
            <p className="text-muted-foreground">
              Funds donated to user-created campaigns are non-refundable, unless the campaign violates our terms of service. SomaTech does not mediate fund disbursement disputes between users.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Us</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <div className="space-y-2 text-muted-foreground">
            <p><strong>Email:</strong> <a href="mailto:support@somatech.pro" className="text-blue-600 hover:text-blue-800">support@somatech.pro</a></p>
            <p><strong>Website:</strong> <a href="https://somatech.pro" className="text-blue-600 hover:text-blue-800">somatech.pro</a></p>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <div className="text-center text-sm text-muted-foreground">
        <p>These terms are designed to protect both users and SomaTech while ensuring a professional, secure environment for financial intelligence tools.</p>
      </div>
    </div>
  );
};

export default TermsOfService;