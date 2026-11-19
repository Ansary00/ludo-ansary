import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';
import { SettingsProvider } from './lib/settings.tsx';
import { ToastProvider } from './lib/toast.tsx';

import './styles/theme.css';
import './styles/base.css';
import './styles/board.css';
import './styles/pages.css';
import './styles/lobby.css';
import './styles/game.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
