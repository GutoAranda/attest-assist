import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          navigate('/nova-solicitacao');
        }
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          const searchInput = document.querySelector('[data-global-search]') as HTMLInputElement;
          searchInput?.focus();
        }
      }
      if (e.key === 'Escape') {
        const dialogs = document.querySelectorAll('[data-state="open"]');
        // Let Radix handle Esc naturally
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
