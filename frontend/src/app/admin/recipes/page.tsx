'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, FlaskConical, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useRequestCooldown } from '@/components/use-request-cooldown';
import { ApiError } from '@/lib/api-client';
import { deleteIngredient, getRecipe, getRecipeCatalog, saveIngredient, saveRecipe, unitLabels, type IngredientUnit, type RecipeCatalog } from '@/services/recipe.service';
import type { ProductSize } from '@/types/product';

type Row = { key: string; ingredientId: string; quantity: string };
const control = 'min-h-11 rounded-ticket border border-ink/20 bg-white px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
const button = `${control} inline-flex items-center justify-center gap-2 font-semibold text-primary hover:border-ink hover:bg-paper disabled:cursor-not-allowed`;
const messageFor = (error: unknown) => error instanceof ApiError && error.statusCode === 401 ? 'Vui lòng đăng nhập để quản lý công thức.'
  : error instanceof ApiError && error.statusCode === 403 ? 'Bạn cần quyền quản trị để quản lý công thức.'
    : error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';

export default function RecipeManagementPage() {
  const [catalog, setCatalog] = useState<RecipeCatalog | null>(null);
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState<ProductSize>('S');
  const [draft, setDraft] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  const [recipeReload, setRecipeReload] = useState(0);
  const [form, setForm] = useState({ id: '', name: '', unit: 'G' as IngredientUnit });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selection = useRef({ productId, size });
  selection.current = { productId, size };
  const catalogRequest = useRef<AbortController | null>(null);
  const recipeRequest = useRef<AbortController | null>(null);
  const refresh = useRequestCooldown('GET', '/admin/recipes/catalog');
  const recipeWrite = useRequestCooldown('PUT', '/admin/recipes/:productId/:size');
  const ingredientCreate = useRequestCooldown('POST', '/admin/recipes/ingredients');
  const ingredientUpdate = useRequestCooldown('PATCH', '/admin/recipes/ingredients/:id');
  const ingredientDelete = useRequestCooldown('DELETE', '/admin/recipes/ingredients/:id');

  useEffect(() => {
    const controller = new AbortController(); catalogRequest.current = controller;
    const token = localStorage.getItem('token');
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setLoading(true);
    void getRecipeCatalog(controller.signal).then(data => {
      if (!current()) return;
      setCatalog(data);
      const chosen = data.products.find(product => product.id === selection.current.productId && product.sizes.length) || data.products.find(product => product.sizes.length);
      setProductId(chosen?.id || '');
      setSize(chosen?.sizes.some(item => item.size === selection.current.size) ? selection.current.size : chosen?.sizes[0]?.size || 'S');
    }).catch(cause => {
      if (!current()) return;
      setError(messageFor(cause));
      if (cause instanceof ApiError && [401, 403].includes(cause.statusCode)) { setCatalog(null); setDraft([]); }
    }).finally(() => { if (current()) setLoading(false); });
    return () => controller.abort();
  }, [catalogReload]);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController(); recipeRequest.current = controller;
    const token = localStorage.getItem('token');
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setRecipeLoading(true); setLoadedKey(''); setDraft([]); setDirty(false);
    void getRecipe(productId, size, controller.signal).then(recipe => {
      if (!current()) return;
      setDraft(recipe.items.map(item => ({ key: crypto.randomUUID(), ingredientId: item.ingredientId, quantity: String(item.quantity) })));
      setLoadedKey(`${productId}:${size}`);
    }).catch(cause => { if (current()) { setError(messageFor(cause)); if (cause instanceof ApiError && [401, 403].includes(cause.statusCode)) setCatalog(null); } })
      .finally(() => { if (current()) setRecipeLoading(false); });
    return () => controller.abort();
  }, [productId, size, recipeReload]);

  useEffect(() => {
    let token = localStorage.getItem('token');
    const onAuth = () => {
      const next = localStorage.getItem('token'); if (token === next) return; token = next;
      catalogRequest.current?.abort(); recipeRequest.current?.abort();
      setCatalog(null); setDraft([]); setProductId(''); setLoadedKey(''); setDirty(false); setBusy(''); setError(''); setNotice(''); setForm({ id: '', name: '', unit: 'G' }); setCatalogReload(value => value + 1);
    };
    window.addEventListener('auth-changed', onAuth); window.addEventListener('storage', onAuth);
    return () => { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('storage', onAuth); };
  }, []);

  async function mutate(action: string, cooldown: { start: () => boolean }, task: () => Promise<unknown>, after: () => void) {
    if (busy || !cooldown.start()) return;
    const token = localStorage.getItem('token'); setBusy(action); setError(''); setNotice('');
    try {
      await task(); if (localStorage.getItem('token') !== token) return;
      after(); setNotice('Đã lưu thay đổi.'); setCatalogReload(value => value + 1);
    } catch (cause) {
      if (localStorage.getItem('token') !== token) return;
      setError(messageFor(cause)); if (cause instanceof ApiError && [401, 403].includes(cause.statusCode)) { setCatalog(null); setDraft([]); }
    } finally { if (localStorage.getItem('token') === token) setBusy(''); }
  }

  const product = catalog?.products.find(item => item.id === productId);
  const ready = Boolean(catalog && productId && loadedKey === `${productId}:${size}` && !recipeLoading);
  const used = new Set(draft.map(item => item.ingredientId));
  const invalid = draft.some(item => !item.ingredientId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0.001 || Number(item.quantity) > 1000000 || (item.quantity.split('.')[1] || '').length > 3 || /e/i.test(item.quantity)) || used.size !== draft.length;
  const editing = catalog?.ingredients.find(item => item.id === form.id);
  const ingredientCooldown = form.id ? ingredientUpdate : ingredientCreate;
  const changeSelection = (id: string, nextSize: ProductSize) => {
    if (dirty && !window.confirm('Bỏ thay đổi công thức chưa lưu?')) return;
    setProductId(id); setSize(nextSize); setError(''); setNotice('');
  };
  const updateRows = (rows: Row[]) => { setDraft(rows); setDirty(true); setNotice(''); };
  const writeRecipe = (items: { ingredientId: string; quantity: number }[]) => mutate('recipe', recipeWrite, () => saveRecipe(productId, size, items), () => { setDirty(false); setRecipeReload(value => value + 1); });

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
      <div>
        <p className="kicker">Sổ quản trị · Công thức</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl"><BookOpen size={26} aria-hidden="true" /> Quản lý công thức</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Định lượng nguyên liệu cho một sản phẩm theo từng size.</p>
      </div>
    </header>
    {error && <p role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-4 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="rounded-ticket border-l-4 border-success bg-success-light p-4 text-sm text-success">{notice}</p>}
    <div className="flex justify-end"><button type="button" className={button} disabled={loading || Boolean(busy) || refresh.blocked} onClick={() => { if (refresh.start()) { setError(''); setCatalogReload(value => value + 1); } }}><RefreshCw size={16} /> {loading ? 'Đang tải…' : refresh.label || 'Làm mới danh mục'}</button></div>
    {catalog && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="recipe-title" className="ticket min-w-0 space-y-5 p-5 sm:p-6">
        <h2 id="recipe-title" className="flex items-center gap-2 font-bold"><BookOpen size={20} className="text-primary" /> Công thức sản phẩm</h2>
        <label className="block text-xs font-semibold text-content-secondary">Sản phẩm<select aria-label="Sản phẩm" value={productId} disabled={Boolean(busy) || loading} onChange={event => { const next = catalog.products.find(item => item.id === event.target.value); changeSelection(event.target.value, next?.sizes[0]?.size || 'S'); }} className={`${control} mt-2 w-full`}><option value="" disabled>Chọn sản phẩm</option>{catalog.products.map(item => <option key={item.id} value={item.id} disabled={!item.sizes.length}>{item.name}{!item.sizes.length ? ' — chưa có size' : ''}</option>)}</select></label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn size">{product?.sizes.map(item => <button key={item.size} type="button" aria-pressed={size === item.size} disabled={Boolean(busy)} onClick={() => changeSelection(productId, item.size)} className={`${button} ${size === item.size ? 'border-primary !bg-primary-light' : ''}`}>Size {item.size} <span className="text-xs text-content-secondary">({item.ingredientCount})</span></button>)}</div>
        {recipeLoading && <p role="status" className="text-sm text-content-secondary">Đang tải công thức…</p>}
        {ready && <><div className="flex items-center justify-between gap-2 text-xs text-content-secondary"><span>{draft.length} nguyên liệu / 1 sản phẩm · Size {size}</span>{dirty && <span className="font-semibold text-primary">Chưa lưu</span>}</div>
          <div className="space-y-3">{draft.map((item, index) => <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_100px_32px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
            <label className="min-w-0 text-xs text-content-secondary">Nguyên liệu {index + 1}<select aria-label={`Nguyên liệu ${index + 1}`} value={item.ingredientId} disabled={Boolean(busy)} onChange={event => updateRows(draft.map(row => row.key === item.key ? { ...row, ingredientId: event.target.value } : row))} className={`${control} mt-1 w-full`}>{catalog.ingredients.map(ingredient => <option key={ingredient.id} value={ingredient.id} disabled={used.has(ingredient.id) && ingredient.id !== item.ingredientId}>{ingredient.name}</option>)}</select></label>
            <label className="text-xs text-content-secondary">Định lượng ({unitLabels[catalog.ingredients.find(ingredient => ingredient.id === item.ingredientId)?.unit || 'G']})<input aria-label={`Định lượng ${index + 1}`} type="number" min="0.001" max="1000000" step="0.001" required value={item.quantity} disabled={Boolean(busy)} onChange={event => updateRows(draft.map(row => row.key === item.key ? { ...row, quantity: event.target.value } : row))} className={`${control} mt-1 w-full`} /></label>
            <button type="button" aria-label={`Bỏ nguyên liệu ${index + 1}`} className={`${button} px-0`} disabled={Boolean(busy)} onClick={() => updateRows(draft.filter(row => row.key !== item.key))}><X size={16} /></button>
          </div>)}{!draft.length && <p role="status" className="rounded-ticket border border-ink/15 bg-paper-deep/40 p-5 text-sm text-content-secondary">Chưa có định lượng cho size này. Thêm nguyên liệu để bắt đầu.</p>}</div>
          {invalid && <p role="alert" className="text-xs text-danger">Mỗi nguyên liệu chỉ xuất hiện một lần. Định lượng từ 0,001 đến 1.000.000, tối đa 3 chữ số thập phân.</p>}
          <button type="button" className={button} disabled={Boolean(busy) || loading || draft.length >= Math.min(100, catalog.ingredients.length)} onClick={() => { const next = catalog.ingredients.find(item => !used.has(item.id)); if (next) updateRows([...draft, { key: crypto.randomUUID(), ingredientId: next.id, quantity: '1' }]); }}><Plus size={16} /> Thêm nguyên liệu</button>
          {!catalog.ingredients.length && <p className="text-xs text-content-secondary">Tạo nguyên liệu trong danh mục trước khi lập công thức.</p>}
          <div className="flex flex-wrap gap-2 border-t border-dashed border-ink/25 pt-5"><button type="button" disabled={!dirty || invalid || Boolean(busy) || recipeWrite.blocked} onClick={() => void writeRecipe(draft.map(item => ({ ingredientId: item.ingredientId, quantity: Number(item.quantity) })))} className={`${button} border-primary !bg-primary !text-white hover:!bg-primary-hover`}><Save size={16} /> {busy === 'recipe' ? 'Đang lưu…' : recipeWrite.label || 'Lưu công thức'}</button><button type="button" disabled={!dirty || Boolean(busy)} onClick={() => setRecipeReload(value => value + 1)} className={button}>Bỏ thay đổi</button><button type="button" disabled={!draft.length || Boolean(busy) || recipeWrite.blocked} onClick={() => { if (window.confirm('Xóa toàn bộ định lượng của sản phẩm và size đang chọn?')) void writeRecipe([]); }} className={`${button} text-danger`}><Trash2 size={16} /> Xóa công thức</button></div>
        </>}
        {!productId && <p role="status" className="text-sm text-content-secondary">Chưa có sản phẩm được cấu hình size.</p>}
      </section>
      <section aria-labelledby="ingredients-title" className="ticket min-w-0 space-y-5 p-5 sm:p-6">
        <h2 id="ingredients-title" className="flex items-center gap-2 font-bold"><FlaskConical size={20} className="text-primary" /> Danh mục nguyên liệu <span className="text-xs font-normal text-content-secondary">({catalog.ingredients.length})</span></h2>
        <form onSubmit={event => { event.preventDefault(); if (form.name.trim()) void mutate('ingredient', ingredientCooldown, () => saveIngredient(form.id, form.name.trim(), form.unit), () => setForm({ id: '', name: '', unit: 'G' })); }} className="space-y-3 rounded-ticket border border-ink/15 bg-paper-deep/40 p-4">
          <p className="text-sm font-semibold">{form.id ? 'Chỉnh sửa nguyên liệu' : 'Thêm nguyên liệu'}</p>
          <label className="block text-xs text-content-secondary">Tên nguyên liệu<input aria-label="Tên nguyên liệu" maxLength={100} required value={form.name} disabled={Boolean(busy)} onChange={event => setForm({ ...form, name: event.target.value })} className={`${control} mt-1 w-full`} placeholder="Ví dụ: Cà phê, sữa tươi…" /></label>
          <label className="block text-xs text-content-secondary">Đơn vị<select aria-label="Đơn vị nguyên liệu" value={form.unit} disabled={Boolean(busy) || Boolean(editing && (editing.recipeCount || used.has(editing.id)))} onChange={event => setForm({ ...form, unit: event.target.value as IngredientUnit })} className={`${control} mt-1 w-full`}>{Object.entries(unitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {editing && (editing.recipeCount > 0 || used.has(editing.id)) && <p className="text-xs text-content-secondary">Đơn vị của nguyên liệu đang dùng trong công thức được giữ cố định.</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={!form.name.trim() || Boolean(busy) || ingredientCooldown.blocked} className={button}><Save size={16} /> {busy === 'ingredient' ? 'Đang lưu…' : ingredientCooldown.label || (form.id ? 'Lưu nguyên liệu' : 'Thêm mới')}</button>{form.id && <button type="button" disabled={Boolean(busy)} onClick={() => setForm({ id: '', name: '', unit: 'G' })} className={button}>Hủy sửa</button>}</div>
        </form>
        <ul className="max-h-[480px] divide-y divide-ink/10 overflow-y-auto">{catalog.ingredients.map(item => <li key={item.id} className="flex items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.name} <span className="font-normal text-content-secondary">({unitLabels[item.unit]})</span></p><p className="mt-1 text-xs text-content-secondary">Dùng trong {item.recipeCount} công thức</p></div><div className="flex shrink-0 gap-1"><button type="button" aria-label={`Sửa ${item.name}`} disabled={Boolean(busy)} onClick={() => setForm({ id: item.id, name: item.name, unit: item.unit })} className={`${button} px-2`}><Pencil size={15} /></button><button type="button" aria-label={`Xóa ${item.name}`} title={item.recipeCount || used.has(item.id) ? 'Nguyên liệu đang được sử dụng' : ingredientDelete.label || 'Xóa nguyên liệu'} disabled={Boolean(busy) || Boolean(item.recipeCount) || used.has(item.id) || ingredientDelete.blocked} onClick={() => { if (window.confirm(`Xóa nguyên liệu ${item.name}?`)) void mutate('delete', ingredientDelete, () => deleteIngredient(item.id), () => { if (form.id === item.id) setForm({ id: '', name: '', unit: 'G' }); }); }} className={`${button} px-2 text-danger`}><Trash2 size={15} /></button></div></li>)}</ul>
        {!catalog.ingredients.length && <p role="status" className="text-sm text-content-secondary">Chưa có nguyên liệu. Thêm nguyên liệu đầu tiên ở biểu mẫu trên.</p>}
      </section>
    </div>}
  </div>;
}
