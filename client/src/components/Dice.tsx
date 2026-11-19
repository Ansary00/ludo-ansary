import { useEffect, useState } from 'react';

const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function Dice({
  value,
  rolling,
  canRoll,
  onRoll,
  hint,
  disabled,
}: {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  hint: string;
  disabled?: boolean;
}) {
  const [flicker, setFlicker] = useState(1);

  useEffect(() => {
    if (!rolling) return;
    const interval = window.setInterval(() => {
      setFlicker(1 + Math.floor(Math.random() * 6));
    }, 80);
    return () => window.clearInterval(interval);
  }, [rolling]);

  const face = rolling ? flicker : value;
  const pips = face ? PIP_LAYOUT[face] ?? [] : [];

  return (
    <div className={`dice-panel ${canRoll ? 'dice-panel--active' : ''}`}>
      <button
        type="button"
        className={`dice ${rolling ? 'dice--rolling' : ''} ${canRoll ? 'dice--ready' : ''} ${
          face ? '' : 'dice--empty'
        }`}
        onClick={onRoll}
        disabled={!canRoll || disabled}
        aria-label={canRoll ? 'Roll the dice' : 'Dice'}
      >
        <span className="dice__face">
          {face === null ? (
            <span className="dice__placeholder">?</span>
          ) : (
            <span className="dice__grid" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} className={pips.includes(index) ? 'dice__pip dice__pip--on' : 'dice__pip'} />
              ))}
            </span>
          )}
        </span>
        <span className="dice__shine" aria-hidden="true" />
      </button>
      <p className="dice-panel__hint">{hint}</p>
    </div>
  );
}
