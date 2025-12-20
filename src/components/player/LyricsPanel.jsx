import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Undo, Redo, PlusCircle, Trash2, CheckCircle, Info } from 'lucide-react';
import { formatTime, parseLrcTextToLines } from '../lrcEditorUtils.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from '@/contexts/LanguageContext';


    const ClockIcon = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    );

    const LyricsPanel = React.forwardRef(({
      lyrics, currentLineIndex, setCurrentLineIndex, handleLyricTextChange,
      syncLine, addLyricLine, removeLyricLine, autoAdvance, setAutoAdvance,
      handleUndo, handleRedo, historyIndex, historyLength,
      setLyrics, pushToHistory, backLine
    }, ref) => {
      const activeLineRef = useRef(null);
      const containerRef = useRef(null);
      const { t } = useLanguage();


      useEffect(() => {
        if (activeLineRef.current) {
          activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, [currentLineIndex]);
      
      const handlePanelKeyDown = (event) => {
         // If focus is on an input field within the panel, don't trigger global shortcuts
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT') { // Sync on Enter in lyric input
                event.preventDefault();
                syncLine(currentLineIndex);
            }
            return; 
        }
    
        if (event.code === 'Space') {
          event.preventDefault();
          syncLine(currentLineIndex);
        } else if (event.key === 'Backspace') {
           event.preventDefault();
           backLine();
        }
      };

      useEffect(() => {
        const currentPanelRef = containerRef.current;
        if (currentPanelRef) {
            currentPanelRef.addEventListener('keydown', handlePanelKeyDown);
        }
        return () => {
            if (currentPanelRef) {
                currentPanelRef.removeEventListener('keydown', handlePanelKeyDown);
            }
        };
    }, [syncLine, backLine, currentLineIndex, containerRef]);


      return (
        <div className="w-full md:w-1/2 flex flex-col overflow-hidden" ref={ref}>
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-200">{t('player.tabs.lyrics')}</h3>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-yellow-400">
                            <Info size={16} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 glass-effect text-xs text-gray-200 border-white/20" side="bottom" align="start">
                        <p className="font-semibold mb-1 golden-text">{t('player.lyricsEditor.shortcutsTitle')}</p>
                        <p><strong className="text-yellow-300">{t('player.lyricsEditor.shortcutSpace')}</strong> {t('player.lyricsEditor.shortcutSpaceDesc')}</p>
                        <p><strong className="text-yellow-300">{t('player.lyricsEditor.shortcutBackspace')}</strong> {t('player.lyricsEditor.shortcutBackspaceDesc')}</p>
                        <p><strong className="text-yellow-300">{t('player.lyricsEditor.shortcutEnter')}</strong> {t('player.lyricsEditor.shortcutEnterDesc')}</p>
                        <p className="mt-2 font-semibold mb-1 golden-text">{t('player.lyricsEditor.mobileTitle')}</p>
                        <p>{t('player.lyricsEditor.mobileHint')}</p>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleUndo} size="sm" variant="outline" className="text-xs" disabled={historyIndex <= 0}><Undo size={14} className="mr-1"/>{t('player.lyricsEditor.undo')}</Button>
              <Button onClick={handleRedo} size="sm" variant="outline" className="text-xs" disabled={historyIndex >= historyLength - 1}><Redo size={14} className="mr-1"/>{t('player.lyricsEditor.redo')}</Button>
            </div>
          </div>
          <div 
            ref={containerRef} 
            tabIndex={-1}  
            className="flex-grow overflow-y-auto space-y-1 pr-2 custom-scrollbar bg-black/20 p-2 rounded-md border border-white/10 focus:outline-none"
            >
            {lyrics.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-2">{t('player.lyricsEditor.emptyTitle')}</p>
                <Textarea 
                  placeholder={t('player.lyricsEditor.emptyPlaceholder')}
                  className="h-40 bg-white/5 border-white/10 text-white placeholder-gray-500"
                  onBlur={(e) => {
                    const newRawLyrics = e.target.value;
                    const parsed = parseLrcTextToLines(newRawLyrics, true); // True to filter metadata on paste
                    setLyrics(parsed);
                    pushToHistory(parsed, true);
                  }}
                />
              </div>
            )}
            {lyrics.map((line, index) => (
              <div
                key={line.id}
                ref={index === currentLineIndex ? activeLineRef : null}
                className={`p-2 rounded-md flex items-center gap-2 transition-all duration-150 ${index === currentLineIndex ? 'bg-yellow-400/20 border-l-2 border-yellow-400' : 'hover:bg-white/5'}`}
                onClick={() => setCurrentLineIndex(index)}
              >
                <Button onClick={(e) => { e.stopPropagation(); syncLine(index);}} size="sm" variant="ghost" className={`p-1 h-auto ${line.time !== null ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-yellow-300'}`}>
                  {line.time !== null ? <CheckCircle size={16}/> : <ClockIcon size={16}/>}
                </Button>
                <span className="text-xs w-16 font-mono text-gray-400 select-none">
                  {line.time !== null ? formatTime(line.time) : '--:--.--'}
                </span>
                <Input 
                  type="text" 
                  value={line.text} 
                  onChange={(e) => handleLyricTextChange(index, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); syncLine(index); }}}
                  className="flex-grow bg-transparent border-none focus:ring-0 focus:bg-white/10 p-1 h-auto text-sm text-gray-200"
                />
                <Button onClick={(e) => { e.stopPropagation(); addLyricLine(index);}} size="icon" variant="ghost" className="p-1 h-auto text-gray-400 hover:text-green-400"><PlusCircle size={14}/></Button>
                <Button onClick={(e) => { e.stopPropagation(); removeLyricLine(index);}} size="icon" variant="ghost" className="p-1 h-auto text-gray-400 hover:text-red-400"><Trash2 size={14}/></Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <Button onClick={() => addLyricLine(lyrics.length > 0 ? lyrics.length -1 : 0)} size="sm" variant="outline" className="text-xs"><PlusCircle size={14} className="mr-1"/>{t('player.lyricsEditor.addLine')}</Button>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="autoAdvance" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="form-checkbox h-4 w-4 text-yellow-400 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"/>
              <label htmlFor="autoAdvance" className="text-xs text-gray-300">{t('player.lyricsEditor.autoAdvance')}</label>
            </div>
          </div>
        </div>
      );
    });

    LyricsPanel.displayName = "LyricsPanel";
    export default LyricsPanel;
