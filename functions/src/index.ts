import * as functions from 'firebase-functions';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Для локального эмулятора: загрузка .env из папки functions
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const YOOKASSA_API = 'https://api.yookassa.ru/v3/payments';

interface CreatePaymentLinkData {
  amount: number; // в рублях
  description: string;
  returnUrl?: string;
}

/**
 * Создаёт платёж в ЮKassa и возвращает ссылку на оплату (confirmation_url).
 * В Firebase Console задайте секреты: YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY.
 */
export const createPaymentLink = functions.https.onCall(
  async (data: CreatePaymentLinkData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Требуется авторизация'
      );
    }

    const shopId = process.env.YOOKASSA_SHOP_ID ?? functions.config().yookassa?.shop_id;
    const secretKey = process.env.YOOKASSA_SECRET_KEY ?? functions.config().yookassa?.secret_key;

    if (!shopId || !secretKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Не настроены YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY. Задайте их в Firebase Console (Functions → Секреты) или firebase functions:config:set yookassa.shop_id=... yookassa.secret_key=...'
      );
    }

    const amount = Number(data?.amount);
    const description = String(data?.description ?? 'Оплата бронирования').slice(0, 128);
    const returnUrl = data?.returnUrl ?? 'https://example.com';

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Укажите корректную сумму (положительное число)'
      );
    }

    const value = amount.toFixed(2);
    const idempotenceKey = crypto.randomUUID();

    const body = {
      amount: { value, currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description,
    };

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    const res = await fetch(YOOKASSA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('YooKassa error:', res.status, errText);
      throw new functions.https.HttpsError(
        'internal',
        'Не удалось создать платёж в ЮKassa. Проверьте настройки и логи.'
      );
    }

    const json = (await res.json()) as {
      confirmation?: { confirmation_url?: string };
      status?: string;
    };

    const confirmationUrl = json.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      throw new functions.https.HttpsError(
        'internal',
        'ЮKassa не вернула ссылку на оплату'
      );
    }

    return { paymentUrl: confirmationUrl };
  }
);
