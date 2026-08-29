import React, { useEffect, useRef } from 'react';
import { modules } from '@/components/app/constants';

interface AppContentProps {
  activeModule: string;
  children: React.ReactNode;
}

const STATIC_TITLES: Record<string, string> = {
  'privacy-policy': 'Privacy Policy | TW Ventures',
  'terms-of-service': 'Terms of Service | TW Ventures',
};

/**
 * The content well, plus the two things a state-driven module switch does not
 * get for free the way a real route change would:
 *
 *  - the document title. Every module already declares an `seo.title` and
 *    nothing read it, so every tab, bookmark and history entry in the app was
 *    labelled with whatever index.html says.
 *  - an announcement and a focus move. Swapping the module leaves a screen
 *    reader on the nav link that was just activated with no indication that the
 *    page changed, and leaves keyboard focus behind in the sidebar.
 */
const AppContent: React.FC<AppContentProps> = ({
  activeModule,
  children
}) => {
  const regionRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const moduleMeta = modules.find((module) => module.id === activeModule);
  const moduleName = moduleMeta?.name ?? 'TW Ventures';

  useEffect(() => {
    document.title =
      STATIC_TITLES[activeModule] ?? moduleMeta?.seo?.title ?? 'TW Ventures';
  }, [activeModule, moduleMeta?.seo?.title]);

  useEffect(() => {
    // Never on load — that would yank focus away from wherever the browser put
    // it and skip the skip-link.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    regionRef.current?.focus();
  }, [activeModule]);

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      className="h-full w-full flex flex-col outline-none"
    >
      <span aria-live="polite" className="sr-only">
        {moduleName} loaded
      </span>
      {children}
    </div>
  );
};

export default AppContent;
