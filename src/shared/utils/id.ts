export function isPositiveIntegerId(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0
}
