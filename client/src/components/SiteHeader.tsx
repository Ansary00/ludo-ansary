import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from './Logo.tsx';
import SettingsMenu from './SettingsMenu.tsx';

export default function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo />
        <nav className="site-header__nav" aria-label="Main">
          <Link to="/#how" className="site-header__link">
            How to play
          </Link>
          <Link to="/#features" className="site-header__link">
            Features
          </Link>
          {right}
          <Link to="/create" className="btn btn--primary btn--sm site-header__cta">
            Create room
          </Link>
          <SettingsMenu />
        </nav>
      </div>
    </header>
  );
}
