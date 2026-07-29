/**
 * Authorization and Domain Validation Utilities for CSAT Agent Platform.
 */

export const ADMIN_EMAILS: string[] = [
  'kiparang999@gmail.com',
  'hongjinwoo@simin.hs.kr',
  'sitech3@simin.hs.kr',
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
 * 1. Designated admins: Allowed regardless of domain.
 * 2. Students: Allowed ONLY if email domain is '@simin.hs.kr'.
 * 3. Others: Denied.
 */
export function validateUserAccess(email?: string | null): AccessCheckResult {
  if (!email) {
    return { allowed: false, role: 'denied', reason: '로그인이 필요합니다.' };
  }

  // 1. Check if designated admin
  if (isAdminUser(email)) {
    return { allowed: true, role: 'admin' };
  }

  // 2. Check if allowed student domain
  if (isAllowedStudentDomain(email)) {
    return { allowed: true, role: 'student' };
  }

  // 3. Otherwise access denied
  return {
    allowed: false,
    role: 'denied',
    reason: `접근 제한: 시민고등학교 학생 전용 계정(${ALLOWED_STUDENT_DOMAIN}) 또는 지정 관리자 계정만 로그인할 수 있습니다.`,
  };
}
