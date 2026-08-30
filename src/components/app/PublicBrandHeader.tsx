import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

interface PublicBrandHeaderProps {
  section?: string;
  actions?: ReactNode;
}

export default function PublicBrandHeader({ section, actions }: PublicBrandHeaderProps) {
  const navigate = useNavigate();
  return <header className="brand-header">
    <div className="brand-header__inner">
      <button onClick={() => navigate('/')} className="brand-lockup" aria-label="TW Ventures home">
        <Logo width={74} height={58} />
        <span className="brand-lockup__copy">
          <span className="brand-lockup__name">TW Ventures</span>
          <span className="brand-lockup__rule" />
          <span className="brand-lockup__section">{section || 'Acquire · Build · Manage'}</span>
        </span>
      </button>
      <nav className="brand-header__actions" aria-label="Public navigation">{actions}</nav>
    </div>
  </header>;
}
