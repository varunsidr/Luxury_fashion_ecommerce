export interface PolicyEntry {
  topic: string;
  summary: string[];
}

// Keep these facts aligned with the storefront's portfolio-demo copy.
export const STORE_POLICIES: Record<string, PolicyEntry> = {
  shipping: {
    topic: "shipping",
    summary: [
      "zeouf is a portfolio demo: no products are shipped and no delivery is arranged.",
      "Shipping services and delivery date estimates are not available for demo orders.",
    ],
  },
  returns: {
    topic: "returns",
    summary: [
      "Shipping, exchanges and returns are not available for demo orders.",
      "No delivery confirmation or customer support follow-up is provided. Use fictional contact and address details.",
    ],
  },
  payment: {
    topic: "payment",
    summary: [
      "Checkout offers two demo payment methods: simulated successful card payment and simulated cash on delivery.",
      "Checkout is a demo: no payment is charged.",
      "Shoppers must be signed in to add to the bag and to check out.",
    ],
  },
  orders: {
    topic: "orders",
    summary: [
      "Signed-in customers can see their own orders on the Orders page (/orders).",
      "The assistant cannot look up, change or cancel orders.",
    ],
  },
  sizing: {
    topic: "sizing",
    summary: [
      "Garment measurements may vary by size; each product page has a size guide and measurements section.",
      "Size availability is shown per product.",
    ],
  },
};

export const POLICY_TOPICS = [...Object.keys(STORE_POLICIES), "all"] as const;
