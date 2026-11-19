import { useEffect, type ReactNode } from 'react';

import { IconClose } from './Icons.tsx';

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  tone = 'neutral',
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal__card ${tone === 'danger' ? 'modal__card--danger' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <IconClose />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
