import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    orderId: string,
    to: OrderStatus,
    tx?: Prisma.TransactionClient,
    reason = 'Payment processing',
  ) {
    if (!tx) return this.prisma.$transaction(client => this.transition(orderId, to, client, reason));
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!transitions[order.status].includes(to)) {
      throw new ConflictException(`Invalid order transition: ${order.status} -> ${to}`);
    }
    const paid = to === OrderStatus.PAID;
    const points = paid ? order.finalAmount.div(1000).floor().toNumber() : 0;
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status, version: order.version, ...(paid ? { paidAt: null } : {}) },
      data: { status: to, version: { increment: 1 }, ...(paid ? { paidAt: new Date(), pointsEarned: points } : {}) },
    });
    if (updated.count !== 1) throw new ConflictException('Order changed concurrently');
    await tx.orderStatusHistory.create({ data: {
      orderId, fromStatus: order.status, toStatus: to, changedBy: 'system', reason,
    } });
    if (paid) {
      const earned = await tx.loyaltyTransaction.findFirst({ where: { orderId, type: 'EARNED' } });
      if (earned) throw new ConflictException('Order already earned loyalty points');
      await tx.loyaltyTransaction.create({ data: {
        orderId, userId: order.userId, points, type: 'EARNED', reason: 'Order paid',
      } });
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } });
    }
    return tx.order.findUnique({ where: { id: orderId } });
  }
}
