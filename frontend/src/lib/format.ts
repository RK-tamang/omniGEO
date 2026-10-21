export function formatINR(n: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(n);
}
