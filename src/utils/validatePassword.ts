export function validatePassword(
  password: string,
  confirm: string,
  messages: { tooShort: string; mismatch: string },
  minLength = 8
): string | null {
  if (password.length < minLength) {
    return messages.tooShort;
  }
  if (password !== confirm) {
    return messages.mismatch;
  }
  return null;
}
