import { useState } from 'react';

import { copyText, inviteUrl, shareInvite } from '../lib/share.ts';
import { useToast } from '../lib/toast.tsx';
import { IconCheck, IconCopy, IconShare } from './Icons.tsx';

export default function ShareRow({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();
  const url = inviteUrl(code);

  const handleCopy = async () => {
    const success = await copyText(url);
    if (success) {
      setCopied(true);
      push('Invitation link copied.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      push('Could not copy — long-press the link to copy it manually.', 'warn');
    }
  };

  const handleShare = async () => {
    const outcome = await shareInvite(code, url);
    if (outcome === 'shared') push('Invitation shared.', 'success');
    else if (outcome === 'copied') {
      setCopied(true);
      push('Link copied to your clipboard.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } else if (outcome === 'failed') push('Sharing is unavailable — copy the link instead.', 'warn');
  };

  return (
    <div className={`share ${compact ? 'share--compact' : ''}`}>
      <div className="share__link" title={url}>
        <IconShare size={15} />
        <span className="share__url">{url.replace(/^https?:\/\//, '')}</span>
      </div>
      <div className="share__actions">
        <button type="button" className="btn btn--soft btn--sm" onClick={handleCopy}>
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={handleShare}>
          <IconShare size={15} />
          Share
        </button>
      </div>
    </div>
  );
}
