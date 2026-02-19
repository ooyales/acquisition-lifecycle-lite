import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-800 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
