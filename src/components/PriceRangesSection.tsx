import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PriceSlot } from '../types/club-slots';
import './PriceRangesSection.css';

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 6; h <= 23; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  slots.push('24:00');
  return slots;
})();

export interface PriceRangesSectionProps {
  title: string;
  slots: PriceSlot[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdateSlot: (index: number, field: keyof PriceSlot, value: string | number) => void;
}

export function PriceRangesSection({ title, slots, onAdd, onRemove, onUpdateSlot }: PriceRangesSectionProps) {
  return (
    <div className="price-ranges">
      <div className="price-ranges__header">
        <h3 className="price-ranges__title">{title}</h3>
        <button
          type="button"
          className="price-ranges__btn-add"
          onClick={onAdd}
          aria-label="Добавить диапазон"
        >
          <Plus className="price-ranges__btn-add-icon" />
          Добавить диапазон
        </button>
      </div>
      <div className="price-ranges__list">
        {slots.map((slot, index) => (
          <div key={index} className="price-ranges__row">
            <select
              value={slot.startTime}
              onChange={(e) => onUpdateSlot(index, 'startTime', e.target.value)}
              className="price-ranges__time"
              aria-label="Начало"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="price-ranges__dash">—</span>
            <select
              value={slot.endTime}
              onChange={(e) => onUpdateSlot(index, 'endTime', e.target.value)}
              className="price-ranges__time"
              aria-label="Конец"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="price-ranges__input-wrap">
              <input
                type="number"
                min={0}
                step={50}
                value={slot.priceRub}
                onChange={(e) => onUpdateSlot(index, 'priceRub', Number(e.target.value) || 0)}
                className="price-ranges__input"
                placeholder="₽"
                aria-label="Цена"
              />
              <span className="price-ranges__currency">₽</span>
            </div>
            {slots.length > 1 && (
              <button
                type="button"
                className="price-ranges__btn-remove"
                onClick={() => onRemove(index)}
                aria-label="Удалить"
              >
                <Trash2 className="price-ranges__btn-remove-icon" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
