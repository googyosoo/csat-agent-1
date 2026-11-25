# 2027 진로영어 CSAT Agent AI (`csat-agent-1`)

심인고등학교 2027학년도 진로영어 수업 및 수능 연계 학습을 지원하는 Agentic AI 학습 플랫폼입니다.
지문 분석, 소크라테스 3단계 문답, 수능형 변형 문항 풀이, 오답노트와 교사용 세특 초안 구성을 한 화면에서 제공합니다.

- **배포 주소**: [https://csat-agent-1.vercel.app](https://csat-agent-1.vercel.app)
- **저장소**: [https://github.com/googyosoo/csat-agent-1](https://github.com/googyosoo/csat-agent-1)

---

## 학생 첫 화면 학습 안내 (4단계)

1. **1단계 지문 정독 및 문제 풀이 (`지문분석`)**
   - 강별 필터에서 지문을 선택하고 원문 낭독(TTS), 선지 풀이, 한국어 번역과 구문 포인트를 확인합니다.
2. **2단계 소크라테스 3단계 문답 (`소크라테스`)**
   - 문맥 힌트(1단계), 구문 힌트(2단계), 완전 해설(3단계)을 고르며 스스로 정답 근거를 찾습니다.
3. **3단계 수능 변형문항 실전 연습 (`변형생성기`)**
   - 빈칸 추론, 어법 판단, 문장 삽입, 어휘 적절성, 주제 및 제목, 요약문 완성 6개 유형을 생성하고 풀이합니다.
4. **4단계 오답노트 및 소감 기록 (`나만의 학습/오답`, `대시보드`)**
   - 틀린 문항은 오답노트에 자동 누적되며, 지문별 성찰 소감을 저장해 학습 이력을 관리합니다.

로그인 전 첫 화면에서 **로그인 없이 게스트 둘러보기** 버튼을 눌러 지문 분석과 어휘 학습을 바로 체험할 수 있습니다.

---

## BYOK (본인 Gemini 무료 API 키 입력) 안내

- 상단 헤더의 **BYOK 키 설정** 버튼을 눌러 Google AI Studio에서 발급한 본인 Gemini API 키(`AIza...`)를 입력할 수 있습니다.
- 기본 추론 엔진은 Gemini 무료 등급 모델(`gemini-2.5-flash`, 폴백 `gemini-2.0-flash`)을 우선 사용합니다.
- 입력한 키는 브라우저 저장소(`localStorage`)에만 보관되며, 소스 코드나 Git 저장소에는 저장되지 않습니다.
- 키를 입력하지 않거나 무료 한도를 초과한 경우 내장된 지문 기반 예비 분석 엔진으로 자동 전환됩니다.

---

## 교사용 수업 활용 및 관리자 대시보드

- **지정 관리자 계정**: `sitech3@simin.hs.kr`, `hongjinwoo@simin.hs.kr` (Google 로그인 시 관리자 대시보드 자동 활성화)
- **학생 접속 현황 및 통계**: 학생별 로그인 횟수, 체류 시간, 소크라테스 질의 수, 변형문항 풀이 이력 조회 및 CSV, Google Sheets 내보내기 지원
- **세특 초안 생성**: 학생별 학습 로그와 성찰 소감을 반영해 바이트 수 검증과 함께 세특 참고 초안을 생성합니다.
- **새 지문 등록**: 사이드바의 `새 지문 (13강~) 자동 등록` 버튼으로 원문을 입력해 워크북 항목으로 추가할 수 있습니다.

---

## 로컬 실행 및 빌드 방법

### 사전 요구사항
- Node.js 18 이상
- npm

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정 (`.env`)
루트 디렉터리에 `.env` 파일을 만들고 필요한 값을 입력합니다. (`.env.example` 참고)

```env
# 선택 사항: 서버 기본 Gemini 키 (미설정 시 상단 BYOK 키 입력 사용)
GEMINI_API_KEY=

# Firebase Web 설정 (Google SSO 및 Cloud Firestore 연동 시 필요)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 3. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

### 4. 타입 검사 및 프로덕션 빌드
```bash
npm run lint
npm run build
```

---

## 기술 스택 및 배포 구조

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Lucide React
- **Backend**: Express, `@google/genai`, esbuild (`api/index.js` 및 `api/index.ts` Vercel Serverless 대응)
- **Auth & DB**: Firebase Auth (Google SSO), Cloud Firestore, 브라우저 `localStorage` 3단 폴백
- **주의사항**: `src/data/ebsDataset.ts`에 교재 연계 지문 30건이 수록되어 있으므로, 외부 공개 저장소 운영 시 저작권 정책에 따라 예시 지문 전환 여부를 검토해야 합니다.
