"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Package, Layers, LogOut,
  Plus, Edit2, Trash2, X, ChevronDown, Upload,
  TrendingUp, AlertTriangle, CheckCircle, Search,
  MessageSquare, Star, Send, User, BarChart, Settings, ShoppingCart,
} from "lucide-react";

const ALL_CATEGORIES = [
  "Women's Dress", "Women's Blouse & Shirt", "Women's Jacket", "Women's Skirt", "Women's Trousers",
  "Men's Suit", "Men's Shirt", "Men's Trousers", "Men's Jacket",
  "Shoes", "Bags", "Accessories", "Perfume", "Makeup",
];

const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image_url: string;
  images: string[];
  description: string;
  sizes: string[];
  created_at: string;
}

interface SizeStock {
  id: string;
  product_id: string;
  size: string;
  stock: number;
}

interface Review {
  id: string;
  product_id: string;
  name: string | null;
  rating: number;
  comment: string;
  created_at: string;
  admin_reply: string | null;
  replied_at: string | null;
}

const emptyForm = {
  name: "", category: ALL_CATEGORIES[0], price: "", stock: "",
  description: "", sizes: [] as string[], image_url: "", images: [] as string[],
};

type Page = "dashboard" | "products" | "stock" | "reviews" | "orders" | "users" | "analytics" | "settings";

export default function AdminApp({ initialPage }: { initialPage?: Page }) {
  const router = useRouter();
  const [page, setPage] = useState<Page>(initialPage ?? "dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [imageInput, setImageInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stock
  const [sizeStocks, setSizeStocks] = useState<SizeStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  // Users (profiles)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("admin_auth") !== "1") router.replace("/admin");
  }, [router]);

  useEffect(() => {
    fetchProducts();
    fetchAllSizeStocks();
  }, []);

  useEffect(() => {
    if (page === "reviews") fetchReviews();
    if (page === "stock") fetchAllSizeStocks();
    if (page === "users") fetchProfiles();
    if (page === "orders") fetchOrders();
    if (page === "analytics") {
      fetchOrders();
      fetchReviews();
    }
  }, [page]);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  }

  async function fetchAllSizeStocks() {
    setStockLoading(true);
    const { data } = await supabase.from("product_size_stock").select("*");
    setSizeStocks(data ?? []);
    setStockLoading(false);
  }

  async function fetchReviews() {
    setReviewsLoading(true);
    setReviewsError("");
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    setReviews(data ?? []);
    if (error) setReviewsError(error.message);
    setReviewsLoading(false);
  }

  async function fetchProfiles() {
    setProfilesLoading(true);
    setProfilesError("");
    const response = await fetch("/api/admin/users");
    const result = await response.json().catch(() => ({}));
    setProfiles(response.ok ? result.users ?? [] : []);
    if (!response.ok) setProfilesError(result.error ?? "Could not load users.");
    setProfilesLoading(false);
  }

  async function fetchOrders() {
    setOrdersLoading(true);
    const response = await fetch("/api/admin/orders");
    const result = await response.json().catch(() => ({}));
    setOrders(response.ok ? result.orders ?? [] : []);
    setOrdersLoading(false);
  }

  async function updateOrderStatus(orderId: string, status: string) {
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status }),
      });
      if (!response.ok) throw new Error("Failed to update order status");
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (selectedOrder && selectedOrder.id === orderId) setSelectedOrder((s: any) => ({ ...s, status }));
    } catch (err) {
      console.error('Failed updating order status', err);
    }
  }

  function logout() {
    localStorage.removeItem("admin_auth");
    router.push("/admin");
  }

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
    const query = orderSearch.trim().toLowerCase();
    const matchesSearch = !query || String(order.id).toLowerCase().includes(query) || String(order.user_id ?? "").toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  function openAdd() {
    setForm(emptyForm);
    setImageInput("");
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name, category: p.category, price: String(p.price),
      stock: String(p.stock ?? 0), description: p.description ?? "",
      sizes: p.sizes ?? [], image_url: p.image_url ?? "", images: p.images ?? [],
    });
    setImageInput("");
    setEditId(p.id);
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditId(null); }

  function toggleSize(size: string) {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
    }));
  }

  function addImageUrl() {
    const url = imageInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, image_url: f.image_url || url, images: [...f.images, url] }));
    setImageInput("");
  }

  function removeImage(idx: number) {
    setForm((f) => {
      const imgs = f.images.filter((_, i) => i !== idx);
      return { ...f, images: imgs, image_url: imgs[0] ?? "" };
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("product-images").upload(fileName, file);
    if (error || !data) return;
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    const url = urlData.publicUrl;
    setForm((f) => ({ ...f, image_url: f.image_url || url, images: [...f.images, url] }));
  }

  async function saveProduct() {
    if (!form.name || !form.price) return;
    setSaving(true);
    const payload = {
      name: form.name, category: form.category,
      price: parseFloat(form.price), stock: parseInt(form.stock) || 0,
      description: form.description, sizes: form.sizes,
      image_url: form.image_url, images: form.images,
    };
    if (editId) {
      await supabase.from("products").update(payload).eq("id", editId);
    } else {
      const { data: newProduct } = await supabase.from("products").insert(payload).select().single();
      if (newProduct && form.sizes.length > 0) {
        await supabase.from("product_size_stock").insert(
          form.sizes.map((size) => ({ product_id: newProduct.id, size, stock: 0 }))
        );
      }
    }
    setSaving(false);
    closeForm();
    fetchProducts();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  }

  async function updateSizeStock(productId: string, size: string, stock: number) {
    if (stock < 0) return;
    const existing = sizeStocks.find((s) => s.product_id === productId && s.size === size);
    if (existing) {
      await supabase.from("product_size_stock").update({ stock }).eq("id", existing.id);
      setSizeStocks((prev) => prev.map((s) => s.id === existing.id ? { ...s, stock } : s));
    } else {
      const { data } = await supabase
        .from("product_size_stock")
        .insert({ product_id: productId, size, stock })
        .select()
        .single();
      if (data) setSizeStocks((prev) => [...prev, data]);
    }
  }

  function getSizeStock(productId: string, size: string) {
    return sizeStocks.find((s) => s.product_id === productId && s.size === size)?.stock ?? 0;
  }

  async function submitReply(reviewId: string) {
    const reply = replyTexts[reviewId]?.trim();
    if (!reply) return;
    setReplyingId(reviewId);
    await supabase.from("reviews").update({
      admin_reply: reply,
      replied_at: new Date().toISOString(),
    }).eq("id", reviewId);
    setReviews((prev) => prev.map((r) => r.id === reviewId
      ? { ...r, admin_reply: reply, replied_at: new Date().toISOString() }
      : r
    ));
    setReplyTexts((prev) => ({ ...prev, [reviewId]: "" }));
    setReplyingId(null);
  }

  async function deleteReply(reviewId: string) {
    await supabase.from("reviews").update({ admin_reply: null, replied_at: null }).eq("id", reviewId);
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, admin_reply: null, replied_at: null } : r));
  }

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalStock = products.reduce((total, product) => {
    const productSizes = (product.sizes ?? []).map((size) => getSizeStock(product.id, size));
    return total + (productSizes.length > 0 ? productSizes.reduce((sum, stock) => sum + stock, 0) : product.stock ?? 0);
  }, 0);
  const outOfStock = products.filter((p) =>
    (p.sizes ?? []).length > 0
      ? (p.sizes ?? []).every((size) => getSizeStock(p.id, size) === 0)
      : (p.stock ?? 0) === 0
  ).length;
  const lowStock = products.filter((p) =>
    (p.sizes ?? []).some((size) => {
      const s = getSizeStock(p.id, size);
      return s > 0 && s < 5;
    })
  ).length;

  const analyticsRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orderStatusCounts = ["pending", "processing", "shipped", "delivered", "cancelled"].map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }));
  const topProducts = products
    .map((product) => ({
      product,
      units: orders.flatMap((order) => order.order_items ?? []).filter((item: any) => item.product_id === product.id).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
    }))
    .filter((entry) => entry.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "TRY", minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
    { id: "products", label: "Products", icon: <Package size={16} strokeWidth={1.5} /> },
    { id: "stock", label: "Stock Management", icon: <Layers size={16} strokeWidth={1.5} /> },
    { id: "orders", label: "Orders", icon: <ShoppingCart size={16} strokeWidth={1.5} /> },
    { id: "users", label: "Users", icon: <User size={16} strokeWidth={1.5} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart size={16} strokeWidth={1.5} /> },
    { id: "reviews", label: "Reviews", icon: <MessageSquare size={16} strokeWidth={1.5} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} strokeWidth={1.5} /> },
  ];

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-56 bg-neutral-900 flex flex-col flex-shrink-0">
        <div className="px-6 py-6 border-b border-neutral-800">
          <p className="text-white text-[13px] tracking-[0.25em] font-light">EL&apos;S</p>
          <p className="text-neutral-500 text-[9px] tracking-[0.3em] uppercase mt-0.5">Admin Panel</p>
          <a href="/" className="inline-flex items-center gap-1.5 mt-3 text-neutral-500 hover:text-neutral-300 transition-colors text-[9px] tracking-[0.2em] uppercase">
            ← Back to Site
          </a>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setShowForm(false); setSelectedStockProduct(null); }}
              className={`w-full flex items-center gap-3 px-6 py-3 text-[11px] tracking-[0.15em] uppercase transition-colors ${
                page === item.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-neutral-800">
          <button onClick={logout} className="flex items-center gap-3 text-neutral-500 hover:text-white transition-colors text-[11px] tracking-[0.15em] uppercase">
            <LogOut size={15} strokeWidth={1.5} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Dashboard */}
        {page === "dashboard" && (
          <div className="p-8">
            <h1 className="text-[22px] font-light text-neutral-800 mb-1">Welcome</h1>
            <p className="text-[12px] text-neutral-400 mb-8">EL&apos;S store administration panel</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Products", value: products.length, icon: <Package size={18} strokeWidth={1.5} />, color: "text-neutral-700" },
                { label: "Total Stock", value: totalStock, icon: <TrendingUp size={18} strokeWidth={1.5} />, color: "text-emerald-600" },
                { label: "Out of Stock", value: outOfStock, icon: <AlertTriangle size={18} strokeWidth={1.5} />, color: "text-red-400" },
                { label: "Low Stock", value: lowStock, icon: <AlertTriangle size={18} strokeWidth={1.5} />, color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-neutral-100 p-5">
                  <div className={`mb-3 ${s.color}`}>{s.icon}</div>
                  <p className="text-[26px] font-light text-neutral-800">{s.value}</p>
                  <p className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products (reuse dashboard product UI) */}
        {page === "products" && !showForm && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[20px] font-light text-neutral-800">Products</h1>
                <p className="text-[11px] text-neutral-400 mt-0.5">{products.length} items</p>
              </div>
              <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-black transition-colors">
                <Plus size={14} strokeWidth={2} />
                Add Product
              </button>
            </div>
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-3 text-neutral-300" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
                  className="w-full border border-neutral-100 pl-9 pr-4 py-2.5 text-[12px] font-light focus:outline-none focus:border-neutral-300 bg-white" />
              </div>
              <div className="relative">
                <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                  className="border border-neutral-100 px-4 py-2.5 text-[12px] font-light focus:outline-none appearance-none pr-8 bg-white">
                  <option value="All">All Categories</option>
                  {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-3.5 text-neutral-400 pointer-events-none" />
              </div>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 bg-neutral-100 animate-pulse" />)}</div>
            ) : (
              <div className="bg-white border border-neutral-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {['Image', 'Product Name', 'Category', 'Price', 'Sizes', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.25em] text-neutral-400 uppercase font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filtered.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          {p.image_url
                            ? <img src={p.image_url} alt="" className="w-9 h-11 object-cover object-top" />
                            : <div className="w-9 h-11 bg-neutral-100" />}
                        </td>
                        <td className="px-4 py-3"><p className="text-[12px] font-medium text-neutral-800">{p.name}</p></td>
                        <td className="px-4 py-3"><span className="text-[11px] text-neutral-400">{p.category}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] text-neutral-700">{fmt(p.price)}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(p.sizes ?? []).map((s) => (
                              <span key={s} className="text-[9px] border border-neutral-200 px-1.5 py-0.5 text-neutral-500">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-neutral-100 rounded transition-colors">
                              <Edit2 size={13} strokeWidth={1.5} className="text-neutral-500" />
                            </button>
                            <button onClick={() => deleteProduct(p.id)} className="p-1.5 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={13} strokeWidth={1.5} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="text-center py-12 text-[12px] text-neutral-300">No products found.</p>}
              </div>
            )}
          </div>
        )}

        {/* Product Form (full add/edit UI) */}
        {page === "products" && showForm && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-[20px] font-light text-neutral-800">{editId ? "Edit Product" : "Add New Product"}</h1>
              <div className="flex items-center gap-3">
                <button onClick={closeForm} className="px-5 py-2.5 border border-neutral-200 text-[10px] tracking-[0.2em] uppercase text-neutral-500 hover:border-neutral-400 transition-colors">Cancel</button>
                <button onClick={saveProduct} disabled={saving || !form.name || !form.price}
                  className="px-6 py-2.5 bg-neutral-900 text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
              <div className="flex flex-col gap-6">
                <div className="bg-white border border-neutral-100 p-6">
                  <p className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mb-5">Basic Information</p>
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="text-[10px] tracking-[0.15em] text-neutral-500 uppercase block mb-2">Product Name *</label>
                      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Product name"
                        className="w-full border-b border-neutral-200 py-2 text-[14px] font-light focus:outline-none focus:border-neutral-800 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[10px] tracking-[0.15em] text-neutral-500 uppercase block mb-2">Category</label>
                      <div className="relative">
                        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full border-b border-neutral-200 py-2 text-[13px] font-light focus:outline-none focus:border-neutral-800 appearance-none bg-transparent pr-6">
                          {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-0 top-3 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] tracking-[0.15em] text-neutral-500 uppercase block mb-2">Price (₺) *</label>
                        <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0"
                          className="w-full border-b border-neutral-200 py-2 text-[14px] font-light focus:outline-none focus:border-neutral-800 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] tracking-[0.15em] text-neutral-500 uppercase block mb-2">Overall Stock</label>
                        <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="0"
                          className="w-full border-b border-neutral-200 py-2 text-[14px] font-light focus:outline-none focus:border-neutral-800 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-neutral-100 p-6">
                  <p className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mb-5">Description</p>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Product description..." rows={5}
                    className="w-full text-[13px] font-light focus:outline-none resize-none placeholder:text-neutral-300 text-neutral-700 leading-relaxed" />
                </div>
                <div className="bg-white border border-neutral-100 p-6">
                  <p className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mb-5">Sizes</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SIZES.map((size) => (
                      <button key={size} onClick={() => toggleSize(size)}
                        className={`px-3 py-1.5 text-[11px] font-medium border transition-colors ${
                          form.sizes.includes(size) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-500 hover:border-neutral-500"
                        }`}>
                        {size}
                      </button>
                    ))}
                  </div>
                  {form.sizes.length > 0 && (
                    <p className="text-[10px] text-neutral-400 mt-3">For size-based stock, use the Stock Management page.</p>
                  )}
                </div>
              </div>
              <div className="bg-white border border-neutral-100 p-6 h-fit">
                <p className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mb-5">Images</p>
                {form.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {form.images.map((img, i) => (
                      <div key={i} className="relative aspect-[3/4] bg-neutral-50 overflow-hidden group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover object-top" />
                        {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-neutral-900/70 text-white text-[8px] text-center py-0.5 tracking-wider">MAIN</span>}
                        <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-white/90 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mb-3">
                  <input
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addImageUrl();
                    }}
                    placeholder="Paste URL..."
                    className="flex-1 border border-neutral-100 px-3 py-2 text-[11px] font-light focus:outline-none focus:border-neutral-300 transition-colors"
                  />
                  <button onClick={addImageUrl} className="px-3 py-2 bg-neutral-100 text-[11px] text-neutral-600 hover:bg-neutral-200 transition-colors">Add</button>
                </div>
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-neutral-200 py-5 flex flex-col items-center gap-2 hover:border-neutral-400 transition-colors text-neutral-400 hover:text-neutral-600">
                  <Upload size={18} strokeWidth={1.5} />
                  <span className="text-[10px] tracking-wide">Upload File</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
            </div>
          </div>
        )}

        {/* Stock */}
        {page === "stock" && (
          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-light text-neutral-800">Stock Management</h1>
              <p className="text-[11px] text-neutral-400 mt-0.5">Size-based stock tracking</p>
            </div>
            {stockLoading ? <div className="h-32 bg-neutral-100 animate-pulse" /> : (
              <div className="bg-white border border-neutral-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-50"><tr>{["Product", "Size", "Units", "Status"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-[9px] tracking-[0.25em] text-neutral-400 uppercase">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-neutral-50">
                    {products.flatMap((product) => {
                      if ((product.sizes ?? []).length === 0) {
                        return [{ product, size: "Overall", stock: product.stock ?? 0, overall: true }];
                      }
                      return product.sizes.map((size) => ({ product, size, stock: getSizeStock(product.id, size), overall: false }));
                    }).map((row) => (
                      <tr key={`${row.product.id}-${row.size}`}>
                        <td className="px-4 py-3 text-[12px] text-neutral-800">{row.product.name}</td>
                        <td className="px-4 py-3 text-[11px] text-neutral-500">{row.size}</td>
                        <td className="px-4 py-3">{row.overall ? <input type="number" min="0" defaultValue={row.stock} onBlur={async (event) => { const stock = Number(event.target.value); if (stock < 0) return; await supabase.from("products").update({ stock }).eq("id", row.product.id); setProducts((previous) => previous.map((product) => product.id === row.product.id ? { ...product, stock } : product)); }} className="w-20 border-b border-neutral-200 py-1 text-[12px] outline-none focus:border-black" /> : <input type="number" min="0" defaultValue={row.stock} onBlur={(event) => updateSizeStock(row.product.id, row.size, Number(event.target.value))} className="w-20 border-b border-neutral-200 py-1 text-[12px] outline-none focus:border-black" />}</td>
                        <td className="px-4 py-3 text-[10px] uppercase tracking-wide text-neutral-400">{row.stock === 0 ? "Out of stock" : row.stock < 5 ? "Low stock" : "Available"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length === 0 && <p className="p-8 text-center text-[12px] text-neutral-400">No products found.</p>}
              </div>
            )}
          </div>
        )}

        {/* Orders */}
        {page === "orders" && (
          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-light text-neutral-800">Orders</h1>
              <p className="text-[11px] text-neutral-400">{orders.length} total orders · update fulfillment status</p>
            </div>

            <div className="mb-5 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-300" />
                <input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search order ID or user ID" className="w-full border border-neutral-100 bg-white py-2.5 pl-9 pr-4 text-[11px] outline-none focus:border-neutral-300" />
              </div>
              <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} className="border border-neutral-100 bg-white px-4 py-2.5 text-[11px] outline-none focus:border-neutral-300">
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {ordersLoading ? (
              <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-neutral-100 animate-pulse" />)}</div>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-neutral-100 p-6">No orders found.</div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white border border-neutral-100 p-6 text-[12px] text-neutral-500">No orders match the current filters.</div>
            ) : (
              <div className="bg-white border border-neutral-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {['Order ID', 'User', 'Total', 'Status', 'Placed', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.25em] text-neutral-400 uppercase font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-4 py-3"><p className="text-[12px] font-medium text-neutral-800">{String(o.id).slice(0,8)}</p></td>
                        <td className="px-4 py-3"><span className="text-[11px] text-neutral-400">{o.user_id ?? '-'}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] text-neutral-700">{fmt(Number(o.total) || 0)}</span></td>
                        <td className="px-4 py-3"><span className="inline-flex border border-neutral-200 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500">{o.status}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] text-neutral-400">{o.placed_at ? new Date(o.placed_at).toLocaleString() : '-'}</span></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelectedOrder(o)} className="text-[10px] text-neutral-500 hover:text-neutral-800">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {profilesError && <p className="mt-4 border border-red-200 bg-red-50 p-4 text-[12px] text-red-600">{profilesError}</p>}

            {/* Order detail drawer/modal */}
            {selectedOrder && (
              <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-6">
                <div className="w-full max-w-3xl bg-white border border-neutral-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[14px] font-medium text-neutral-800">Order {String(selectedOrder.id).slice(0,8)}</p>
                      <p className="text-[11px] text-neutral-400">{selectedOrder.user_id ?? '-'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select value={selectedOrder.status} onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)} className="border border-neutral-200 px-2 py-1.5 text-[11px] outline-none">
                        {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button onClick={() => setSelectedOrder(null)} className="text-[11px] text-neutral-500">Close</button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-[12px] font-medium text-neutral-700 mb-2">Items</p>
                    <div className="divide-y divide-neutral-100">
                      {(selectedOrder.order_items ?? []).map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-[12px] font-medium text-neutral-800">{it.products?.name ?? 'Product'}</p>
                            <p className="text-[11px] text-neutral-400">Qty: {it.quantity}</p>
                          </div>
                          <div className="text-right text-[12px] text-neutral-700">{fmt(Number(it.unit_price) * Number(it.quantity) || 0)}<p className="text-[10px] text-neutral-400">{it.products?.image_url ? "Product image available" : "No product image"}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-neutral-600">Total</p>
                    <p className="text-[14px] font-medium">{fmt(Number(selectedOrder.total) || 0)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {page === "users" && (
          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-light text-neutral-800">Users</h1>
              <p className="text-[11px] text-neutral-400 mt-0.5">Manage user profiles</p>
            </div>
            {profilesLoading ? (
              <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-14 bg-neutral-100 animate-pulse" />)}</div>
            ) : (
              <div className="bg-white border border-neutral-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {['User', 'Full Name', 'Updated', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.25em] text-neutral-400 uppercase font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-4 py-3"><p className="text-[12px] font-medium text-neutral-800">{p.id}</p></td>
                        <td className="px-4 py-3"><span className="text-[11px] text-neutral-400">{p.full_name ?? '-'}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] text-neutral-700">{p.updated_at ? new Date(p.updated_at).toLocaleString() : '-'}</span></td>
                        <td className="px-4 py-3 text-right"><button className="text-[10px] text-neutral-500 hover:text-neutral-800">View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Analytics */}
        {page === "analytics" && (
          <div className="p-8">
            <h1 className="text-[20px] font-light text-neutral-800 mb-2">Analytics</h1>
            <p className="text-[11px] text-neutral-400 mb-6">Live summaries from your catalog, inventory, reviews, and orders.</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[{ label: "Revenue", value: fmt(analyticsRevenue) }, { label: "Orders", value: orders.length }, { label: "Average order", value: fmt(orders.length ? analyticsRevenue / orders.length : 0) }, { label: "Units in stock", value: totalStock }].map((metric) => <div key={metric.label} className="bg-white border border-neutral-100 p-5"><p className="text-[24px] font-light text-neutral-800">{metric.value}</p><p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-400">{metric.label}</p></div>)}
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="bg-white border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-5"><div><h2 className="text-[13px] font-medium text-neutral-800">Order pipeline</h2><p className="mt-1 text-[11px] text-neutral-400">Current fulfillment status</p></div><ShoppingCart size={17} className="text-neutral-300" /></div>
                <div className="space-y-4">{orderStatusCounts.map((entry) => { const percentage = orders.length ? Math.round((entry.count / orders.length) * 100) : 0; return <div key={entry.status}><div className="flex justify-between text-[11px] text-neutral-500"><span className="capitalize">{entry.status}</span><span>{entry.count} · {percentage}%</span></div><div className="mt-2 h-2 bg-neutral-100"><div className="h-full bg-neutral-800 transition-all" style={{ width: `${percentage}%` }} /></div></div>; })}</div>
              </section>
              <section className="bg-white border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-5"><div><h2 className="text-[13px] font-medium text-neutral-800">Inventory health</h2><p className="mt-1 text-[11px] text-neutral-400">Products needing attention</p></div><AlertTriangle size={17} className="text-amber-500" /></div>
                <div className="space-y-3"><div className="flex justify-between border-b border-neutral-100 pb-3 text-[12px]"><span className="text-neutral-500">Healthy products</span><span className="text-emerald-700">{Math.max(products.length - lowStock - outOfStock, 0)}</span></div><div className="flex justify-between border-b border-neutral-100 pb-3 text-[12px]"><span className="text-neutral-500">Low stock</span><span className="text-amber-600">{lowStock}</span></div><div className="flex justify-between text-[12px]"><span className="text-neutral-500">Out of stock</span><span className="text-red-500">{outOfStock}</span></div></div>
              </section>
              <section className="bg-white border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-5"><div><h2 className="text-[13px] font-medium text-neutral-800">Top products</h2><p className="mt-1 text-[11px] text-neutral-400">Units sold in loaded orders</p></div><TrendingUp size={17} className="text-neutral-300" /></div>
                {topProducts.length === 0 ? <p className="text-[12px] text-neutral-400">No product sales data yet.</p> : <div className="space-y-3">{topProducts.map((entry) => <div key={entry.product.id} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"><span className="truncate text-[12px] text-neutral-700">{entry.product.name}</span><span className="whitespace-nowrap text-[11px] text-neutral-400">{entry.units} units</span></div>)}</div>}
              </section>
              <section className="bg-white border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-5"><div><h2 className="text-[13px] font-medium text-neutral-800">Customer signal</h2><p className="mt-1 text-[11px] text-neutral-400">Review activity</p></div><Star size={17} className="text-amber-500" /></div>
                <p className="text-[30px] font-light text-neutral-800">{reviews.length ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1) : "0.0"}<span className="ml-2 text-[12px] text-neutral-400">/ 5 average</span></p><p className="mt-2 text-[11px] text-neutral-400">{reviews.length} total reviews</p>
              </section>
            </div>
          </div>
        )}

        {/* Reviews */}
        {page === "reviews" && (
          <div className="p-8">{/* reuse reviews UI area */}
            <div className="mb-6">
              <h1 className="text-[20px] font-light text-neutral-800">Reviews</h1>
              <p className="text-[11px] text-neutral-400 mt-0.5">{reviews.length} reviews</p>
            </div>
            {reviewsError && <p className="mb-4 border border-red-200 bg-red-50 p-4 text-[12px] text-red-600">{reviewsError}</p>}
            {reviewsLoading ? <div className="h-32 bg-neutral-100 animate-pulse" /> : reviews.length === 0 ? <div className="bg-white border border-neutral-100 p-6 text-[12px] text-neutral-400">No reviews found.</div> : <div className="space-y-3">{reviews.map((review) => <div key={review.id} className="bg-white border border-neutral-100 p-5"><div className="flex items-center justify-between"><p className="text-[12px] text-neutral-800">{review.name ?? "Customer review"}</p><span className="flex items-center gap-1 text-[11px] text-amber-500"><Star size={13} /> {review.rating}/5</span></div><p className="mt-3 text-[13px] leading-6 text-neutral-600">{review.comment}</p><p className="mt-3 text-[10px] text-neutral-400">{formatDate(review.created_at)}{review.admin_reply ? " · Replied" : " · Awaiting reply"}</p></div>)}</div>}
          </div>
        )}

        {/* Settings */}
        {page === "settings" && (
          <div className="p-8">
            <h1 className="text-[20px] font-light text-neutral-800 mb-2">Settings</h1>
            <p className="text-[11px] text-neutral-400 mb-6">Site configuration and feature toggles.</p>
            <div className="bg-white border border-neutral-100 divide-y divide-neutral-100"><div className="p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Storefront</p><p className="mt-2 text-[13px] text-neutral-800">zeouf Luxury Fashion &amp; Lifestyle</p></div><div className="p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Catalog</p><p className="mt-2 text-[13px] text-neutral-800">{products.length} products across {new Set(products.map((product) => product.category)).size} categories</p></div><div className="p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Database</p><p className="mt-2 text-[13px] text-emerald-700">Supabase connection configured</p></div></div>
          </div>
        )}

      </main>
    </div>
  );
}
