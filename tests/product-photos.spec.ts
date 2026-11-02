import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { productPhotoSource, isIllustrativeProductPhoto } from "../src/lib/productPhotos";
import manifest from "../src/lib/product-photo-manifest.json";

test("versioned demo photos preserve identity, originals and supported unrelated sources", async () => {
  for (const [original,photo] of Object.entries(manifest)) {
    expect(productPhotoSource(original)).toBe(photo.src);
    expect(isIllustrativeProductPhoto(original)).toBe(true);
    expect(isIllustrativeProductPhoto(photo.src)).toBe(true);
    const metadata = await sharp("public"+photo.src).metadata();
    expect(metadata.width).toBeGreaterThanOrEqual(1024);
    expect(metadata.height).toBeGreaterThanOrEqual(1536);
    expect(photo.provenance).toContain("AI-enhanced demo illustration");
  }
  for (const original of ["/demo-products/womens-dress/01.jpg","/kadin-product-1.jpg","/unknown.jpg","https://xiunlqsyghlmiedespim.supabase.co/storage/v1/object/public/product-images/photo.jpg"]) {
    expect(productPhotoSource(original)).toBe(original);
    expect(isIllustrativeProductPhoto(original)).toBe(false);
  }
});

test("cargo detail and cards show the complete high-resolution standalone image on mobile and desktop", async ({ page },testInfo) => {
  await page.route("**/api/storefront/region**",route => route.fulfill({ json: { country: "IN",currency: "INR",rate: 1,rateDate: null } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Read the existing local demo fixture by its filename, preserving its own ID.
  const { localProducts } = await import("../src/lib/localProducts");
  const cargo = localProducts.find(product => product.image_url === "/demo-products/mens-trousers/14.jpg");
  if (!cargo) throw new Error("Missing cargo fixture");
  for (const width of [390,1440]) {
    await page.setViewportSize({ width,height: 1000 });
    await page.goto("/men/"+cargo.id);
    const frame = page.getByTestId("product-detail-image");
    const photo = frame.locator("img");
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(photo).toHaveCSS("object-fit","contain");
    await expect(photo).toHaveCSS("transform","none");
    await expect(photo).toHaveAttribute("src",/product-photos-v2%2Fmens-trousers%2F14\.webp/);
    await expect(page.getByText("Illustrative demo imagery.",{ exact: true })).toBeVisible();
    await frame.screenshot({ path: testInfo.outputPath("cargo-detail-"+width+".png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/men/trousers");
  const card = page.getByTestId("product-card").filter({ has: page.getByRole("link", { name: cargo.name,exact: true }) }).first();
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveCSS("object-fit","contain");
  await card.hover();
  await expect(card.locator("img")).toHaveCSS("transform","none");
});
