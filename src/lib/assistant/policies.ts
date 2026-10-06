export interface PolicyEntry {
  topic: string;
  summary: string[];
}

// Only facts already published by the storefront (product page "Shipping, Exchanges & Returns"
// defaults and the demo checkout) belong here. Do not add anything the store does not publish.
export const STORE_POLICIES: Record<string, PolicyEntry> = {
  shipping: {
    topic: "shipping",
    summary: [
      "Free standard shipping on all orders.",
      "No delivery date estimates are published, so none can be promised.",
      "Checkout is a demo: no order is actually shipped.",
    ],
  },
  returns: {
    topic: "returns",
    summary: [
      "Free returns within 30 days of delivery.",
      "Items must be unworn, unwashed and with original tags attached.",
      "An individual product page may list its own shipping and returns notes.",
    ],
  },
  payment: {
    topic: "payment",
    summary: [
      "Checkout offers two demo payment methods: card (demo) and cash on delivery.",
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
