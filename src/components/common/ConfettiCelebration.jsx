import React from 'react';
import { motion } from 'framer-motion';

const ConfettiPiece = ({ x, y, rotate, color }) => {
  const variants = {
    initial: {
      opacity: 1,
      y: y,
      x: x,
      rotate: rotate,
      scale: 1,
    },
    animate: {
      opacity: 0,
      y: y + 200,
      x: x + (Math.random() - 0.5) * 200,
      rotate: rotate + (Math.random() - 0.5) * 360,
      scale: 0.5,
      transition: {
        duration: 2 + Math.random() * 2,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: '10px',
        height: '20px',
        backgroundColor: color,
        borderRadius: '5px',
      }}
    />
  );
};

const ConfettiCelebration = ({ isActive }) => {
  const colors = ['#FFD700', '#FFA500', '#FFFFFF', '#FFC40C', '#FFBF00'];
  const numPieces = 50;

  if (!isActive) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      {Array.from({ length: numPieces }).map((_, i) => (
        <ConfettiPiece
          key={i}
          x={(Math.random() - 0.5) * window.innerWidth}
          y={(Math.random() - 0.5) * 200}
          rotate={Math.random() * 360}
          color={colors[Math.floor(Math.random() * colors.length)]}
        />
      ))}
    </div>
  );
};

export default ConfettiCelebration;
