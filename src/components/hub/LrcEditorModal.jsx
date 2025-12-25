import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, AlertTriangle, ChevronRight, X as CloseIcon } from 'lucide-react';

import { parseLrcTextToLines, generateLrcContent, getStoragePath } from '../lrcEditorUtils.js';
import LyricsPanel from '@/components/lrcEditorComponents/LyricsPanel';
import PlayerControls from '@/components/lrcEditorComponents/PlayerControls';
import FileOperations from '@/components/lrcEditorComponents/FileOperations';
import MobileSyncControls from '@/components/lrcEditorComponents/MobileSyncControls';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function LrcEditorModal({
  isOpen,
  onOpenChange,
  track,
  allTracks,
  currentTrackIndexInList,
  onLyricsUpdated,
  onSwitchTrack
}) {
  const { user } = useAuth();
  const audioRef = useRef(null);
  const lyricsPanelRef = useRef(null);

  const [lyrics, setLyrics] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lrcFile, setLrcFile] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [autoAdvance, setAutoAdvance] = useState(true);
  const [initialLyricsState, setInitialLyricsState] = useState(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [nextAction, setNextAction] = useState(null);

  const hasUnsavedChanges = useCallback(() => {
    if (!initialLyricsState) return false;
    const currentLrcContent = generateLrcContent(lyrics);
    return currentLrcContent !== initialLyricsState.lrcContent || (lrcFile && lrcFile !== initialLyricsState.file);
  }, [lyrics, lrcFile, initialLyricsState]);

  const pushToHistory = (newLyrics, isInitial = false) => {
    const newHistoryEntry = JSON.parse(JSON.stringify(newLyrics));
    if (isInitial) {
      setHistory([newHistoryEntry]);
      setHistoryIndex(0);
    } else {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newHistoryEntry);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const loadLyrics = useCallback(async (currentTrack) => {
    if (!currentTrack) return;

    const storagePath = getStoragePath(currentTrack.lrc_file_path);
    let lrcTextContent = currentTrack.lyrics_text || '';
    let fromStorage = false;

    if (storagePath) {
      try {
        const { data, error } = await supabase.storage
          .from('lyrics-sync-files')
          .download(storagePath);

        if (error) {
          console.warn("Error loading .lrc file from storage, falling back to lyrics_text:", error.message);
        } else {
          lrcTextContent = await data.text();
          fromStorage = true;
        }
      } catch (error) {
        console.warn("Exception loading .lrc file, falling back to lyrics_text:", error.message);
      }
    }

    const parsedLines = parseLrcTextToLines(lrcTextContent, !fromStorage); // filter metadata if not from storage file
    setLyrics(parsedLines);

    const initialContent = generateLrcContent(parsedLines);
    setInitialLyricsState({ lrcContent: initialContent, file: null });

    pushToHistory(parsedLines, true);
    setCurrentLineIndex(0);
    setLrcFile(null);
  }, [history, historyIndex]);

  useEffect(() => {
    if (isOpen && track) {
      loadLyrics(track);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
    } else if (!isOpen) {
      setLyrics([]);
      setHistory([]);
      setHistoryIndex(-1);
      setInitialLyricsState(null);
      setShowUnsavedChangesDialog(false);
      setNextAction(null);
      setLrcFile(null);
    }
  }, [isOpen, track, loadLyrics]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setLyrics(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setLyrics(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [isOpen, track]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
    }
  };

  const handleSeek = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleLyricTextChange = (index, newText) => {
    const updatedLyrics = lyrics.map((line, i) => i === index ? { ...line, text: newText } : line);
    setLyrics(updatedLyrics);
    pushToHistory(updatedLyrics);
  };

  const syncLine = (indexToSync = currentLineIndex) => {
    if (!audioRef.current || indexToSync < 0 || indexToSync >= lyrics.length) return;

    const time = audioRef.current.currentTime;
    const updatedLyrics = lyrics.map((line, i) => i === indexToSync ? { ...line, time } : line);

    setLyrics(updatedLyrics);
    pushToHistory(updatedLyrics);

    if (autoAdvance) {
      let nextIndex = indexToSync + 1;
      while (nextIndex < lyrics.length && lyrics[nextIndex].text.trim() === '') {
        nextIndex++;
      }
      if (nextIndex < lyrics.length) {
        setCurrentLineIndex(nextIndex);
      }
    }
  };

  const addLyricLine = (index) => {
    const newLine = { time: null, text: '', id: Math.random().toString(36).substr(2, 9) };
    const updatedLyrics = [...lyrics.slice(0, index + 1), newLine, ...lyrics.slice(index + 1)];
    setLyrics(updatedLyrics);
    pushToHistory(updatedLyrics);
    setCurrentLineIndex(index + 1);
  };

  const removeLyricLine = (index) => {
    const updatedLyrics = lyrics.filter((_, i) => i !== index);
    setLyrics(updatedLyrics);
    pushToHistory(updatedLyrics);

    if (currentLineIndex >= index && currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1);
    } else if (updatedLyrics.length === 0) {
      setCurrentLineIndex(0);
    }
  };

  const backLine = () => {
    setCurrentLineIndex(prev => Math.max(0, prev - 1));
  };

  const performSave = async (currentTrackToSave) => {
    if (!currentTrackToSave || !user) return false;

    setIsSaving(true);

    let lrcContentToSave = generateLrcContent(lyrics);

    // IMPORTANT: store under user-owned path for RLS policies like storage_is_own_path(name)
    let newLrcStoragePath = `${user.id}/${currentTrackToSave.id}_${Date.now()}.lrc`;
    let fileToUpload;

    if (lrcFile) {
      lrcContentToSave = await lrcFile.text();
      newLrcStoragePath = `${user.id}/${currentTrackToSave.id}_${Date.now()}_uploaded.lrc`;
      fileToUpload = lrcFile;
    } else {
      fileToUpload = new Blob([lrcContentToSave], { type: 'text/plain' });
    }

    try {
      const { error: uploadError } = await supabase.storage
        .from('lyrics-sync-files')
        .upload(newLrcStoragePath, fileToUpload, {
          upsert: true,
          contentType: 'text/plain',
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('tracks')
        .update({
          lrc_file_path: newLrcStoragePath,
          lyrics_text: lrcContentToSave
        })
        .eq('id', currentTrackToSave.id)
        .eq('uploader_id', user.id);

      if (updateError) throw updateError;

      toast({ title: "LRC Saved!", description: `Lyrics for ${currentTrackToSave.title} saved.` });

      onLyricsUpdated({
        ...currentTrackToSave,
        lrc_file_path: newLrcStoragePath,
        lyrics_text: lrcContentToSave
      });

      setInitialLyricsState({ lrcContent: lrcContentToSave, file: lrcFile });
      setLrcFile(null);

      return true;
    } catch (error) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLrc = () => performSave(track);

  const handleLrcFileChange = (file) => {
    setLrcFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const parsedLines = parseLrcTextToLines(content, false); // don't filter metadata from uploaded .lrc
        setLyrics(parsedLines);
        pushToHistory(parsedLines, true);
        toast({ title: "LRC File Loaded", description: `${file.name} loaded into editor.` });
      };
      reader.readAsText(file);
    }
  };

  const handleSaveUploadedLrc = () => performSave(track);

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges()) {
      setNextAction(() => () => onOpenChange(false));
      setShowUnsavedChangesDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleNextTrack = async () => {
    const saveAndProceed = async () => {
      const saved = await performSave(track);
      if (saved || !hasUnsavedChanges()) {
        if (currentTrackIndexInList !== null && currentTrackIndexInList < allTracks.length - 1) {
          onSwitchTrack(currentTrackIndexInList + 1);
        } else {
          toast({ title: "Last Track", description: "You've reached the end of your track list." });
        }
      }
    };

    if (hasUnsavedChanges()) {
      setNextAction(() => saveAndProceed);
      setShowUnsavedChangesDialog(true);
    } else {
      saveAndProceed();
    }
  };

  const confirmUnsavedChanges = async (saveChanges) => {
    setShowUnsavedChangesDialog(false);

    if (saveChanges) {
      const saved = await performSave(track);
      if (saved && nextAction) {
        nextAction();
      } else if (!saved && nextAction) {
        toast({ title: "Save Failed", description: "Could not proceed with the action.", variant: "destructive" });
      }
    } else if (nextAction) {
      nextAction();
    }

    setNextAction(null);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (!isOpen || showUnsavedChangesDialog) return;

      const targetTagName = event.target.tagName.toLowerCase();
      const isInputFocused = targetTagName === 'input' || targetTagName === 'textarea' || event.target.isContentEditable;

      if (lyricsPanelRef.current && lyricsPanelRef.current.contains(event.target)) {
        return;
      }

      if (event.code === 'Space' && !isInputFocused) {
        event.preventDefault();
        syncLine();
      } else if (event.key === 'Backspace' && !isInputFocused) {
        event.preventDefault();
        backLine();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, showUnsavedChangesDialog, lyrics, currentLineIndex, autoAdvance]);

  if (!track) return null;

  const isLastTrack = currentTrackIndexInList === null || currentTrackIndexInList >= allTracks.length - 1;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent showClose={false} className="max-w-4xl xl:max-w-5xl w-[95vw] h-[90vh] glass-effect-light text-white flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-white/10 flex flex-row justify-between items-center space-x-4">
            <DialogTitle className="flex items-center text-lg sm:text-xl flex-shrink overflow-hidden">
              <Edit2 className="w-5 h-5 mr-2 text-yellow-400 flex-shrink-0" />
              <span className="truncate max-w-[calc(100%-80px)]">{track.title}</span>
            </DialogTitle>

            <div className="flex flex-shrink-0 items-center gap-2 ml-auto">
              <Button
                onClick={handleNextTrack}
                variant="outline"
                size="sm"
                className="golden-gradient text-black text-xs sm:text-sm"
                disabled={isLastTrack || isSaving}
              >
                {isSaving && nextAction === handleNextTrack ? <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" /> : null}
                Next Track
                {!isSaving && <ChevronRight className="w-4 h-4 ml-1 sm:ml-1" />}
              </Button>

              <Button size="icon" variant="ghost" onClick={handleCloseAttempt} className="text-gray-400 hover:text-yellow-400">
                <CloseIcon className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-grow overflow-hidden flex flex-col md:flex-row p-1 sm:p-2 md:p-4 gap-4">
            <LyricsPanel
              ref={lyricsPanelRef}
              lyrics={lyrics}
              currentLineIndex={currentLineIndex}
              setCurrentLineIndex={setCurrentLineIndex}
              handleLyricTextChange={handleLyricTextChange}
              syncLine={syncLine}
              addLyricLine={addLyricLine}
              removeLyricLine={removeLyricLine}
              autoAdvance={autoAdvance}
              setAutoAdvance={setAutoAdvance}
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              historyIndex={historyIndex}
              historyLength={history.length}
              setLyrics={setLyrics}
              pushToHistory={pushToHistory}
              backLine={backLine}
            />

            <div className="w-full md:w-1/2 flex flex-col space-y-3 md:space-y-4">
              <PlayerControls
                audioRef={audioRef}
                trackAudioUrl={track.audio_file_url}
                isPlaying={isPlaying}
                togglePlayPause={togglePlayPause}
                currentTime={currentTime}
                duration={duration}
                handleSeek={handleSeek}
                currentLineIndex={currentLineIndex}
                setCurrentLineIndex={setCurrentLineIndex}
                lyricsLength={lyrics.length}
              />

              <MobileSyncControls onSync={() => syncLine()} onBack={backLine} />

              <FileOperations
                isSaving={isSaving}
                handleSaveLrc={handleSaveLrc}
                lyrics={lyrics}
                trackTitle={track.title}
                lrcFile={lrcFile}
                onLrcFileChange={handleLrcFileChange}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent className="glass-effect-light text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="text-yellow-400 mr-2" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              You have unsaved changes. Do you want to save them before proceeding?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => confirmUnsavedChanges(false)}
              className="bg-gray-600 hover:bg-gray-500 border-gray-500 text-white"
            >
              Discard
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => confirmUnsavedChanges(true)}
              className="golden-gradient text-black"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default LrcEditorModal;
