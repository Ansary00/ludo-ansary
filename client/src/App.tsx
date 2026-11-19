import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import HomePage from './pages/HomePage.tsx';
import CreatePage from './pages/CreatePage.tsx';
import JoinPage from './pages/JoinPage.tsx';
import RoomPage from './pages/RoomPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';

/** Reset the window scroll on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/room" element={<Navigate to="/join" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
