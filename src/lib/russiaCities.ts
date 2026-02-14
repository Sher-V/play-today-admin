/**
 * Города России из открытого API (GitHub: pensnarik/russian-cities).
 * Формат ответа: массив объектов { name, subject, district, population, coords }.
 */
const RUSSIA_CITIES_URL =
  'https://raw.githubusercontent.com/pensnarik/russian-cities/master/russian-cities.json';

export interface RussiaCityItem {
  name: string;
  subject: string;
  district?: string;
  population?: number;
  coords?: { lat: string; lon: string };
}

let cachedCities: string[] | null = null;

/**
 * Загружает список городов России и возвращает отсортированные по имени названия.
 * Результат кэшируется.
 */
export async function getRussiaCities(): Promise<string[]> {
  if (cachedCities) return cachedCities;

  const res = await fetch(RUSSIA_CITIES_URL);
  if (!res.ok) throw new Error(`Не удалось загрузить список городов: ${res.status}`);

  const data = (await res.json()) as RussiaCityItem[];
  const names = [...new Set(data.map((c) => c.name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
  cachedCities = names;
  return names;
}
