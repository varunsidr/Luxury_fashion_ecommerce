import type { ProductComparison } from "@/lib/assistant/types";

export default function AssistantComparison({ comparison }: { comparison: ProductComparison }) {
  return <div className="assistant-comparison" role="region" aria-label="Product comparison" tabIndex={0} data-testid="assistant-comparison">
    <table>
      <caption>Catalog comparison<span>Scroll across to see every product.</span></caption>
      <thead><tr><th scope="col">Detail</th>{comparison.products.map(product => <th scope="col" key={product.id}>{product.name}</th>)}</tr></thead>
      <tbody>{comparison.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={comparison.products[index]?.id ?? index}>{value}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
