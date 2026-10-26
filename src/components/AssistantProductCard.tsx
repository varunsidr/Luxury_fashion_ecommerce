"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, GitCompareArrows, Sparkles } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { ProductCardData } from "@/lib/assistant/types";

interface Props {
  product: ProductCardData;
  busy: boolean;
  selected: boolean;
  onNavigate: () => void;
  onCompare: () => void;
  onSimilar: () => void;
  onAdd: (size: string | null, color: string | null, quantity: number) => void;
}

export default function AssistantProductCard({ product, busy, selected, onNavigate, onCompare, onSimilar, onAdd }: Props) {
  const { formatPrice } = useCurrency();
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const sizes = product.sizes ?? [], colors = product.colors ?? [];
  const valid = (!sizes.length || sizes.some(option => option.size === size && option.inStock)) &&
    (!colors.length || colors.includes(color)) && Number.isInteger(Number(quantity)) && Number(quantity) >= 1 && Number(quantity) <= 10;
  return (
    <div className="assistant-product" data-selected={selected} data-testid="assistant-product">
      <Link href={product.url} onClick={onNavigate} data-testid="assistant-product-card" className="assistant-product-link">
        <span className="assistant-product-image"><Image src={product.image_url} alt="" width={88} height={110} unoptimized /></span>
        <span className="assistant-product-copy">
          <span className="assistant-product-name">{product.name}</span>
          <span className="assistant-product-price">{formatPrice(product.price)}</span>
          <span className="assistant-stock" data-available={product.inStock}><span aria-hidden="true" />{product.inStock ? "In stock" : "Out of stock"}</span>
        </span>
      </Link>
      <dl className="assistant-product-facts">
        <div><dt>Category</dt><dd>{product.category}</dd></div>
        <div><dt>Brand</dt><dd>{product.brand || "Not listed"}</dd></div>
        <div><dt>Sizes</dt><dd>{sizes.length ? sizes.map(option => option.size + (option.inStock ? "" : " (out of stock)")).join(", ") : "No size selection"}</dd></div>
        <div><dt>Colors</dt><dd>{colors.length ? colors.join(", ") : "No color selection"}</dd></div>
      </dl>
      <div className="assistant-product-actions">
        <button type="button" disabled={busy} aria-pressed={selected} aria-label={`Compare ${product.name}`} onClick={onCompare} className="assistant-secondary">{selected ? <Check size={14} aria-hidden="true" /> : <GitCompareArrows size={14} aria-hidden="true" />}{selected ? "Selected" : "Compare"}</button>
        <button type="button" disabled={busy} onClick={onSimilar} className="assistant-secondary"><Sparkles size={14} aria-hidden="true" />Find similar</button>
      </div>
      {product.inStock && (
        <details className="assistant-product-options">
          <summary>Choose options <ChevronDown size={16} aria-hidden="true" /></summary>
          <form className="assistant-option-form" onSubmit={event => { event.preventDefault(); if (valid && !busy) onAdd(size || null, color || null, Number(quantity)); }}>
            {sizes.length > 0 && <label>Size
              <select aria-label={`Size for ${product.name}`} required value={size} onChange={event => setSize(event.target.value)}>
                <option value="" disabled>Choose a size</option>
                {sizes.map(option => <option key={option.size} value={option.size} disabled={!option.inStock}>{option.size}{!option.inStock ? " — out of stock" : ""}</option>)}
              </select>
            </label>}
            {colors.length > 0 && <label>Color
              <select aria-label={`Color for ${product.name}`} required value={color} onChange={event => setColor(event.target.value)}>
                <option value="" disabled>Choose a color</option>
                {colors.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>}
            <label>Quantity
              <input aria-label={`Quantity for ${product.name}`} type="number" min={1} max={10} step={1} required value={quantity} onChange={event => setQuantity(event.target.value)} />
            </label>
            <p>Review first, then Confirm. Stock is checked again before adding.</p>
            <button type="submit" disabled={busy || !valid} className="assistant-primary">Review bag addition <ArrowRight size={15} aria-hidden="true" /></button>
          </form>
        </details>
      )}
    </div>
  );
}
