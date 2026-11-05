import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ZaloPaySuccess {
  providerOrderId: string;
  transactionId: string;
  amount: number;
}

// JSON.parse's source context preserves ZaloPay's int64 IDs on Node.js 22.
function parseResponse(text: string): Record<string, any> {
  const parse = JSON.parse as (text: string, reviver: (key: string, value: any, context?: { source: string }) => any) => any;
  const result = parse(text, (key, value, context) => {
    if (key === 'zp_trans_id' && typeof value === 'number') {
      if (context?.source) return context.source;
      if (!Number.isSafeInteger(value)) throw new Error('Unsafe transaction ID');
      return String(value);
    }
    return value;
  });
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid response');
  return result;
}

@Injectable()
export class ZaloPaySandboxGateway {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    try { this.settings(); return true; } catch { return false; }
  }

  assertReady() { this.settings(); }

  async create(payment: Payment, userId: string, orderNumber: number) {
    const settings = this.settings();
    const redirect = new URL(settings.redirect);
    redirect.pathname = `${redirect.pathname.replace(/\/$/, '')}/orders/${encodeURIComponent(payment.orderId)}/payment`;
    const embed = JSON.stringify({
      redirecturl: redirect.href,
      preferred_payment_method: payment.method === 'BANK_CARD' ? ['domestic_card', 'account'] : ['zalopay_wallet'],
    });
    const item = '[]';
    const appTime = payment.createdAt.getTime();
    const amount = Number(payment.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    const body: Record<string, string> = {
      app_id: settings.appId, app_user: userId, app_trans_id: payment.providerOrderId,
      app_time: String(appTime), amount: String(amount), bank_code: '', embed_data: embed, item,
      expire_duration_seconds: '900', description: `BrewLite Sandbox - Thanh toán đơn #${orderNumber}`,
      mac: this.mac(settings.key1, [settings.appId, payment.providerOrderId, userId, amount, appTime, embed, item].join('|')),
    };
    // Callback is optional: without a public HTTPS URL the client polls the
    // query endpoint instead (see the "Kiểm tra kết quả" button).
    if (settings.callback) body.callback_url = settings.callback;
    const result = await this.post('create', body);
    if (result.return_code === 2) return { accepted: false as const };
    if (result.return_code !== 1) throw new ServiceUnavailableException('Chưa xác định được kết quả tạo thanh toán ZaloPay');
    try {
      const url = new URL(result.order_url);
      // Never redirect the customer to an arbitrary host supplied in a malformed response.
      if (url.protocol !== 'https:' || !['sbgateway.zalopay.vn', 'sbcheckout.zalopay.vn', 'qcgateway.zalopay.vn'].includes(url.hostname)
        || url.username || url.password || (url.port && url.port !== '443')) throw new Error();
      return { accepted: true as const, paymentUrl: url.href };
    } catch {
      throw new ServiceUnavailableException('ZaloPay chưa trả về URL thanh toán sandbox hợp lệ');
    }
  }

  async query(providerOrderId: string) {
    const settings = this.settings();
    const result = await this.post('query', {
      app_id: settings.appId, app_trans_id: providerOrderId,
      mac: this.mac(settings.key1, `${settings.appId}|${providerOrderId}|${settings.key1}`),
    });
    if (![1, 2, 3].includes(result.return_code)
      || (result.return_code === 2 && !Number.isInteger(result.sub_return_code))
      || (result.is_processing !== undefined && typeof result.is_processing !== 'boolean')) {
      throw new ServiceUnavailableException('Chưa xác định được trạng thái giao dịch ZaloPay');
    }
    // These codes reject the query itself; they do not establish payment failure.
    if (result.return_code === 2 && [-92, -401, -402, -429, -500, -999].includes(result.sub_return_code)) {
      throw new ServiceUnavailableException('Chưa xác định được trạng thái giao dịch ZaloPay');
    }
    return {
      code: result.return_code as number,
      subCode: Number.isInteger(result.sub_return_code) ? result.sub_return_code as number : null,
      processing: result.return_code === 3 ? true : (result.is_processing as boolean | undefined) ?? null,
      success: result.return_code === 1 ? this.success(result, providerOrderId) : null,
    };
  }

  async cancel(providerOrderId: string) {
    const settings = this.settings();
    const result = await this.post('cancel', {
      app_id: settings.appId, app_trans_id: providerOrderId,
      mac: this.mac(settings.key1, `${settings.appId}|${providerOrderId}|${settings.key1}`),
    });
    if (result.return_code !== 1) throw new ServiceUnavailableException('ZaloPay chưa xác nhận hủy giao dịch. Vui lòng kiểm tra kết quả trước khi thử lại.');
  }

  verifyCallback(body: unknown): ZaloPaySuccess {
    const settings = this.settings();
    const value = body as { data?: unknown; mac?: unknown; type?: unknown };
    if (!value || typeof value.data !== 'string' || value.data.length > 65536
      || typeof value.mac !== 'string' || !/^[a-f\d]{64}$/i.test(value.mac)
      || (value.type !== undefined && value.type !== 1)) {
      throw new BadRequestException('Invalid callback');
    }
    const expected = Buffer.from(this.mac(settings.key2, value.data), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(value.mac, 'hex'))) throw new BadRequestException('Invalid callback MAC');
    try {
      const data = parseResponse(value.data);
      if (String(data.app_id) !== settings.appId || typeof data.app_trans_id !== 'string'
        || !/^\d{6}_[a-f\d]{32}$/.test(data.app_trans_id)) throw new Error();
      return this.success(data, data.app_trans_id);
    } catch {
      throw new BadRequestException('Invalid callback data');
    }
  }

  private success(result: Record<string, any>, providerOrderId: string): ZaloPaySuccess {
    if (typeof result.zp_trans_id !== 'string' || !/^[1-9]\d{0,29}$/.test(result.zp_trans_id)
      || !Number.isSafeInteger(result.amount) || result.amount <= 0 || result.amount > 999999999999) {
      throw new ServiceUnavailableException('Thông tin giao dịch ZaloPay không hợp lệ');
    }
    return { providerOrderId, transactionId: result.zp_trans_id, amount: result.amount };
  }

  private mac(key: string, data: string) { return createHmac('sha256', key).update(data).digest('hex'); }

  private settings() {
    const appId = this.config.get<string>('ZALOPAY_APP_ID') || '';
    const key1 = this.config.get<string>('ZALOPAY_KEY1') || '';
    const key2 = this.config.get<string>('ZALOPAY_KEY2') || '';
    try {
      if (this.config.get<string>('ZALOPAY_SANDBOX_ENABLED') !== 'true'
        || !['development', 'test'].includes(this.config.get<string>('NODE_ENV'))
        || !/^[1-9]\d{0,9}$/.test(appId) || !key1.trim() || !key2.trim()) throw new Error();
      const rawCallback = (this.config.get<string>('ZALOPAY_CALLBACK_URL') || '').trim();
      let callback: string | null = null;
      if (rawCallback) {
        const parsed = new URL(rawCallback);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash
          || (parsed.port && parsed.port !== '443')) throw new Error();
        callback = parsed.href;
      }
      const redirect = new URL(this.config.get<string>('ZALOPAY_REDIRECT_URL'));
      if (!['http:', 'https:'].includes(redirect.protocol) || redirect.username || redirect.password
        || redirect.search || redirect.hash) throw new Error();
      return { appId, key1, key2, callback, redirect: redirect.href };
    } catch {
      throw new ServiceUnavailableException('ZaloPay Sandbox chưa được bật hoặc cấu hình chưa đầy đủ');
    }
  }

  private async post(path: 'create' | 'query' | 'cancel', body: Record<string, string>) {
    try {
      const response = await fetch(`https://sb-openapi.zalopay.vn/v2/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body), signal: AbortSignal.timeout(10000), redirect: 'error',
      });
      if (!response.ok) throw new Error();
      const result = parseResponse(await response.text());
      if (!Number.isInteger(result.return_code)) throw new Error();
      return result;
    } catch {
      throw new ServiceUnavailableException('Không thể xác định kết quả từ ZaloPay Sandbox. Vui lòng đồng bộ lại.');
    }
  }
}
