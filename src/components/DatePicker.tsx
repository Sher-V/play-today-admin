import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Минимальная дата (YYYY-MM-DD). Дни до неё недоступны. */
  minDate?: string;
  /** Плейсхолдер, когда дата не выбрана (selectedDate пустой). */
  placeholder?: string;
}

export function DatePicker({ selectedDate, onDateChange, minDate, placeholder }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const minDateObj = minDate ? (() => {
    const [y, m, d] = minDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : null;
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const [year, month] = selectedDate.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    if (minDateObj) return new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1);
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const formatSelectedDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const dayOfWeek = dayNames[date.getDay()];
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} (${dayOfWeek})`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Добавляем пустые ячейки для дней до начала месяца
    // В России неделя начинается с понедельника
    const offset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    for (let i = 0; i < offset; i++) {
      days.push(null);
    }
    
    // Добавляем дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    onDateChange(dateStr);
    setIsOpen(false);
  };

  const isSelectedDate = (date: Date | null) => {
    if (!date) return false;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return dateStr === selectedDate;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isBeforeMin = (date: Date | null) => {
    if (!date || !minDateObj) return false;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return d < minDateObj;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const buttonLabel = selectedDate
    ? formatSelectedDate(selectedDate)
    : (placeholder ?? 'Выберите дату');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors text-left"
        type="button"
      >
        <span className={`text-gray-900 whitespace-nowrap ${!selectedDate ? 'text-gray-500' : ''}`}>
          {buttonLabel}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Overlay to close calendar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Calendar dropdown */}
          <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-[320px]">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-semibold text-gray-900 capitalize">
                {monthName}
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const disabled = !date || isBeforeMin(date);
                return (
                  <button
                    key={index}
                    onClick={() => date && !disabled && handleDateSelect(date)}
                    disabled={disabled}
                    type="button"
                    className={`
                      h-10 rounded-lg text-sm font-medium transition-colors
                      ${!date ? 'invisible' : ''}
                      ${disabled && date ? 'text-gray-300 cursor-not-allowed' : ''}
                      ${!disabled && isSelectedDate(date) ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                      ${!disabled && !isSelectedDate(date) && isToday(date) ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : ''}
                      ${!disabled && !isSelectedDate(date) && !isToday(date) ? 'text-gray-700 hover:bg-gray-100' : ''}
                    `}
                  >
                    {date?.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}