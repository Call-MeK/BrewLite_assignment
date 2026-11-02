import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentSource, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentManagementQueryDto } from './dto/payment-management-query.dto';

interface PaymentRow {
  id: string;
  orderId: string;
  orderNumber: number;
  customer: string;
  amount: Prisma.Decimal;
  expectedAmount: Prisma.Decimal;
  method: PaymentMethod;
  status: PaymentStatus;
  source: PaymentSource;
  providerAmount: Prisma.Decimal | null;
  reviewReason: string | null;
  reference: string | null;
  failureReason: string | null;
  createdAt: Date;
}

interface SummaryRow {
  total: number;
  test: Prisma.Decimal;
  pending: number;
  attention: number;
}

const joins = Prisma.sql`FROM payments p
  JOIN orders o ON o.id = p.order_id
  JOIN users u ON u.id = o.user_id`;
const columns = Prisma.sql`p.id, p.order_id AS "orderId", o.order_number AS "orderNumber",
  COALESCE(NULLIF(TRIM(u.full_name), ''), 'Khách hàng') AS customer,
  p.amount, o.final_amount AS "expectedAmount", p.method, p.status, p.source,
  p.provider_amount AS "providerAmount", p.review_reason AS "reviewReason",
  p.transaction_ref AS reference, p.failure_reason AS "failureReason", p.created_at AS "createdAt"`;

@Injectable()
export class PaymentManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaymentManagementQueryDto) {
    const where = this.where(query);
    const [rows, summaryRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
        SELECT ${columns} ${joins} WHERE ${where}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      this.summaryQuery(where),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const { total, ...summary } = this.toSummary(summaryRows[0]);
    return {
      items: rows.map((row) => this.toResponse(row)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      summary,
    };
  }

  async summary(query: PaymentManagementQueryDto) {
    return this.toSummary((await this.summaryQuery(this.where(query)))[0]);
  }

  async detail(id: string) {
    const rows = await this.prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
      SELECT ${columns} ${joins} WHERE p.id = ${id}`);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy giao dịch');
    return this.toResponse(rows[0]);
  }

  private where(query: PaymentManagementQueryDto) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
    }
    const conditions: Prisma.Sql[] = [];
    if (query.source === 'BANK_TRANSFER') conditions.push(Prisma.sql`FALSE`);
    else if (query.source !== 'ALL') conditions.push(Prisma.sql`p.source::text = ${query.source}`);
    if (query.status === 'REVIEW') conditions.push(Prisma.sql`(COALESCE(p.provider_amount, p.amount) <> o.final_amount OR p.review_reason IS NOT NULL)`);
    else if (query.status !== 'ALL') conditions.push(Prisma.sql`p.status::text = ${query.status}`);
    if (query.from) conditions.push(Prisma.sql`p.created_at >= ${new Date(`${query.from}T00:00:00+07:00`)}`);
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00+07:00`);
      end.setUTCDate(end.getUTCDate() + 1);
      conditions.push(Prisma.sql`p.created_at < ${end}`);
    }
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(Prisma.sql`(p.id ILIKE ${pattern} OR p.transaction_ref ILIKE ${pattern} OR p.provider_order_id ILIKE ${pattern}
        OR u.full_name ILIKE ${pattern} OR o.order_number::text = ${search.replace(/^#/, '')})`);
    }
    return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
  }

  private summaryQuery(where: Prisma.Sql) {
    // Compare payment and order amounts in SQL so REVIEW and totals cover every filtered row.
    return this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total,
        COALESCE(SUM(COALESCE(p.provider_amount, p.amount)) FILTER (WHERE p.status = 'SUCCESS' AND p.review_reason IS NULL AND COALESCE(p.provider_amount, p.amount) = o.final_amount), 0) AS test,
        COUNT(*) FILTER (WHERE p.status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE p.status = 'FAILED' OR COALESCE(p.provider_amount, p.amount) <> o.final_amount OR p.review_reason IS NOT NULL)::int AS attention
      ${joins} WHERE ${where}`);
  }

  private toSummary(row: SummaryRow) {
    return { total: row.total, bank: 0, test: Number(row.test), pending: row.pending, attention: row.attention };
  }

  private toResponse(row: PaymentRow) {
    const amount = Number(row.providerAmount ?? row.amount);
    const expectedAmount = Number(row.expectedAmount);
    return {
      id: row.id, orderId: row.orderId, orderNumber: row.orderNumber, customer: row.customer,
      source: row.source, method: row.method, amount, expectedAmount, status: row.status,
      reconciliation: amount !== expectedAmount ? 'AMOUNT_MISMATCH' as const
        : row.reviewReason ? 'NEEDS_REVIEW' as const : row.status === 'SUCCESS' ? 'MATCHED' as const : 'WAITING' as const,
      reference: row.reference, description: `${row.source === 'MOCK' ? 'Thanh toán mô phỏng' : 'ZaloPay Sandbox'} đơn #${row.orderNumber}`,
      failureReason: row.failureReason, reviewReason: row.reviewReason, createdAt: row.createdAt,
    };
  }
}
