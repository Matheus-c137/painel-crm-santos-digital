import React from 'react';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(10,10,12,0.5)] z-40 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="bg-surface border border-line rounded-[18px] w-full max-w-[580px] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] my-8"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded-lg"
            aria-label="Fechar modal"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {subtitle && <p className="text-muted text-xs mb-5">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
};
