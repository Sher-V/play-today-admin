import { getFirebaseFunctions } from './firebase';
import { httpsCallable } from 'firebase/functions';

export interface CreatePaymentLinkParams {
  amount: number;
  description: string;
  returnUrl?: string;
}

/**
 * Создаёт платёж в ЮKassa через Cloud Function и возвращает ссылку на оплату.
 * Требуется задеплоенная функция createPaymentLink и настройка YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY.
 */
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const fn = getFirebaseFunctions();
  if (!fn) {
    throw new Error('Firebase не настроен');
  }

  const callable = httpsCallable<CreatePaymentLinkParams, { paymentUrl: string }>(fn, 'createPaymentLink');
  const returnUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const res = await callable({ ...params, returnUrl });
  const data = res.data;
  if (!data?.paymentUrl) {
    throw new Error('Не получена ссылка на оплату');
  }
  return data.paymentUrl;
}
