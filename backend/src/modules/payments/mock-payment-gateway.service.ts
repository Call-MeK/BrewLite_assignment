import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentGatewayService {
  constructor(private readonly config: ConfigService) {}

  outcome(header?: string): 'SUCCESS' | 'FAILED' {
    if (!['development', 'test'].includes(this.config.get<string>('NODE_ENV')) ||
        this.config.get<string>('PAYMENT_DEMO_MODE') !== 'true') {
      throw new ServiceUnavailableException('Mock payments require development/test and PAYMENT_DEMO_MODE=true');
    }
    if (header !== undefined && header !== 'SUCCESS' && header !== 'FAILED') {
      throw new BadRequestException('X-Mock-Outcome must be SUCCESS or FAILED');
    }
    return header === 'FAILED' ? 'FAILED' : 'SUCCESS';
  }

  charge(outcome: 'SUCCESS' | 'FAILED') {
    return {
      status: outcome,
      transactionRef: outcome === 'SUCCESS' ? `MOCK_TXN_${randomUUID()}` : null,
      failureReason: outcome === 'FAILED' ? 'Giao dịch bị từ chối bởi cổng thanh toán mô phỏng' : null,
    };
  }
}
