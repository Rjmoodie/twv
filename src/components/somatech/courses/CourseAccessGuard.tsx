import React from 'react';
import { FeatureGuard } from '../FeatureGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface CourseAccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  adminOverride?: boolean;
}

const defaultFallback = (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base font-semibold">
        <Crown className="h-4 w-4 text-muted-foreground" />
        Course Access
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        Upgrade your plan to access the full course library.
      </p>
    </CardHeader>
    <CardContent className="space-y-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Included</Badge>
        Structured video curriculum on financial analysis
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Included</Badge>
        Progress tracking and completion certificates
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Included</Badge>
        Downloadable course materials and references
      </div>
    </CardContent>
  </Card>
);

export const CourseAccessGuard: React.FC<CourseAccessGuardProps> = ({
  children,
  fallback = defaultFallback,
  adminOverride = true
}) => {
  return (
    <FeatureGuard
      feature="courseAccess"
      requiredTier="tier3"
      fallback={fallback}
      adminOverride={adminOverride}
    >
      {children}
    </FeatureGuard>
  );
};
