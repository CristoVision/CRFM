import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MultiSelectCombobox = ({ options, selected, onChange, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSelect = (value) => {
    if (!selected.some(s => s.value.toLowerCase() === value.toLowerCase())) {
      const option = options.find(o => o.value.toLowerCase() === value.toLowerCase()) || { value, label: value };
      onChange([...selected, option]);
    }
    setInputValue('');
    setOpen(true); 
  };

  const handleDeselect = (valueToRemove) => {
    onChange(selected.filter(s => s.value !== valueToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim() !== '') {
      e.preventDefault();
      if (!selected.some(s => s.value.toLowerCase() === inputValue.trim().toLowerCase())) {
         handleSelect(inputValue.trim());
      }
      setInputValue(''); 
    }
  };

  const filteredOptions = options.filter(option => 
    !selected.some(s => s.value.toLowerCase() === option.value.toLowerCase()) && 
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-white focus:border-yellow-400", className)}
        >
          <span className="truncate">
            {selected.length > 0 ? selected.map(s => s.label).join(', ') : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-yellow-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 glass-effect-light border-yellow-500/50">
        <Command>
          <CommandInput 
            placeholder="Search or add..." 
            value={inputValue} 
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
            className="text-white bg-transparent border-0 focus:ring-0 placeholder:text-gray-500" 
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() !== '' ? `Press Enter to add "${inputValue}"` : "No items found."}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="text-gray-300 hover:!bg-yellow-400/10 hover:!text-yellow-300 aria-selected:!bg-yellow-400/20 aria-selected:!text-yellow-200"
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {inputValue.trim() !== '' && 
             !options.some(o => o.label.toLowerCase() === inputValue.trim().toLowerCase()) && 
             !selected.some(s => s.label.toLowerCase() === inputValue.trim().toLowerCase()) && (
                <CommandItem
                    key={inputValue.trim()}
                    value={inputValue.trim()}
                    onSelect={() => handleSelect(inputValue.trim())}
                    className="text-gray-300 hover:!bg-yellow-400/10 hover:!text-yellow-300"
                >
                    Add "{inputValue.trim()}"
                </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge
              key={item.value}
              variant="secondary"
              className="bg-yellow-400/20 text-yellow-100 border-yellow-400/30 hover:bg-yellow-400/30"
            >
              {item.label}
              <button
                type="button"
                onClick={() => handleDeselect(item.value)}
                className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-3 w-3 text-yellow-100 hover:text-white" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </Popover>
  );
};

export default MultiSelectCombobox;
