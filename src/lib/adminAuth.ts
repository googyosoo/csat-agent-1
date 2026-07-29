/**
 * Admin authorization utilities for the CSAT Agent Platform.
 */

export const ADMIN_EMAILS: string[] = [
  'kiparang999@gmail.com',
  'hongjinwoo@simin.hs.kr',
  'sitech3@simin.hs.kr',
];

/**
 * Check if the given email is an authorized administrator.
 */
export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === cleanEmail);
}
