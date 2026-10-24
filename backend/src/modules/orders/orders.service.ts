import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  // Payment integration only: cancellation/fulfilment belong to the Order implementation.
  async transition(
    orderId: string,
    to: OrderStatus,
    tx: Prisma.TransactionClient,
    changedBy: string,
    reason: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const valid = (order.status === 'PENDING' && (to === 'PAID' || to === 'PAYMENT_FAILED')) ||
      (order.status === 'PAYMENT_FAILED' && to === 'PENDING');
    if (!valid) throw new ConflictException('Chuyển trạng thái đơn hàng không hợp lệ');

    const points = order.finalAmount.dividedToIntegerBy(1000).toNumber();
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === 'PAID' ? { paidAt: new Date(), pointsEarned: points } : {}),
      },
    });
    if (updated.count !== 1) throw new ConflictException('Đơn hàng đã thay đổi, vui lòng thử lại');
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: to, changedBy, reason },
    });
    if (to === 'PAID') {
      const earned = await tx.loyaltyTransaction.findFirst({ where: { orderId, type: 'EARNED' } });
      if (earned) throw new ConflictException('Đơn hàng đã được cộng điểm');
      await tx.loyaltyTransaction.create({
        data: { orderId, userId: order.userId, type: 'EARNED', points, reason: 'Payment success' },
      });
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } });
    }
  }
}
