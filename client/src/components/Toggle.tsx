import { useEffect, useState } from 'react';

export default function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" />
    </button>
  );
}

/** Seconds remaining until an epoch timestamp (0 when inactive). */
export function useCountdown(target: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [target]);

  if (target === null) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}
