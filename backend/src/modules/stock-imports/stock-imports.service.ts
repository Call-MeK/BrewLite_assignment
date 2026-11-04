import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStockImportDto, StockImportsQueryDto } from "./stock-imports.dto";

const listSelect = {
  id: true,
  importNumber: true,
  supplier: true,
  note: true,
  totalAmount: true,
  createdBy: true,
  createdAt: true,
  _count: { select: { items: true } },
} as const;

const detailSelect = {
  id: true,
  importNumber: true,
  supplier: true,
  note: true,
  totalAmount: true,
  createdBy: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      ingredientId: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      ingredient: { select: { name: true, unit: true, stock: true } },
    },
    orderBy: { ingredient: { name: "asc" } },
  },
} as const;

type DetailRow = Prisma.StockImportGetPayload<{ select: typeof detailSelect }>;

const publicDetail = (row: DetailRow) => ({
  ...row,
  totalAmount: Number(row.totalAmount),
  items: row.items.map((item) => ({
    ...item,
    lineTotal: Number(item.lineTotal),
  })),
});

@Injectable()
export class StockImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: StockImportsQueryDto) {
    const [rows, total, aggregate] = await this.prisma.$transaction(
      [
        this.prisma.stockImport.findMany({
          select: listSelect,
          orderBy: [{ createdAt: "desc" }, { importNumber: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.stockImport.count(),
        this.prisma.stockImport.aggregate({ _sum: { totalAmount: true } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return {
      items: rows.map(({ _count, ...row }) => ({
        ...row,
        totalAmount: Number(row.totalAmount),
        itemCount: _count.items,
      })),
      summary: {
        count: total,
        totalValue: Number(aggregate._sum.totalAmount || 0),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(id: string) {
    return this.detail(this.prisma, id);
  }

  async create(actorId: string, dto: CreateStockImportDto) {
    const ids = dto.items.map((item) => item.ingredientId);

    return this.prisma.$transaction(async (tx) => {
      // Khóa các nguyên liệu để tránh ghi đè tồn kho khi có đơn hàng chạy song song.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM ingredients WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
      `;
      if (locked.length !== ids.length) {
        throw new BadRequestException("Có nguyên liệu không tồn tại");
      }

      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { email: true, fullName: true },
      });

      const totalAmount = Math.round(
        dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      );

      const created = await tx.stockImport.create({
        data: {
          supplier: dto.supplier || null,
          note: dto.note || null,
          totalAmount: new Prisma.Decimal(totalAmount),
          createdBy: actor?.fullName || actor?.email || null,
          items: {
            create: dto.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: new Prisma.Decimal(
                Math.round(item.quantity * item.unitPrice),
              ),
            })),
          },
        },
        select: { id: true },
      });

      for (const item of dto.items) {
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stock: { increment: item.quantity },
            // Giá vốn lấy theo lần nhập gần nhất.
            price: item.unitPrice,
            // Tăng version để đơn hàng đang xử lý phải đọc lại tồn kho.
            version: { increment: 1 },
          },
        });
      }

      return this.detail(tx, created.id);
    });
  }

  private async detail(
    db: Prisma.TransactionClient | PrismaService,
    id: string,
  ) {
    const row = await db.stockImport.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!row) throw new NotFoundException("Không tìm thấy phiếu nhập hàng");
    return publicDetail(row);
  }
}
