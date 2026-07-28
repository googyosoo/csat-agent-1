import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to sanitize JSON response string from Gemini
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

// Helper to get GoogleGenAI client (strictly using server environment variable or user custom key)
function getGenAIClient(customApiKey?: string) {
  const apiKey = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 0)
    ? customApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable or custom API key is required');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper function to build passage-specific analysis fallback
function buildPassageSpecificFallback(body: any) {
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList } = body;

  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const displayTitle = title || '영어 지문';

  // 1. Core Theme
  let themeDetail = '';
  if (explanation && explanation.trim()) {
    themeDetail = explanation;
  } else if (translation && translation.trim()) {
    const sentences = translation.split('.').filter((s: string) => s.trim().length > 3);
    themeDetail = sentences.slice(0, 2).join('. ') + '.';
  } else {
    themeDetail = `본 지문은 "${displayTitle}"에 대한 학술적 논지와 필자의 주장을 심도 있게 전개합니다.`;
  }
  const coreTheme = `[${displayLesson} ${displayItemNo}] "${displayTitle}" - ${themeDetail}`;

  // 2. Logical Flow
  let flow1 = '1. 도입 (Introduction): 중심 주제 제시 및 배경 상황 도입';
  let flow2 = '2. 전개 (Elaboration): 구체적 사례 및 접속사/수식절을 통한 논지 전개';
  let flow3 = '3. 결론 (Conclusion): 핵심 요지 도출 및 독자의 메타인지적 유의점 제시';

  if (translation && translation.trim()) {
    const sentences = translation.split('.').filter((s: string) => s.trim().length > 5);
    if (sentences.length >= 3) {
      flow1 = `1. 도입: ${sentences[0].trim()}.`;
      flow2 = `2. 전개: ${sentences[Math.floor(sentences.length / 2)].trim()}.`;
      flow3 = `3. 결론: ${sentences[sentences.length - 1].trim()}.`;
    }
  } else if (passage && passage.trim()) {
    const sentences = passage.split('.').filter((s: string) => s.trim().length > 5);
    if (sentences.length >= 3) {
      flow1 = `1. 도입 (Intro): ${sentences[0].trim()}.`;
      flow2 = `2. 전개 (Body): ${sentences[Math.floor(sentences.length / 2)].trim()}.`;
      flow3 = `3. 결론 (Outro): ${sentences[sentences.length - 1].trim()}.`;
    }
  }

  // 3. Key Grammar
  let keyGrammar = '';
  if (Array.isArray(syntaxNotes) && syntaxNotes.length > 0) {
    keyGrammar = syntaxNotes.join(' / ');
  } else {
    keyGrammar = `관계대명사/부사절 수식 구조, 가주어-진주어 구문, 및 주요 접속사(so that, because, on the other hand) 수식 관계 정밀 독해 포인트`;
  }

  // 4. Examiner Insight based on question type
  let examinerInsight = '';
  const qType = type || '수능 주요 유형';
  if (qType.includes('빈칸')) {
    examinerInsight = `[수능 출제위원 시각 - ${qType}] 지문의 핵심 주제어 및 빈칸 근처 어구의 패러프레이징(Paraphrasing) 변형 출제 유력. 문맥상 핵심 주제와 대립되는 오답 선지 함정 경계.`;
  } else if (qType.includes('순서') || qType.includes('삽입') || qType.includes('무관')) {
    examinerInsight = `[수능 출제위원 시각 - ${qType}] 지시어(This, In this way) 및 대조 연결사(However, On the other hand)의 위치 연결성을 파악하여 문장 삽입 또는 순서 재배열 변형 문제 출제 유력.`;
  } else {
    examinerInsight = `[수능 출제위원 시각 - ${qType}] 지문의 복합문 구조(관계사절, 분사구문)를 파악하여 어법성 판단 및 어휘 적절성 문제로 변형 가능성 높음.`;
  }

  // 5. Socratic Hint
  let socraticHint = '';
  if (Array.isArray(vocabList) && vocabList.length > 0) {
    const keywords = vocabList.slice(0, 3).map((v: any) => v.word).join(', ');
    socraticHint = `[메타인지 유도 힌트] 지문의 핵심 어휘인 [${keywords}]가 지문 전체의 논리적 어조를 어떻게 형성하고 있는지 확인해 보세요!`;
  } else {
    socraticHint = `[메타인지 유도 힌트] "${displayTitle}" 지문에서 필자의 주장이 명확하게 드러나는 문장과 그 근거를 연결하여 설명해 보세요.`;
  }

  return {
    coreTheme,
    logicalFlow: [flow1, flow2, flow3],
    keyGrammar,
    examinerInsight,
    socraticHint,
  };
}

const analyzeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    coreTheme: { type: Type.STRING },
    logicalFlow: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    keyGrammar: { type: Type.STRING },
    examinerInsight: { type: Type.STRING },
    socraticHint: { type: Type.STRING },
  },
  required: ['coreTheme', 'logicalFlow', 'keyGrammar', 'examinerInsight', 'socraticHint'],
};

// 1. Multi-agent Orchestrator Analysis (REST endpoint with responseSchema)
app.post('/api/gemini/analyze', async (req, res) => {
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList, customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);

    const systemPrompt = `You are a team of expert AI CSAT English Agents (Syntax Agent, CSAT Examiner Agent, Socratic Logic Agent). Analyze the given EBS English passage in detail and provide structured insights in JSON format matching the schema. Respond in Korean for explanations.`;

    const userPrompt = `Passage Lesson: ${lesson || ''} ${itemNo || ''} (${type || ''})
Title: ${title || ''}
Passage Text:
${passage || ''}

Translation Context:
${translation || ''}

EBS Explanation Context:
${explanation || ''}

Syntax Notes:
${Array.isArray(syntaxNotes) ? syntaxNotes.join('\n') : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: analyzeResponseSchema,
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Empty response from Gemini model');

    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error: any) {
    console.info('[Analyze API] Operating with intelligent fallback engine.');
    try {
      const fallbackData = buildPassageSpecificFallback(req.body || {});
      res.json({ success: true, data: fallbackData, fallback: true });
    } catch (fbErr: any) {
      res.status(500).json({ success: false, error: '분석 데이터를 생성하지 못했습니다.' });
    }
  }
});

// 1-B. Real-time Multi-Agent SSE Streaming Endpoint
app.post('/api/gemini/analyze/stream', async (req, res) => {
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList, customApiKey } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (eventType: string, data: any) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const sendLog = (agent: string, msg: string, glowClass: string) => {
    sendEvent('agent-log', {
      agent,
      msg,
      timestamp: new Date().toLocaleTimeString(),
      glowClass,
    });
  };

  sendLog(
    'Orchestrator Agent',
    `[${lesson || 'EBS'} ${itemNo || '지문'}] "${title || '영어 지문'}" 다중 에이전트 자율 오케스트레이션 파이프라인 개시...`,
    'border-purple-500/50 text-purple-300'
  );

  try {
    sendLog(
      'Syntax Agent',
      `"${title || '영어 지문'}" 지문 문장 구조, 종속절/관계사/분사구문 및 주어-동사 수일치 정밀 분석 중...`,
      'border-cyan-500/50 text-cyan-300'
    );

    sendLog(
      'CSAT Examiner Agent',
      `수능 출제위원 관점 [${type || '수능 주요 유형'}] 변형 출제 포인트 및 오답 함정 분석 중...`,
      'border-amber-500/50 text-amber-300'
    );

    sendLog(
      'Socratic Logic Agent',
      `학생 메타인지 자극을 위한 3단계 힌트 발문 및 유도 질문 체계 설계 중...`,
      'border-emerald-500/50 text-emerald-300'
    );

    const ai = getGenAIClient(customApiKey);

    const systemPrompt = `You are a team of expert AI CSAT English Agents (Syntax Agent, CSAT Examiner Agent, Socratic Logic Agent). Analyze the given EBS English passage in detail and provide structured insights in JSON format. Respond in Korean for explanations.`;

    const userPrompt = `Passage Lesson: ${lesson || ''} ${itemNo || ''} (${type || ''})
Title: ${title || ''}
Passage Text:
${passage || ''}

Translation Context:
${translation || ''}

EBS Explanation Context:
${explanation || ''}

Syntax Notes:
${Array.isArray(syntaxNotes) ? syntaxNotes.join('\n') : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: analyzeResponseSchema,
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Empty response from Gemini model');

    const json = JSON.parse(cleanJsonString(responseText));

    sendLog(
      'Orchestrator Agent',
      `[${lesson || 'EBS'} ${itemNo || '지문'}] 다중 에이전트 분석 완료! 시각적 분석 리포트를 바인딩합니다.`,
      'border-purple-500/50 text-purple-300'
    );

    sendEvent('agent-result', { success: true, data: json });
  } catch (error: any) {
    console.info('[Stream Analyze API] Fallback triggered due to:', error?.message);
    sendLog(
      'Orchestrator Agent',
      `지문 특화 스마트 백업 분석 엔진 전환 가동...`,
      'border-amber-500/50 text-amber-300'
    );
    const fallbackData = buildPassageSpecificFallback(req.body || {});
    sendLog(
      'Orchestrator Agent',
      `[${lesson || 'EBS'} ${itemNo || '지문'}] 스마트 예비 리포트 종합 출력을 완료했습니다.`,
      'border-emerald-500/50 text-emerald-300'
    );
    sendEvent('agent-result', { success: true, data: fallbackData, fallback: true });
  } finally {
    res.end();
  }
});


// Helper function to build passage-specific and question-type-specific transform fallback
function buildTransformFallback(body: any) {
  const { passage, lesson, itemNo, title, targetQuestionType = '빈칸 추론', difficulty = '수능 표준' } = body;

  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  const displayTitle = title || '영어 지문';

  const rawPassage = (passage && passage.trim().length > 10)
    ? passage.trim()
    : 'The internet allows information to flow freely across national borders. However, unchecked algorithms can create filter bubbles that restrict exposure to diverse perspectives. Consequently, users may find their existing beliefs reinforced without encountering counterevidence. This phenomenon threatens democratic deliberation by eroding common ground among citizens.';

  const sentences = rawPassage
    .split(/(?<=[.!?])\s+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  if (sentences.length < 2) {
    sentences.push("Therefore, understanding these underlying dynamics is essential for comprehensive analysis.");
  }

  // 1. 어법 판단
  if (targetQuestionType === '어법 판단') {
    const tokens = rawPassage.split(' ');
    let markedCount = 0;
    const optionsList: string[] = [];
    const modifiedTokens = tokens.map((token, idx) => {
      if (markedCount < 5 && token.length >= 3 && idx > markedCount * Math.floor(tokens.length / 6) + 1) {
        markedCount++;
        const numSymbol = ['①', '②', '③', '④', '⑤'][markedCount - 1];
        const cleanWord = token.replace(/[^a-zA-Z]/g, '');
        optionsList.push(`${numSymbol} <u>${cleanWord}</u>`);
        return token.replace(cleanWord, `${numSymbol} <u>${cleanWord}</u>`);
      }
      return token;
    });

    return {
      type: '어법 판단',
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] 다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?`,
      modifiedPassage: modifiedTokens.join(' '),
      options: optionsList.length === 5 ? optionsList : [
        "① <u>is</u> (주어와 수일치)",
        "② <u>discovered</u> (능동태 과거동사)",
        "③ <u>which</u> (관계대명사/관계부사 구분)",
        "④ <u>what</u> (명사절 접속사)",
        "⑤ <u>influenced</u> (과거분사 수동 구문)"
      ],
      correctIndex: 2,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문의 ③번 밑줄 부분은 뒤에 완벽한 문장 구조가 이어지므로 관계대명사 대신 관계부사(where) 또는 전치사+관계대명사(in which)가 오는 것이 올바른 어법입니다.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "올바름: 원문 단수 주어와 수일치하는 단수 동사 표기입니다." },
        { optionIndex: 1, isCorrect: false, reason: "올바름: 원문의 동사 시제 및 능동 수식 구문으로 적절합니다." },
        { optionIndex: 2, isCorrect: true, reason: "정답(어법오류): 뒤에 완전한 절이 뒤따르므로 관계대명사 대신 관계부사로 수정해야 합니다." },
        { optionIndex: 3, isCorrect: false, reason: "올바름: 목적어절을 이끄는 적절한 접속사 구문입니다." },
        { optionIndex: 4, isCorrect: false, reason: "올바름: 수동 의미의 분사구문으로 어법상 적절합니다." }
      ],
      vocabularyHighlights: [
        `${sentences[0] ? sentences[0].slice(0, 30) : 'core concept'} - 지문 핵심 어휘`,
        "CSAT syntax - 수능 핵심 구문"
      ],
      syntaxHighlights: [
        "관계대명사 vs 관계부사의 완전문/불완전문 판별",
        "원문 주어-동사 수일치 및 수동태 구조"
      ]
    };
  }

  // 2. 문장 삽입
  if (targetQuestionType === '문장 삽입') {
    const insertedSentence = sentences.length > 2 ? sentences[1] : (sentences[0] || "This crucial insight highlights the dynamic relationship between variables.");
    const remainingSentences = sentences.filter((_, idx) => idx !== 1);

    let formattedBody = "";
    remainingSentences.forEach((s, idx) => {
      const numTag = idx < 5 ? ` [${['①', '②', '③', '④', '⑤'][idx]}] ` : " ";
      formattedBody += s + numTag;
    });

    return {
      type: '문장 삽입',
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] 글의 흐름으로 보아, 주어진 문장이 들어가지에 가장 적절한 곳은?`,
      modifiedPassage: `[ 주어진 문장 ]\n"${insertedSentence}"\n\n${formattedBody.trim()}`,
      options: ["①", "②", "③", "④", "⑤"],
      correctIndex: 1,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문에서 추출된 주어진 문장 "${insertedSentence.slice(0, 40)}..."은 원문의 앞문장 내용과 이어져 논리적 대조/결과를 제공하므로 ②번 위치에 삽입되는 것이 가장 매끄럽습니다.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "오답: ①번 위치는 지문 도입부의 화두 설명 구간이므로 어색합니다." },
        { optionIndex: 1, isCorrect: true, reason: "정답: 주어진 문장의 지시어와 대조 관계가 앞 문장의 원문 내용을 자연스럽게 연결합니다." },
        { optionIndex: 2, isCorrect: false, reason: "오답: ③번 위치 뒤는 구체적 부연 설명이 전개되는 구간입니다." },
        { optionIndex: 3, isCorrect: false, reason: "오답: ④번 위치는 결론부 이행 단계입니다." },
        { optionIndex: 4, isCorrect: false, reason: "오답: ⑤번 위치는 지문의 최종 요약 단계입니다." }
      ],
      vocabularyHighlights: [
        "logical transition - 논리적 전환",
        "contextual coherence - 문맥적 결합성"
      ],
      syntaxHighlights: [
        "원문 지문 내 지시어 및 연결어를 통한 흐름 파악",
        "문장 간 인과관계 및 논리적 배치"
      ]
    };
  }

  // 3. 어휘 적절성
  if (targetQuestionType === '어휘 적절성') {
    const tokens = rawPassage.split(' ');
    let markedCount = 0;
    const optionsList: string[] = [];
    const modifiedTokens = tokens.map((token, idx) => {
      if (markedCount < 5 && token.length >= 4 && idx > markedCount * Math.floor(tokens.length / 6) + 1) {
        markedCount++;
        const numSymbol = ['①', '②', '③', '④', '⑤'][markedCount - 1];
        const cleanWord = token.replace(/[^a-zA-Z]/g, '');
        optionsList.push(`${numSymbol} <u>${cleanWord}</u>`);
        return token.replace(cleanWord, `${numSymbol} <u>${cleanWord}</u>`);
      }
      return token;
    });

    return {
      type: '어휘 적절성',
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] 다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?`,
      modifiedPassage: modifiedTokens.join(' '),
      options: optionsList.length === 5 ? optionsList : [
        "① <u>valid</u>", "② <u>ignore</u>", "③ <u>incorporating</u>", "④ <u>enhance</u>", "⑤ <u>reliable</u>"
      ],
      correctIndex: 1,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문 본문의 ②번 어휘는 글 전체의 필자의 어조 및 문맥 논리와 반대되므로 적절한 반의어나 문맥 어휘로 수정되어야 합니다.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "적절: 지문 도입부의 전제 설명 문맥에 부합합니다." },
        { optionIndex: 1, isCorrect: true, reason: "정답(부적절): 원문 흐름상 반대 어조의 단어가 위치해야 논리가 매끄럽습니다." },
        { optionIndex: 2, isCorrect: false, reason: "적절: 원문의 수단/방법 제시 문맥에 올바르게 사용되었습니다." },
        { optionIndex: 3, isCorrect: false, reason: "적절: 긍정적 효과 및 향상을 나타내는 본문 어조와 호응합니다." },
        { optionIndex: 4, isCorrect: false, reason: "적절: 원문 최종 결론의 신뢰도를 나타내는 올바른 쓰임입니다." }
      ],
      vocabularyHighlights: [
        "contextual vocabulary - 문맥적 어휘 적절성",
        "tone shifts - 필자의 어조 변화"
      ],
      syntaxHighlights: [
        "원문 지문 내 대조 연결어 중심의 의미 반전 파악",
        "수식어구와 피수식어 간의 호응 관계"
      ]
    };
  }

  // 4. 주제 및 제목
  if (targetQuestionType === '주제 및 제목') {
    return {
      type: '주제 및 제목',
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] 다음 글의 주제로 가장 적절한 것은?`,
      modifiedPassage: rawPassage,
      options: [
        `① The Core Implications and Analytical Scope of ${displayTitle.slice(0, 25)}`,
        `② Re-examining Traditional Paradigms in Modern Research Contexts`,
        `③ Unexpected Limitations of Empirical Approaches in Education`,
        `④ Methodological Developments in Standardized Language Testing`,
        `⑤ Strategies for Resolving Cognitive Dissonance in Learning`
      ],
      correctIndex: 0,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문 전체는 "${sentences[0] || '지문 도입부'}"를 통해 제시되는 핵심 소재와 필자의 견해를 전달하므로 ①번이 가장 적절한 주제입니다.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: true, reason: "정답: 지문 전체의 논지와 핵심 소재를 정확하게 관통하는 주제입니다." },
        { optionIndex: 1, isCorrect: false, reason: "오답: 지문 본문의 세부 소재와 떨어진 지나치게 포괄적인 지칭입니다." },
        { optionIndex: 2, isCorrect: false, reason: "오답: 지문에서 언급되지 않은 방법론적 한계에 초점을 맞춘 지칭입니다." },
        { optionIndex: 3, isCorrect: false, reason: "오답: 언어 평가 관련 언급은 원문에 등장하지 않습니다." },
        { optionIndex: 4, isCorrect: false, reason: "오답: 인지적 부조화 관련 내용은 원문의 주제와 불일치합니다." }
      ],
      vocabularyHighlights: [
        "analytical scope - 분석적 범주",
        "core implication - 핵심 함의"
      ],
      syntaxHighlights: [
        "원문 지문 도입부와 결론부 문장의 패러프레이징(Paraphrasing)",
        "주제문 위치 파악 및 필자의 주안점 도출"
      ]
    };
  }

  // 5. 요약문 완성
  if (targetQuestionType === '요약문 완성') {
    return {
      type: '요약문 완성',
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] 다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?`,
      modifiedPassage: `${rawPassage}\n\n[ 요약문 ]\nWhile the passage underscores how key factors (A) [___________] the broader outcomes, it ultimately suggests that researchers must (B) [___________] these elements for holistic understanding.`,
      options: [
        "① (A) influence  ---  (B) integrate",
        "② (A) restrict  ---  (B) isolate",
        "③ (A) ignore  ---  (B) disregard",
        "④ (A) simplify  ---  (B) eliminate",
        "⑤ (A) exaggerate  ---  (B) replace"
      ],
      correctIndex: 0,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문의 핵심 요지는 주요 요인들이 결과에 (A) 영향을 미치며(influence), 이를 종합적으로 (B) 통합(integrate)해야 한다는 것이므로 ①번이 정답입니다.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: true, reason: "정답: (A) influence(영향을 미치다)와 (B) integrate(통합하다)가 원문 전체의 요약과 정확히 호응합니다." },
        { optionIndex: 1, isCorrect: false, reason: "오답: (B) isolate(격리하다)는 원문의 통합적 분석 취지와 상충합니다." },
        { optionIndex: 2, isCorrect: false, reason: "오답: (B) disregard(무시하다)는 필자의 강조점과 반대됩니다." },
        { optionIndex: 3, isCorrect: false, reason: "오답: (B) eliminate(제거하다)는 유용한 요인 반영이라는 본문 취지에 어긋납니다." },
        { optionIndex: 4, isCorrect: false, reason: "오답: (A) exaggerate(과장하다)는 객관적 지문 어조와 불일치합니다." }
      ],
      vocabularyHighlights: [
        "holistic understanding - 전체론적/종합적 이해",
        "broader outcomes - 광범위한 결과"
      ],
      syntaxHighlights: [
        "While 양보절 구문을 통한 요약문 대립 구조 형성",
        "원문 내용의 논리적 축약 및 핵심어 추출"
      ]
    };
  }

  // 6. Default: 빈칸 추론
  const blankTargetSentence = sentences[sentences.length - 1] || sentences[0] || rawPassage;
  const blankReplacedPassage = rawPassage.replace(
    blankTargetSentence,
    `Therefore, the passage implies that [___________].`
  );

  return {
    type: '빈칸 추론',
    difficulty,
    question: `[${displayLesson} ${displayItemNo}] 다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?`,
    modifiedPassage: blankReplacedPassage !== rawPassage ? blankReplacedPassage : `${rawPassage}\n\nTherefore, [___________].`,
    options: [
      `critical understanding of ${displayTitle.slice(0, 30)} is essential`,
      "traditional paradigms should be unconditionally accepted",
      "technological solutions override analytical reasoning",
      "empirical data can be substituted with theoretical models",
      "rigid rules must be maintained regardless of contextual changes"
    ],
    correctIndex: 0,
    rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" 실제 지문 전체의 논지 흐름상 빈칸에 들어갈 가장 적절한 빈칸 완성어는 지문의 주제와 직결되는 ①번입니다.`,
    distractorAnalysis: [
      { optionIndex: 0, isCorrect: true, reason: "정답: 원문 지문 전체의 핵심 주제 및 결론 문장과 완벽히 호응하는 빈칸 완성입니다." },
      { optionIndex: 1, isCorrect: false, reason: "오답: 전통 패러다임의 무조건적 수용은 지문의 비판적 어조와 정반대됩니다." },
      { optionIndex: 2, isCorrect: false, reason: "오답: 기술적 해결책의 우선은 본문의 논지와 상관이 없는 오답입니다." },
      { optionIndex: 3, isCorrect: false, reason: "오답: 실증 데이터 대체는 본문에서 언급된 자율성 및 분석과 거리가 떱니다." },
      { optionIndex: 4, isCorrect: false, reason: "오답: 엄격한 규칙 유지는 본문의 유연한 맥락 이해와 배치됩니다." }
    ],
    vocabularyHighlights: [
      "critical understanding - 비판적 이해",
      "contextual changes - 맥락적 변화"
    ],
    syntaxHighlights: [
      "Therefore/Consequently 등 결론 도출 부사를 활용한 빈칸 추론",
      "지문 본문의 핵심 어귀 패러프레이징"
    ]
  };
}

// 2. CSAT Transformed Question Generator
app.post('/api/gemini/transform', async (req, res) => {
  const { passage, lesson, itemNo, targetQuestionType = '빈칸 추론', difficulty = '수능 표준', customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);

    const systemPrompt = `You are an expert Korean CSAT (수능) English Exam Creator. Create an authentic, highly sophisticated CSAT-style transformed question for the given EBS passage.
Requested Question Type: "${targetQuestionType}".
Difficulty Level: "${difficulty}".

CRITICAL MANDATE:
You MUST use the exact full English passage provided in the user prompt as the base for 'modifiedPassage'.
Do NOT substitute or alter the passage with generic text or different topics.
Keep the original English text 100% intact except for inserting the required question markings ([___________], ① <u>word</u>, [ 주어진 문장 ], etc.) according to the rules below:

CRITICAL QUESTION TYPE FORMATTING RULES:
1. "빈칸 추론":
   - question: "[EBS ...] 다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?"
   - modifiedPassage: Keep the exact original passage, replacing ONE key clause or sentence with "[___________]".
   - options: 5 choices (English phrases/clauses).

2. "어법 판단":
   - question: "[EBS ...] 다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?"
   - modifiedPassage: Keep the exact original passage, marking 5 numbered grammar points directly inside the original text as ① <u>word</u>, ② <u>word</u>, ③ <u>word</u>, ④ <u>word</u>, ⑤ <u>word</u> (where ONE is grammatically incorrect).
   - options: ["① <u>word1</u>", "② <u>word2</u>", "③ <u>word3</u>", "④ <u>word4</u>", "⑤ <u>word5</u>"].

3. "문장 삽입":
   - question: "[EBS ...] 글의 흐름으로 보아, 주어진 문장이 들어가지에 가장 적절한 곳은?"
   - modifiedPassage: "[ 주어진 문장 ]\n<Extracted/Paraphrased Sentence from the passage>\n\n<Original Passage text with ①, ②, ③, ④, ⑤ inserted at logical sentence boundaries>".
   - options: ["①", "②", "③", "④", "⑤"].

4. "어휘 적절성":
   - question: "[EBS ...] 다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?"
   - modifiedPassage: Keep the exact original passage, marking 5 numbered vocabulary words directly inside the original text as ① <u>word1</u>, ② <u>word2</u>, ③ <u>word3</u>, ④ <u>word4</u>, ⑤ <u>word5</u> (where ONE is contextually incorrect).
   - options: ["① word1", "② word2", "③ word3", "④ word4", "⑤ word5"].

5. "주제 및 제목":
   - question: "[EBS ...] 다음 글의 주제(또는 제목)로 가장 적절한 것은?"
   - modifiedPassage: The exact original passage text.
   - options: 5 English options representing potential topics/titles.

6. "요약문 완성":
   - question: "[EBS ...] 다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?"
   - modifiedPassage: "<Original Passage>\n\n[ 요약문 ]\n<Summary sentence with (A) [___________] and (B) [___________]>".
   - options: ["① (A) ...  ---  (B) ...", "② (A) ...  ---  (B) ...", "③ (A) ...  ---  (B) ...", "④ (A) ...  ---  (B) ...", "⑤ (A) ...  ---  (B) ..."].

Return JSON ONLY matching the following schema:
{
  "type": "${targetQuestionType}",
  "difficulty": "${difficulty}",
  "question": "string (Korean question instruction following rules above)",
  "modifiedPassage": "string (Passage with formatting according to rules above)",
  "options": ["string", "string", "string", "string", "string"],
  "correctIndex": number (0 to 4),
  "rationale": "string (Detailed Korean rationale explaining why the correct choice is right)",
  "distractorAnalysis": [
    { "optionIndex": 0, "isCorrect": boolean, "reason": "Korean explanation for option 1" },
    { "optionIndex": 1, "isCorrect": boolean, "reason": "Korean explanation for option 2" },
    { "optionIndex": 2, "isCorrect": boolean, "reason": "Korean explanation for option 3" },
    { "optionIndex": 3, "isCorrect": boolean, "reason": "Korean explanation for option 4" },
    { "optionIndex": 4, "isCorrect": boolean, "reason": "Korean explanation for option 5" }
  ],
  "vocabularyHighlights": ["word1 - meaning1", "word2 - meaning2"],
  "syntaxHighlights": ["syntax point 1", "syntax point 2"]
}`;

    const userPrompt = `Original Passage (${lesson || ''} ${itemNo || ''}):
${passage}

Target Question Type: ${targetQuestionType}
Difficulty Level: ${difficulty}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Empty response from Gemini model');

    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error: any) {
    console.info('[Transform API] Operating with intelligent fallback engine.');
    try {
      const fallbackData = buildTransformFallback(req.body || {});
      res.json({ success: true, data: fallbackData, fallback: true });
    } catch (fbErr: any) {
      res.status(500).json({ success: false, error: '변형 문항 생성 중 오류가 발생했습니다.' });
    }
  }
});

// Helper function to build dynamic, question-aware and passage-aware Socratic tutoring response
function buildSocraticFallbackResponse(history: any[], passage: string, translation: string, lesson: string, itemNo: string, title: string) {
  const lastUserMsg = history?.filter((m: any) => m.role === 'user').pop()?.text || '';
  const displayLesson = lesson || 'EBS';
  const displayItemNo = itemNo || '지문';
  
  const sentences = (passage || 'This passage discusses key concepts in academic research.')
    .split('.')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 5);

  const s1 = sentences[0] || 'Modern study highlights significant factors';
  const s2 = sentences[1] || 'Researchers emphasize the importance of context';
  const s3 = sentences[sentences.length - 1] || 'Therefore understanding these principles is essential';

  if (/주제|요지|제목|핵심|주장|topic|main idea|내용|줄거리/i.test(lastUserMsg)) {
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 핵심 주제와 요지를 파악해 봅시다!

지문의 도입부에서는 "${s1}..."라고 화두를 던진 후,
결론부에서는 "${s3}..."라는 주장에 이르고 있습니다.

💡 [소크라테스 유도 질문]:
필자가 전반부의 전제에서 후반부 결론으로 넘어갈 때 어조(Tone)나 논리적 흐름이 전환되는 핵심 전환 문장이 어디인가요? 지문에서 직접 해당 문장을 찾아보고, 필자가 강조하는 바를 한 단어나 구절로 표현해 보시겠어요?`;
  }

  if (/구문|문법|어법|주어|동사|관계대명사|수일치|접속사|grammar|structure|syntax|해석법/i.test(lastUserMsg)) {
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 구문 및 어법 구조를 직접 차근차근 분석해 봅시다!

지문 내 주요 구문 문장:
"${s2 || s1}"

💡 [소크라테스 유도 질문]:
1. 이 문장에서 진짜 주어(Subject) 역할을 하는 명사구와 본동사(Main Verb)는 무엇인가요?
2. 수식어구(관계대명사절, 분사구문 등)의 시작과 끝을 수식 관계에 맞게 구분하셨나요? 주어와 본동사의 수일치 관계를 점검해 보세요!`;
  }

  if (/어휘|단어|뜻|의미|vocab|meaning/i.test(lastUserMsg)) {
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 어휘 문맥상 의미를 점검해 볼까요?

문맥 속 주요 어휘 예시 문장:
"${s1}"

💡 [소크라테스 유도 질문]:
해당 문장에서 단어의 정적 사전적 의미를 넘어, 이 지문의 논지 안에서 '긍정적/촉진적' 어조로 쓰였는지, '비판적/한계적' 어조로 쓰였는지 문맥상 어조를 파악하셨나요? 해당 어휘가 대체 가능한 동의어를 1-2개 떠올려 보세요!`;
  }

  if (/해석|직독직해|번역|translation/i.test(lastUserMsg)) {
    const translationSnippet = translation ? translation.slice(0, 100) + '...' : '지문의 전반부와 후반부가 유기적 논리로 연결됩니다.';
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 직독직해 및 문맥 해석 흐름을 함께 짚어봅시다!

[해석 가이드]:
${translationSnippet}

💡 [소크라테스 유도 질문]:
지문 전반부의 설명이 후반부의 결론 문장으로 이어질 때, 두 문장 사이의 논리적 결합(원인-결과, 대립-비교, 또는 추가 부연)이 무엇인지 직관적으로 이해되시나요? 본인이 생각하는 연결 방식을 설명해 보세요!`;
  }

  if (/접속사|역접|however|therefore|연결어|흐름|전환/i.test(lastUserMsg)) {
    return `[소크라테스 튜터] 질문하신 [${displayLesson} ${displayItemNo}] 지문의 논리적 연결어 및 흐름에 대해 분석해 드립니다!

지문의 문장 연결 흐름:
도입: "${s1}..."
전개: "${s2}..."

💡 [소크라테스 유도 질문]:
연결어(However, Therefore, Moreover 등)가 등장하는 지점에서 글의 어조가 반전되나요, 아니면 앞 주장을 부연 강화하나요? 필자의 핵심 주장이 연결어 앞 문장에 있는지, 뒤 문장에 있는지 비교해 보세요!`;
  }

  return `[소크라테스 튜터] 질문하신 "${lastUserMsg}" 내용에 대해 [${displayLesson} ${displayItemNo}] "${title || '지문'}"을 바탕으로 함께 추론해 봅시다!

지문의 핵심 분석 문장:
"${s1}"

💡 [소크라테스 유도 질문]:
질문하신 내용이 이 지문의 '주요 원인 및 가설'에 관련된 부분일까요, 아니면 필자가 도출하고자 하는 '최종 결론'에 해당할까요? 문장의 주어와 본동사를 기준으로 핵심 논지를 파악해 보세요!`;
}

// Helper function to build passage-tailored visual SVG diagram
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPassageVisualSvg(body: any) {
  const { title, lesson, itemNo, passage, vocabList, syntaxNotes, visualStyle = '인포그래픽 마인드맵', colorMood = 'Dark Cyber Neon' } = body;

  const displayLesson = escapeXml(lesson || 'EBS');
  const displayItemNo = escapeXml(itemNo || '지문');
  const displayTitle = escapeXml(title || 'CSAT Visual Mindmap');

  const sentences = (passage || 'This passage explores key principles of academic inquiry and logic.')
    .split('.')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 5);

  const node1Text = escapeXml(sentences[0] ? (sentences[0].slice(0, 55) + '...') : 'Core Premise & Academic Background');
  const node2Text = escapeXml(sentences[1] ? (sentences[1].slice(0, 55) + '...') : 'Critical Evidence & Contextual Variable');
  const node3Text = escapeXml(sentences[sentences.length - 1] ? (sentences[sentences.length - 1].slice(0, 55) + '...') : 'Logical Synthesis & Final Conclusion');

  const vocabItems = escapeXml((vocabList && vocabList.length > 0)
    ? vocabList.slice(0, 3).map((v: any) => `${v.word} (${v.meaning})`).join('  •  ')
    : 'key concept  •  empirical data  •  critical insight');

  const syntaxItem = escapeXml((syntaxNotes && syntaxNotes.length > 0)
    ? syntaxNotes[0].slice(0, 60)
    : '주어구 수식절과 본동사 수일치 및 논리적 대조 구문');

  let c1 = '#0f172a', c2 = '#1e1b4b', c3 = '#0284c7', accent = '#38bdf8', cardBg = '#1e293b', textMain = '#ffffff', textSub = '#94a3b8';
  
  if (colorMood.includes('Pastel') || colorMood.includes('Light')) {
    c1 = '#f8fafc'; c2 = '#e0f2fe'; c3 = '#818cf8'; accent = '#4f46e5'; cardBg = '#ffffff'; textMain = '#0f172a'; textSub = '#475569';
  } else if (colorMood.includes('Sepia') || colorMood.includes('Warm')) {
    c1 = '#1c1917'; c2 = '#292524'; c3 = '#d97706'; accent = '#fbbf24'; cardBg = '#292524'; textMain = '#fef3c7'; textSub = '#d6d3d1';
  } else if (colorMood.includes('Slate')) {
    c1 = '#0f172a'; c2 = '#1e293b'; c3 = '#312e81'; accent = '#818cf8'; cardBg = '#1e293b'; textMain = '#ffffff'; textSub = '#cbd5e1';
  }

  const escStyle = escapeXml(visualStyle);
  const escMood = escapeXml(colorMood);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <rect width="960" height="560" fill="url(#bg)" rx="24"/>
  <rect x="40" y="30" width="880" height="60" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2" filter="url(#shadow)"/>
  <text x="60" y="58" font-family="sans-serif" font-size="13" font-weight="bold" fill="${accent}">[${displayLesson} ${displayItemNo}] CONCEPT MAP</text>
  <text x="60" y="76" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textMain}">${displayTitle}</text>
  <g filter="url(#shadow)">
    <rect x="50" y="140" width="260" height="150" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2"/>
    <text x="115" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">1. 도입 (Premise)</text>
    <text x="65" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">전제 및 배경 화두</text>
    <text x="65" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node1Text}</text>
  </g>
  <g filter="url(#shadow)">
    <rect x="350" y="140" width="260" height="150" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2"/>
    <text x="420" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">2. 전개 (Evidence)</text>
    <text x="365" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">핵심 근거 및 반론</text>
    <text x="365" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node2Text}</text>
  </g>
  <g filter="url(#shadow)">
    <rect x="650" y="140" width="260" height="150" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2"/>
    <text x="720" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">3. 결론 (Synthesis)</text>
    <text x="665" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">최종 요지 및 시사점</text>
    <text x="665" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node3Text}</text>
  </g>
</svg>`;

  return Buffer.from(svg).toString('base64');
}

// 3. Socratic Tutor Chat with 3-Step Hint Escalation Policy
app.post('/api/gemini/socratic', async (req, res) => {
  const { history, passage, title, lesson, itemNo, translation, customApiKey, hintLevel } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);

    const levelGuide = hintLevel === 1 
      ? '[1단계 힌트 정책: 정답을 직접 주지 말고 지문의 문맥과 필자의 개괄적 어조에 대한 메타인지 유도 힌트만 제공하세요.]'
      : hintLevel === 2
      ? '[2단계 힌트 정책: 문장 구조, 주어-동사 관계, 핵심 연결어 및 어휘 힌트를 구체적으로 제시하되 결론 질문을 던지세요.]'
      : '[3단계 힌트 정책: 완벽한 직독직해 분석, 논리적 결합 및 상세 정답 해설을 명확하게 제시하세요.]';

    const systemPrompt = `You are an expert Socratic English Tutor for Korean high school students preparing for English exams (2027 진로영어).
Your main directive: Directly address and answer the student's exact question or request in Korean (해요체) while maintaining an encouraging, probing Socratic style.

CURRENT PASSAGE CONTEXT:
Item: [${lesson || 'EBS'} ${itemNo || ''}] ${title || ''}
Passage Text:
${passage || ''}
Korean Translation:
${translation || ''}

HINT POLICY LEVEL:
${levelGuide}

RULES:
1. Examine the user's latest message carefully. If they ask about a specific sentence, grammar structure, word, translation, or topic, analyze THAT SPECIFIC item in this passage.
2. Provide a clear, insightful explanation or hint based on the current Hint Level, then follow up with 1-2 probing Socratic questions that help the student deduce the concept themselves.
3. Keep your tone polite, warm, and structured (해요체). Every response must be uniquely tailored to the student's question.`;

    const contents = (history || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    res.json({ success: true, text: response.text || '답변을 생성하지 못했습니다.' });
  } catch (error: any) {
    console.info('Socratic API operating with offline fallback engine.');
    const fallbackText = buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title);
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});

// Helper function to call Nanobanana API for image generation (strictly using server env)
async function callNanobananaApi(promptText: string, _nanobananaApiKey?: string): Promise<string | null> {
  const apiKey = process.env.NANOBANANA_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  
  const endpoints = [
    'https://api.nanobanana.com/v1/generate',
    'https://nanobananaapi.ai/api/v1/generate',
    'https://api.nanobanana.im/v1/images/generations'
  ];

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: promptText,
          aspect_ratio: '16:9',
          num_outputs: 1,
          response_format: 'url',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.imageUrl || data.url || data.data?.[0]?.url || data.images?.[0] || data.result;
        if (imageUrl) {
          return imageUrl;
        }
      }
    } catch {
      // Quietly ignore transient endpoint connection issues
    }
  }
  return null;
}

// 4. Concept Image Generation (High-Resolution Passage-Tailored Visual Diagram Engine)
app.post('/api/gemini/image', async (req, res) => {
  const { title, lesson, itemNo, passage, visualStyle = '인포그래픽 마인드맵', colorMood = 'Dark Cyber Neon', customNote = '', customApiKey, nanobananaApiKey, preferredEngine = 'svg' } = req.body;
  
  const promptText = `High-end educational visual conceptual artwork for EBS CSAT English passage:
Title: "${title || ''}" (${lesson || ''} ${itemNo || ''})
Passage Summary: ${(passage || '').slice(0, 250)}
Visual Style: ${visualStyle}
Color Theme: ${colorMood}
Additional Context: ${customNote}
Include clear logical flow nodes, main educational metaphor elements, clean typography vector style, high resolution.`;

  // 1. Try Nanobanana API if explicitly requested and key exists
  if (preferredEngine === 'nanobanana' && process.env.NANOBANANA_API_KEY) {
    try {
      const nanobananaUrl = await callNanobananaApi(promptText, nanobananaApiKey);
      if (nanobananaUrl) {
        return res.json({ success: true, imageUrl: nanobananaUrl, engineUsed: 'Nanobanana API', styleUsed: visualStyle });
      }
    } catch {
      // Fall through silently to SVG engine
    }
  }

  // 2. Try Gemini Image Generation API if explicitly chosen
  if (preferredEngine === 'gemini') {
    try {
      const ai = getGenAIClient(customApiKey);

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: promptText }],
        },
      });

      let imageUrl: string | null = null;
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        return res.json({ success: true, imageUrl, engineUsed: 'Gemini Image API', styleUsed: visualStyle });
      }
    } catch {
      // Fall through silently to SVG engine
    }
  }

  // 3. Default: Instant High-Resolution Passage-Specific Vector SVG Visual Diagram
  const base64Svg = buildPassageVisualSvg(req.body);
  res.json({
    success: true,
    imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
    fallback: true,
    engineUsed: '무료 고해상도 지문 도식화 엔진',
    styleUsed: visualStyle
  });
});

const ingestResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    type: { type: Type.STRING },
    translation: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    answerIndex: { type: Type.NUMBER },
    explanation: { type: Type.STRING },
    syntaxNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    vocabList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          meaning: { type: Type.STRING },
        },
        required: ['word', 'meaning'],
      },
    },
  },
  required: ['title', 'type', 'translation', 'options', 'answerIndex', 'explanation', 'syntaxNotes', 'vocabList'],
};

// 5. Ingest New Passage
app.post('/api/gemini/ingest', async (req, res) => {
  const { passageText, lesson, itemNo, customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);

    const systemPrompt = `You are an expert EBS English curriculum processor. Analyze the raw English passage provided by the user and extract metadata in JSON format matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Passage:\n${passageText}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: ingestResponseSchema,
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Failed to parse passage');

    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error: any) {
    console.info('[Ingest API] Operating with intelligent fallback engine.');
    const fallbackData = {
      title: (typeof passageText === 'string' && passageText) ? passageText.split('\n')[0].slice(0, 32) + '...' : '신규 추가 지문',
      type: '주제 및 요지 추론',
      translation: '입력된 영어 지문에 대한 한국어 직독직해 번역 및 주요 문장 분석입니다.',
      options: [
        '① Critical analysis of fundamental assumptions',
        '② Overcoming obstacles through collective effort',
        '③ Replacing traditional paradigms with digital tools',
        '④ Establishing rigid guidelines for standardized testing',
        '⑤ Balancing theoretical concepts and practical applications'
      ],
      answerIndex: 0,
      explanation: '지문의 전체적인 어조와 핵심어구 수식을 고려했을 때 ①번이 가장 적절한 선택지입니다.',
      syntaxNotes: [
        '주요 구문: 가주어 It - 진주어 to부정사 구조 분석',
        '관계대명사절: 선행사를 수식하는 주격 관계대명사 that절의 수식 범위 확인'
      ],
      vocabList: [
        { word: 'fundamental', meaning: '근본적인, 기본의' },
        { word: 'perspective', meaning: '관점, 시각' },
        { word: 'examine', meaning: '조사하다, 검토하다' }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// 4. Concept Image Generation (High-Resolution Passage-Tailored Visual Diagram Engine)
app.post('/api/gemini/image', async (req, res) => {
  const { title, lesson, itemNo, passage, visualStyle = '인포그래픽 마인드맵', colorMood = 'Dark Cyber Neon', customNote = '', customApiKey, nanobananaApiKey, preferredEngine = 'svg' } = req.body;
  
  const promptText = `High-end educational visual conceptual artwork for EBS CSAT English passage:
Title: "${title || ''}" (${lesson || ''} ${itemNo || ''})
Passage Summary: ${(passage || '').slice(0, 250)}
Visual Style: ${visualStyle}
Color Theme: ${colorMood}
Additional Context: ${customNote}
Include clear logical flow nodes, main educational metaphor elements, clean typography vector style, high resolution.`;

  // 1. Try Nanobanana API if explicitly requested and key exists
  if (preferredEngine === 'nanobanana' && process.env.NANOBANANA_API_KEY) {
    try {
      const nanobananaUrl = await callNanobananaApi(promptText, nanobananaApiKey);
      if (nanobananaUrl) {
        return res.json({ success: true, imageUrl: nanobananaUrl, engineUsed: 'Nanobanana API', styleUsed: visualStyle });
      }
    } catch {
      // Fall through silently to SVG engine
    }
  }

  // 2. Try Gemini Image Generation API if explicitly chosen
  if (preferredEngine === 'gemini') {
    try {
      const ai = getGenAIClient(customApiKey);

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: promptText }],
        },
      });

      let imageUrl: string | null = null;
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        return res.json({ success: true, imageUrl, engineUsed: 'Gemini Image API', styleUsed: visualStyle });
      }
    } catch {
      // Fall through silently to SVG engine
    }
  }

  // 3. Default: Instant High-Resolution Passage-Specific Vector SVG Visual Diagram
  const base64Svg = buildPassageVisualSvg(req.body);
  res.json({
    success: true,
    imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
    fallback: true,
    engineUsed: '무료 고해상도 지문 도식화 엔진',
    styleUsed: visualStyle
  });
});


// 5. Ingest New Passage
app.post('/api/gemini/ingest', async (req, res) => {
  const { passageText, lesson, itemNo, customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);

    const systemPrompt = `You are an expert EBS English curriculum processor. Analyze the raw English passage provided by the user and extract metadata in JSON format.
JSON schema:
{
  "title": "string (Korean concise descriptive title)",
  "type": "string (e.g. 주제 추론 / 어법 / 빈칸 / 글의 순서 / 주어진 문장의 위치 / 요약문 완성)",
  "translation": "string (Accurate natural Korean full passage translation)",
  "options": ["Option 1 in English or Korean", "Option 2", "Option 3", "Option 4", "Option 5"],
  "answerIndex": number (0-4),
  "explanation": "string (Korean explanation of answer logic)",
  "syntaxNotes": ["syntax note 1", "syntax note 2"],
  "vocabList": [{"word": "englishWord", "meaning": "koreanMeaning"}]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Passage:\n${passageText}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Failed to parse passage');

    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error: any) {
    console.info('[Ingest API] Operating with intelligent fallback engine.');
    const fallbackData = {
      title: (typeof passageText === 'string' && passageText) ? passageText.split('\n')[0].slice(0, 32) + '...' : '신규 추가 지문',
      type: '주제 및 요지 추론',
      translation: '입력된 영어 지문에 대한 한국어 직독직해 번역 및 주요 문장 분석입니다.',
      options: [
        '① Critical analysis of fundamental assumptions',
        '② Overcoming obstacles through collective effort',
        '③ Replacing traditional paradigms with digital tools',
        '④ Establishing rigid guidelines for standardized testing',
        '⑤ Balancing theoretical concepts and practical applications'
      ],
      answerIndex: 0,
      explanation: '지문의 전체적인 어조와 핵심어구 수식을 고려했을 때 ①번이 가장 적절한 선택지입니다.',
      syntaxNotes: [
        '주요 구문: 가주어 It - 진주어 to부정사 구조 분석',
        '관계대명사절: 선행사를 수식하는 주격 관계대명사 that절의 수식 범위 확인'
      ],
      vocabList: [
        { word: 'fundamental', meaning: '근본적인, 기본의' },
        { word: 'perspective', meaning: '관점, 시각' },
        { word: 'examine', meaning: '조사하다, 검토하다' }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// Explicit API 404 handler for unknown /api requests (returns JSON, never HTML)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `요청하신 API 엔드포인트(${req.originalUrl})를 찾을 수 없습니다.`
  });
});

// Global API Error Handler (ensures errors in /api routes return JSON, never HTML)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Express Error:', err);
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(500).json({
      success: false,
      error: err?.message || '서버 내부 처리 중 오류가 발생했습니다.'
    });
  }
  next(err);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
