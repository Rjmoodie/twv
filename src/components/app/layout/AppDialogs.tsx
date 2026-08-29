import React from 'react';
import { useAuth } from '@/components/app/AuthProvider';
import { useOnboarding } from '@/components/app/hooks/useOnboarding';
import OnboardingWelcome from '@/components/app/OnboardingWelcome';

const AppDialogs: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    showOnboarding,
    setShowOnboarding,
    handleOnboardingComplete,
  } = useOnboarding();

  return (
    <>
      {/* Welcome modal — only shown when explicitly triggered (e.g. "What is TW Ventures?" link).
          New-user onboarding is handled by OnboardingChecklist on the dashboard. */}
      <OnboardingWelcome
        open={showOnboarding && !!user && !authLoading}
        onOpenChange={setShowOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </>
  );
};

export default AppDialogs;
