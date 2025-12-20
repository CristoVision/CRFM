import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const MONTH_KEYS = [
  'months.nisan',
  'months.iyar',
  'months.sivan',
  'months.tammuz',
  'months.av',
  'months.elul',
  'months.tishrei',
  'months.cheshvan',
  'months.kislev',
  'months.tevet',
  'months.shevat',
  'months.adar',
  'months.adar2',
];
const WEEKDAY_KEYS = [
  'weekdays.sunday',
  'weekdays.monday',
  'weekdays.tuesday',
  'weekdays.wednesday',
  'weekdays.thursday',
  'weekdays.friday',
  'weekdays.saturday',
];
const WEEKDAY_SHORT_KEYS = [
  'weekdaysShort.sun',
  'weekdaysShort.mon',
  'weekdaysShort.tue',
  'weekdaysShort.wed',
  'weekdaysShort.thu',
  'weekdaysShort.fri',
  'weekdaysShort.sat',
];

const BASELINE_OPTIONS = [
  { id: 'ussh', year: 4004, labelKey: 'calendar.baselines.ussh.label', noteKey: 'calendar.baselines.ussh.note', sourceKey: 'calendar.baselines.ussh.source', sourceUrl: 'https://en.wikipedia.org/wiki/Ussher_chronology' },
  { id: 'hebrew', year: 3761, labelKey: 'calendar.baselines.hebrew.label', noteKey: 'calendar.baselines.hebrew.note', sourceKey: 'calendar.baselines.hebrew.source', sourceUrl: 'https://en.wikipedia.org/wiki/Anno_Mundi' },
  { id: 'byzantine', year: 5509, labelKey: 'calendar.baselines.byzantine.label', noteKey: 'calendar.baselines.byzantine.note', sourceKey: 'calendar.baselines.byzantine.source', sourceUrl: 'https://en.wikipedia.org/wiki/Anno_Mundi' },
];

const isLeapYear = (year) => (
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
);

const getDayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const CreationCalendarPanel = () => {
  const { t, language } = useLanguage();
  const [yearMode, setYearMode] = useState('creation');
  const [baselineId, setBaselineId] = useState('ussh');
  const [gregorianInput, setGregorianInput] = useState(formatDateInput(new Date()));
  const [creationYearInput, setCreationYearInput] = useState(`${new Date().getFullYear()}`);
  const [creationMonthInput, setCreationMonthInput] = useState('0');
  const [creationDayInput, setCreationDayInput] = useState('1');

  const baseline = BASELINE_OPTIONS.find((option) => option.id === baselineId) || BASELINE_OPTIONS[0];

  const todayData = useMemo(() => {
    const today = new Date();
    const gregorianYear = today.getFullYear();
    const dayOfYear = getDayOfYear(today);
    const leapYear = isLeapYear(gregorianYear);
    const intercalary = dayOfYear > 364;
    const intercalaryName = intercalary
      ? leapYear && dayOfYear === 366
        ? t('calendar.leapDay')
        : t('calendar.yearDay')
      : '';
    const monthIndex = Math.floor((dayOfYear - 1) / 28);
    const dayInMonth = ((dayOfYear - 1) % 28) + 1;
    const weekdayIndex = (dayOfYear - 1) % 7;
    const weekdayName = intercalary ? t('calendar.intercalaryDay') : t(WEEKDAY_KEYS[weekdayIndex]);
    const monthName = intercalary ? intercalaryName : t(MONTH_KEYS[monthIndex]);
    const creationYear = baseline.year + gregorianYear;

    return {
      today,
      gregorianYear,
      dayOfYear,
      leapYear,
      intercalary,
      intercalaryName,
      monthIndex,
      dayInMonth,
      weekdayName,
      monthName,
      creationYear,
    };
  }, [baseline.year, t]);

  const gregorianLabel = useMemo(() => {
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(todayData.today);
  }, [language, todayData.today]);

  const yearDisplay = yearMode === 'creation'
    ? `${todayData.creationYear} ${t('calendar.am')}`
    : `${t('calendar.ad')} ${todayData.gregorianYear}`;

  const primaryDateLabel = todayData.intercalary
    ? `${todayData.intercalaryName} · ${yearDisplay}`
    : `${todayData.weekdayName}, ${todayData.monthName} ${todayData.dayInMonth} · ${yearDisplay}`;

  const monthLabels = MONTH_KEYS.map((key) => t(key));
  const weekdayShortLabels = WEEKDAY_SHORT_KEYS.map((key) => t(key));

  const gregorianConversion = useMemo(() => {
    const date = parseDateInput(gregorianInput);
    if (!date) return null;
    const dayOfYear = getDayOfYear(date);
    const leapYear = isLeapYear(date.getFullYear());
    const intercalary = dayOfYear > 364;
    const intercalaryName = intercalary
      ? leapYear && dayOfYear === 366
        ? t('calendar.leapDay')
        : t('calendar.yearDay')
      : '';
    const monthIndex = Math.floor((dayOfYear - 1) / 28);
    const dayInMonth = ((dayOfYear - 1) % 28) + 1;
    const weekdayName = intercalary
      ? t('calendar.intercalaryDay')
      : t(WEEKDAY_KEYS[(dayOfYear - 1) % 7]);
    const monthName = intercalary ? intercalaryName : t(MONTH_KEYS[monthIndex]);
    const creationYear = baseline.year + date.getFullYear();

    return {
      dayOfYear,
      leapYear,
      intercalary,
      intercalaryName,
      weekdayName,
      monthName,
      dayInMonth,
      creationYear,
    };
  }, [baseline.year, gregorianInput, t]);

  const creationConversion = useMemo(() => {
    const year = Number(creationYearInput);
    if (!year) return { error: t('calendar.invalidYear') };

    const leapYear = isLeapYear(year);
    const monthValue = creationMonthInput;
    let dayOfYear = 0;

    if (monthValue === 'year_day') {
      dayOfYear = 365;
    } else if (monthValue === 'leap_day') {
      if (!leapYear) return { error: t('calendar.invalidLeapDay') };
      dayOfYear = 366;
    } else {
      const dayNumber = Number(creationDayInput);
      if (!dayNumber || dayNumber < 1 || dayNumber > 28) {
        return { error: t('calendar.invalidDay') };
      }
      dayOfYear = Number(monthValue) * 28 + dayNumber;
    }

    if (dayOfYear === 366 && !leapYear) {
      return { error: t('calendar.invalidLeapDay') };
    }

    const date = new Date(year, 0, dayOfYear);
    return { date, leapYear };
  }, [creationYearInput, creationMonthInput, creationDayInput, t]);

  const creationMonthOptions = [
    ...MONTH_KEYS.map((key, index) => ({ value: `${index}`, label: t(key) })),
    { value: 'year_day', label: t('calendar.yearDay') },
    { value: 'leap_day', label: t('calendar.leapDay') },
  ];

  return (
    <div className="p-6 sm:p-8 glass-effect rounded-xl min-h-[50vh]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-bold golden-text flex items-center">
            <CalendarDays className="w-8 h-8 mr-3 text-yellow-400" />
            {t('calendar.title')}
          </h2>
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            {t('calendar.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={yearMode === 'creation' ? 'secondary' : 'outline'}
            onClick={() => setYearMode('creation')}
            className="text-xs sm:text-sm"
          >
            {t('calendar.creationTimeline')}
          </Button>
          <Button
            type="button"
            variant={yearMode === 'gregorian' ? 'secondary' : 'outline'}
            onClick={() => setYearMode('gregorian')}
            className="text-xs sm:text-sm"
          >
            {t('calendar.adBcEra')}
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col lg:flex-row gap-3 items-start">
        <div className="w-full lg:w-64">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{t('calendar.selectBaseline')}</p>
          <Select value={baselineId} onValueChange={setBaselineId}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASELINE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mt-2">{t(baseline.noteKey)}</p>
        </div>
        <div className="flex-1 text-xs text-gray-400">
          <p className="uppercase tracking-wide text-gray-400 mb-1">{t('calendar.sourcesTitle')}</p>
          <div className="space-y-1">
            {BASELINE_OPTIONS.map((option) => (
              <a
                key={option.id}
                href={option.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-yellow-300/80 hover:text-yellow-300"
              >
                {t(option.sourceKey)}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-effect-light rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">{t('calendar.todayLabel')}</p>
            <p className="text-2xl text-gray-100 font-semibold">{primaryDateLabel}</p>
            <p className="text-sm text-gray-400">
              {t('calendar.gregorianReference')} {gregorianLabel}
            </p>
          </div>
          <div className="mt-6 text-xs text-gray-400 space-y-1">
            <p>{t('calendar.dayOfYear')} {todayData.dayOfYear}</p>
            <p>{todayData.leapYear ? t('calendar.leapYear') : t('calendar.standardYear')} · {t('calendar.weekStartsSunday')}</p>
            <p>{t('calendar.creationBaseline')} {baseline.year} {t('calendar.bc')}</p>
          </div>
        </div>

        <div className="glass-effect-light rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-wide text-gray-400">{t('calendar.monthView')}</p>
            <p className="text-sm text-gray-300">
              {todayData.intercalary ? t('calendar.intercalaryDay') : todayData.monthName}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2 text-[11px] uppercase text-gray-500">
            {weekdayShortLabels.map((day) => (
              <span key={day} className="text-center">{day}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2 text-sm">
            {Array.from({ length: 28 }, (_, index) => {
              const dayNumber = index + 1;
              const isToday = !todayData.intercalary && dayNumber === todayData.dayInMonth;

              return (
                <span
                  key={dayNumber}
                  className={cn(
                    'text-center rounded-md py-1',
                    isToday ? 'bg-yellow-400 text-black font-semibold' : 'bg-white/5 text-gray-300',
                  )}
                >
                  {dayNumber}
                </span>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            {t('calendar.note')}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">{t('calendar.converterTitle')}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-effect-light rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-400">{t('calendar.gregorianToCreation')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-gray-400">{t('calendar.gregorianDate')}</label>
              <Input
                type="date"
                value={gregorianInput}
                onChange={(event) => setGregorianInput(event.target.value)}
                className="bg-black/30 border-white/10 text-white"
              />
            </div>
            <div className="pt-2 text-sm text-gray-300">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{t('calendar.convertResult')}</p>
              {gregorianConversion ? (
                <div className="space-y-1">
                  <p>
                    {gregorianConversion.intercalary
                      ? `${gregorianConversion.intercalaryName} · ${gregorianConversion.creationYear} ${t('calendar.am')}`
                      : `${gregorianConversion.weekdayName}, ${gregorianConversion.monthName} ${gregorianConversion.dayInMonth} · ${gregorianConversion.creationYear} ${t('calendar.am')}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('calendar.dayOfYear')} {gregorianConversion.dayOfYear}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">—</p>
              )}
            </div>
          </div>

          <div className="glass-effect-light rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-400">{t('calendar.creationToGregorian')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-gray-400">{t('calendar.yearLabel')}</label>
                <Input
                  type="number"
                  value={creationYearInput}
                  onChange={(event) => setCreationYearInput(event.target.value)}
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-gray-400">{t('calendar.monthLabel')}</label>
                <Select value={creationMonthInput} onValueChange={setCreationMonthInput}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {creationMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-gray-400">{t('calendar.dayLabel')}</label>
                <Input
                  type="number"
                  value={creationDayInput}
                  onChange={(event) => setCreationDayInput(event.target.value)}
                  className="bg-black/30 border-white/10 text-white"
                  disabled={creationMonthInput === 'year_day' || creationMonthInput === 'leap_day'}
                />
              </div>
            </div>
            <div className="pt-2 text-sm text-gray-300">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{t('calendar.convertResult')}</p>
              {creationConversion?.error ? (
                <p className="text-sm text-red-400">{creationConversion.error}</p>
              ) : creationConversion?.date ? (
                <p>
                  {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(creationConversion.date)}
                </p>
              ) : (
                <p className="text-xs text-gray-500">—</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreationCalendarPanel;
