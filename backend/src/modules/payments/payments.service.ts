import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: MockPaymentGatewayService,
  ) {}

  async create(userId: string, dto: CreatePaymentDto, key: string, mockOutcome?: string) {
    if (typeof key !== 'string' || !key.trim() || key.length > 128) {
      throw new BadRequestException('Idempotency-Key is required (1-128 characters)');
    }
    const outcome = this.gateway.outcome(mockOutcome);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId, orderId: dto.orderId, method: dto.method, mockOutcome: outcome }))
      .digest('hex');
    try {
      return await this.prisma.$transaction(async tx => {
        // Serialize attempts on one order; this local mock performs no network I/O.
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${dto.orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id: dto.orderId } });
        if (!order) throw new NotFoundException('Order not found');
        if (order.userId !== userId) throw new ForbiddenException('You do not own this order');
        const existing = await tx.payment.findUnique({ where: { idempotencyKey: key } });
        if (existing) return this.replay(existing, requestHash);
        if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) {
          throw new ConflictException('Order is not payable');
        }
        if (await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ['PENDING', 'SUCCESS'] } } })) {
          throw new ConflictException('Order has an in-progress or successful payment');
        }
        if (order.status === 'PAYMENT_FAILED') {
          await this.orders.transition(order.id, 'PENDING', tx, 'Retry payment');
        }
        const payment = await tx.payment.create({ data: {
          orderId: order.id, idempotencyKey: key, requestHash, amount: order.finalAmount, method: dto.method,
        } });
        const result = this.gateway.charge(outcome);
        const updated = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' }, data: result,
        });
        if (updated.count !== 1) throw new ConflictException('Payment changed concurrently');
        await this.orders.transition(order.id, result.status === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED', tx,
          result.failureReason || 'Mock payment successful');
        return { payment: this.publicPayment({ ...payment, ...result }), replayed: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // A global key can also race across different orders; never disclose that payment.
        const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
        if (existing) return this.replay(existing, requestHash);
      }
      throw error;
    }
  }

  private replay(payment: Payment, hash: string) {
    if (payment.requestHash !== hash) throw new ConflictException('Idempotency-Key was used with a different request');
    if (payment.status === 'PENDING') throw new ConflictException('Payment is still in progress');
    return { payment: this.publicPayment(payment), replayed: true };
  }

  private publicPayment(payment: Payment) {
    const { id, orderId, amount, method, status, transactionRef, failureReason, createdAt } = payment;
    return { id, orderId, amount: amount.toNumber(), method, status, transactionRef, failureReason, createdAt };
  }
}
