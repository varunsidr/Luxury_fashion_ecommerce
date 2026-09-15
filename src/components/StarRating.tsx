"use client";

import { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange }: { value?: number, onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((s) => (
        <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onChange?.(s)}>
          <Star size={20} strokeWidth={1.2} className={`transition-colors duration-100 ${s <= (hover || value) ? 'fill-neutral-900 text-neutral-900' : 'text-neutral-200 hover:text-neutral-400'}`} />
        </button>
      ))}
    </div>
  );
}
