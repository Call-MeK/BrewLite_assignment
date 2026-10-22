import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

@Injectable()
export class MockPaymentGatewayService {
  constructor(private readonly config: ConfigService) {}

  resolveOutcome(header?: string): 'SUCCESS' | 'FAILED' {
    const environment = this.config.get<string>('NODE_ENV');
    if (
      !['development', 'test'].includes(environment) ||
      this.config.get<string>('PAYMENT_DEMO_MODE') !== 'true'
    ) {
      throw new ServiceUnavailableException('Mock payment requires development/test and PAYMENT_DEMO_MODE=true');
    }
    if (header !== undefined && header !== 'SUCCESS' && header !== 'FAILED') {
      throw new BadRequestException('X-Mock-Outcome must be SUCCESS or FAILED');
    }
    return header === 'FAILED' ? 'FAILED' : 'SUCCESS';
  }

  // Local simulation only; this method must never perform network I/O.
  pay(outcome: 'SUCCESS' | 'FAILED') {
    return {
      status: outcome,
      transactionRef: outcome === 'SUCCESS' ? `MOCK_TXN_${randomUUID()}` : null,
      failureReason: outcome === 'FAILED' ? 'Giao dịch bị từ chối bởi cổng thanh toán mô phỏng' : null,
    };
  }
}
