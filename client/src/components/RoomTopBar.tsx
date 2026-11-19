import { useState } from 'react';

import { copyText } from '../lib/share.ts';
import { useToast } from '../lib/toast.tsx';
import { IconCheck, IconCopy, IconLogout, IconWifi } from './Icons.tsx';
import { Logo } from './Logo.tsx';
import SettingsMenu from './SettingsMenu.tsx';

export default function RoomTopBar({
  code,
  connected,
  onExit,
  exitLabel = 'Leave',
}: {
  code: string;
  connected: boolean;
  onExit: () => void;
  exitLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  const copyCode = async () => {
    const success = await copyText(code);
    if (success) {
      setCopied(true);
      push('Room code copied.', 'success');
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <header className="room-bar">
      <div className="room-bar__left">
        <Logo compact />
        <button type="button" className="room-code" onClick={copyCode} title="Copy room code">
          <span className="room-code__label">Room</span>
          <span className="room-code__value">{code}</span>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      </div>
      <div className="room-bar__right">
        <span className={`conn ${connected ? 'conn--live' : 'conn--off'}`}>
          <IconWifi size={14} offline={!connected} />
          <span className="conn__text">{connected ? 'Live' : 'Reconnecting'}</span>
        </span>
        <SettingsMenu />
        <button type="button" className="icon-btn" onClick={onExit} title={exitLabel} aria-label={exitLabel}>
          <IconLogout />
        </button>
      </div>
    </header>
  );
}
