/**
 * Структура данных клуба и слотов (Firestore).
 * Иерархия: clubs/{clubId} → courts/{courtId}, bookings/{bookingId}
 */

/** Один диапазон времени с ценой за аренду корта (руб/час или за слот) */
export interface PriceSlot {
  startTime: string; // HH:mm
  endTime: string;
  priceRub: number;
}

/** Цены по типам дней: будние и выходные */
export interface ClubPricing {
  weekday: PriceSlot[];
  weekend: PriceSlot[];
}

/** Типы бронирований (как в ADMIN_README) */
export type BookingType = 'one_time' | 'group' | 'regular' | 'tournament' | 'personal_training';

/** Документ клуба: clubs/{clubId} */
export interface ClubDoc {
  id: string;
  name: string;
  city?: string;
  courtOrder?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Документ корта: clubs/{clubId}/courts/{courtId} */
export interface CourtDoc {
  id: string;
  name: string;
  order?: number;
  /** Прайс корта (если задан — используется для расчёта суммы; иначе берётся прайс клуба) */
  pricing?: ClubPricing;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Документ брони: clubs/{clubId}/bookings/{bookingId} */
export interface ClubBookingDoc {
  id: string;
  courtId: string;
  type: BookingType;
  startTime: unknown; // Firestore Timestamp
  endTime: unknown;
  comment: string;
  /** Тренер (для типа group и personal_training) */
  coach?: string;
  firstSessionDate?: unknown | null;
  lastSessionDate?: unknown | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  one_time: 'Разовая',
  group: 'Группа',
  regular: 'Регулярная',
  tournament: 'Турнир',
  personal_training: 'Персональная тренировка',
};
