# Админская документация

## Структура данных клуба и слотов (Firestore)

Используется для клуба в Воронеже (и при необходимости в других городах). Свободные слоты вычисляются по кортам и броням: временные окна без броней считаются свободными.

### Иерархия коллекций

```
clubs                          — коллекция клубов
  {clubId}                     — документ клуба
    courts                     — подколлекция кортов
      {courtId}                 — документ корта
    bookings                   — подколлекция броней
      {bookingId}               — документ брони
```

### Документ клуба (Club)

Путь: `clubs/{clubId}`

| Поле        | Тип     | Описание                                      |
|-------------|---------|-----------------------------------------------|
| id          | string  | Идентификатор клуба                           |
| name        | string  | Название клуба                                |
| city        | string  | Город (например `voronezh`, см. `constants/cities`) |
| courtOrder  | string[]| (опц.) Порядок кортов для отображения         |
| createdAt   | Date    | (опц.) Дата создания                          |
| updatedAt   | Date    | (опц.) Дата обновления                        |

### Документ корта (Court)

Путь: `clubs/{clubId}/courts/{courtId}`

| Поле      | Тип    | Описание                                      |
|-----------|--------|-----------------------------------------------|
| id        | string | Идентификатор корта                            |
| name      | string | Название корта                                 |
| order     | number | (опц.) Порядок в списке кортов (меньше = выше) |
| createdAt | Date   | (опц.) Дата создания                           |
| updatedAt | Date   | (опц.) Дата обновления                         |

### Документ брони (ClubBooking)

Путь: `clubs/{clubId}/bookings/{bookingId}`

| Поле             | Тип       | Описание |
|-------------------|------------|----------|
| id                | string     | Идентификатор брони |
| courtId           | string     | ID корта в этом клубе (документ из подколлекции `courts`) |
| type              | BookingType| Тип брони: см. ниже |
| startTime         | Timestamp  | Время начала брони |
| endTime           | Timestamp  | Время окончания брони |
| comment           | string     | Комментарий к брони |
| firstSessionDate  | Timestamp \| null | Дата первого занятия в серии. Для типов `regular` и `group` — обязательно |
| lastSessionDate   | Timestamp \| null | Дата последнего занятия в серии. Для типов `regular` и `group` — обязательно |
| createdAt         | Date       | (опц.) Дата создания |
| updatedAt         | Date       | (опц.) Дата обновления |

### Типы бронирований (BookingType)

| Значение   | Подпись     | Примечание |
|------------|-------------|------------|
| one_time   | Разовая     | Одно занятие, firstSessionDate/lastSessionDate можно не заполнять |
| group      | Группа      | Серия занятий: заполнять firstSessionDate и lastSessionDate |
| regular    | Регулярная  | Серия занятий: заполнять firstSessionDate и lastSessionDate |
| tournament | Турнир      | Турнир, firstSessionDate/lastSessionDate по необходимости |

Для типов `regular` и `group` в Firestore хранятся даты первого и последнего занятия серии (как `Timestamp`).

### Составные индексы Firestore

Для подколлекции `bookings` (`clubs/{clubId}/bookings`) рекомендуется создать индексы:

1. **Все брони корта за период**  
   - `courtId` (Ascending), `startTime` (Ascending)

2. **Все брони за день**  
   - `startTime` (Ascending), `courtId` (Ascending)

Создание: Firebase Console → Firestore → Indexes или через `firestore.indexes.json`.

### Код

Типы и константы: `src/types/club-slots.ts`.
