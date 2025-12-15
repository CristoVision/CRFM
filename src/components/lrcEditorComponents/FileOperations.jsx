import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Download, UploadCloud, Loader2 } from 'lucide-react';
import { generateLrcContent } from '../lrcEditorUtils.js';
import { toast } from '@/components/ui/use-toast';

function FileOperations({
  isSaving, handleSaveLrc, lyrics, trackTitle,
  lrcFile, onLrcFileChange
}) {

  const handleDownloadLrc = () => {
    if (lyrics.length === 0) {
        toast({ title: "Cannot Download", description: "No lyrics to download.", variant: "destructive"});
        return;
    }
    const lrcContent = generateLrcContent(lyrics);
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${trackTitle.replace(/[^a-z0-9]/gi, '_')}.lrc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up blob URL
    toast({ title: "LRC Downloaded", description: "Check your downloads folder." });
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      onLrcFileChange(file);
    }
     // Reset file input to allow re-uploading the same file name
    event.target.value = null;
  };


  return (
    <div className="bg-black/20 p-3 rounded-md border border-white/10 space-y-3">
      <h4 className="text-md font-semibold text-gray-200">File Operations</h4>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleSaveLrc} disabled={isSaving || lyrics.length === 0} className="flex-1 golden-gradient text-black">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
          {lrcFile ? 'Save Uploaded LRC' : 'Save Synced LRC'}
        </Button>
        <Button onClick={handleDownloadLrc} variant="outline" disabled={lyrics.length === 0} className="flex-1 bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300">
          <Download className="w-4 h-4 mr-2" /> Download LRC
        </Button>
      </div>
      <div className="pt-2 border-t border-white/10">
        <Label htmlFor="lrcFile" className="text-xs text-gray-400 block mb-1">Upload .LRC File to Replace Current</Label>
        <div className="flex gap-2">
          <Input id="lrcFile" type="file" accept=".lrc" onChange={handleFileSelect} className="flex-grow bg-white/5 border-white/10 text-gray-300 file:text-yellow-400 file:bg-transparent file:border-none file:mr-2 file:text-xs"/>
        </div>
         {lrcFile && <p className="text-xs text-yellow-300 mt-1">File selected: {lrcFile.name}. Click "Save Uploaded LRC" to apply.</p>}
      </div>
    </div>
  );
}

export default FileOperations;
