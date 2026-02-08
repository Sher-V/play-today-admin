import type { ClubPricing, PriceSlot } from '../types/club-slots';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Считает стоимость аренды (руб) по прайсу клуба для заданной даты и интервала времени.
 * Цена в PriceSlot трактуется как руб/час для этого диапазона.
 * Будние = Пн–Пт (1–5), выходные = Сб–Вс (0, 6).
 */
export function getPriceForBooking(
  pricing: ClubPricing,
  date: string,
  startTime: string,
  endTime: string
): number {
  const d = new Date(date + 'T12:00:00');
  const dayOfWeek = d.getDay(); // 0 Вс, 1 Пн, ..., 6 Сб
  const slots: PriceSlot[] =
    dayOfWeek >= 1 && dayOfWeek <= 5 ? pricing.weekday : pricing.weekend;
  if (!slots.length) return 0;

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  let total = 0;

  for (const slot of slots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    const overlapStart = Math.max(slotStart, startMin);
    const overlapEnd = Math.min(slotEnd, endMin);
    if (overlapEnd > overlapStart) {
      const durationHours = (overlapEnd - overlapStart) / 60;
      total += durationHours * slot.priceRub;
    }
  }

  return Math.round(total);
}

/** Есть ли у клуба настроенные цены для расчёта (хотя бы один слот). */
export function hasPricing(pricing: ClubPricing | undefined): boolean {
  if (!pricing) return false;
  return (pricing.weekday?.length ?? 0) > 0 || (pricing.weekend?.length ?? 0) > 0;
}
