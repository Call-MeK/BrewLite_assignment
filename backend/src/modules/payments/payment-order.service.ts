import { ConflictException, Injectable } from '@nestjs/common';
import { Order, OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class PaymentOrderService {
  // shortcut: Keep payment transitions local until Orders exposes a shared transition service.
  async transition(tx: Prisma.TransactionClient, order: Order, to: OrderStatus): Promise<Order> {
    const allowed: Partial<Record<OrderStatus, OrderStatus[]>> = {
      PENDING: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED],
      PAYMENT_FAILED: [OrderStatus.PENDING],
    };
    if (!allowed[order.status]?.includes(to)) {
      throw new ConflictException('Đơn hàng không ở trạng thái hợp lệ để thanh toán');
    }
    const points = to === OrderStatus.PAID ? Math.floor(Number(order.finalAmount) / 1000) : 0;
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: order.status, version: order.version },
      data: {
        status: to, version: { increment: 1 },
        ...(to === OrderStatus.PAID ? { paidAt: new Date(), pointsEarned: points } : {}),
      },
    });
    if (changed.count !== 1) throw new ConflictException('Trạng thái đơn hàng đã thay đổi');
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: to, changedBy: 'payment' },
    });
    if (to === OrderStatus.PAID) {
      await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } });
      await tx.loyaltyTransaction.create({
        data: { userId: order.userId, orderId: order.id, points, type: 'EARNED', reason: 'Thanh toán đơn hàng' },
      });
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  }
}
