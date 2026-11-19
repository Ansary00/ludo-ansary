import { useEffect, useRef, useState } from 'react';

import { useSettings } from '../lib/settings.tsx';
import { IconMusic, IconSettings, IconSparkle, IconVolume } from './Icons.tsx';
import Toggle from './Toggle.tsx';

function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span className="setting-row__icon">{icon}</span>
      <span className="setting-row__text">
        <span className="setting-row__title">{title}</span>
        <span className="setting-row__desc">{description}</span>
      </span>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export default function SettingsMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { settings, setSound, setMusic, setAnimations } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        type="button"
        className={`icon-btn ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Settings"
      >
        <IconSettings />
      </button>
      {open && (
        <div className={`settings__panel settings__panel--${align}`} role="dialog" aria-label="Game settings">
          <p className="settings__title">Settings</p>
          <SettingRow
            icon={<IconVolume muted={!settings.sound} />}
            title="Sound effects"
            description="Dice, moves and captures"
            checked={settings.sound}
            onChange={setSound}
          />
          <SettingRow
            icon={<IconMusic />}
            title="Background music"
            description="Gentle ambient loop"
            checked={settings.music && settings.sound}
            onChange={setMusic}
          />
          <SettingRow
            icon={<IconSparkle />}
            title="Animations"
            description="Motion effects and confetti"
            checked={settings.animations}
            onChange={setAnimations}
          />
          <p className="settings__note">Zero-cost, ad-free and open source.</p>
        </div>
      )}
    </div>
  );
}
