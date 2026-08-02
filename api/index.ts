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

// Socratic Fallback Builder with Selected Passage Direct Binding
function buildSocraticFallbackResponse(history: any[], passage: string, translation: string, lesson: string, itemNo: string, title: string, hintLevel: number = 1) {
  const lastUserMsg = history?.filter((m: any) => m.role === 'user').pop()?.text || '';
  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const displayTitle = title || '선택 지문';
  
  const rawPassage = passage && passage.trim().length > 10 ? passage.trim() : 'The internet allows information to flow freely across national borders. However, unchecked algorithms can create filter bubbles that restrict exposure to diverse perspectives.';
  const rawTranslation = translation && translation.trim().length > 5 ? translation.trim() : '인터넷은 정보가 국경을 넘어 자유롭게 흐르도록 합니다. 그러나 검증되지 않은 알고리즘은 필터 버블을 생성하여 다양한 관점에 대한 노출을 제한할 수 있습니다.';

  const sentences = rawPassage.split(/(?<=[.!?])\s+/).filter(s => s.length > 5);
  const s1 = sentences[0] || 'Passage introductory sentence';
  const s2 = sentences[1] || sentences[0] || 'Passage development sentence';

  let hintGuide = '1단계 문맥 힌트: 직접적인 정답 대신 지문의 배경 및 단서 문장을 지칭해 드립니다.';
  if (hintLevel === 2) hintGuide = '2단계 구문/어휘 힌트: 문장의 주어-동사 구조 및 주요 핵심 어휘의 문맥상 어조를 분석해 드립니다.';
  if (hintLevel === 3) hintGuide = '3단계 완전 해설: 지문 전체의 상세 직독직해 및 출제 의도와 해설을 제공합니다.';

  if (/주제|요지|제목|핵심|주장|topic|main idea/i.test(lastUserMsg)) {
    return `[소크라테스 튜터 - ${hintGuide}]
선택된 지문: [${displayLesson} ${displayItemNo}] "${displayTitle}"

📌 지문 핵심 도입 문장:
"${s1}"

🇰🇷 한국어 직독직해 참고:
${rawTranslation.slice(0, 140)}...

💡 [소크라테스 유도 질문]:
필자가 글의 전반부 전제에서 후반부 결론으로 이어질 때 강조하고자 하는 핵심 소재와 주안점은 무엇인가요? 지문에서 직접 필자의 핵심 어구를 찾아 표현해 보시겠어요?`;
  }

  if (/구문|문법|어법|주어|동사|관계대명사|수일치|접속사|grammar|syntax/i.test(lastUserMsg)) {
    return `[소크라테스 튜터 - ${hintGuide}]
선택된 지문: [${displayLesson} ${displayItemNo}] "${displayTitle}"

📌 분석 핵심 문장:
"${s2}"

💡 [소크라테스 구문 분석 유도]:
1. 위 문장에서 진짜 주어(Subject)와 본동사(Main Verb)의 수일치 관계를 점검해 보셨나요?
2. 관계사절이나 수식어구가 주어와 동사 사이에 어떻게 배치되어 있는지 수식 범위를 구별해 보세요!`;
  }

  return `[소크라테스 튜터 - ${hintGuide}]
선택된 지문: [${displayLesson} ${displayItemNo}] "${displayTitle}"

질문하신 "${lastUserMsg}" 내용에 대해 현재 선택된 EBS 지문을 바탕으로 함께 추론해 봅시다!

📌 원문 분석 핵심 구절:
"${s1}"

🇰🇷 원문 직독직해 내용:
${rawTranslation.slice(0, 160)}...

💡 [소크라테스 메타인지 유도 질문]:
질문하신 내용이 필자의 핵심 주장 및 결론과 어떻게 유기적으로 연결되는지, 본인이 생각하는 문맥상 의미를 한 문장으로 설명해 보시겠어요?`;
}

// D4 Input validation helper
const VALID_QUESTION_TYPES = ['빈칸 추론', '어법 판단', '문장 삽입', '어휘 적절성', '주제 및 제목', '요약문 완성'];

function validateRequestBody(body: any, options: { checkType?: boolean } = {}) {
  const p = body?.passage || body?.rawText || '';
  if (!p || typeof p !== 'string' || p.trim().length < 50) {
    return '지문이 비어 있거나 너무 짧습니다. (최소 50자)';
  }
  if (options.checkType && body?.targetQuestionType) {
    if (!VALID_QUESTION_TYPES.includes(body.targetQuestionType)) {
      return `지원하지 않는 출제 유형입니다: ${body.targetQuestionType}`;
    }
  }
  return null;
}

// 1. Analyze Endpoint (Fast Non-Streaming)
// In-Memory Cache for Static Analyze Results (Strategy 1)
const analyzeCacheMap = new Map<string, any>();

// 1. Analyze Endpoint (with Strategy 1 Caching & Strategy 2 Model Tiering)
app.post('/api/gemini/analyze', async (req, res) => {
  const invalidError = validateRequestBody(req.body);
  if (invalidError) {
    return res.status(400).json({ success: false, error: invalidError });
  }

  const startedAt = Date.now();
  const { passage = '', lesson = '', itemNo = '', title = '', type = '', translation = '', explanation = '', syntaxNotes = [], vocabList = [], customApiKey } = req.body;
  
  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const displayTitle = title || '선택 지문';
  const displayType = type || '주제 및 요지 추론';

  // Strategy 1: Check In-Memory Static Cache First
  const cacheKey = `${displayLesson}_${displayItemNo}`;
  if (analyzeCacheMap.has(cacheKey)) {
    console.log(`[Analyze Cache Hit]: 0ms response for ${cacheKey}`);
    return res.json({ success: true, data: analyzeCacheMap.get(cacheKey), cached: true });
  }

  // Extract actual words from passage for fallback
  const passageWords = (passage || '').match(/[a-zA-Z]{5,}/g) || [];
  const uniquePassageWords = Array.from(new Set(passageWords.map(w => w.toLowerCase()))).slice(0, 3);
  const fallbackVocab = Array.isArray(vocabList) && vocabList.length > 0
    ? vocabList
    : uniquePassageWords.map(w => ({ word: w, meaning: '지문 수능 핵심 어휘' }));

  const defaultAnalysisData = {
    themeSummary: explanation || `[${displayLesson} ${displayItemNo}] "${displayTitle}" 지문의 핵심 요지 및 논리 구조 요약입니다.`,
    examinerNotes: `수능 출제 포인트: [${displayType}] 유형 변형 문제 출제 가능성이 매우 높습니다.`,
    socraticPrompts: [
      `지문 도입부 문장에서 필자가 강조하는 핵심 주제어 도출하기`,
      `후반부 결론 문장과의 논리적 결속성 및 대조 연결어 역할 분석하기`,
      `핵심 어휘의 문맥상 함축적 어조 구별하기`
    ],
    syntaxBreakdown: Array.isArray(syntaxNotes) && syntaxNotes.length > 0 ? syntaxNotes : [
      `주어-동사 수일치: 복잡한 수식어구에 따른 본동사 수일치 확인`,
      `연결어 구문: However, Therefore 등의 역접/결론 연결어를 통한 글의 흐름 전환 파악`
    ],
    vocabulary: fallbackVocab
  };

  // Strategy 1: If rich pre-analyzed dataset properties are provided, return immediately without API call (0 Cost, 0ms)
  if (explanation && Array.isArray(syntaxNotes) && syntaxNotes.length > 0) {
    analyzeCacheMap.set(cacheKey, defaultAnalysisData);
    return res.json({ success: true, data: defaultAnalysisData, precomputed: true });
  }

  let rawModelOutput = '';
  try {
    const ai = getGenAIClient(customApiKey);
    const systemInstruction = `You are an expert AI English Exam Analyzer for Korean High School Students. Return JSON:
{
  "themeSummary": "Main idea summary in Korean (2 sentences)",
  "examinerNotes": "CSAT Examiner question transformation notes in Korean",
  "socraticPrompts": ["Socratic prompt 1", "Socratic prompt 2", "Socratic prompt 3"],
  "syntaxBreakdown": ["Syntax point 1", "Syntax point 2"],
  "vocabulary": [{"word": "word_from_text", "meaning": "Korean meaning"}]
}`;

    const userPrompt = `Passage (${displayLesson} ${displayItemNo}: ${displayTitle}): ${passage.slice(0, 800)}`;

    // Strategy 2: Model Tiering - Use gemini-1.5-flash for lightweight fast analysis (90% cheaper)
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    rawModelOutput = response.text || '';
    const json = JSON.parse(cleanJsonString(rawModelOutput));
    const resultData = { ...defaultAnalysisData, ...json };
    
    // Store in cache
    analyzeCacheMap.set(cacheKey, resultData);

    res.json({ success: true, data: resultData });
  } catch (err: any) {
    console.error('[analyze] fallback 진입:', {
      name: err?.name,
      message: err?.message,
      elapsedMs: Date.now() - startedAt,
    });

    const fallbackData = {
      ...defaultAnalysisData,
      themeSummary: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 지문 요지 및 어휘/구문 분석입니다.`,
    };

    analyzeCacheMap.set(cacheKey, fallbackData);
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// 2. Socratic Endpoint (with Strategy 2 Model Tiering)
app.post('/api/gemini/socratic', async (req, res) => {
  const { history = [], passage = '', title = '', lesson = '', itemNo = '', translation = '', customApiKey, hintLevel = 1 } = req.body;
  
  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const displayTitle = title || '선택 지문';

  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `Master Socratic English Tutor for Korean students on EBS Passage [${displayLesson} ${displayItemNo}: ${displayTitle}].
Context Passage: ${passage.slice(0, 600)}
Translation: ${translation.slice(0, 400)}
Hint Level ${hintLevel}: Level 1=Contextual hint, Level 2=Syntax/Vocab hint, Level 3=Full explanation.
Answer concisely in Korean teacher tone.`;

    const lastMsgText = history?.filter((m: any) => m.role === 'user').pop()?.text || '지문 핵심 분석해줘';

    // Strategy 2: Model Tiering (Use 1.5-flash for Hint Level 1 & 2, 3.6-flash for Level 3)
    const selectedModel = hintLevel === 3 ? 'gemini-3.6-flash' : 'gemini-1.5-flash';

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: 'user', parts: [{ text: `Question: "${lastMsgText}"` }] }],
      config: { systemInstruction: systemPrompt, temperature: 0.3 },
    });

    res.json({ success: true, text: response.text || buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title, hintLevel) });
  } catch {
    const fallbackText = buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title, hintLevel);
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});

const SYMBOL_TO_INDEX: Record<string, number> = {
  '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
};

const INDEX_TO_SYMBOL = ['①', '②', '③', '④', '⑤'];

function cleanOptionTextHelper(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/^[①②③④⑤12345][\.\)]?\s*/, '').trim();
}

function parseAnswerIndex(json: any, rawOptions: string[]): number {
  if (typeof json.correctIndex === 'number' && Number.isInteger(json.correctIndex)) {
    if (json.correctIndex >= 0 && json.correctIndex < rawOptions.length) {
      return json.correctIndex;
    }
    if (json.correctIndex >= 1 && json.correctIndex <= rawOptions.length) {
      return json.correctIndex - 1;
    }
  }

  const ansStr = String(json.answer || json.correctAnswer || json.solution || '');
  for (const [sym, idx] of Object.entries(SYMBOL_TO_INDEX)) {
    if (ansStr.includes(sym)) {
      return idx;
    }
  }

  const ratStr = String(json.rationale || json.explanation || '');
  for (const [sym, idx] of Object.entries(SYMBOL_TO_INDEX)) {
    if (ratStr.includes(`${sym}번`) || ratStr.includes(`${sym}가`) || ratStr.includes(`${sym}이`) || ratStr.includes(`${sym} `)) {
      return idx;
    }
  }

  return 0;
}

// Helper D3: Deterministic option shuffle with clean symbol alignment & correct index parsing
function shuffleTransformOptions(data: any, targetQuestionType: string) {
  const rawOptions: string[] = Array.isArray(data.options) && data.options.length === 5
    ? data.options
    : ['option 1', 'option 2', 'option 3', 'option 4', 'option 5'];

  const originalCorrectIdx = parseAnswerIndex(data, rawOptions);
  const cleanedOptions = rawOptions.map(cleanOptionTextHelper);

  const POSITIONAL = ['어법 판단', '어휘 적절성', '문장 삽입'];
  
  if (POSITIONAL.includes(targetQuestionType)) {
    const formattedOptions = cleanedOptions.map((opt, i) => `${INDEX_TO_SYMBOL[i]} ${opt}`);
    const updatedDistractors = Array.isArray(data.distractorAnalysis)
      ? data.distractorAnalysis.map((d: any, idx: number) => ({
          ...d,
          optionIndex: idx,
          isCorrect: idx === originalCorrectIdx,
        }))
      : undefined;

    return {
      ...data,
      options: formattedOptions,
      correctIndex: originalCorrectIdx,
      answer: String(originalCorrectIdx + 1),
      ...(updatedDistractors ? { distractorAnalysis: updatedDistractors } : {}),
    };
  }

  const n = cleanedOptions.length;
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const newCorrectIdx = order.indexOf(originalCorrectIdx);
  const shuffledCleaned = order.map(i => cleanedOptions[i]);
  const formattedOptions = shuffledCleaned.map((opt, i) => `${INDEX_TO_SYMBOL[i]} ${opt}`);

  let updatedDistractors = undefined;
  if (Array.isArray(data.distractorAnalysis) && data.distractorAnalysis.length === 5) {
    updatedDistractors = order.map((origIdx, newIdx) => {
      const origDistractor = data.distractorAnalysis[origIdx] || {};
      return {
        ...origDistractor,
        optionIndex: newIdx,
        isCorrect: newIdx === newCorrectIdx,
      };
    });
  }

  return {
    ...data,
    options: formattedOptions,
    correctIndex: newCorrectIdx,
    answer: String(newCorrectIdx + 1),
    ...(updatedDistractors ? { distractorAnalysis: updatedDistractors } : {}),
  };
}

// Item Bank In-Memory / Persistent Cache Layer
const itemBankCache = new Map<string, any>();

// 3. Transform Endpoint (with S2 Item Bank Caching)
app.post('/api/gemini/transform', async (req, res) => {
  const invalidError = validateRequestBody(req.body, { checkType: true });
  if (invalidError) {
    return res.status(400).json({ success: false, error: invalidError });
  }

  const { passage = '', lesson = '', itemNo = '', targetQuestionType = '빈칸 추론', difficulty = '수능 표준', customApiKey } = req.body;
  
  // S2 Item Bank Cache Key
  const cacheKey = `${lesson}_${itemNo}_${targetQuestionType}_${difficulty}`;
  if (itemBankCache.has(cacheKey)) {
    console.log(`[Item Bank Hit]: 0ms response for ${cacheKey}`);
    return res.json({ success: true, data: itemBankCache.get(cacheKey), cached: true, itemBankHit: true });
  }

  try {
    const ai = getGenAIClient(customApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: `Generate CSAT ${targetQuestionType} for passage: ${passage}` }] }],
      config: { responseMimeType: 'application/json' },
    });
    const json = JSON.parse(cleanJsonString(response.text || '{}'));

    const formattedData = {
      ...json,
      type: json.type || targetQuestionType || '변형 문항',
      modifiedPassage: json.modifiedPassage || json.passage || passage || '',
      question: json.question || `[${lesson || 'EBS'} ${itemNo || '지문'}] 다음 글의 ${targetQuestionType} 문제로 가장 적절한 것은?`,
      options: json.options && json.options.length > 0 ? json.options : ['① option 1', '② option 2', '③ option 3', '④ option 4', '⑤ option 5'],
      correctIndex: typeof json.correctIndex === 'number' ? json.correctIndex : (parseInt(json.answer || '1', 10) - 1 || 0),
      rationale: json.rationale || json.explanation || '지문의 정밀 구문 및 흐름상 정답이 도출됩니다.',
    };

    const finalOutput = shuffleTransformOptions(formattedData, targetQuestionType);
    
    // Store in Item Bank Cache
    itemBankCache.set(cacheKey, finalOutput);

    res.json({ success: true, data: finalOutput });
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
    const finalFallback = shuffleTransformOptions(fallbackData, targetQuestionType);
    
    // Store fallback in cache
    itemBankCache.set(cacheKey, finalFallback);

    res.json({ success: true, data: finalFallback, fallback: true });
  }
});

// 4. Student Report Endpoint
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

// 5. Ingest Endpoint (New Passage Auto Parsing)
app.post('/api/gemini/ingest', async (req, res) => {
  const { rawText = '', lesson = '13강', itemNo = '01번', customApiKey } = req.body;
  if (!rawText || rawText.trim().length < 30) {
    return res.status(400).json({ success: false, error: '지문 텍스트가 비어 있거나 너무 짧습니다. (최소 30자)' });
  }

  const cleanPassage = rawText.trim();
  const titleDefault = cleanPassage.slice(0, 30).split('.')[0] + '...';

  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are a CSAT English Exam Digitizer. Convert the provided raw English passage into a complete structured EBS workbook item matching this exact JSON schema:
{
  "title": "Short Korean Title representing passage core theme",
  "type": "CSAT question type in Korean e.g. 주제 및 요지 추론, 빈칸 추론, 어법 판단",
  "translation": "Full natural Korean translation of the passage",
  "options": ["① Choice 1", "② Choice 2", "③ Choice 3", "④ Choice 4", "⑤ Choice 5"],
  "answerIndex": 0,
  "explanation": "Detailed EBS logic explanation in Korean",
  "syntaxNotes": ["Grammar point 1 in Korean", "Grammar point 2 in Korean"],
  "vocabList": [
    { "word": "word1", "meaning": "Korean meaning" },
    { "word": "word2", "meaning": "Korean meaning" }
  ]
}`;

    const userPrompt = `Passage (${lesson} ${itemNo}):
${cleanPassage}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const json = JSON.parse(cleanJsonString(response.text || '{}'));
    const data = {
      title: json.title || titleDefault,
      type: json.type || '주제 및 요지 추론',
      translation: json.translation || '지문 직독직해 한국어 번역입니다.',
      options: json.options && json.options.length === 5 ? json.options : ['① Choice 1', '② Choice 2', '③ Choice 3', '④ Choice 4', '⑤ Choice 5'],
      answerIndex: typeof json.answerIndex === 'number' ? json.answerIndex : 0,
      explanation: json.explanation || '지문 주제 및 구문 정밀 해설입니다.',
      syntaxNotes: json.syntaxNotes || ['주어-동사 수일치 확인', '관계대명사 수식 구문 파악'],
      vocabList: json.vocabList || [{ word: 'analysis', meaning: '분석' }, { word: 'comprehension', meaning: '이해' }],
    };

    res.json({ success: true, data });
  } catch (err: any) {
    const fallbackIngest = {
      title: titleDefault,
      type: '주제 및 요지 추론',
      translation: '인터넷 및 정보 탐구와 학술적 논지에 관한 글입니다.',
      options: [
        '① critical understanding of core concepts',
        '② traditional approaches to learning',
        '③ empirical evidence in academic study',
        '④ technological advancements in research',
        '⑤ rigid rules in formal education'
      ],
      answerIndex: 0,
      explanation: '지문의 도입부 주제문과 후반부 결론 문장의 논리적 연관성에 따라 ①번이 가장 적절합니다.',
      syntaxNotes: ['주어-동사 수일치 정밀 분석', '관계대명사절 및 분사구문 수식 범위 구별'],
      vocabList: [
        { word: 'curiosity', meaning: '호기심' },
        { word: 'behavior', meaning: '행동' }
      ]
    };
    res.json({ success: true, data: fallbackIngest, fallback: true });
  }
});

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
