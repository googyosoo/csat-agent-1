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
 * Check if the given email belongs to an allowed student domain (@simin.hs.kr).
 */
export function isAllowedStudentDomain(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return cleanEmail.endsWith(ALLOWED_STUDENT_DOMAIN.toLowerCase());
}

export interface AccessCheckResult {
  allowed: boolean;
  role: 'admin' | 'student' | 'denied';
  reason?: string;
}

/**
 * Validate overall access permission for the logged-in user:
 * 1. Designated admins (sitech3@simin.hs.kr, hongjinwoo@simin.hs.kr): Allowed with 'admin' role.
 * 2. Students with '@simin.hs.kr' domain: Allowed with 'student' role.
 * 3. Other domains: Denied.
 */
export function validateUserAccess(email?: string | null): AccessCheckResult {
  if (!email) {
    return { allowed: false, role: 'denied', reason: '로그인이 필요합니다.' };
  }

  // 1. Check if designated admin (sitech3@simin.hs.kr, hongjinwoo@simin.hs.kr)
  if (isAdminUser(email)) {
    return { allowed: true, role: 'admin' };
  }

  // 2. Check if student email has @simin.hs.kr domain
  if (isAllowedStudentDomain(email)) {
    return { allowed: true, role: 'student' };
  }

  // 3. Deny all other domains
  return {
    allowed: false,
    role: 'denied',
    reason: `접근 제한: 심인고등학교 전용 서비스입니다. @simin.hs.kr 도메인 계정으로 로그인해 주세요.`,
  };
}
