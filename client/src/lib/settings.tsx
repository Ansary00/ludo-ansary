import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { audio } from './audio.ts';
import { loadSettings, saveSettings, type Settings } from './storage.ts';

interface SettingsContextValue {
  settings: Settings;
  setSound: (enabled: boolean) => void;
  setMusic: (enabled: boolean) => void;
  setAnimations: (enabled: boolean) => void;
  rememberName: (name: string) => void;
  play: (effect: Parameters<typeof audio.play>[0]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      audio.setEnabled(settings.sound);
      audio.setMusicEnabled(settings.music && settings.sound);
    }
    audio.setEnabled(settings.sound);
    if (!settings.sound) audio.setMusicEnabled(false);
    else audio.setMusicEnabled(settings.music);
    saveSettings(settings);
    document.documentElement.dataset.animations = settings.animations ? 'on' : 'off';
  }, [settings]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const onVisibility = () => {
      if (document.hidden) audio.stopMusic();
      else if (settings.music && settings.sound) audio.startMusic();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [settings.music, settings.sound]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setSound: (enabled) => update({ sound: enabled }),
      setMusic: (enabled) => update({ music: enabled }),
      setAnimations: (enabled) => update({ animations: enabled }),
      rememberName: (name) => update({ name: name.slice(0, 16) }),
      play: (effect) => audio.play(effect),
    }),
    [settings, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
