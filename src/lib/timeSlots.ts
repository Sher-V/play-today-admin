/**
 * Генерирует слоты времени для расписания на основе времени работы клуба.
 * @param openingTime — время открытия (например, "08:00")
 * @param closingTime — время закрытия (например, "22:00")
 * @returns timeSlots — получасовые слоты для бронирования; hourlyTimeSlots — часы для отображения
 */
export function generateTimeSlots(
  openingTime: string,
  closingTime: string
): { timeSlots: string[]; hourlyTimeSlots: string[] } {
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const openMinutes = openH * 60 + (openM ?? 0);
  const closeMinutes = closeH * 60 + (closeM ?? 0);

  const slots: string[] = [];
  const hourlySet = new Set<string>();

  for (let m = openMinutes; m < closeMinutes; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    slots.push(time);
    if (min === 0) {
      hourlySet.add(time);
    }
  }

  const hourlyTimeSlots = Array.from(hourlySet).sort();
  return { timeSlots: slots, hourlyTimeSlots };
}
