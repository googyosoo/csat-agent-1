/**
 * Helper utility to safely execute fetch requests and handle JSON responses,
 * preventing 'Unexpected token <' errors when server returns HTML error pages.
 */
export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  
  const contentType = response.headers.get('content-type') || '';
  
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorJson = await response.json();
      throw new Error(errorJson.error || errorJson.message || `서버 오류가 발생했습니다. (HTTP ${response.status})`);
    } else {
      const text = await response.text();
      console.error(`[API Non-JSON Error ${response.status}]:`, text.slice(0, 300));
      throw new Error(`서버 응답 오류 (HTTP ${response.status}): 올바른 데이터 형식(JSON)이 아닙니다. 백엔드 처리 상태를 확인해 주세요.`);
    }
  }

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (parseErr) {
      throw new Error('응답 데이터를 분석하는 중 오류가 발생했습니다 (JSON 파싱 에러).');
    }
  } else {
    const rawText = await response.text();
    console.warn(`[API Response Not JSON]:`, rawText.slice(0, 300));
    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error('서버 응답이 JSON 형식이 아닙니다.');
    }
  }
}
