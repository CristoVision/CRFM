import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import { CalendarPlus as CalendarIcon, Filter as FilterIcon, Loader2 } from 'lucide-react';
import { format, subDays, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';

const ANY_TRACK_VALUE = "__ANY_TRACK__";
const ANY_GENRE_VALUE = "__ANY_GENRE__";
const ANY_LANGUAGE_VALUE = "__ANY_LANGUAGE__";

const normalizeValue = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length === 0 ? null : str;
};

const addUiValues = (options) => {
  const counts = new Map();
  return options.map((opt) => {
    const baseKey = normalizeValue(opt.value) ?? 'empty';
    const count = counts.get(baseKey) || 0;
    counts.set(baseKey, count + 1);
    const suffix = count === 0 ? '' : `__dup_${count}`;
    return { ...opt, uiValue: `${baseKey}${suffix}` };
  });
};

const getUiValueFromRaw = (options, rawValue, anyValue) => {
  if (rawValue === null || rawValue === undefined) return anyValue;
  const found = options.find((opt) => opt.value === rawValue);
  return found ? found.uiValue : anyValue;
};

const getRawFromUi = (options, uiValue, anyValue, anyReturn = null) => {
  if (uiValue === anyValue) return anyReturn;
  const found = options.find((opt) => opt.uiValue === uiValue);
  return found ? found.value : anyReturn;
};

const dedupeOptions = (options, normalizeFn = (val) => val) => {
  const map = new Map();
  options.forEach((opt) => {
    if (!opt) return;
    const normalized = normalizeFn(opt.value);
    if (normalized === null || normalized === undefined) return;
    if (!map.has(normalized)) {
      map.set(normalized, opt);
    }
  });
  return Array.from(map.values());
};

export default function AnalyticsFilters({ initialFilterValues, onApply, userId, showTrackFilter = true, showGenreFilter = true, showLanguageFilter = true }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [internalSelectedTrackId, setInternalSelectedTrackId] = useState(initialFilterValues?.selectedTrackId || null);
  const [internalDateRange, setInternalDateRange] = useState(
    initialFilterValues?.dateRange && initialFilterValues.dateRange.from && initialFilterValues.dateRange.to
      ? initialFilterValues.dateRange
      : { from: subDays(new Date(), 30), to: new Date() }
  );
  const [selectedGenre, setSelectedGenre] = useState(initialFilterValues?.genre || null);
  const [selectedLanguage, setSelectedLanguage] = useState(initialFilterValues?.language || null);

  const [availableTracks, setAvailableTracks] = useState([{ value: ANY_TRACK_VALUE, label: 'Any Track' }]);
  const [availableGenres, setAvailableGenres] = useState([{ value: ANY_GENRE_VALUE, label: 'Any Genre' }]);
  const [availableLanguages, setAvailableLanguages] = useState([{ value: ANY_LANGUAGE_VALUE, label: 'Any Language' }]);
  
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingGenres, setLoadingGenres] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  useEffect(() => {
    setInternalSelectedTrackId(initialFilterValues?.selectedTrackId || null);
    if (initialFilterValues?.dateRange && initialFilterValues.dateRange.from && initialFilterValues.dateRange.to) {
      setInternalDateRange(initialFilterValues.dateRange);
    } else {
      setInternalDateRange({ from: subDays(new Date(), 30), to: new Date() });
    }
    setSelectedGenre(initialFilterValues?.genre || null);
    setSelectedLanguage(initialFilterValues?.language || null);
  }, [initialFilterValues]);

  const fetchFilterData = useCallback(async () => {
    if (!userId || !isOpen) return;

    if (showTrackFilter) setLoadingTracks(true);
    if (showGenreFilter) setLoadingGenres(true);
    if (showLanguageFilter) setLoadingLanguages(true);

    let tracksError = false;
    let genresError = false;
    let languagesErrorFlag = false;

    try {
      const tracksPromise = showTrackFilter
        ? supabase
            .from('tracks')
            .select('id, title')
            .eq('uploader_id', userId)
            .order('title', { ascending: true })
            .limit(100)
        : Promise.resolve({ data: null, error: null });
      
      const genresPromise = showGenreFilter
        ? supabase
            .from('tracks')
            .select('genre', { distinct: true })
            .eq('uploader_id', userId)
            .neq('genre', null)
        : Promise.resolve({ data: null, error: null });
      
      const languagesPromise = showLanguageFilter
        ? supabase
            .from('tracks')
            .select('languages')
            .eq('uploader_id', userId)
            .not('languages', 'is', null)
        : Promise.resolve({ data: null, error: null });

      const [tracksRes, genresRes, languagesRes] = await Promise.all([
        tracksPromise,
        genresPromise,
        languagesPromise
      ]);

      if (showTrackFilter) {
        if (tracksRes.error) {
          tracksError = true;
          console.error("Error fetching tracks:", tracksRes.error);
        } else {
          const mappedTracks = tracksRes.data
            ? tracksRes.data.map(row => {
                const safeLabel = normalizeValue(row.title) || 'Untitled track';
                return {
                  value: row.id,
                  label: safeLabel,
                };
              })
            : [];
          const uniqueTracks = dedupeOptions(
            mappedTracks,
            (val) => normalizeValue(val)?.toLowerCase()
          );
          const tracksWithUi = addUiValues([{ value: ANY_TRACK_VALUE, label: 'Any Track' }, ...uniqueTracks]);
          setAvailableTracks(tracksWithUi);
        }
      } else {
        setAvailableTracks(addUiValues([{ value: ANY_TRACK_VALUE, label: 'Any Track' }]));
      }

      if (showGenreFilter) {
        if (genresRes.error) {
          genresError = true;
          console.error("Error fetching genres:", genresRes.error);
        } else {
          const mappedGenres = genresRes.data
            ? genresRes.data
                .map(row => normalizeValue(row.genre))
                .filter(Boolean)
                .map(genre => ({
                  value: genre,
                  label: genre,
                }))
            : [];
          const uniqueGenres = dedupeOptions(
            mappedGenres,
            (val) => normalizeValue(val)?.toLowerCase()
          );
          const genresWithUi = addUiValues([{ value: ANY_GENRE_VALUE, label: 'Any Genre' }, ...uniqueGenres]);
          setAvailableGenres(genresWithUi);
        }
      } else {
        setAvailableGenres(addUiValues([{ value: ANY_GENRE_VALUE, label: 'Any Genre' }]));
      }
      
      if (showLanguageFilter) {
        if (languagesRes.error) {
          languagesErrorFlag = true;
          console.error("Error fetching languages:", languagesRes.error);
        } else {
          const rows = languagesRes.data || [];
          const allLangs = rows
            .flatMap(r => Array.isArray(r.languages) ? r.languages : [])
            .map(lang => normalizeValue(lang))
            .filter(Boolean);
          const uniqueLangs = Array.from(new Set(allLangs));
          
          if (uniqueLangs.length === 0 && rows.length > 0) { 
            languagesErrorFlag = true; 
          }

          const languageOptions = [
            { value: ANY_LANGUAGE_VALUE, label: 'Any Language' },
            ...dedupeOptions(
              uniqueLangs.map(l => ({ value: l, label: l })),
              (val) => normalizeValue(val)?.toLowerCase()
            )
          ];
          setAvailableLanguages(addUiValues(languageOptions));
          if (uniqueLangs.length === 0 && (languagesRes.error || rows.length > 0)) {
              languagesErrorFlag = true;
          }
        }
      } else {
        setAvailableLanguages(addUiValues([{ value: ANY_LANGUAGE_VALUE, label: 'Any Language' }]));
      }
      
      if (languagesErrorFlag) {
         toast({
            title: 'Language Data Error',
            description: 'Failed to load languages — check tracks.languages in your schema.',
            variant: 'destructive',
          });
         setAvailableLanguages([{ value: ANY_LANGUAGE_VALUE, label: 'Any Language' }]);
      }


      if ((showTrackFilter && tracksError) || (showGenreFilter && genresError) ) {
         toast({
            title: 'Filter Data Error',
            description: 'Failed to load some filter data — check tracks table & schema.',
            variant: 'destructive',
          });
          if (tracksError) setAvailableTracks([{ value: ANY_TRACK_VALUE, label: 'Any Track' }]);
          if (genresError) setAvailableGenres([{ value: ANY_GENRE_VALUE, label: 'Any Genre' }]);
      }


    } catch (err) {
      console.error("General error fetching filter data:", err);
      toast({
        title: 'Filter Data Error',
        description: 'An unexpected error occurred while loading filter data.',
        variant: 'destructive',
      });
      setAvailableTracks([{ value: ANY_TRACK_VALUE, label: 'Any Track' }]);
      setAvailableGenres([{ value: ANY_GENRE_VALUE, label: 'Any Genre' }]);
      setAvailableLanguages([{ value: ANY_LANGUAGE_VALUE, label: 'Any Language' }]);
    } finally {
      if (showTrackFilter) setLoadingTracks(false);
      if (showGenreFilter) setLoadingGenres(false);
      if (showLanguageFilter) setLoadingLanguages(false);
    }
  }, [userId, isOpen, showTrackFilter, showGenreFilter, showLanguageFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchFilterData();
    }
  }, [isOpen, fetchFilterData]);

  const handleApply = () => {
    if (onApply && typeof onApply === 'function') {
      onApply({
        selectedTrackId: internalSelectedTrackId,
        dateRange: internalDateRange,
        genre: selectedGenre,
        language: selectedLanguage,
      });
    }
    setIsOpen(false);
  };

  const formatDateDisplay = (date) => {
    return date && isValid(new Date(date)) ? format(new Date(date), 'LLL dd, y') : 'Pick a date';
  };

  const trackUiValue = getUiValueFromRaw(availableTracks, internalSelectedTrackId, ANY_TRACK_VALUE);
  const genreUiValue = getUiValueFromRaw(availableGenres, selectedGenre, ANY_GENRE_VALUE);
  const languageUiValue = getUiValueFromRaw(availableLanguages, selectedLanguage, ANY_LANGUAGE_VALUE);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto flex items-center gap-2 golden-glow-button">
          <FilterIcon className="h-4 w-4" />
          Filter Analytics
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 glass-effect p-4 space-y-4" align="end">
        {showTrackFilter && (
          <div className="space-y-2">
            <Label htmlFor="track-filter-select" className="text-sm font-medium text-gray-300">Select Track</Label>
            {loadingTracks ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              </div>
            ) : (
              <Select
                value={trackUiValue}
                onValueChange={(uiVal) => setInternalSelectedTrackId(getRawFromUi(availableTracks, uiVal, ANY_TRACK_VALUE, null))}
              >
                <SelectTrigger id="track-filter-select" className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                  <SelectValue placeholder="Any Track" />
                </SelectTrigger>
                <SelectContent className="glass-effect border-yellow-400/30 text-white">
                  {availableTracks.map((track, idx) => (
                    <SelectItem 
                      key={track.uiValue || idx} 
                      value={track.uiValue} 
                      className="hover:!bg-yellow-400/10 hover:!text-yellow-200"
                    >
                      {track.label}
                    </SelectItem>
                  ))}
                  {availableTracks.length <= 1 && !loadingTracks && <SelectItem value="no-tracks-placeholder" disabled>No tracks found</SelectItem>}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-300">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-black/20 border-white/10 text-white hover:text-yellow-300"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {internalDateRange && internalDateRange.from ? formatDateDisplay(internalDateRange.from) : 'Pick a date'} - {internalDateRange && internalDateRange.to ? formatDateDisplay(internalDateRange.to) : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 glass-effect" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={internalDateRange?.from || new Date()}
                selected={internalDateRange}
                onSelect={setInternalDateRange}
                numberOfMonths={2}
                className="bg-black/50 border-yellow-400/20"
              />
            </PopoverContent>
          </Popover>
        </div>
        
        {showGenreFilter && (
          <div className="space-y-2">
            <Label htmlFor="genre-filter-select" className="text-sm font-medium text-gray-300">Genre</Label>
            {loadingGenres ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              </div>
            ) : (
              <Select 
                value={genreUiValue} 
                onValueChange={(uiVal) => setSelectedGenre(getRawFromUi(availableGenres, uiVal, ANY_GENRE_VALUE, null))}
              >
                <SelectTrigger id="genre-filter-select" className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                  <SelectValue placeholder="Any Genre" />
                </SelectTrigger>
                <SelectContent className="glass-effect border-yellow-400/30 text-white">
                  {availableGenres.map((genre, idx) => (
                    <SelectItem 
                      key={genre.uiValue || idx} 
                      value={genre.uiValue} 
                      className="hover:!bg-yellow-400/10 hover:!text-yellow-200"
                    >
                      {genre.label}
                    </SelectItem>
                  ))}
                   {availableGenres.length <= 1 && !loadingGenres && <SelectItem value="no-genres-placeholder" disabled>No genres found</SelectItem>}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {showLanguageFilter && (
          <div className="space-y-2">
            <Label htmlFor="language-filter-select" className="text-sm font-medium text-gray-300">Language</Label>
            {loadingLanguages ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              </div>
            ) : (
              <Select 
                value={languageUiValue} 
                onValueChange={(uiVal) => setSelectedLanguage(getRawFromUi(availableLanguages, uiVal, ANY_LANGUAGE_VALUE, null))}
              >
                <SelectTrigger id="language-filter-select" className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                  <SelectValue placeholder="Any Language" />
                </SelectTrigger>
                <SelectContent className="glass-effect border-yellow-400/30 text-white">
                   {availableLanguages.map((lang, idx) => (
                    <SelectItem 
                      key={lang.uiValue || idx} 
                      value={lang.uiValue} 
                      className="hover:!bg-yellow-400/10 hover:!text-yellow-200"
                    >
                      {lang.label}
                    </SelectItem>
                  ))}
                  {availableLanguages.length <= 1 && !loadingLanguages && <SelectItem value="no-languages-placeholder" disabled>No languages found</SelectItem>}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <Button onClick={handleApply} className="w-full golden-button">
          Apply Filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}
