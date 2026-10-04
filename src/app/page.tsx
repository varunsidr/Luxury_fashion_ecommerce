"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowDown, ArrowRight, Pause, Play } from "lucide-react";

const heroSlides = [
  { video: "/rose.mp4", poster: "/kadin-product-1.jpg", label: "A quieter kind\nof statement.", category: "Women's Collection", href: "/women" },
  { video: "/jungkook.mp4", poster: "/erkek-takim-1-b.jpg", label: "Presence,\nwithout effort.", category: "Men's Collection", href: "/men" },
];
const collections = [
  { image: "/kadin-product-1.jpg", label: "For her", detail: "Soft lines. A strong point of view.", href: "/women", number: "01" },
  { image: "/erkek-takim-1-b.jpg", label: "For him", detail: "Considered pieces, worn your way.", href: "/men", number: "02" },
];
const featured = [
  { image: "/canta-5.jpg", title: "The finishing touch", category: "Bags", href: "/bags" },
  { image: "/ayakkabi-1.jpg", title: "A different perspective", category: "Shoes", href: "/shoes" },
  { image: "/aksesuar-3.jpg", title: "Details that stay", category: "Accessories", href: "/accessories" },
  { image: "/kadin-ceket-1.jpg", title: "A little edge", category: "Women's Jackets", href: "/women/jacket" },
  { image: "/parfum-2.jpg", title: "Leave an impression", category: "Perfume", href: "/perfume" },
  { image: "/erkek-takim-3.jpg", title: "The art of tailoring", category: "Men's Suits", href: "/men/suits" },
];
const categories = ["Women", "Men", "Perfume", "Shoes", "Accessories", "Bags", "Makeup"];
const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const current = heroSlides[slide];
  const playing = inView && pageVisible && !paused && !reducedMotion;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.1), { threshold: 0.1 });
    if (heroRef.current) observer.observe(heroRef.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) void video.play().catch(() => { /* Keep the poster if playback is unavailable. */ });
    else video.pause();
    return () => video.pause();
  }, [playing, slide, reducedMotion]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setSlide((value) => (value + 1) % heroSlides.length), 6000);
    return () => clearInterval(timer);
  }, [playing, slide]);

  return (
    <div className="storefront-home">
      <section ref={heroRef} className="editorial-hero" aria-label="Featured collections" data-testid="home-hero">
        <Image src={current.poster} alt="" fill priority loading="eager" sizes="100vw" className="object-cover object-top" />
        <video key={current.video} ref={videoRef} src={reducedMotion ? undefined : current.video} poster={current.poster}
          muted loop playsInline preload="none" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/15 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="editorial-container relative flex h-full flex-col justify-end pb-24 pt-12 md:justify-center md:pb-16">
          <p className="editorial-eyebrow mb-6 text-white/80">The collection / {String(slide + 1).padStart(2, "0")}</p>
          <h1 className="max-w-3xl whitespace-pre-line font-playfair text-[clamp(3rem,6.5vw,6.75rem)] font-normal leading-[1.05] tracking-[-0.045em] text-white">{current.label}</h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/80">Timeless shapes. Unexpected details. Find the pieces that feel like you.</p>
          <Link href={current.href} className="editorial-button mt-8 w-fit border-white/50 bg-white text-neutral-900 hover:bg-white/90">Explore {current.href === "/women" ? "women" : "men"} <ArrowRight size={16} /></Link>
        </div>
        <div className="editorial-container absolute inset-x-0 bottom-7 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            {heroSlides.map((item, index) => <button key={item.href} onClick={() => setSlide(index)} aria-label={`Show ${item.category}`} aria-pressed={slide === index}
              className={`flex min-h-11 items-center gap-2 text-xs ${slide === index ? "text-white" : "text-white/60"}`}>
              <span className={`h-px transition-all ${slide === index ? "w-10 bg-white" : "w-5 bg-white/50"}`} />{String(index + 1).padStart(2, "0")}
            </button>)}
            {!reducedMotion && <button onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play collection video" : "Pause collection video"}
              aria-pressed={paused} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30">{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
          </div>
          <Link href="#collections" className="flex min-h-11 items-center gap-3 text-xs text-white/80">Discover more <ArrowDown size={15} /></Link>
        </div>
      </section>
      <nav aria-label="Explore categories" className="border-b border-[var(--store-line)] bg-[var(--store-surface)]">
        <div className="editorial-container flex flex-wrap items-center justify-center gap-x-7 gap-y-1 py-4 md:gap-x-10">
          {categories.map((category) => <Link key={category} href={`/${category.toLowerCase()}`} className="py-2 text-xs text-[var(--store-muted)] transition-colors hover:text-[var(--store-ink)]">{category}</Link>)}
        </div>
      </nav>
      <section id="collections" className="editorial-container editorial-section scroll-mt-32">
        <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="editorial-eyebrow mb-3">Your everyday, elevated</p><h2 className="editorial-heading">Style is personal.</h2></div>
          <p className="max-w-sm text-sm leading-7 text-[var(--store-muted)]">A considered edit of fashion and lifestyle. Explore a new direction, or rediscover your signature.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {collections.map((item) => <Link key={item.href} href={item.href} className="group relative block aspect-[4/5] overflow-hidden bg-[#e9e5df] md:aspect-[5/4]">
            <Image src={item.image} alt={`${item.label} collection`} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover object-top transition-transform duration-700 motion-safe:group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" /><span className="absolute left-6 top-6 text-xs text-white/80">/{item.number}</span>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white md:p-9">
              <div><h3 className="font-playfair text-4xl tracking-tight md:text-5xl">{item.label}</h3><p className="mt-3 text-sm text-white/80">{item.detail}</p></div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/50 transition-colors group-hover:bg-white group-hover:text-black"><ArrowRight size={19} /></span>
            </div>
          </Link>)}
        </div>
      </section>
      <section className="border-y border-[var(--store-line)] bg-[var(--store-surface)]">
        <div className="editorial-container editorial-section">
          <div className="mb-9 flex items-end justify-between gap-5">
            <div><p className="editorial-eyebrow mb-3">The zeouf edit</p><h2 className="editorial-heading">Small details.<br className="sm:hidden" /> Lasting impressions.</h2></div>
            <span className="hidden text-xs text-[var(--store-muted)] sm:block">Six ways to make it yours</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-10">
            {featured.map((item, index) => <Link key={item.href} href={item.href} className="group" data-testid="home-editorial-link">
              <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-[#ebe7e2]">
                <Image src={item.image} alt={item.category} fill sizes="(max-width: 767px) 50vw, 33vw" className="object-cover object-top transition-transform duration-700 motion-safe:group-hover:scale-[1.04]" />
                <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 transition-transform group-hover:-rotate-45"><ArrowRight size={15} /></span>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-[var(--store-muted)]"><span>{item.category}</span><span>0{index + 1}</span></div>
              <h3 className="mt-2 font-playfair text-lg text-[var(--store-ink)] md:text-2xl">{item.title}</h3>
            </Link>)}
          </div>
        </div>
      </section>
      <section className="editorial-container editorial-section">
        <div className="grid overflow-hidden bg-[#e9e4dc] md:grid-cols-2">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px]"><Image src="/kadin-bluz-1.jpg" alt="Women's blouse collection" fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover object-top" /></div>
          <div className="flex flex-col items-start justify-center p-8 md:p-12 lg:p-16">
            <p className="editorial-eyebrow mb-5">In focus / The blouse edit</p><h2 className="editorial-heading">Ease, in every<br />little detail.</h2>
            <p className="mt-6 max-w-sm text-sm leading-7 text-[var(--store-muted)]">From soft silhouettes to a crisp shirt. Discover an everyday piece with a point of view.</p>
            <Link href="/women/blouse" className="editorial-button mt-8 border-[var(--store-ink)] bg-[var(--store-ink)] text-white hover:bg-neutral-700">Explore the edit <ArrowRight size={16} /></Link>
          </div>
        </div>
        <p className="mt-10 text-center text-xs leading-6 text-[var(--store-muted)]">A portfolio shopping experience. Orders and payments are simulated. <Link href="/privacy" className="underline underline-offset-4">About this demo</Link></p>
      </section>
    </div>
  );
}
