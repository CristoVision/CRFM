import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeftToLine, Zap } from 'lucide-react';

function MobileSyncControls({ onSync, onBack }) {
  return (
    <div className="md:hidden flex flex-col sm:flex-row gap-2 mt-2">
      <Button 
        onClick={onBack}
        variant="outline" 
        className="flex-1 py-3 text-base bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-yellow-300"
      >
        <ArrowLeftToLine className="w-5 h-5 mr-2" /> Back Line
      </Button>
      <Button 
        onClick={() => onSync()}
        className="flex-1 py-3 text-base golden-gradient text-black font-semibold"
      >
        <Zap className="w-5 h-5 mr-2" /> Sync Line
      </Button>
    </div>
  );
}

export default MobileSyncControls;
