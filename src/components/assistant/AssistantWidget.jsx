import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';

export default function AssistantWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);

  /**
   * IMPORTANTE:
   * - Siempre dejamos espacio para el FloatingPlayer
   * - Aunque el offset no esté seteado aún
   * - 96px ≈ botón + panel del player
   */
  const bottomOffset =
    'calc(env(safe-area-inset-bottom) + 1rem + max(var(--crfm-player-offset, 0px), 96px))';

  // Reset cuando el usuario cambia
  useEffect(() => {
    setIsOpen(false);
  }, [user?.id]);

  if (!user) return null;

  return (
    <div
      className="fixed right-4 z-[70]"
      style={{ bottom: bottomOffset }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="assistant-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[min(360px,calc(100vw-2rem))] h-[min(520px,calc(100vh-8rem))] bg-black/85 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden"
            role="dialog"
            aria-label="CRFM Assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">
                {t('assistant.title', 'Assistant')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4 text-white/70" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 text-sm text-white/80">
              {t(
                'assistant.placeholder',
                'El asistente estará disponible aquí.'
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen((v) => !v)}
        className="mt-3 w-14 h-14 rounded-full golden-gradient shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label={t('assistant.open', 'Open assistant')}
      >
        <MessageSquare className="w-6 h-6 text-black" />
      </Button>
    </div>
  );
}
