export function inviteUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'failed' | 'cancelled';

export async function shareInvite(code: string, gameUrl = inviteUrl(code)): Promise<ShareOutcome> {
  const shareData: ShareData = {
    title: 'Join my Ludo ANSARY game',
    text: `Join my private Ludo room ${code} — tap the link to play.`,
    url: gameUrl,
  };
  if (typeof navigator.share === 'function' && navigator.canShare?.(shareData) !== false) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(gameUrl)) ? 'copied' : 'failed';
}
