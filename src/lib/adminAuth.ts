/**
 * Authorization and Domain Validation Utilities for CSAT Agent Platform.
 */

export const ADMIN_EMAILS: string[] = [
  'sitech3@simin.hs.kr',
  'hongjinwoo@simin.hs.kr',
];

export const ALLOWED_STUDENT_DOMAIN = '@simin.hs.kr';

/**
 * Check if the given email belongs to an authorized administrator.
 */
export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === cleanEmail);
}

/**
 * Check if the given email is valid for student access (모든 구글 계정 접근 허용).
 */
export function isAllowedStudentDomain(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return cleanEmail.includes('@');
}

export interface AccessCheckResult {
  allowed: boolean;
  role: 'admin' | 'student' | 'denied';
  reason?: string;
}

/**
 * Validate overall access permission for the logged-in user:
 * 1. Designated admins (sitech3@simin.hs.kr, hongjinwoo@simin.hs.kr): Allowed with 'admin' role.
 * 2. All Google accounts (@simin.hs.kr 및 일반 구글 계정 전체): Allowed with 'student' role.
 */
export function validateUserAccess(email?: string | null): AccessCheckResult {
  if (!email || !email.trim()) {
    return { allowed: false, role: 'denied', reason: '로그인이 필요합니다.' };
  }

  // 1. Check if designated admin (sitech3@simin.hs.kr, hongjinwoo@simin.hs.kr)
  if (isAdminUser(email)) {
    return { allowed: true, role: 'admin' };
  }

  // 2. All valid Google accounts are allowed as students
  return { allowed: true, role: 'student' };
}
