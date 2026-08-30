export function validateLoginInput(
  email: string,
  password: string
): { valid: true } | { valid: false; error: string } {
  if (!email) return { valid: false, error: 'Email obbligatoria' };
  if (!password) return { valid: false, error: 'Password obbligatoria' };
  return { valid: true };
}
