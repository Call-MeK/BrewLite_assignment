"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Plus, RefreshCw, Trash2, Truck, X } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { ingredientsService, type Ingredient } from "@/services/ingredients.service";
import {
  createStockImport,
  getStockImport,
  listStockImports,
  stockUnitLabels,
  type IngredientUnit,
  type StockImportDetail,
  type StockImportList,
} from "@/services/stock-import.service";

type Row = { key: string; ingredientId: string; quantity: string; unitPrice: string };

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const unitOf = (unit: string) => stockUnitLabels[unit as IngredientUnit] ?? unit;
const newRow = (): Row => ({ key: crypto.randomUUID(), ingredientId: "", quantity: "", unitPrice: "" });
const messageFor = (error: unknown) =>
  error instanceof ApiError && error.statusCode === 401
    ? "Vui lòng đăng nhập bằng tài khoản quản trị để xem phiếu nhập."
    : error instanceof ApiError
      ? error.message
      : "Không kết nối được máy chủ. Vui lòng thử lại.";

export default function StockImportsPage() {
  const [data, setData] = useState<StockImportList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<StockImportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await listStockImports(page));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    ingredientsService
      .getAll()
      .then(setIngredients)
      .catch(() => setIngredients([]));
  }, []);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );

  const total = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const quantity = Number(row.quantity);
        const price = Number(row.unitPrice);
        return sum + (Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0);
      }, 0),
    [rows],
  );

  function openCreate() {
    setSupplier("");
    setNote("");
    setRows([newRow()]);
    setFormError("");
    setNotice("");
    setCreateOpen(true);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function pickIngredient(key: string, ingredientId: string) {
    const ingredient = ingredientById.get(ingredientId);
    updateRow(key, {
      ingredientId,
      unitPrice: ingredient ? String(ingredient.price || "") : "",
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    const payloadItems = rows
      .map((row) => ({
        ingredientId: row.ingredientId,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
      }))
      .filter((row) => row.ingredientId || row.quantity || row.unitPrice);

    if (payloadItems.length === 0) return setFormError("Thêm ít nhất một nguyên liệu vào phiếu nhập.");
    if (payloadItems.some((row) => !row.ingredientId)) return setFormError("Vui lòng chọn nguyên liệu cho mọi dòng.");
    if (new Set(payloadItems.map((row) => row.ingredientId)).size !== payloadItems.length) {
      return setFormError("Mỗi nguyên liệu chỉ được xuất hiện một lần trong phiếu.");
    }
    if (payloadItems.some((row) => !Number.isFinite(row.quantity) || row.quantity <= 0)) {
      return setFormError("Số lượng nhập phải lớn hơn 0.");
    }
    if (payloadItems.some((row) => !Number.isFinite(row.unitPrice) || row.unitPrice < 0)) {
      return setFormError("Đơn giá nhập không hợp lệ.");
    }

    setSaving(true);
    try {
      await createStockImport({
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
        items: payloadItems,
      });
      setCreateOpen(false);
      setNotice("Đã tạo phiếu nhập và cập nhật tồn kho.");
      if (page !== 1) setPage(1);
      else await load();
    } catch (cause) {
      setFormError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await getStockImport(id));
    } catch (cause) {
      setDetailError(messageFor(cause));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }

  const summary = data?.summary;
  const pagination = data?.pagination;
  const latest = data?.items[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <p className="kicker">Sổ quản trị · Kho</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Nhập hàng</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">
            Ghi phiếu nhập để cộng tồn kho và cập nhật giá vốn mới nhất cho từng nguyên liệu.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded-ticket border border-ink/25 bg-white px-4 text-sm font-semibold text-ink hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Làm mới
          </button>
          <button type="button" onClick={openCreate} className="btn-primary min-h-11 px-4 text-white">
            <Plus size={18} aria-hidden="true" /> Tạo phiếu nhập
          </button>
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-ticket border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-ticket border border-danger/30 bg-danger-light px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ticket p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">Số phiếu nhập</p>
          <p className="price mt-3 text-3xl font-bold tracking-[-0.02em] text-ink">
            {summary ? summary.count.toLocaleString("vi-VN") : "—"}
          </p>
          <p className="mt-2 text-xs leading-5 text-content-secondary">Tổng số phiếu đã ghi nhận.</p>
        </div>
        <div className="ticket p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">Tổng giá trị nhập</p>
          <p className="price mt-3 text-3xl font-bold tracking-[-0.02em] text-primary">
            {summary ? money(summary.totalValue) : "—"}
          </p>
          <p className="mt-2 text-xs leading-5 text-content-secondary">Cộng dồn toàn bộ phiếu nhập.</p>
        </div>
        <div className="ticket p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">Nguyên liệu theo dõi</p>
          <p className="price mt-3 text-3xl font-bold tracking-[-0.02em] text-ink">
            {ingredients.length.toLocaleString("vi-VN")}
          </p>
          <p className="mt-2 text-xs leading-5 text-content-secondary">
            {latest ? `Phiếu gần nhất: #${latest.importNumber} · ${date(latest.createdAt)}` : "Chưa có phiếu nhập nào."}
          </p>
        </div>
      </div>

      <div className="ticket overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.14em] text-content-secondary">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Phiếu</th>
                <th scope="col" className="px-5 py-3 font-semibold">Nhà cung cấp</th>
                <th scope="col" className="px-5 py-3 font-semibold">Mặt hàng</th>
                <th scope="col" className="px-5 py-3 font-semibold">Tổng tiền</th>
                <th scope="col" className="px-5 py-3 font-semibold">Người tạo</th>
                <th scope="col" className="px-5 py-3 font-semibold">Thời điểm</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {data?.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-paper/60">
                  <td className="px-5 py-4">
                    <span className="price font-bold text-ink">#{item.importNumber}</span>
                    {item.note && <span className="mt-0.5 block max-w-[16rem] truncate text-xs text-content-secondary">{item.note}</span>}
                  </td>
                  <td className="px-5 py-4 text-content-secondary">{item.supplier || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-ticket bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-ink">{item.itemCount} dòng</span>
                  </td>
                  <td className="price px-5 py-4 font-semibold text-primary">{money(item.totalAmount)}</td>
                  <td className="px-5 py-4 text-content-secondary">{item.createdBy || "—"}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-content-secondary">{date(item.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(item.id)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-ticket border border-ink/25 bg-white px-3 text-xs font-semibold text-ink hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Xem phiếu nhập #${item.importNumber}`}
                    >
                      <Eye size={14} aria-hidden="true" /> Xem
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} role="status" className="px-5 py-12 text-center text-content-secondary">
                    Chưa có phiếu nhập nào. Bấm “Tạo phiếu nhập” để bắt đầu.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} role="status" className="px-5 py-12 text-center text-content-secondary">Đang tải phiếu nhập…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-5 py-3 text-xs text-content-secondary">
          <span>
            {pagination ? `${pagination.total} phiếu · trang ${pagination.page}/${Math.max(pagination.totalPages, 1)}` : "Tổng cộng"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!pagination || pagination.page <= 1 || loading}
              className="inline-flex min-h-9 items-center rounded-ticket border border-ink/25 bg-white px-3 font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination || pagination.page >= pagination.totalPages || loading}
              className="inline-flex min-h-9 items-center rounded-ticket border border-ink/25 bg-white px-3 font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-import-title">
          <div className="ticket flex max-h-[92vh] w-full max-w-3xl flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/25 p-6 pb-4">
              <div>
                <p className="kicker">Kho nguyên liệu</p>
                <h2 id="create-import-title" className="mt-1 text-xl font-bold text-ink">Tạo phiếu nhập hàng</h2>
                <p className="mt-1 text-xs leading-5 text-content-secondary">Tồn kho sẽ được cộng ngay khi lưu phiếu.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-ticket p-2 text-content-secondary hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label="Đóng">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-content-secondary">Nhà cung cấp
                    <input type="text" maxLength={120} className="field mt-2" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="VD: Cà phê Đắk Lắk" />
                  </label>
                  <label className="block text-xs font-semibold text-content-secondary">Ghi chú
                    <input type="text" maxLength={500} className="field mt-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="VD: Nhập đầu tuần" />
                  </label>
                </div>

                <div className="rounded-ticket border border-ink/15">
                  <div className="flex items-center justify-between gap-3 border-b border-ink/15 bg-paper-deep/40 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-content-secondary">Nguyên liệu nhập</span>
                    <button
                      type="button"
                      onClick={() => setRows((current) => [...current, newRow()])}
                      disabled={rows.length >= 100}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-ticket border border-ink/25 bg-white px-3 text-xs font-semibold text-ink hover:border-ink disabled:opacity-40"
                    >
                      <Plus size={14} aria-hidden="true" /> Thêm dòng
                    </button>
                  </div>

                  <ul className="divide-y divide-ink/10">
                    {rows.map((row, index) => {
                      const ingredient = ingredientById.get(row.ingredientId);
                      const lineTotal = Number(row.quantity) * Number(row.unitPrice);
                      return (
                        <li key={row.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto] sm:items-end">
                          <label className="block text-[11px] font-semibold text-content-secondary">
                            Nguyên liệu
                            <select
                              className="field mt-1"
                              value={row.ingredientId}
                              onChange={(event) => pickIngredient(row.key, event.target.value)}
                              aria-label={`Nguyên liệu dòng ${index + 1}`}
                            >
                              <option value="">Chọn nguyên liệu</option>
                              {ingredients.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.stock.toLocaleString("vi-VN")} {unitOf(item.unit)})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[11px] font-semibold text-content-secondary">
                            Số lượng{ingredient ? ` (${unitOf(ingredient.unit)})` : ""}
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              className="field mt-1"
                              value={row.quantity}
                              onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                              aria-label={`Số lượng dòng ${index + 1}`}
                              required
                            />
                          </label>
                          <label className="block text-[11px] font-semibold text-content-secondary">
                            Đơn giá (đ)
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="field mt-1"
                              value={row.unitPrice}
                              onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
                              aria-label={`Đơn giá dòng ${index + 1}`}
                              required
                            />
                          </label>
                          <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <span className="price text-xs font-semibold text-content-secondary sm:hidden">
                              {Number.isFinite(lineTotal) ? money(lineTotal) : "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRows((current) => current.length > 1 ? current.filter((item) => item.key !== row.key) : [newRow()])}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ticket text-danger hover:bg-danger-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              aria-label={`Xóa dòng ${index + 1}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {ingredients.length === 0 && (
                  <p className="text-xs leading-5 text-content-secondary">
                    Chưa tải được danh sách nguyên liệu. Hãy kiểm tra kết nối máy chủ rồi mở lại phiếu.
                  </p>
                )}
                {formError && <p role="alert" className="rounded-ticket border border-danger/30 bg-danger-light px-3 py-2 text-sm font-medium text-danger">{formError}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/25 p-6 pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">Tổng giá trị phiếu</p>
                  <p className="price text-xl font-bold text-primary">{money(total)}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreateOpen(false)} className="inline-flex min-h-11 items-center rounded-ticket px-4 text-sm font-semibold text-content-secondary hover:bg-paper">Hủy</button>
                  <button type="submit" disabled={saving} className="btn-primary min-h-11 px-4 text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? "Đang lưu…" : "Lưu phiếu nhập"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {(detailLoading || detail || detailError) && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="detail-import-title">
          <div className="ticket flex max-h-[92vh] w-full max-w-2xl flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/25 p-6 pb-4">
              <div>
                <p className="kicker">Chi tiết phiếu</p>
                <h2 id="detail-import-title" className="mt-1 text-xl font-bold text-ink">
                  {detail ? `Phiếu nhập #${detail.importNumber}` : "Đang tải phiếu nhập…"}
                </h2>
                {detail && (
                  <p className="mt-1 text-xs leading-5 text-content-secondary">
                    {date(detail.createdAt)} · {detail.createdBy || "Không rõ người tạo"}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeDetail} className="rounded-ticket p-2 text-content-secondary hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label="Đóng">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {detailError && <p role="alert" className="rounded-ticket border border-danger/30 bg-danger-light px-3 py-2 text-sm font-medium text-danger">{detailError}</p>}
              {!detail && !detailError && <p className="text-sm text-content-secondary">Đang tải chi tiết…</p>}
              {detail && (
                <div className="space-y-5">
                  <dl className="grid gap-3 rounded-ticket border border-ink/15 bg-paper/60 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">Nhà cung cấp</dt>
                      <dd className="mt-1 font-medium text-ink">{detail.supplier || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">Ghi chú</dt>
                      <dd className="mt-1 font-medium text-ink">{detail.note || "—"}</dd>
                    </div>
                  </dl>

                  <div className="overflow-x-auto rounded-ticket border border-ink/15">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.14em] text-content-secondary">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 font-semibold">Nguyên liệu</th>
                          <th scope="col" className="px-4 py-2.5 text-right font-semibold">Số lượng</th>
                          <th scope="col" className="px-4 py-2.5 text-right font-semibold">Đơn giá</th>
                          <th scope="col" className="px-4 py-2.5 text-right font-semibold">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {detail.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-ink">{item.ingredient.name}</span>
                              <span className="mt-0.5 block text-xs text-content-secondary">Tồn hiện tại: {item.ingredient.stock.toLocaleString("vi-VN")} {unitOf(item.ingredient.unit)}</span>
                            </td>
                            <td className="price px-4 py-3 text-right">{item.quantity.toLocaleString("vi-VN")} {unitOf(item.ingredient.unit)}</td>
                            <td className="price px-4 py-3 text-right">{money(item.unitPrice)}</td>
                            <td className="price px-4 py-3 text-right font-semibold text-ink">{money(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-ink/15 bg-paper/60">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-content-secondary">Tổng cộng</td>
                          <td className="price px-4 py-3 text-right text-base font-bold text-primary">{money(detail.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="flex items-start gap-2 text-xs leading-5 text-content-secondary">
                    <Truck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                    Sau khi lưu, tồn kho đã được cộng và giá vốn của từng nguyên liệu lấy theo đơn giá trong phiếu này.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
