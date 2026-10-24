import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';

const paymentWithOwner = { order: { select: { userId: true } } } as const;
type OwnedPayment = Prisma.PaymentGetPayload<{ include: typeof paymentWithOwner }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: MockPaymentGatewayService,
  ) {}

  async create(userId: string, dto: CreatePaymentDto, key: string, mockHeader?: string) {
    if (typeof key !== 'string' || !key.trim() || key.length > 255) {
      throw new BadRequestException('Idempotency-Key must contain 1–255 characters');
    }
    const mockOutcome = this.gateway.resolveOutcome(mockHeader);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ orderId: dto.orderId, method: dto.method, mockOutcome }))
      .digest('hex');
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key }, include: paymentWithOwner,
    });
    if (existing) return this.replay(existing, userId, requestHash);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize attempts for this order across all backend processes, including retries.
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${dto.orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id: dto.orderId } });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');

        // A competing request may have completed while we waited for the order lock.
        const completed = await tx.payment.findUnique({
          where: { idempotencyKey: key }, include: paymentWithOwner,
        });
        if (completed) return this.replay(completed, userId, requestHash);
        if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
          throw new ConflictException('Đơn hàng không ở trạng thái hợp lệ để thanh toán');
        }
        const active = await tx.payment.findFirst({
          where: { orderId: order.id, status: { in: ['PENDING', 'SUCCESS'] } },
        });
        if (active) throw new ConflictException('Đơn hàng đã thanh toán hoặc đang được xử lý');
        if (order.status === 'PAYMENT_FAILED') {
          await this.orders.transition(order.id, 'PENDING', tx, userId, 'Payment retry');
        }
        const payment = await tx.payment.create({
          data: { orderId: order.id, idempotencyKey: key, requestHash, method: dto.method, amount: order.finalAmount },
        });
        const result = this.gateway.pay(mockOutcome);
        const updated = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' }, data: result,
        });
        if (updated.count !== 1) throw new ConflictException('Giao dịch đã thay đổi');
        await this.orders.transition(
          order.id, result.status === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED', tx, userId,
          result.failureReason ?? 'Payment success',
        );
        return { payment: this.toResponse({ ...payment, ...result }), replayed: false };
      });
    } catch (error) {
      // Same key on different orders can race on the global unique constraint.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const payment = await this.prisma.payment.findUnique({
          where: { idempotencyKey: key }, include: paymentWithOwner,
        });
        if (payment) return this.replay(payment, userId, requestHash);
      }
      throw error;
    }
  }

  private replay(payment: OwnedPayment, userId: string, requestHash: string) {
    if (payment.order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    if (payment.requestHash !== requestHash) throw new ConflictException('Idempotency key đã được sử dụng với thông tin khác');
    if (payment.status === 'PENDING') throw new ConflictException('Giao dịch đang được xử lý, vui lòng thử lại với cùng key');
    return { payment: this.toResponse(payment), replayed: true };
  }

  private toResponse(payment: Payment) {
    return {
      id: payment.id, orderId: payment.orderId, amount: payment.amount.toNumber(),
      method: payment.method, status: payment.status, transactionRef: payment.transactionRef,
      failureReason: payment.failureReason, createdAt: payment.createdAt,
    };
  }
}
