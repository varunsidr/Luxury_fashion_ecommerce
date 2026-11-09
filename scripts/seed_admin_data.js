const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");

async function seed() {
  const { demoEmail, seedAdminFixtures } = await import("./admin-fixtures.mjs");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL) throw new Error("Missing fixture configuration");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let user;
  for (let page = 1; !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    user = data.users.find(candidate => candidate.email === demoEmail);
    if (data.users.length < 1000) break;
  }
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoEmail, password: process.env.DEMO_USER_PASSWORD || "DemoCustomer123!",
      email_confirm: true, user_metadata: { full_name: "Demo Customer" },
    });
    if (error || !data.user) throw error || new Error("Could not create fixture user");
    user = data.user;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await seedAdminFixtures(client, user.id);
    console.log(`Committed ${result.orders} demo orders and ${result.reviews} fictional approved reviews. Inventory was retained. Demo account: ${demoEmail}`);
  } finally { await client.end(); }
}

seed().catch(() => {
  console.error("Admin fixture seed failed. Verify matching Supabase/DATABASE_URL settings, migrations and at least four products. Application fixtures roll back together; a newly provisioned demo Auth user may remain. Credentials and database error details are omitted.");
  process.exitCode = 1;
});
