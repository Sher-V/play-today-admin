import type { ClubPricing } from '../types/club-slots';

const STORAGE_KEY = 'tennis_club_registration';

/** Данные клуба (форма + локальное хранение). clubId заполняется при загрузке из Firestore. */
export interface ClubData {
  clubId?: string;
  name: string;
  email: string;
  city?: string;
  /** Ссылка на место клуба в Яндекс.Картах */
  yandexMapsUrl?: string;
  courtsCount: number;
  openingTime: string;
  closingTime: string;
  /** Цены за аренду: диапазоны времени для будних и выходных. */
  pricing?: ClubPricing;
}

function parsePricing(raw: unknown): ClubPricing | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const weekday = Array.isArray(o.weekday)
    ? (o.weekday as unknown[]).filter(
        (x): x is { startTime: string; endTime: string; priceRub: number } =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).startTime === 'string' &&
          typeof (x as Record<string, unknown>).endTime === 'string' &&
          typeof (x as Record<string, unknown>).priceRub === 'number'
      )
    : [];
  const weekend = Array.isArray(o.weekend)
    ? (o.weekend as unknown[]).filter(
        (x): x is { startTime: string; endTime: string; priceRub: number } =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).startTime === 'string' &&
          typeof (x as Record<string, unknown>).endTime === 'string' &&
          typeof (x as Record<string, unknown>).priceRub === 'number'
      )
    : [];
  return weekday.length || weekend.length ? { weekday, weekend } : undefined;
}

export function getStoredClub(): ClubData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ClubData;
    if (!data.name || typeof data.courtsCount !== 'number') return null;
    if (typeof data.email !== 'string') data.email = '';
    if (typeof data.city !== 'string') data.city = '';
    if (data.pricing !== undefined) data.pricing = parsePricing(data.pricing) ?? undefined;
    return data;
  } catch {
    return null;
  }
}

export function saveClub(data: ClubData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearClub(): void {
  localStorage.removeItem(STORAGE_KEY);
}
