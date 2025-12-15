import React from 'react';
    import {
      Dialog,
      DialogContent,
      DialogDescription,
      DialogHeader,
      DialogTitle,
      DialogFooter,
      DialogClose
    } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Construction } from 'lucide-react';

    function PlaceholderModal({ isOpen, onOpenChange, title, description, featureName }) {
      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[480px] glass-effect-light text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Construction className="w-6 h-6 mr-3 text-yellow-400" />
                {title || `${featureName || 'Feature'} Under Construction`}
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                {description || `The "${featureName || 'selected'}" functionality is currently in development. We're working hard to bring it to you soon!`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6 text-center">
              <Construction className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
              <p className="text-lg text-gray-300">
                Stay tuned for updates!
              </p>
            </div>

            <DialogFooter className="sm:justify-center">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Got it!
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    export default PlaceholderModal;
