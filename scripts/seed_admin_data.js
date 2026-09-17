const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = "demo.customer@zeouf.local";
const demoPassword = "DemoCustomer123!";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function getOrCreateDemoUser() {
  const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  let user = usersPage.users.find((candidate) => candidate.email === demoEmail);
  if (!user) {
    const result = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: "Demo Customer" },
    });
    if (result.error || !result.data.user) throw result.error ?? new Error("Could not create demo user");
    user = result.data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: "Demo Customer",
  }, { onConflict: "id" });
  if (profileError) throw profileError;
  return user;
}

async function seed() {
  const demoUser = await getOrCreateDemoUser();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price")
    .order("created_at", { ascending: true })
    .limit(6);
  if (productsError) throw productsError;
  if (!products || products.length < 3) throw new Error("Seed products first with npm run seed:products.");

  const stockUpdates = products.map((product, index) =>
    supabase.from("products").update({ stock: index < 12 ? (index % 4) + 2 : 0 }).eq("id", product.id)
  );
  const stockResults = await Promise.all(stockUpdates);
  const stockError = stockResults.find((result) => result.error)?.error;
  if (stockError) throw stockError;

  const orders = [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      user_id: demoUser.id,
      total: Number(products[0].price) + Number(products[1].price),
      status: "delivered",
      shipping_address: { fullName: "Demo Customer", address: "1 Demo Street", city: "Istanbul", postalCode: "34000", source: "admin-demo-seed" },
      payment_method: "card_demo",
      placed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      user_id: demoUser.id,
      total: Number(products[2].price) * 2,
      status: "processing",
      shipping_address: { fullName: "Demo Customer", address: "1 Demo Street", city: "Istanbul", postalCode: "34000", source: "admin-demo-seed" },
      payment_method: "cash_on_delivery",
      placed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: "a0000000-0000-4000-8000-000000000003",
      user_id: demoUser.id,
      total: Number(products[3].price),
      status: "pending",
      shipping_address: { fullName: "Demo Customer", address: "1 Demo Street", city: "Istanbul", postalCode: "34000", source: "admin-demo-seed" },
      payment_method: "card_demo",
      placed_at: new Date().toISOString(),
    },
  ];

  const { error: orderError } = await supabase.from("orders").upsert(orders, { onConflict: "id" });
  if (orderError) throw orderError;

  const orderItems = [
    { id: "b0000000-0000-4000-8000-000000000001", order_id: orders[0].id, product_id: products[0].id, quantity: 1, unit_price: products[0].price },
    { id: "b0000000-0000-4000-8000-000000000002", order_id: orders[0].id, product_id: products[1].id, quantity: 1, unit_price: products[1].price },
    { id: "b0000000-0000-4000-8000-000000000003", order_id: orders[1].id, product_id: products[2].id, quantity: 2, unit_price: products[2].price },
    { id: "b0000000-0000-4000-8000-000000000004", order_id: orders[2].id, product_id: products[3].id, quantity: 1, unit_price: products[3].price },
  ];
  const { error: itemError } = await supabase.from("order_items").upsert(orderItems, { onConflict: "id" });
  if (itemError) throw itemError;

  const reviews = products.slice(0, 4).map((product, index) => ({
    id: `c0000000-0000-4000-8000-00000000000${index + 1}`,
    product_id: product.id,
    user_id: demoUser.id,
    rating: index === 2 ? 4 : 5,
    title: "Demo customer review",
    comment: ["Beautiful quality and fast delivery.", "The fit and finish are excellent.", "Lovely piece, slightly smaller than expected.", "Looks exactly like the product photos."][index],
    approved: true,
  }));
  const { error: reviewError } = await supabase.from("reviews").upsert(reviews, { onConflict: "id" });
  if (reviewError) throw reviewError;

  console.log(`Seeded demo customer ${demoEmail}.`);
  console.log(`Created ${orders.length} orders and ${reviews.length} approved reviews.`);
  console.log(`Demo customer password: ${demoPassword}`);
}

seed().catch((error) => {
  console.error("Admin demo data seed failed:", error.message ?? error);
  process.exit(1);
});
