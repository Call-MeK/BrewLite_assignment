import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ZaloPayTransaction {
  app_id: number;
  app_trans_id: string;
  amount: number;
  zp_trans_id: number | string;
}

export interface ZaloPayQueryResult {
  return_code: number;
  sub_return_code?: number;
  return_message?: string;
  is_processing: boolean;
  amount?: number;
  zp_trans_id?: number | string;
}

@Injectable()
export class ZaloPayService {
  constructor(private readonly config: ConfigService) {}

  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(`Chưa cấu hình ${name}`);
    }
    return value;
  }

  assertConfigured(): void {
    if (!/^[1-9]\d*$/.test(this.required('ZALOPAY_APP_ID'))) {
      throw new ServiceUnavailableException('ZALOPAY_APP_ID không hợp lệ');
    }
    this.required('ZALOPAY_KEY1');
    this.required('ZALOPAY_KEY2');
    this.endpoint();
    let redirect: URL;
    try {
      redirect = new URL(this.required('ZALOPAY_REDIRECT_URL'));
    } catch {
      throw new ServiceUnavailableException('Chưa cấu hình ZALOPAY_REDIRECT_URL hợp lệ');
    }
    if (redirect.username || redirect.password ||
      (redirect.protocol !== 'https:' &&
        !(redirect.protocol === 'http:' && redirect.hostname === 'localhost'))) {
      throw new ServiceUnavailableException('ZALOPAY_REDIRECT_URL phải dùng HTTPS hoặc localhost');
    }
    const callback = this.config.get<string>('ZALOPAY_CALLBACK_URL')?.trim();
    if (callback) {
      let url: URL;
      try { url = new URL(callback); } catch {
        throw new ServiceUnavailableException('ZALOPAY_CALLBACK_URL không hợp lệ');
      }
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new ServiceUnavailableException('ZALOPAY_CALLBACK_URL phải dùng HTTPS');
      }
    }
  }

  private endpoint(): string {
    const endpoint = this.config.get<string>('ZALOPAY_ENDPOINT')?.trim() ||
      'https://sb-openapi.zalopay.vn/v2/create';
    if (endpoint !== 'https://sb-openapi.zalopay.vn/v2/create') {
      throw new ServiceUnavailableException('ZALOPAY_ENDPOINT phải là endpoint sandbox v2/create');
    }
    return endpoint;
  }

  private sign(key: string, data: string): string {
    return createHmac('sha256', key).update(data).digest('hex');
  }

  private async request(endpoint: string, form: Record<string, string>) {
    try {
      const response = await fetch(new URL(endpoint, this.endpoint()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Gateway HTTP error');
      const result = await response.json();
      if (!result || ![1, 2, 3].includes(result.return_code)) {
        throw new Error('Invalid v2 response');
      }
      return result;
    } catch {
      throw new ServiceUnavailableException(
        'Chưa xác định được kết quả từ ZaloPay. Hãy kiểm tra lại giao dịch hiện tại.',
      );
    }
  }

  async create(
    payment: { orderId: string; gatewayOrderId: string; amount: unknown; method: string },
    userId: string,
  ): Promise<{ paymentUrl?: string; failureReason?: string }> {
    this.assertConfigured();
    const amount = Number(payment.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }
    const redirect = new URL(this.required('ZALOPAY_REDIRECT_URL'));
    redirect.pathname = `${redirect.pathname.replace(/\/$/, '')}/${encodeURIComponent(payment.orderId)}`;
    const form = {
      app_id: this.required('ZALOPAY_APP_ID'),
      app_trans_id: payment.gatewayOrderId,
      app_user: userId,
      app_time: String(Date.now()),
      amount: String(amount),
      expire_duration_seconds: '900',
      embed_data: JSON.stringify({ redirecturl: redirect.toString() }),
      item: '[]',
      bank_code: payment.method === 'E_WALLET' ? 'zalopayapp' : 'CC',
      description: `BrewLite - Thanh toán đơn hàng ${payment.orderId}`,
    };
    const data = [form.app_id, form.app_trans_id, form.app_user, form.amount,
      form.app_time, form.embed_data, form.item].join('|');
    const callback = this.config.get<string>('ZALOPAY_CALLBACK_URL')?.trim();
    const result = await this.request('create', {
      ...form, mac: this.sign(this.required('ZALOPAY_KEY1'), data),
      ...(callback ? { callback_url: callback } : {}),
    });
    if (result.return_code !== 1) {
      if (result.return_code !== 2 || [-68, -1, -500, -503].includes(result.sub_return_code)) {
        throw new ServiceUnavailableException('Cần truy vấn lại giao dịch ZaloPay');
      }
      return { failureReason: `ZaloPay từ chối tạo giao dịch (mã ${result.sub_return_code ?? result.return_code})` };
    }
    let url: URL;
    try {
      url = new URL(result.order_url);
    } catch {
      throw new ServiceUnavailableException('ZaloPay chưa cung cấp đường dẫn thanh toán hợp lệ');
    }
    if (url.protocol !== 'https:' || url.username || url.password ||
      !['zalopay.vn', 'zalopay.com.vn'].some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      throw new ServiceUnavailableException('Đường dẫn thanh toán ZaloPay không hợp lệ');
    }
    return { paymentUrl: url.toString() };
  }

  async query(gatewayOrderId: string): Promise<ZaloPayQueryResult> {
    const app_id = this.required('ZALOPAY_APP_ID');
    const key1 = this.required('ZALOPAY_KEY1');
    const result = await this.request('query', {
      app_id, app_trans_id: gatewayOrderId,
      mac: this.sign(key1, `${app_id}|${gatewayOrderId}|${key1}`),
    });
    if (typeof result.is_processing !== 'boolean' ||
      (result.return_code === 1 && !this.validTransaction(result))) {
      throw new ServiceUnavailableException('Kết quả truy vấn ZaloPay không hợp lệ');
    }
    return result;
  }

  private validTransaction(data: { amount?: unknown; zp_trans_id?: unknown }): boolean {
    return Number.isSafeInteger(data.amount) && Number(data.amount) > 0 &&
      ((typeof data.zp_trans_id === 'number' && Number.isSafeInteger(data.zp_trans_id) && data.zp_trans_id > 0) ||
        (typeof data.zp_trans_id === 'string' && /^[1-9]\d{0,29}$/.test(data.zp_trans_id)));
  }

  verifyCallback(data: string, mac: string): ZaloPayTransaction {
    const expected = this.sign(this.required('ZALOPAY_KEY2'), data);
    if (!/^[a-fA-F0-9]{64}$/.test(mac) ||
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(mac, 'hex'))) {
      throw new BadRequestException('Chữ ký ZaloPay không hợp lệ');
    }
    let transaction: ZaloPayTransaction;
    try {
      transaction = JSON.parse(data);
    } catch {
      throw new BadRequestException('Dữ liệu callback không hợp lệ');
    }
    if (!transaction || String(transaction.app_id) !== this.required('ZALOPAY_APP_ID') ||
      typeof transaction.app_trans_id !== 'string' || !transaction.app_trans_id ||
      !this.validTransaction(transaction)) {
      throw new BadRequestException('Thông tin giao dịch ZaloPay không hợp lệ');
    }
    return transaction;
  }
}
