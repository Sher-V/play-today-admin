import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub, clearClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail, getCourts, ensureCourts } from '../lib/clubsFirestore';
import {
  getBookings,
  addBookingToFirestore,
  updateBookingInFirestore,
} from '../lib/bookingsFirestore';
import type { ClubData } from '../lib/clubStorage';
import type { CourtDoc } from '../types/club-slots';
import { BookingCalendar } from '../components/BookingCalendar';
import { BookingModal, type BookingSaveOptions } from '../components/BookingModal';
import { createPaymentLink } from '../lib/yookassa';
import { DatePicker } from '../components/DatePicker';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, LogOut, User, CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { Booking } from '../App';

const today = () => new Date().toISOString().split('T')[0];

function parseDateFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const d = params.get('date');
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : d;
}

function parseViewFromUrl(search: string): 'day' | 'week' {
  const params = new URLSearchParams(search);
  const v = params.get('view');
  return v === 'week' ? 'week' : 'day';
}

export function MainPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<{ uid: string; email?: string | null; emailVerified?: boolean } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [courts, setCourts] = useState<CourtDoc[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedDate, setSelectedDateState] = useState(() =>
    parseDateFromUrl(window.location.search) ?? today()
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string; time: string; duration?: number; date?: string } | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewMode, setViewModeState] = useState<'day' | 'week'>(() =>
    parseViewFromUrl(window.location.search)
  );
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [bookingToCancelSeries, setBookingToCancelSeries] = useState<Booking | null>(null);
  const [cancelInProgress, setCancelInProgress] = useState(false);
  /** Результат создания регулярных бронирований: показываем модалку вместо alert. */
  const [recurringResult, setRecurringResult] = useState<
    | { type: 'success'; created: number }
    | { type: 'partial'; created: number; skippedDates: string[] }
    | { type: 'none' }
    | null
  >(null);

  const setSelectedDate = useCallback(
    (date: string) => {
      setSelectedDateState(date);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', date);
        const view = prev.get('view');
        if (view === 'day' || view === 'week') next.set('view', view);
        return next;
      });
    },
    [setSearchParams]
  );

  const setViewMode = useCallback(
    (mode: 'day' | 'week') => {
      setViewModeState(mode);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', mode);
        const date = prev.get('date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) next.set('date', date);
        else next.set('date', today());
        return next;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email ?? null, emailVerified: firebaseUser.emailVerified } : null);
      try {
        if (firebaseUser) {
          let stored = getStoredClub();
          if (!stored) {
            try {
              const c = await getClubByUserIdOrEmail(firebaseUser.uid, firebaseUser.email ?? null);
              if (c) {
                saveClub(c);
                stored = c;
              }
            } catch {
              stored = null;
            }
          }
          setClub(stored);
        } else {
          setClub(null);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    });
    const timeout = setTimeout(() => {
      if (!cancelled) setAuthChecked(true);
    }, 5000);
    return () => {
      cancelled = true;
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  // Загрузка кортов и броней из Firestore при наличии клуба с clubId
  // Если кортов нет, но у клуба указано courtsCount — создаём подколлекцию courts (для старых клубов)
  useEffect(() => {
    if (!club?.clubId) {
      setCourts([]);
      setBookings([]);
      setScheduleLoading(false);
      return;
    }
    let cancelled = false;
    setScheduleLoading(true);
    (async () => {
      try {
        let courtsList = await getCourts(club.clubId!);
        if (cancelled) return;
        if (courtsList.length === 0 && (club.courtsCount ?? 0) > 0) {
          courtsList = await ensureCourts(club.clubId!, club.courtsCount!);
          if (cancelled) return;
        }
        setCourts(courtsList);
        const list = await getBookings(club.clubId!, courtsList);
        if (cancelled) return;
        setBookings(list);
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [club?.clubId, club?.courtsCount]);

  // Обновлять список бронирований раз в минуту
  useEffect(() => {
    if (!club?.clubId || courts.length === 0) return;
    const loadBookings = async () => {
      const list = await getBookings(club.clubId, courts);
      setBookings(list);
    };
    const intervalId = setInterval(loadBookings, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [club?.clubId, courts]);

  // При первой загрузке без параметров — записать текущую дату и вид в URL
  useEffect(() => {
    if (!searchParams.get('date') && !searchParams.get('view')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('date', selectedDate);
          next.set('view', viewMode);
          return next;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Синхронизация даты и режима просмотра с URL (при переходе назад/вперёд по истории)
  // Базовый URL без параметра date — всегда показываем сегодня
  useEffect(() => {
    const dateFromUrl = parseDateFromUrl(searchParams.toString());
    setSelectedDateState(dateFromUrl ?? today());
    setViewModeState(parseViewFromUrl(searchParams.toString()));
  }, [searchParams]);

  const handleLogout = () => {
    const auth = getFirebaseAuth();
    if (auth) signOut(auth);
    clearClub();
    setClub(null);
    setUser(null);
  };

  // Список кортов и прайс по кортам — считаем до любых return, чтобы порядок хуков не менялся
  // Если все корты имеют одинаковое имя (например, "Корт 1"), используем их order для генерации правильных имён
  const courtNames = useMemo(() => {
    const expectedCount = club?.courtsCount ?? 1;
    if (courts.length === 0) {
      return Array.from({ length: expectedCount }, (_, i) => `Корт ${i + 1}`);
    }
    // Сортируем по order
    const sorted = [...courts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    // Проверяем, все ли корты имеют одинаковое имя
    const firstName = sorted[0]?.name ?? '';
    const allSameName = sorted.length > 0 && sorted.every(c => c.name === firstName);
    
    if (allSameName && sorted.length > 1) {
      // Если все корты имеют одинаковое имя, генерируем имена на основе order или индекса
      return sorted.slice(0, expectedCount).map((c, idx) => {
        // Используем order, если он уникален и больше 0, иначе используем индекс + 1
        const order = (c.order && c.order > 0) ? c.order : (idx + 1);
        return `Корт ${order}`;
      });
    }
    
    // Иначе используем реальные имена, убирая дубликаты
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const court of sorted) {
      if (!seen.has(court.name) && unique.length < expectedCount) {
        seen.add(court.name);
        unique.push(court.name);
      }
    }
    
    // Если после дедупликации кортов меньше, чем должно быть, дополняем правильными именами
    if (unique.length < expectedCount) {
      for (let i = unique.length + 1; i <= expectedCount; i++) {
        const name = `Корт ${i}`;
        if (!seen.has(name)) {
          unique.push(name);
        }
      }
    }
    
    // Ограничиваем до expectedCount
    return unique.slice(0, expectedCount);
  }, [courts, club?.courtsCount]);
  const pricingByCourt = useMemo(() => {
    const r: Record<string, import('../lib/clubStorage').ClubData['pricing']> = {};
    courtNames.forEach((name) => {
      const court = courts.find((c) => c.name === name);
      r[name] = court?.pricing ?? club?.pricing ?? undefined;
    });
    return r;
  }, [courts, club?.pricing, courtNames]);
  const visibleBookings = useMemo(
    () => bookings.filter((b) => b.status !== 'canceled'),
    [bookings]
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Загрузка…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Клуб не найден для этого аккаунта.</p>
          <Link to="/signup" className="text-blue-600 font-medium hover:underline">
            Зарегистрировать клуб
          </Link>
        </div>
      </div>
    );
  }

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

  const loadBookings = async () => {
    if (!club?.clubId || courts.length === 0) return;
    const list = await getBookings(club.clubId, courts);
    setBookings(list);
  };

  const handleAddBooking = async (booking: Omit<Booking, 'id'>, bookingId?: string, options?: BookingSaveOptions) => {
    if (!club?.clubId) {
      alert('Клуб не загружен. Обновите страницу.');
      return;
    }
    if (courts.length === 0) {
      alert('Список кортов ещё загружается или не создан. Подождите несколько секунд и попробуйте снова, либо обновите страницу.');
      return;
    }

    if (bookingId) {
      try {
        await updateBookingInFirestore(club.clubId, bookingId, booking, courts);
        await loadBookings();
        setModalOpen(false);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Не удалось обновить бронь.');
      }
      return;
    }

    if (booking.isRecurring && booking.recurringEndDate) {
      const startDate = new Date(booking.date);
      const endDate = new Date(booking.recurringEndDate);
      let currentDate = new Date(startDate);
      let created = 0;
      const skippedDates: string[] = [];

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const hasConflict = visibleBookings.some(b => {
          if (b.courtId !== booking.courtId || b.date !== dateStr) return false;
          const existingStart = parseInt(b.startTime.replace(':', ''));
          const existingEnd = parseInt(b.endTime.replace(':', ''));
          const newStart = parseInt(booking.startTime.replace(':', ''));
          const newEnd = parseInt(booking.endTime.replace(':', ''));
          return (newStart < existingEnd && newEnd > existingStart);
        });
        if (!hasConflict) {
          try {
            await addBookingToFirestore(
              club.clubId,
              { ...booking, date: dateStr },
              courts
            );
            created++;
          } catch {
            skippedDates.push(new Date(dateStr).toLocaleDateString('ru-RU'));
          }
        } else {
          skippedDates.push(new Date(dateStr).toLocaleDateString('ru-RU'));
        }
        currentDate.setDate(currentDate.getDate() + 7);
      }

      await loadBookings();
      setModalOpen(false);
      if (created === 0) {
        setRecurringResult({ type: 'none' });
      } else if (skippedDates.length > 0) {
        setRecurringResult({ type: 'partial', created, skippedDates });
      } else {
        setRecurringResult({ type: 'success', created });
      }
      return;
    }

    const hasConflict = visibleBookings.some(b => {
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

    try {
      await addBookingToFirestore(club.clubId, booking, courts);
      await loadBookings();

      if (options?.needPaymentLink) {
        try {
          const description = `Бронь корта: ${booking.courtId}, ${booking.date} ${booking.startTime}–${booking.endTime}. ${booking.comment}`.slice(0, 128);
          const url = await createPaymentLink({
            amount: options.amount,
            description,
          });
          setPaymentLink(url);
        } catch (e) {
          console.error(e);
          alert(e instanceof Error ? e.message : 'Не удалось создать ссылку на оплату. Бронирование сохранено.');
          setModalOpen(false);
        }
      } else {
        setModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Не удалось сохранить бронь.');
    }
  };

  const handleCloseModal = () => {
    setPaymentLink(null);
    setModalOpen(false);
    setSelectedSlot(null);
    setEditingBooking(null);
  };

  const handleCancelBookingFromCalendar = async (booking: Booking) => {
    if (!club?.clubId || courts.length === 0) return;
    try {
      const payload: Omit<Booking, 'id'> = {
        courtId: booking.courtId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        activity: booking.activity,
        comment: booking.comment,
        color: booking.color,
        isRecurring: booking.isRecurring,
        recurringEndDate: booking.recurringEndDate,
        status: 'canceled',
      };
      await updateBookingInFirestore(club.clubId, booking.id, payload, courts);
      await loadBookings();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Не удалось отменить бронь.');
    }
  };

  /** Отменить эту и все последующие брони серии (тот же корт, время, дата >= текущей). */
  const handleCancelSeriesFromModal = async (booking: Booking) => {
    if (!club?.clubId || courts.length === 0) return;
    const sameSeries = bookings.filter(
      (b) =>
        b.status !== 'canceled' &&
        b.courtId === booking.courtId &&
        b.startTime === booking.startTime &&
        b.endTime === booking.endTime &&
        b.date >= booking.date
    );
    setCancelInProgress(true);
    try {
      for (const b of sameSeries) {
        const payload: Omit<Booking, 'id'> = {
          courtId: b.courtId,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          activity: b.activity,
          comment: b.comment,
          color: b.color,
          isRecurring: b.isRecurring,
          recurringEndDate: b.recurringEndDate,
          status: 'canceled',
        };
        await updateBookingInFirestore(club.clubId, b.id, payload, courts);
      }
      await loadBookings();
      setBookingToCancelSeries(null);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Не удалось отменить серию.');
    } finally {
      setCancelInProgress(false);
    }
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    const step = viewMode === 'day' ? 1 : 7;
    currentDate.setDate(currentDate.getDate() + (direction === 'prev' ? -step : step));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {user && !user.emailVerified && (
          <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900" role="status">
            Подтвердите почту: на <strong>{user.email || 'ваш email'}</strong> отправлено письмо со ссылкой. Перейдите по ссылке в письме, чтобы подтвердить адрес.
          </div>
        )}
        <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="mb-3 text-xl">Управление бронированием кортов</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 truncate max-w-[200px]" title={club.name}>
              {club.name}
            </span>
            <Link
              to="/account"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title="Аккаунт"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Аккаунт</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
        <div className="mb-3 -mt-1">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('day')}
              >
                <Calendar className="w-5 h-5" />
                <span>Дневной вид</span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('week')}
              >
                <CalendarDays className="w-5 h-5" />
                <span>Расписание по неделям</span>
              </button>
            </div>

            {viewMode === 'day' && (
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                  onClick={() => handleDateChange('prev')}
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Предыдущий день</span>
                </button>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-medium text-gray-600">Выберите дату:</span>
                    <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                  onClick={() => handleDateChange('next')}
                >
                  <span>Следующий день</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            {viewMode === 'day' ? (
              <BookingCalendar
                courts={courtNames}
                selectedDate={selectedDate}
                bookings={visibleBookings}
                openingTime={club?.openingTime ?? '08:00'}
                closingTime={club?.closingTime ?? '22:00'}
                onSlotClick={handleSlotClick}
                onCancelBooking={(b) => setBookingToCancel(b)}
                onBookingClick={handleBookingClick}
              />
            ) : (
              <WeeklySchedule
                courts={courtNames}
                selectedDate={selectedDate}
                bookings={visibleBookings}
                openingTime={club?.openingTime ?? '08:00'}
                closingTime={club?.closingTime ?? '22:00'}
                onWeekChange={handleDateChange}
                onBookingClick={handleBookingClick}
                onSlotClick={handleSlotClick}
              />
            )}
            {scheduleLoading && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg pointer-events-auto"
                style={{ zIndex: 9999 }}
                aria-busy="true"
                aria-label="Загрузка"
              >
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {modalOpen && (selectedSlot || editingBooking || paymentLink) && (
            <BookingModal
              courts={courtNames}
              courtId={editingBooking?.courtId || selectedSlot?.courtId || ''}
              time={editingBooking?.startTime || selectedSlot?.time || ''}
              date={editingBooking?.date || selectedSlot?.date || selectedDate}
              openingTime={club?.openingTime ?? '08:00'}
              closingTime={club?.closingTime ?? '22:00'}
              initialDuration={selectedSlot?.duration}
              existingBooking={editingBooking || undefined}
              paymentLink={paymentLink}
              pricingByCourt={pricingByCourt}
              onClose={handleCloseModal}
              onSave={handleAddBooking}
              onRequestCancelBooking={(booking) => {
                setBookingToCancel(booking);
                handleCloseModal();
              }}
              onRequestCancelSeries={(booking) => {
                setBookingToCancelSeries(booking);
                handleCloseModal();
              }}
            />
          )}

          {recurringResult !== null && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              style={{ zIndex: 10000 }}
              onClick={() => setRecurringResult(null)}
            >
              <div
                className={`
                  w-[min(100%,24rem)] min-w-[280px] shrink-0
                  bg-white rounded-2xl shadow-2xl overflow-hidden relative
                  ${recurringResult.type === 'success' ? 'ring-1 ring-emerald-200' : ''}
                  ${recurringResult.type === 'partial' ? 'ring-1 ring-amber-200' : ''}
                  ${recurringResult.type === 'none' ? 'ring-1 ring-red-200' : ''}
                `}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Акцентная полоса сверху */}
                <div
                  className={`
                    h-1 w-full rounded-t-2xl
                    ${recurringResult.type === 'success' ? 'bg-emerald-500' : ''}
                    ${recurringResult.type === 'partial' ? 'bg-amber-500' : ''}
                    ${recurringResult.type === 'none' ? 'bg-red-500' : ''}
                  `}
                />
                <button
                  type="button"
                  onClick={() => setRecurringResult(null)}
                  className="absolute p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors z-10"
                  style={{ top: '1rem', right: '1rem', left: 'auto' }}
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="px-10 py-8 pt-10 pb-10">
                  {recurringResult.type === 'success' && (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-5">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={2} />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Готово</h2>
                      <p className="text-gray-600 leading-relaxed">
                        Успешно создано <strong className="text-emerald-700">{recurringResult.created}</strong>{' '}
                        {recurringResult.created === 1 ? 'регулярное бронирование' : 'регулярных бронирований'}.
                      </p>
                    </div>
                  )}
                  {recurringResult.type === 'partial' && (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-5">
                        <AlertCircle className="w-10 h-10 text-amber-600" strokeWidth={2} />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Создано частично</h2>
                      <p className="text-gray-600 leading-relaxed mb-3">
                        Создано бронирований: <strong className="text-amber-700">{recurringResult.created}</strong>.
                      </p>
                      <p className="text-sm text-gray-500 leading-relaxed mb-2">
                        Пропущено дат: {recurringResult.skippedDates.length}{' '}
                        (заняты или ошибка):{' '}
                        {recurringResult.skippedDates.slice(0, 5).join(', ')}
                        {recurringResult.skippedDates.length > 5 ? '…' : ''}
                      </p>
                      <p className="text-gray-600 text-sm">Остальные даты добавлены в календарь.</p>
                    </div>
                  )}
                  {recurringResult.type === 'none' && (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-5">
                        <AlertCircle className="w-10 h-10 text-red-600" strokeWidth={2} />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Ни одного не создано</h2>
                      <p className="text-gray-600 leading-relaxed">
                        Все выбранные слоты уже заняты или произошла ошибка. Выберите другое время или даты.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setRecurringResult(null)}
                    className="mt-8 w-full py-3.5 px-5 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
                  >
                    Понятно
                  </button>
                </div>
              </div>
            </div>
          )}

          {bookingToCancel !== null && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
              style={{ zIndex: 10000 }}
              onClick={() => !cancelInProgress && setBookingToCancel(null)}
            >
              <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center relative"
                onClick={(e) => e.stopPropagation()}
              >
                {cancelInProgress && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg z-10">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-label="Загрузка" />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Отменить бронирование?</h2>
                <p className="text-sm text-gray-600 mb-6">Вы действительно хотите отменить бронирование?</p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    disabled={cancelInProgress}
                    onClick={() => setBookingToCancel(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Нет
                  </button>
                  <button
                    type="button"
                    disabled={cancelInProgress}
                    onClick={async () => {
                      if (!bookingToCancel) return;
                      setCancelInProgress(true);
                      try {
                        await handleCancelBookingFromCalendar(bookingToCancel);
                        setBookingToCancel(null);
                      } finally {
                        setCancelInProgress(false);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Да
                  </button>
                </div>
              </div>
            </div>
          )}

          {bookingToCancelSeries !== null && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
              style={{ zIndex: 10000 }}
              onClick={() => !cancelInProgress && setBookingToCancelSeries(null)}
            >
              <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center relative"
                onClick={(e) => e.stopPropagation()}
              >
                {cancelInProgress && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg z-10">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-label="Загрузка" />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Отменить серию?</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Будет отменено это занятие и все последующие в этой серии. Прошлые занятия сохранятся.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    disabled={cancelInProgress}
                    onClick={() => setBookingToCancelSeries(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Нет
                  </button>
                  <button
                    type="button"
                    disabled={cancelInProgress}
                    onClick={async () => {
                      if (!bookingToCancelSeries) return;
                      await handleCancelSeriesFromModal(bookingToCancelSeries);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Да
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
