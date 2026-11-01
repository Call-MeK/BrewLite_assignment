import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentAdminGuard } from './payment-admin.guard';
import { ZaloPaySandboxGateway, ZaloPaySuccess } from './zalopay-sandbox.gateway';

const owner = { order: { select: { userId: true, orderNumber: true } } } as const;
type OwnedPayment = Prisma.PaymentGetPayload<{ include: typeof owner }>;

@Injectable()
export class ZaloPaySandboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: ZaloPaySandboxGateway,
    private readonly admins: PaymentAdminGuard,
  ) {}

  async create(userId: string, dto: CreatePaymentDto, key: string) {
    this.gateway.assertReady();
    if (typeof key !== 'string' || !key.trim() || key.length > 255) {
      throw new BadRequestException('Idempotency-Key must contain 1–255 characters');
    }
    const requestHash = createHash('sha256').update(JSON.stringify({
      source: 'ZALOPAY_SANDBOX', orderId: dto.orderId, method: dto.method,
    })).digest('hex');
    let attempt: { payment: OwnedPayment; created: boolean };
    try {
      attempt = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${dto.orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id: dto.orderId } });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
        const existing = await tx.payment.findUnique({ where: { idempotencyKey: key }, include: owner });
        if (existing) return { payment: this.replay(existing, userId, requestHash), created: false };
        if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) throw new ConflictException('Đơn hàng không còn chờ thanh toán');
        if (await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ['PENDING', 'SUCCESS'] } } })) {
          throw new ConflictException('Đơn hàng đã thanh toán hoặc đang được xử lý');
        }
        if (Number(order.finalAmount) <= 0) throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
        if (order.status === 'PAYMENT_FAILED') await this.orders.transition(order.id, 'PENDING', tx, userId, 'ZaloPay retry');
        const now = new Date();
        const day = new Date(now.getTime() + 7 * 3600000).toISOString().slice(2, 10).replace(/-/g, '');
        const payment = await tx.payment.create({
          data: {
            orderId: order.id, source: 'ZALOPAY_SANDBOX', method: dto.method,
            amount: order.finalAmount, idempotencyKey: key, requestHash,
            providerOrderId: `${day}_${randomUUID().replace(/-/g, '')}`,
            createdAt: now, expiresAt: new Date(now.getTime() + 900000),
          }, include: owner,
        });
        return { payment, created: true };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: key }, include: owner });
      if (!existing) throw error;
      attempt = { payment: this.replay(existing, userId, requestHash), created: false };
    }
    if (!attempt.created) return this.toResponse(attempt.payment);

    // Persist the pending attempt before network I/O; an unknown outcome must not allow another charge.
    let result: Awaited<ReturnType<ZaloPaySandboxGateway['create']>>;
    try {
      result = await this.gateway.create(attempt.payment, userId, attempt.payment.order.orderNumber);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      await this.prisma.payment.updateMany({
        where: { id: attempt.payment.id, status: 'PENDING' },
        data: { failureReason: 'Chưa xác định được kết quả tạo thanh toán. Vui lòng đồng bộ trạng thái.' },
      });
      return this.get(attempt.payment.id, userId);
    }
    if (!result.accepted) {
      return this.toResponse(await this.fail(attempt.payment.id, 'ZaloPay từ chối tạo thanh toán sandbox'));
    }
    const payment = await this.prisma.payment.update({
      where: { id: attempt.payment.id }, data: { paymentUrl: result.paymentUrl },
    });
    return this.toResponse(payment);
  }

  async get(id: string, userId: string) {
    return this.toResponse(await this.authorized(id, userId));
  }

  async latest(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId && !await this.admins.isAdmin(userId)) throw new ForbiddenException('Bạn không có quyền xem giao dịch');
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, source: 'ZALOPAY_SANDBOX' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return payment ? this.toResponse(payment) : null;
  }

  async sync(id: string, userId: string) {
    this.gateway.assertReady();
    const payment = await this.authorized(id, userId);
    if (payment.status === 'SUCCESS') return this.toResponse(payment);
    const result = await this.gateway.query(payment.providerOrderId);
    if (result.success) return this.toResponse(await this.settle(result.success));
    // Only explicit provider expiration can close an attempt; local expiry alone is inconclusive.
    if (result.code === 2 && result.subCode === -54 && result.processing !== true
      && payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
      return this.toResponse(await this.fail(payment.id, 'ZaloPay xác nhận thanh toán thất bại hoặc hết hạn'));
    }
    return this.get(id, userId);
  }

  async callback(body: unknown) {
    const success = this.gateway.verifyCallback(body);
    await this.settle(success);
    return { return_code: 1, return_message: 'success' };
  }

  private async settle(result: ZaloPaySuccess): Promise<Payment> {
    const candidate = await this.prisma.payment.findUnique({ where: { providerOrderId: result.providerOrderId } });
    if (!candidate || candidate.source !== 'ZALOPAY_SANDBOX') throw new BadRequestException('Unknown payment');
    // Different orders can race on the unique provider transaction ID. Retry once to record a review.
    for (let retry = 0; ; retry++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${candidate.orderId} FOR UPDATE`;
          const payment = await tx.payment.findUnique({ where: { id: candidate.id } });
          const order = await tx.order.findUnique({ where: { id: candidate.orderId } });
          if (!payment || !order) throw new BadRequestException('Unknown payment');
          if (payment.status === 'SUCCESS') {
            if (payment.providerTransactionId === result.transactionId && Number(payment.providerAmount) === result.amount) return payment;
            return tx.payment.update({ where: { id: payment.id }, data: { reviewReason: 'Nhận kết quả ZaloPay khác với giao dịch đã ghi nhận' } });
          }
          const duplicate = await tx.payment.findUnique({ where: { providerTransactionId: result.transactionId } });
          const otherActive = await tx.payment.findFirst({
            where: { orderId: order.id, id: { not: payment.id }, status: { in: ['PENDING', 'SUCCESS'] } },
          });
          let reviewReason: string | null = null;
          if (duplicate && duplicate.id !== payment.id) reviewReason = 'Mã giao dịch ZaloPay đã được gắn với giao dịch khác';
          else if (result.amount !== Number(payment.amount) || result.amount !== Number(order.finalAmount)) reviewReason = 'Số tiền ZaloPay không khớp giá trị đơn hàng';
          else if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status) || otherActive) reviewReason = 'Đơn hàng đã hủy, đã xử lý hoặc có lượt thanh toán khác; cần kiểm tra';
          const updated = await tx.payment.update({
            where: { id: payment.id }, data: {
              status: 'SUCCESS', providerAmount: result.amount, transactionRef: result.transactionId,
              providerTransactionId: duplicate && duplicate.id !== payment.id ? null : result.transactionId,
              reviewReason, failureReason: null,
            },
          });
          if (!reviewReason) {
            if (order.status === 'PAYMENT_FAILED') await this.orders.transition(order.id, 'PENDING', tx, 'zalopay', 'ZaloPay late confirmation');
            await this.orders.transition(order.id, 'PAID', tx, 'zalopay', 'ZaloPay Sandbox success');
          }
          return updated;
        });
      } catch (error) {
        if (retry >= 1 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
  }

  private async fail(id: string, reason: string) {
    const candidate = await this.prisma.payment.findUnique({ where: { id } });
    if (!candidate) throw new NotFoundException('Không tìm thấy giao dịch');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${candidate.orderId} FOR UPDATE`;
      const payment = await tx.payment.findUnique({ where: { id } });
      if (payment.status !== 'PENDING') return payment;
      const order = await tx.order.findUnique({ where: { id: payment.orderId } });
      const updated = await tx.payment.update({ where: { id }, data: { status: 'FAILED', failureReason: reason } });
      if (order.status === 'PENDING') await this.orders.transition(order.id, 'PAYMENT_FAILED', tx, 'zalopay', reason);
      return updated;
    });
  }

  private async authorized(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: owner });
    if (!payment || payment.source !== 'ZALOPAY_SANDBOX') throw new NotFoundException('Không tìm thấy giao dịch ZaloPay');
    if (payment.order.userId !== userId && !await this.admins.isAdmin(userId)) throw new ForbiddenException('Bạn không có quyền xem giao dịch');
    return payment;
  }

  private replay(payment: OwnedPayment, userId: string, requestHash: string) {
    if (payment.order.userId !== userId) throw new ForbiddenException('Bạn không có quyền xem giao dịch');
    if (payment.source !== 'ZALOPAY_SANDBOX' || payment.requestHash !== requestHash) throw new ConflictException('Idempotency key đã được sử dụng với thông tin khác');
    return payment;
  }

  private toResponse(payment: Payment) {
    return {
      id: payment.id, orderId: payment.orderId, source: payment.source, status: payment.status,
      amount: Number(payment.amount), method: payment.method, paymentUrl: payment.paymentUrl,
      providerOrderId: payment.providerOrderId, reference: payment.transactionRef,
      providerAmount: payment.providerAmount === null ? null : Number(payment.providerAmount),
      reviewReason: payment.reviewReason, failureReason: payment.failureReason,
      expiresAt: payment.expiresAt, createdAt: payment.createdAt,
    };
  }
}
