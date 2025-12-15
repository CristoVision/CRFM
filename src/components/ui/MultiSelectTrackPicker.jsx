import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { X, Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { cn } from '@/lib/utils';
    import { toast } from '@/components/ui/use-toast';

    const MultiSelectTrackPicker = ({ selectedTracks = [], onSelectedTracksChange, placeholder = "Select tracks..." }) => {
      const { user } = useAuth();
      const [open, setOpen] = useState(false);
      const [searchTerm, setSearchTerm] = useState("");
      const [searchResults, setSearchResults] = useState([]);
      const [isLoading, setIsLoading] = useState(false);

      const fetchTracks = useCallback(async () => {
        if (!user || !searchTerm.trim()) {
          setSearchResults([]);
          return;
        }
        setIsLoading(true);
        try {
          let query = supabase
            .from('tracks')
            .select('id, title, cover_art_url, video_cover_art_url, creator_display_name')
            .ilike('title', `%${searchTerm}%`);
            
          const { data, error } = await query.limit(10);

          if (error) throw error;
          
          setSearchResults(data || []);
        } catch (error) {
          console.error("Error fetching tracks:", error);
          toast({ title: "Error", description: "Could not fetch tracks for selection.", variant: "error" });
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      }, [user, searchTerm]);

      useEffect(() => {
        const debouncedFetch = setTimeout(() => {
          if(searchTerm.length > 1) fetchTracks();
          else setSearchResults([]);
        }, 300);
        return () => clearTimeout(debouncedFetch);
      }, [searchTerm, fetchTracks]);

      const handleSelectTrack = (track) => {
        if (!selectedTracks.find(t => t.id === track.id)) {
          onSelectedTracksChange([...selectedTracks, track]);
        }
        setSearchTerm(""); 
        setSearchResults([]);
      };

      const handleRemoveTrack = (trackId) => {
        onSelectedTracksChange(selectedTracks.filter(t => t.id !== trackId));
      };

      const toggleTrack = (track) => {
        const isSelected = selectedTracks.some(st => st.id === track.id);
        if (isSelected) {
          handleRemoveTrack(track.id);
        } else {
          handleSelectTrack(track);
        }
      };
      
      return (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 hover:text-yellow-300"
              >
                {selectedTracks.length > 0 ? `${selectedTracks.length} track(s) selected` : placeholder}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 glass-effect-popover">
              <Command>
                <CommandInput 
                  placeholder="Search tracks..." 
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  className="h-9 bg-transparent border-0 focus:ring-0 text-white placeholder-gray-500"
                />
                <CommandList>
                  {isLoading && <CommandItem disabled className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-yellow-400" /></CommandItem>}
                  {!isLoading && searchResults.length === 0 && searchTerm.length > 1 && <CommandEmpty>No tracks found.</CommandEmpty>}
                  
                  <ScrollArea className={searchResults.length > 0 ? "max-h-60" : ""}>
                    <CommandGroup>
                      {searchResults.map((track) => (
                        <CommandItem
                          key={track.id}
                          value={track.title}
                          onSelect={() => toggleTrack(track)}
                          className="text-gray-300 hover:!bg-yellow-400/10 hover:!text-yellow-300 flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center overflow-hidden">
                            <img-replace 
                              src={track.cover_art_url || "https://via.placeholder.com/40?text=?"} 
                              alt={track.title} 
                              className="w-8 h-8 rounded-sm mr-2 object-cover"
                            />
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate">{track.title}</span>
                              <span className="text-xs text-gray-500 truncate">{track.creator_display_name}</span>
                            </div>
                          </div>
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTracks.some(st => st.id === track.id) ? "opacity-100 text-yellow-400" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </ScrollArea>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedTracks.length > 0 && (
            <ScrollArea className="max-h-40 border border-white/10 rounded-md p-2 bg-black/30">
              <div className="flex flex-wrap gap-1">
                {selectedTracks.map((track) => (
                  <Badge
                    key={track.id}
                    variant="secondary"
                    className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30"
                  >
                    {track.title}
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.id)}
                      className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      aria-label={`Remove ${track.title}`}
                    >
                      <X className="h-3 w-3 text-yellow-200 hover:text-white" />
                    </button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      );
    };

    export default MultiSelectTrackPicker;
