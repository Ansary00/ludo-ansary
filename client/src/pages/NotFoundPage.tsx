import { Link } from 'react-router-dom';

import { Logo } from '../components/Logo.tsx';

export default function NotFoundPage() {
  return (
    <div className="page page--form">
      <header className="site-header site-header--simple">
        <div className="site-header__inner">
          <Logo />
        </div>
      </header>
      <main className="form-wrap form-wrap--narrow">
        <div className="card form-card form-card--centered">
          <p className="eyebrow">404</p>
          <h1>That page rolled off the board</h1>
          <p className="form-card__lede">The link may be mistyped or the room may have closed.</p>
          <div className="button-row button-row--center">
            <Link to="/" className="btn btn--primary">
              Back to home
            </Link>
            <Link to="/create" className="btn btn--ghost">
              Create a room
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
