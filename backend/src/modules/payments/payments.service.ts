import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Order, Payment, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentOrderService } from './payment-order.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ZaloPayCallbackDto } from './dto/zalopay-callback.dto';
import { ZaloPayService } from './zalopay.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: PaymentOrderService,
    private readonly gateway: ZaloPayService,
  ) {}

  private publicPayment(payment: Payment) {
    const { id, orderId, method, status, transactionRef, gatewayOrderId,
      paymentUrl, failureReason, createdAt } = payment;
    return { id, orderId, amount: Number(payment.amount), method, status, transactionRef,
      gatewayOrderId, paymentUrl, failureReason, createdAt };
  }

  private authorize(order: Order | null, userId: string): asserts order is Order {
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    }
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
    return tx.order.findUnique({ where: { id: orderId } });
  }

  private checkHash(payment: Payment, hash: string) {
    if (payment.requestHash !== hash) {
      throw new ConflictException('Idempotency key đã được sử dụng với thông tin khác');
    }
    return { payment, replayed: true };
  }

  async create(userId: string, dto: CreatePaymentDto, key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException('Header Idempotency-Key là bắt buộc, tối đa 128 ký tự');
    }
    const hash = createHash('sha256')
      .update(JSON.stringify({ userId, orderId: dto.orderId, method: dto.method })).digest('hex');
    let reservation: { payment: Payment; replayed: boolean };
    try {
      reservation = await this.prisma.$transaction(async tx => {
        let order = await this.lockOrder(tx, dto.orderId);
        this.authorize(order, userId);
        const previous = await tx.payment.findUnique({ where: { idempotencyKey: key } });
        if (previous) return this.checkHash(previous, hash);
        if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) {
          throw new ConflictException('Đơn hàng không ở trạng thái hợp lệ để thanh toán');
        }
        const pending = await tx.payment.findFirst({ where: { orderId: order.id, status: 'PENDING' } });
        if (pending) {
          throw new ConflictException('Đơn hàng có giao dịch đang chờ. Hãy kiểm tra kết quả trước khi thử lại.');
        }
        this.gateway.assertConfigured();
        const amount = Number(order.finalAmount);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new BadRequestException('Số tiền đơn hàng không hợp lệ');
        }
        if (order.status === 'PAYMENT_FAILED') {
          order = await this.orders.transition(tx, order, 'PENDING');
        }
        const vietnamDate = new Date(Date.now() + 7 * 60 * 60 * 1000)
          .toISOString().slice(2, 10).replaceAll('-', '');
        const payment = await tx.payment.create({
          data: {
            orderId: order.id, amount: order.finalAmount, method: dto.method,
            idempotencyKey: key, requestHash: hash,
            gatewayOrderId: `${vietnamDate}_${randomUUID().replaceAll('-', '')}`,
          },
        });
        return { payment, replayed: false };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const previous = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
      if (!previous) throw error;
      reservation = this.checkHash(previous, hash);
    }
    if (reservation.replayed) {
      return { payment: this.publicPayment(reservation.payment), replayed: true };
    }
    const payment = reservation.payment;
    let result: { paymentUrl?: string; failureReason?: string };
    try {
      result = await this.gateway.create(payment, userId);
    } catch {
      // A timeout may follow an accepted request; keep this attempt for reconciliation.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { failureReason: 'Chưa xác định được kết quả ZaloPay. Hãy kiểm tra lại giao dịch.' },
      });
    }
    if (result?.failureReason) {
      await this.finish(payment.id, { status: 'FAILED', failureReason: result.failureReason });
    } else if (result?.paymentUrl) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' }, data: { paymentUrl: result.paymentUrl, failureReason: null },
      });
    }
    return {
      payment: this.publicPayment(await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })),
      replayed: false,
    };
  }

  private async finish(
    id: string,
    result: { status: 'SUCCESS' | 'FAILED'; amount?: number; transactionRef?: string; failureReason?: string },
  ) {
    const snapshot = await this.prisma.payment.findUnique({ where: { id } });
    if (!snapshot) throw new NotFoundException('Không tìm thấy giao dịch');
    return this.prisma.$transaction(async tx => {
      const order = await this.lockOrder(tx, snapshot.orderId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (result.status === 'SUCCESS' && Number(payment.amount) !== result.amount) {
        throw new BadRequestException('Số tiền giao dịch không khớp');
      }
      if (payment.status === 'SUCCESS') {
        if (result.status === 'SUCCESS' && payment.transactionRef !== result.transactionRef) {
          throw new BadRequestException('Mã giao dịch ZaloPay không khớp');
        }
        return payment;
      }
      if (payment.status !== 'PENDING') {
        if (result.status === 'SUCCESS') throw new ConflictException('Giao dịch cần đối soát thủ công');
        return payment;
      }
      await this.orders.transition(tx, order, result.status === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED');
      return tx.payment.update({
        where: { id }, data: {
          status: result.status, transactionRef: result.transactionRef ?? null,
          failureReason: result.failureReason ?? null,
        },
      });
    });
  }

  async getOrder(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id }, include: { payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    this.authorize(order, userId);
    return {
      id: order.id, orderNumber: order.orderNumber, finalAmount: Number(order.finalAmount),
      status: order.status, payment: order.payments[0] ? this.publicPayment(order.payments[0]) : null,
    };
  }

  async get(userId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { order: true } });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
    this.authorize(payment.order, userId);
    if (payment.status !== 'PENDING' || !payment.gatewayOrderId) return this.publicPayment(payment);
    const result = await this.gateway.query(payment.gatewayOrderId);
    if (result.return_code === 1 && result.is_processing === false) {
      return this.publicPayment(await this.finish(id, {
        status: 'SUCCESS', amount: result.amount, transactionRef: String(result.zp_trans_id),
      }));
    }
    const age = Date.now() - payment.createdAt.getTime();
    if (result.return_code === 2 && result.is_processing === false &&
      (result.sub_return_code === -54 ||
        (result.sub_return_code === -101 && age > 15 * 60 * 1000 && age < 48 * 60 * 60 * 1000))) {
      return this.publicPayment(await this.finish(id, {
        status: 'FAILED', failureReason: 'Giao dịch ZaloPay đã hết hạn và chưa được thanh toán',
      }));
    }
    return this.publicPayment(await this.prisma.payment.findUniqueOrThrow({ where: { id } }));
  }

  async callback(dto: ZaloPayCallbackDto) {
    try {
      const result = this.gateway.verifyCallback(dto.data, dto.mac);
      const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: result.app_trans_id } });
      if (!payment) throw new BadRequestException('Không tìm thấy giao dịch ZaloPay');
      await this.finish(payment.id, {
        status: 'SUCCESS', amount: result.amount, transactionRef: String(result.zp_trans_id),
      });
      return { return_code: 1, return_message: 'Success' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return { return_code: -1, return_message: 'Invalid transaction' };
      }
      return { return_code: 0, return_message: 'Please retry' };
    }
  }
}
