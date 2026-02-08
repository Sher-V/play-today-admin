import { useState } from 'react';
import { BookingCalendar } from './components/BookingCalendar';
import { BookingModal } from './components/BookingModal';
import { DatePicker } from './components/DatePicker';
import { WeeklySchedule } from './components/WeeklySchedule';
import { ChevronLeft, ChevronRight, Calendar, CalendarDays } from 'lucide-react';

export interface Booking {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  comment: string;
  color: string;
  isRecurring?: boolean;
  recurringEndDate?: string;
}

export const activityTypes = [
  { name: 'Разовая бронь корта', color: '#7dd3fc' },
  { name: 'Группа', color: '#3b82f6' },
  { name: 'Регулярная бронь корта', color: '#10b981' },
  { name: 'Турнир', color: '#fca5a5' },
];

export default function App() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string; time: string; duration?: number; date?: string } | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const handleSlotClick = (courtId: string, time: string, duration?: number, date?: string) => {
    setSelectedSlot({ courtId, time, duration, date });
    setEditingBooking(null);
    setModalOpen(true);
  };

  const handleBookingClick = (booking: Booking) => {
    setEditingBooking(booking);
    setSelectedSlot(null);
    setModalOpen(true);
  };

  const handleAddBooking = (booking: Omit<Booking, 'id'>, bookingId?: string) => {
    // If editing existing booking, update it
    if (bookingId) {
      setBookings(bookings.map(b => b.id === bookingId ? { ...booking, id: bookingId } : b));
      setModalOpen(false);
      return;
    }

    if (booking.isRecurring && booking.recurringEndDate) {
      // Create recurring bookings
      const newBookings: Booking[] = [];
      const skippedDates: string[] = [];
      const startDate = new Date(booking.date);
      const endDate = new Date(booking.recurringEndDate);
      
      let currentDate = new Date(startDate);
      let idCounter = Date.now();
      
      // Generate bookings for each week
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check if slot is available (check for time overlap)
        const hasConflict = bookings.some(b => {
          if (b.courtId !== booking.courtId || b.date !== dateStr) return false;
          
          // Check for time overlap
          const existingStart = parseInt(b.startTime.replace(':', ''));
          const existingEnd = parseInt(b.endTime.replace(':', ''));
          const newStart = parseInt(booking.startTime.replace(':', ''));
          const newEnd = parseInt(booking.endTime.replace(':', ''));
          
          return (newStart < existingEnd && newEnd > existingStart);
        });
        
        if (!hasConflict) {
          newBookings.push({
            ...booking,
            id: (idCounter++).toString(),
            date: dateStr,
          });
        } else {
          skippedDates.push(new Date(dateStr).toLocaleDateString('ru-RU'));
        }
        
        // Move to next week (add 7 days)
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 7);
      }
      
      if (newBookings.length === 0) {
        alert('Не удалось создать ни одного бронирования. Все выбранные слоты уже заняты.');
        return;
      }
      
      setBookings([...bookings, ...newBookings]);
      
      // Show summary
      if (skippedDates.length > 0) {
        alert(`Создано бронирований: ${newBookings.length}\n\nПропущено дат из-за конфликтов: ${skippedDates.length}\n(${skippedDates.slice(0, 5).join(', ')}${skippedDates.length > 5 ? '...' : ''})`);
      } else {
        alert(`Успешно создано ${newBookings.length} регулярных бронирований!`);
      }
    } else {
      // Create single booking - check for conflicts
      const hasConflict = bookings.some(b => {
        if (b.courtId !== booking.courtId || b.date !== booking.date) return false;
        
        const existingStart = parseInt(b.startTime.replace(':', ''));
        const existingEnd = parseInt(b.endTime.replace(':', ''));
        const newStart = parseInt(booking.startTime.replace(':', ''));
        const newEnd = parseInt(booking.endTime.replace(':', ''));
        
        return (newStart < existingEnd && newEnd > existingStart);
      });
      
      if (hasConflict) {
        alert('Этот временной слот уже занят. Пожалуйста, выберите другое время.');
        return;
      }
      
      const newBooking = {
        ...booking,
        id: Date.now().toString(),
      };
      setBookings([...bookings, newBooking]);
    }
    
    setModalOpen(false);
  };

  const handleDeleteBooking = (id: string) => {
    setBookings(bookings.filter(b => b.id !== id));
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const dayOfWeek = dayNames[date.getDay()];
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} (${dayOfWeek})`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="mb-6">Управление бронированием кортов</h1>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-3 mb-4">
            <button
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                viewMode === 'day' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setViewMode('day')}
            >
              <Calendar className="w-5 h-5" />
              <span>Дневной вид</span>
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                viewMode === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setViewMode('week')}
            >
              <CalendarDays className="w-5 h-5" />
              <span>Расписание по неделям</span>
            </button>
          </div>

          {viewMode === 'day' && (
            <div className="flex items-center gap-4 mb-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => handleDateChange('prev')}
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Предыдущая неделя</span>
              </button>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-gray-600">Выберите дату:</span>
                  <DatePicker
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                  />
                </div>
              </div>
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => handleDateChange('next')}
              >
                <span>Следующая неделя</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {viewMode === 'day' ? (
          <BookingCalendar
            selectedDate={selectedDate}
            bookings={bookings}
            onSlotClick={handleSlotClick}
            onDeleteBooking={handleDeleteBooking}
            onBookingClick={handleBookingClick}
          />
        ) : (
          <WeeklySchedule
            selectedDate={selectedDate}
            bookings={bookings}
            onWeekChange={handleDateChange}
            onBookingClick={handleBookingClick}
            onSlotClick={handleSlotClick}
          />
        )}
        
        {modalOpen && (selectedSlot || editingBooking) && (
          <BookingModal
            courtId={editingBooking?.courtId || selectedSlot?.courtId || ''}
            time={editingBooking?.startTime || selectedSlot?.time || ''}
            date={editingBooking?.date || selectedSlot?.date || selectedDate}
            initialDuration={selectedSlot?.duration}
            existingBooking={editingBooking || undefined}
            onClose={() => setModalOpen(false)}
            onSave={handleAddBooking}
          />
        )}
      </div>
    </div>
  );
}