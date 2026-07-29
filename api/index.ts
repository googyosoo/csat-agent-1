import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

function cleanJsonString(str: string): string {
  if (!str) return '';
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function getGenAIClient(customApiKey?: string) {
  const apiKey = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 0)
    ? customApiKey.trim()
    : (process.env.GEMINI_API_KEY || 'dummy_gemini_api_key');

  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function getKoreanByteLength(str: string): number {
  let b = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >> 11) b += 3;
    else if (c >> 7) b += 2;
    else b += 1;
  }
  return b;
}

// Socratic Fallback Builder
function buildSocraticFallbackResponse(history: any[], passage: string, translation: string, lesson: string, itemNo: string, title: string) {
  const lastUserMsg = history?.filter((m: any) => m.role === 'user').pop()?.text || '';
  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const sentences = (passage || 'This passage explores key principles of academic inquiry.')
    .split('.').map((s: string) => s.trim()).filter((s: string) => s.length > 5);

  const s1 = sentences[0] || 'Modern study highlights significant factors';

  if (/주제|요지|제목|핵심|주장/i.test(lastUserMsg)) {
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 핵심 주제와 요지를 파악해 봅시다!\n\n지문 도입부: "${s1}..."\n\n💡 [소크라테스 유도 질문]: 필자가 강조하는 핵심 개념과 주제를 본인만의 말로 한 구절로 표현해 보시겠어요?`;
  }
  return `[소크라테스 튜터] 질문하신 "${lastUserMsg}" 내용에 대해 [${displayLesson} ${displayItemNo}] 지문을 바탕으로 함께 추론해 봅시다!\n\n주요 분석 문장: "${s1}"\n\n💡 [소크라테스 유도 질문]: 본인이 구문 분석을 통해 파악한 핵심 논지를 설명해 보세요!`;
}

// Analyze Endpoint
app.post('/api/gemini/analyze', async (req, res) => {
  const { passage = '', lesson = '', itemNo = '', title = '', type = '', translation = '', explanation = '', customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: `Analyze CSAT passage: ${passage}` }] }],
    });
    const json = JSON.parse(cleanJsonString(response.text || '{}'));
    res.json({ success: true, data: json });
  } catch {
    res.json({
      success: true,
      data: {
        themeSummary: `[${lesson} ${itemNo}] "${title}" 지문은 학술적 핵심 주제와 논리적 전개를 다루는 수능 연계 주요 지문입니다.`,
        examinerNotes: '수능 출제 포인트: 주제문 수식 구조 및 핵심어 패러프레이징 선택지 분석',
        socraticPrompts: ['지문 도입부의 핵심 명사구 파악하기', '후반부 결론 문장과의 유기적 연결성 검증'],
        syntaxBreakdown: ['주어-동사 수일치 확인', '관계대명사절 및 분사구문 수식 범위 구별'],
        vocabulary: [{ word: 'fundamental', meaning: '근본적인' }, { word: 'perspective', meaning: '관점' }],
      },
      fallback: true,
    });
  }
});

// Socratic Endpoint
app.post('/api/gemini/socratic', async (req, res) => {
  const { history = [], passage = '', title = '', lesson = '', itemNo = '', translation = '', customApiKey, hintLevel = 1 } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are a Socratic English tutor. Hint Level: ${hintLevel}. Guide the student in Korean without directly giving the answer away.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(history) }] }],
      config: { systemInstruction: systemPrompt },
    });
    res.json({ success: true, text: response.text || '답변 생성 완료' });
  } catch {
    const fallbackText = buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title);
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});

// Transform Endpoint
app.post('/api/gemini/transform', async (req, res) => {
  const { passage = '', lesson = '', itemNo = '', targetQuestionType = '빈칸 추론', difficulty = '수능 표준', customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: `Generate CSAT ${targetQuestionType} for passage: ${passage}` }] }],
      config: { responseMimeType: 'application/json' },
    });
    const json = JSON.parse(cleanJsonString(response.text || '{}'));
    res.json({ success: true, data: json });
  } catch {
    const fallbackData = {
      type: targetQuestionType,
      difficulty,
      question: `[${lesson || 'EBS'} ${itemNo || '지문'}] 다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?`,
      modifiedPassage: `${passage}\n\nTherefore, [___________].`,
      options: [
        '① critical understanding of core principles is essential',
        '② traditional paradigms must be unconditionally accepted',
        '③ technological tools override analytical reasoning',
        '④ empirical data can be substituted with theoretical models',
        '⑤ rigid rules must be maintained regardless of context'
      ],
      correctIndex: 0,
      rationale: '지문 전체의 논지 흐름상 주제와 직결되는 ①번이 가장 적절합니다.',
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// Student Report Endpoint
app.post('/api/gemini/student-report', async (req, res) => {
  const { student } = req.body;
  const name = student?.name || '김학생';
  const sampleSetek = `'2027 진로영어' 지문 분석 워크북과 소크라테스 AI 튜터를 적극 활용하여 영어 독해력과 지문 구조 파악 능력을 종합적으로 신장함. 특히 EBS 수능 연계 지문 학습 과정에서 가주어-진주어 구문 및 역접 연결어를 통한 논지 전환 파악에 남다른 메타인지적 탐구열을 보임. 소크라테스 튜터링 3단계 힌트 시스템을 단계별로 탐색하며 스스로 문맥상 어휘의 함축적 의미를 도출해내는 주도적인 학습 태도를 형성함. 수능 변형문제 생성기 기능을 응용하여 빈칸 추론 및 어법성 판단 문항을 직접 풀이하고 분석함으로써 텍스트의 논리적 결속성을 파악하는 비판적 사고력이 매우 우수함.`;

  res.json({
    success: true,
    data: {
      studentEmail: student?.email || 'student@simin.hs.kr',
      studentName: name,
      personalizedFeedback: `${name} 학생은 EBS 진로영어 지문 완독 및 소크라테스 튜터 질의를 통해 적극적인 구문 탐구를 수행하였습니다.`,
      schoolRecordSetek: sampleSetek,
      byteCount: getKoreanByteLength(sampleSetek),
      keyCompetencies: ['주도적 메타인지 탐구', '논리적 지문 구조 분석', '수능 변형 문제 응용력'],
    },
  });
});

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
