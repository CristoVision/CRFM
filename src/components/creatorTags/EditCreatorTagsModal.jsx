import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, PlusCircle, X } from 'lucide-react';

const EditCreatorTagsModal = ({ creator, onUpdate }) => {
  const [tags, setTags] = useState(creator.creator_tags || []);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ creator_tags: tags, updated_at: new Date().toISOString() })
        .eq('id', creator.id);
      if (error) throw error;
      onUpdate({ ...creator, creator_tags: tags });
      toast({ title: "Tags Updated", description: `Creator tags for ${creator.username} updated.`, variant: "success" });
    } catch (error) {
      toast({ title: "Update Failed", description: error.message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="glass-effect-light text-white max-w-md">
      <DialogHeader>
        <DialogTitle className="golden-text text-2xl">Edit Tags for {creator.username}</DialogTitle>
        <DialogDescription className="text-gray-400">
          Manage creator tags for <span className="font-semibold text-yellow-400">{creator.full_name || creator.username}</span>.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
        <div>
          <Label htmlFor="newTag" className="text-gray-300">Add New Tag</Label>
          <div className="flex space-x-2 mt-1">
            <Input
              id="newTag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Enter a tag (e.g., Producer, Vocalist)"
              className="bg-black/20 border-white/10 text-white focus:border-yellow-400"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }}}
            />
            <Button onClick={handleAddTag} variant="outline" className="golden-gradient text-black shrink-0 px-3" disabled={!newTag.trim()}>
              <PlusCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-gray-300">Current Tags</Label>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2 p-2 bg-black/10 rounded-md border border-yellow-400/10">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-sm bg-yellow-400/10 text-yellow-300 border-yellow-400/30">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="ml-2 text-yellow-500 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-1">No tags assigned yet.</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">Cancel</Button>
        </DialogClose>
        <Button onClick={handleSubmit} disabled={isLoading} className="golden-gradient text-black font-semibold hover:opacity-90">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
          Save Tags
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default EditCreatorTagsModal;
