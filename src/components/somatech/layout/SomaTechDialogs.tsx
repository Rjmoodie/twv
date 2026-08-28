import React from 'react';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useOnboarding } from '@/components/somatech/hooks/useOnboarding';
import OnboardingWelcome from '@/components/somatech/OnboardingWelcome';

const SomaTechDialogs: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    showOnboarding,
    setShowOnboarding,
    handleOnboardingComplete,
  } = useOnboarding();

  return (
    <>
      {/* Welcome modal — only shown when explicitly triggered (e.g. "What is SomaTech?" link).
          New-user onboarding is handled by OnboardingChecklist on the dashboard. */}
      <OnboardingWelcome
        open={showOnboarding && !!user && !authLoading}
        onOpenChange={setShowOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </>
  );
};

export default SomaTechDialogs;
