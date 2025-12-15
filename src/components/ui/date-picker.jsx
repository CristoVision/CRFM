import React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function DatePicker({ date, setDate, placeholder = "Pick a date", className }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal glass-effect text-white border-white/20 hover:bg-white/10 hover:text-yellow-400",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-yellow-400" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 glass-effect-light border-yellow-500/50">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
          className="text-white"
          classNames={{
            day_selected: "bg-yellow-400 text-black hover:bg-yellow-500 focus:bg-yellow-500",
            day_today: "text-yellow-300 border-yellow-400",
            head_cell: "text-muted-foreground",
            nav_button: "text-yellow-400 hover:text-yellow-300",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DatePickerWithRange({ date, onDateChange, className, placeholder = "Pick a date range" }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal glass-effect text-white border-white/20 hover:bg-white/10 hover:text-yellow-400",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-yellow-400" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 glass-effect-light border-yellow-500/50" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            className="text-white"
            classNames={{
                day_selected: "bg-yellow-400 text-black hover:bg-yellow-500 focus:bg-yellow-500",
                day_today: "text-yellow-300 border-yellow-400",
                day_range_start: "bg-yellow-400 text-black rounded-l-md",
                day_range_end: "bg-yellow-400 text-black rounded-r-md",
                day_range_middle: "bg-yellow-400/30 text-yellow-100",
                head_cell: "text-muted-foreground",
                nav_button: "text-yellow-400 hover:text-yellow-300",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
