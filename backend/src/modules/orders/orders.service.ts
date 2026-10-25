import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoyaltyTransactionType,
  OrderStatus,
  Prisma,
  ProductSize,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { assertOrderTransition } from './order-state';

const ORDER_HISTORY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  discountAmount: true,
  finalAmount: true,
  createdAt: true,
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const productIds = [...new Set(dto.items.map((item) => item.productId))];
          const toppingIds = [
            ...new Set(dto.items.flatMap((item) => item.toppingIds ?? [])),
          ];
          const [products, toppings] = await Promise.all([
            tx.product.findMany({
              where: { id: { in: productIds }, isAvailable: true },
              include: { sizePrices: true },
            }),
            toppingIds.length
              ? tx.topping.findMany({
                  where: { id: { in: toppingIds }, isAvailable: true },
                })
              : Promise.resolve([]),
          ]);

          const productsById = new Map(products.map((product) => [product.id, product]));
          const toppingsById = new Map(toppings.map((topping) => [topping.id, topping]));

          for (const productId of productIds) {
            if (!productsById.has(productId)) {
              throw new BadRequestException(
                'Sản phẩm không tồn tại hoặc hiện không được bán',
              );
            }
          }
          for (const toppingId of toppingIds) {
            if (!toppingsById.has(toppingId)) {
              throw new BadRequestException(
                'Topping không tồn tại hoặc hiện không được bán',
              );
            }
          }

          const productQuantities = new Map<string, number>();
          const toppingQuantities = new Map<string, number>();
          let totalAmount = 0;
          const orderItems = dto.items.map((item) => {
            const size = item.size ?? ProductSize.M;
            const product = productsById.get(item.productId)!;
            const sizePrice = product.sizePrices.find(
              (price) => price.size === size,
            );
            if (!sizePrice) {
              throw new BadRequestException(
                `Sản phẩm ${product.name} không hỗ trợ size ${size}`,
              );
            }

            const unitPrice = Number(product.basePrice) + Number(sizePrice.priceAdjustment);
            const selectedToppings = (item.toppingIds ?? []).map((id) => {
              const topping = toppingsById.get(id)!;
              toppingQuantities.set(
                id,
                (toppingQuantities.get(id) ?? 0) + item.quantity,
              );
              return { toppingId: id, price: Number(topping.price) };
            });
            const lineTotal =
              (unitPrice +
                selectedToppings.reduce((sum, topping) => sum + topping.price, 0)) *
              item.quantity;

            productQuantities.set(
              item.productId,
              (productQuantities.get(item.productId) ?? 0) + item.quantity,
            );
            totalAmount += lineTotal;

            return {
              productId: item.productId,
              size,
              quantity: item.quantity,
              unitPrice,
              lineTotal,
              toppings: { create: selectedToppings },
            };
          });

          const productIdsToReserve = [...productQuantities.keys()].sort();
          for (const productId of productIdsToReserve) {
            const product = productsById.get(productId)!;
            const quantity = productQuantities.get(productId)!;
            const updated = await tx.product.updateMany({
              where: {
                id: productId,
                isAvailable: true,
                version: product.version,
                stock: { gte: quantity },
              },
              data: {
                stock: { decrement: quantity },
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) {
              throw new BadRequestException(
                `Sản phẩm ${product.name} không đủ tồn kho`,
              );
            }
          }

          for (const toppingId of [...toppingQuantities.keys()].sort()) {
            const topping = toppingsById.get(toppingId)!;
            const quantity = toppingQuantities.get(toppingId)!;
            const updated = await tx.topping.updateMany({
              where: {
                id: toppingId,
                isAvailable: true,
                stock: { gte: quantity },
              },
              data: { stock: { decrement: quantity } },
            });
            if (updated.count !== 1) {
              throw new BadRequestException(
                `Topping ${topping.name} không đủ tồn kho`,
              );
            }
          }

          let promotionId: string | undefined;
          let discountAmount = 0;
          if (dto.promotionCode?.trim()) {
            const promotion = await tx.promotion.findUnique({
              where: { code: dto.promotionCode.trim().toUpperCase() },
            });
            const now = new Date();
            if (
              !promotion ||
              !promotion.isActive ||
              promotion.startDate > now ||
              (promotion.endDate !== null && promotion.endDate < now) ||
              totalAmount < Number(promotion.minOrderAmount)
            ) {
              throw new BadRequestException(
                'Mã khuyến mãi không hợp lệ hoặc chưa đủ điều kiện áp dụng',
              );
            }

            promotionId = promotion.id;
            if (promotion.discountPercent !== null) {
              discountAmount = Math.floor(
                (totalAmount * promotion.discountPercent) / 100,
              );
              if (promotion.maxDiscount !== null) {
                discountAmount = Math.min(
                  discountAmount,
                  Number(promotion.maxDiscount),
                );
              }
            } else if (promotion.discountAmount !== null) {
              discountAmount = Number(promotion.discountAmount);
            } else {
              throw new BadRequestException(
                'Mã khuyến mãi chưa được cấu hình mức giảm',
              );
            }
            discountAmount = Math.min(totalAmount, discountAmount);
          }

          const finalAmount = Math.max(0, totalAmount - discountAmount);
          const order = await tx.order.create({
            data: {
              userId,
              promotionId,
              status: OrderStatus.PENDING,
              totalAmount,
              discountAmount,
              finalAmount,
              items: { create: orderItems },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: OrderStatus.PENDING,
                  changedBy: 'system',
                  reason: 'Order created',
                },
              },
            },
            include: {
              items: {
                include: {
                  toppings: {
                    select: { toppingId: true, price: true },
                  },
                },
              },
              statusHistory: {
                orderBy: { createdAt: 'asc' },
                select: {
                  fromStatus: true,
                  toStatus: true,
                  changedBy: true,
                  reason: true,
                  createdAt: true,
                },
              },
            },
          });

          return {
            id: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
            status: order.status,
            totalAmount: Number(order.totalAmount),
            discountAmount: Number(order.discountAmount),
            finalAmount: Number(order.finalAmount),
            items: order.items.map((item) => ({
              productId: item.productId,
              size: item.size,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              lineTotal: Number(item.lineTotal),
              toppings: item.toppings.map((topping) => ({
                ...topping,
                price: Number(topping.price),
              })),
            })),
            payments: [],
            statusHistory: order.statusHistory,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException(
          'Dữ liệu tồn kho vừa thay đổi, vui lòng thử đặt hàng lại',
        );
      }
      throw error;
    }
  }

  async cancel(orderId: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId, userId },
          include: {
            items: {
              include: { toppings: { select: { toppingId: true } } },
            },
          },
        });
        if (!order) {
          throw new NotFoundException('Không tìm thấy đơn hàng');
        }
        if (
          order.status !== OrderStatus.PENDING &&
          order.status !== OrderStatus.PAYMENT_FAILED
        ) {
          throw new ConflictException(
            'Chỉ có thể hủy đơn đang chờ thanh toán hoặc thanh toán thất bại',
          );
        }

        assertOrderTransition(order.status, OrderStatus.CANCELLED);
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            userId,
            status: order.status,
            version: order.version,
          },
          data: {
            status: OrderStatus.CANCELLED,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'Đơn hàng vừa được cập nhật, vui lòng tải lại và thử lại',
          );
        }

        for (const item of order.items) {
          const productRestored = await tx.product.updateMany({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              version: { increment: 1 },
            },
          });
          if (productRestored.count !== 1) {
            throw new ConflictException(
              'Không thể hoàn lại tồn kho sản phẩm của đơn hàng',
            );
          }
          for (const topping of item.toppings) {
            const toppingRestored = await tx.topping.updateMany({
              where: { id: topping.toppingId },
              data: { stock: { increment: item.quantity } },
            });
            if (toppingRestored.count !== 1) {
              throw new ConflictException(
                'Không thể hoàn lại tồn kho topping của đơn hàng',
              );
            }
          }
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: OrderStatus.CANCELLED,
            changedBy: 'customer',
            reason: 'Customer cancelled',
          },
        });

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: OrderStatus.CANCELLED,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transition(
    orderId: string,
    toStatus: OrderStatus,
    tx: Prisma.TransactionClient,
    changedBy = 'system',
    reason?: string,
  ) {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      assertOrderTransition(order.status, toStatus);
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          version: order.version,
        },
        data: {
          status: toStatus,
          version: { increment: 1 },
          ...(toStatus === OrderStatus.PAID ? { paidAt: new Date() } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Đơn hàng vừa được cập nhật, vui lòng thử lại',
        );
      }

      if (toStatus === OrderStatus.PAID) {
        const points = Math.floor(Number(order.finalAmount) / 1000);
        await tx.order.update({
          where: { id: order.id },
          data: { pointsEarned: points },
        });
        if (points > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: points } },
          });
        }
        await tx.loyaltyTransaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            points,
            type: LoyaltyTransactionType.EARNED,
            reason: 'Points earned from paid order',
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          changedBy,
          reason,
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        select: { id: true, orderNumber: true, status: true },
      });
  }

  async getOrderHistory(userId: string, query: OrderHistoryQueryDto) {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_HISTORY_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      items: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        finalAmount: Number(order.finalAmount),
        createdAt: order.createdAt,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
      },
    };
  }

  async getOrderDetail(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            toppings: {
              include: { topping: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        toppings: item.toppings.map((topping) => ({
          id: topping.id,
          toppingId: topping.toppingId,
          name: topping.topping.name,
          price: Number(topping.price),
        })),
      })),
    };
  }
}
