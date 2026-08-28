import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Lock, Eye, FileText } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            Privacy Policy
          </CardTitle>
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
            At SomaTech ("we," "us," or "our"), we are committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your personal information when you use our website (<a href="https://www.somatech.pro" className="text-blue-600 hover:text-blue-800">https://www.somatech.pro</a>), apps, and services (collectively, the "Services").
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            By accessing or using our Services, you agree to this Privacy Policy.
          </p>
        </CardContent>
      </Card>

      {/* Information We Collect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            1. Information We Collect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">a. Information You Provide</h3>
            <p className="text-muted-foreground mb-3">We collect personal information when you:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Create an account</li>
              <li>Fill out forms (e.g., valuation tools, funding campaigns)</li>
              <li>Make purchases or subscribe to services</li>
              <li>Contact our support team</li>
              <li>Post content or share feedback</li>
            </ul>
            <p className="text-muted-foreground mt-3 mb-2">This may include:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Business name and details</li>
              <li>Financial data (entered for calculators or valuation tools)</li>
              <li>Uploaded documents</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">b. Automatically Collected Data</h3>
            <p className="text-muted-foreground mb-3">When you use our Services, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Device type and browser</li>
              <li>IP address and location</li>
              <li>Referring URLs and site activity</li>
              <li>Cookies and analytics identifiers</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">c. Third-Party Data</h3>
            <p className="text-muted-foreground">
              We may receive data from APIs or services (e.g., financial data providers, Google Maps, Stripe) to enhance your experience.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How We Use Information */}
      <Card>
        <CardHeader>
          <CardTitle>2. How We Use Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">We use your information to:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Provide, personalize, and improve the Services</li>
            <li>Enable financial calculations, dashboards, and tools</li>
            <li>Process payments and subscriptions</li>
            <li>Communicate with you (updates, support, promotions)</li>
            <li>Ensure platform security and compliance</li>
            <li>Analyze trends and performance (using anonymized data)</li>
          </ul>
          <p className="text-muted-foreground mt-4 font-medium">We do not sell your personal information.</p>
        </CardContent>
      </Card>

      {/* Information Sharing */}
      <Card>
        <CardHeader>
          <CardTitle>3. Sharing of Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">We may share your data with:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Trusted third-party service providers (hosting, payments, analytics, email tools)</li>
            <li>Legal authorities, when required by law</li>
            <li>Other users, only if you choose to make your funding campaign or profile public</li>
          </ul>
        </CardContent>
      </Card>

      {/* Cookies and Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>4. Cookies & Tracking Technologies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">We use cookies and similar technologies to:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Keep you logged in</li>
            <li>Understand user behavior</li>
            <li>Measure traffic and improve usability</li>
          </ul>
          <p className="text-muted-foreground">
            You may disable cookies in your browser settings, but some features may not work properly.
          </p>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle>5. Data Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We retain your personal data as long as your account is active or as needed to provide Services. You can request account deletion by contacting <a href="mailto:support@somatech.pro" className="text-blue-600 hover:text-blue-800">support@somatech.pro</a>.
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            6. Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We implement industry-standard security protocols (e.g., HTTPS, encryption, secure cloud storage). However, no method is 100% secure. Use caution and safeguard your login credentials.
          </p>
        </CardContent>
      </Card>

      {/* Your Rights */}
      <Card>
        <CardHeader>
          <CardTitle>7. Your Rights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Depending on your location, you may have the right to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Access the data we hold about you</li>
            <li>Request correction or deletion</li>
            <li>Object to or restrict certain uses</li>
            <li>Withdraw consent</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Contact us at <a href="mailto:privacy@somatech.pro" className="text-blue-600 hover:text-blue-800">privacy@somatech.pro</a> for requests.
          </p>
        </CardContent>
      </Card>

      {/* Children's Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>8. Children's Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            SomaTech is not intended for users under the age of 18. We do not knowingly collect data from children.
          </p>
        </CardContent>
      </Card>

      {/* Third-Party Links */}
      <Card>
        <CardHeader>
          <CardTitle>9. Third-Party Links</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Our platform may link to third-party websites. We are not responsible for their privacy practices or content.
          </p>
        </CardContent>
      </Card>

      {/* Updates to Policy */}
      <Card>
        <CardHeader>
          <CardTitle>10. Policy Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We may revise this Privacy Policy from time to time. If significant changes are made, we will notify you via email or prominent site notice.
          </p>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Us</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <div className="space-y-2 text-muted-foreground">
            <p><strong>Email:</strong> <a href="mailto:privacy@somatech.pro" className="text-blue-600 hover:text-blue-800">privacy@somatech.pro</a></p>
            <p><strong>Website:</strong> <a href="https://somatech.pro" className="text-blue-600 hover:text-blue-800">somatech.pro</a></p>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <div className="text-center text-sm text-muted-foreground">
        <p>This privacy policy is designed to be compliant with GDPR, CCPA, and other major privacy regulations.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;