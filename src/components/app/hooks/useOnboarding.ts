import { useState, useEffect } from 'react';
import { useAuth } from '@/components/app/AuthProvider';

export const useOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      const completed = localStorage.getItem(`onboarding-completed-${user.id}`);
      setHasCompletedOnboarding(!!completed);
      // Onboarding progress is now surfaced via the OnboardingChecklist widget
      // on the dashboard — no modal auto-fires here. ProgressiveOnboarding
      // (the 3-step portfolio modal) was removed because it conflicted with
      // the journey system and duplicated what OnboardingChecklist shows.
    }
  }, [user, authLoading]);

  const handleOnboardingComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding-completed-${user.id}`, 'true');
      setHasCompletedOnboarding(true);
    }
    setShowOnboarding(false);
  };

  return {
    showOnboarding,
    setShowOnboarding,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    handleOnboardingComplete,
  };
};
