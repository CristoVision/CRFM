import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, PartyPopper } from 'lucide-react';

const ConfettiPiece = ({ x, y, rotate, opacity }) => (
  <motion.div
    style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: '8px',
      height: '16px',
      backgroundColor: `hsl(${Math.random() * 60 + 40}, 100%, 70%)`, 
      rotate: `${rotate}deg`,
    }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: [0, opacity, opacity, 0], scale: 1, y: [y, y + 100, y + 250] }}
    transition={{ duration: Math.random() * 2 + 2, ease: "easeOut" }}
  />
);

const FileUploadProgress = ({ file, progress, onCancel, uploadComplete }) => {
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    if (uploadComplete) {
      const newPieces = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 20 - 40, 
        rotate: Math.random() * 360,
        opacity: Math.random() * 0.5 + 0.5,
      }));
      setConfettiPieces(newPieces);
      const timer = setTimeout(() => setConfettiPieces([]), 4000); 
      return () => clearTimeout(timer);
    }
  }, [uploadComplete]);

  if (!file) return null;

  return (
    <div className="mt-2 p-3 glass-effect rounded-md relative overflow-hidden">
      <AnimatePresence>
        {confettiPieces.map(p => <ConfettiPiece key={p.id} {...p} />)}
      </AnimatePresence>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-gray-300 max-w-[70%]">{typeof file === 'string' ? file : file.name}</span>
        <div className="flex items-center">
          <span className="text-yellow-400 mr-2">{progress}%</span>
          {progress < 100 && onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="p-1 h-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </Button>
          )}
           {uploadComplete && <PartyPopper className="w-5 h-5 text-yellow-400 animate-bounce" />}
        </div>
      </div>
      <div className="mt-1 h-2 w-full bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </div>
    </div>
  );
};

export default FileUploadProgress;
