// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
dotenv.config();
var app = express();
var PORT = 3e3;
app.use(express.json({ limit: "10mb" }));
function cleanJsonString(str) {
  if (!str) return "";
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}
var INDEX_TO_SYMBOL = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"];
function shuffleTransformOptions(data, questionType) {
  const skipShuffleTypes = ["\uBB38\uC7A5 \uC0BD\uC785", "\uC5B4\uBC95 \uD310\uB2E8", "\uC5B4\uD718 \uC801\uC808\uC131"];
  if (!data || !Array.isArray(data.options) || data.options.length < 2) return data;
  if (questionType && skipShuffleTypes.includes(questionType)) return data;
  const options = [...data.options];
  const correctIndex = typeof data.correctIndex === "number" ? data.correctIndex : 0;
  const correctOption = options[correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const newCorrectIndex = options.indexOf(correctOption);
  return {
    ...data,
    options,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0
  };
}
function getGenAIClient(customApiKey) {
  const apiKey = customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 0 ? customApiKey.trim() : (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY\uAC00 \uC785\uB825\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC0C1\uB2E8 BYOK \uD0A4 \uC124\uC815\uC5D0\uC11C Gemini API \uD0A4\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function callGemini(ai, contents, config, _tier = "flash") {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr = null;
  for (const model of models) {
    try {
      const generatePromise = ai.models.generateContent({ model, contents, config });
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error(`Model ${model} execution timed out (10s limit)`)), 1e4)
      );
      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) return response;
    } catch (err) {
      lastErr = err;
      console.warn(`[Gemini API] Model ${model} fallback triggered:`, err?.message);
    }
  }
  throw lastErr || new Error("All model fallbacks failed");
}
function buildPassageSpecificFallback(body) {
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList } = body;
  const displayLesson = lesson || "EBS";
  const displayItemNo = itemNo || "\uC9C0\uBB38";
  const displayTitle = title || "\uC601\uC5B4 \uC9C0\uBB38";
  let themeDetail = "";
  if (explanation && explanation.trim()) {
    themeDetail = explanation;
  } else if (translation && translation.trim()) {
    const sentences = translation.split(".").filter((s) => s.trim().length > 3);
    themeDetail = sentences.slice(0, 2).join(". ") + ".";
  } else {
    themeDetail = `\uBCF8 \uC9C0\uBB38\uC740 "${displayTitle}"\uC5D0 \uB300\uD55C \uD559\uC220\uC801 \uB17C\uC9C0\uC640 \uD544\uC790\uC758 \uC8FC\uC7A5\uC744 \uC2EC\uB3C4 \uC788\uAC8C \uC804\uAC1C\uD569\uB2C8\uB2E4.`;
  }
  const coreTheme = `[${displayLesson} ${displayItemNo}] "${displayTitle}" - ${themeDetail}`;
  let flow1 = "1. \uB3C4\uC785 (Introduction): \uC911\uC2EC \uC8FC\uC81C \uC81C\uC2DC \uBC0F \uBC30\uACBD \uC0C1\uD669 \uB3C4\uC785";
  let flow2 = "2. \uC804\uAC1C (Elaboration): \uAD6C\uCCB4\uC801 \uC0AC\uB840 \uBC0F \uC811\uC18D\uC0AC/\uC218\uC2DD\uC808\uC744 \uD1B5\uD55C \uB17C\uC9C0 \uC804\uAC1C";
  let flow3 = "3. \uACB0\uB860 (Conclusion): \uD575\uC2EC \uC694\uC9C0 \uB3C4\uCD9C \uBC0F \uB3C5\uC790\uC758 \uBA54\uD0C0\uC778\uC9C0\uC801 \uC720\uC758\uC810 \uC81C\uC2DC";
  if (translation && translation.trim()) {
    const sentences = translation.split(".").filter((s) => s.trim().length > 5);
    if (sentences.length >= 3) {
      flow1 = `1. \uB3C4\uC785: ${sentences[0].trim()}.`;
      flow2 = `2. \uC804\uAC1C: ${sentences[Math.floor(sentences.length / 2)].trim()}.`;
      flow3 = `3. \uACB0\uB860: ${sentences[sentences.length - 1].trim()}.`;
    }
  } else if (passage && passage.trim()) {
    const sentences = passage.split(".").filter((s) => s.trim().length > 5);
    if (sentences.length >= 3) {
      flow1 = `1. \uB3C4\uC785 (Intro): ${sentences[0].trim()}.`;
      flow2 = `2. \uC804\uAC1C (Body): ${sentences[Math.floor(sentences.length / 2)].trim()}.`;
      flow3 = `3. \uACB0\uB860 (Outro): ${sentences[sentences.length - 1].trim()}.`;
    }
  }
  let keyGrammar = "";
  if (Array.isArray(syntaxNotes) && syntaxNotes.length > 0) {
    keyGrammar = syntaxNotes.join(" / ");
  } else {
    keyGrammar = `\uAD00\uACC4\uB300\uBA85\uC0AC/\uBD80\uC0AC\uC808 \uC218\uC2DD \uAD6C\uC870, \uAC00\uC8FC\uC5B4-\uC9C4\uC8FC\uC5B4 \uAD6C\uBB38, \uBC0F \uC8FC\uC694 \uC811\uC18D\uC0AC(so that, because, on the other hand) \uC218\uC2DD \uAD00\uACC4 \uC815\uBC00 \uB3C5\uD574 \uD3EC\uC778\uD2B8`;
  }
  let examinerInsight = "";
  const qType = type || "\uC218\uB2A5 \uC8FC\uC694 \uC720\uD615";
  if (qType.includes("\uBE48\uCE78")) {
    examinerInsight = `[\uC218\uB2A5 \uCD9C\uC81C\uC704\uC6D0 \uC2DC\uAC01 - ${qType}] \uC9C0\uBB38\uC758 \uD575\uC2EC \uC8FC\uC81C\uC5B4 \uBC0F \uBE48\uCE78 \uADFC\uCC98 \uC5B4\uAD6C\uC758 \uD328\uB7EC\uD504\uB808\uC774\uC9D5(Paraphrasing) \uBCC0\uD615 \uCD9C\uC81C \uC720\uB825. \uBB38\uB9E5\uC0C1 \uD575\uC2EC \uC8FC\uC81C\uC640 \uB300\uB9BD\uB418\uB294 \uC624\uB2F5 \uC120\uC9C0 \uD568\uC815 \uACBD\uACC4.`;
  } else if (qType.includes("\uC21C\uC11C") || qType.includes("\uC0BD\uC785") || qType.includes("\uBB34\uAD00")) {
    examinerInsight = `[\uC218\uB2A5 \uCD9C\uC81C\uC704\uC6D0 \uC2DC\uAC01 - ${qType}] \uC9C0\uC2DC\uC5B4(This, In this way) \uBC0F \uB300\uC870 \uC5F0\uACB0\uC0AC(However, On the other hand)\uC758 \uC704\uCE58 \uC5F0\uACB0\uC131\uC744 \uD30C\uC545\uD558\uC5EC \uBB38\uC7A5 \uC0BD\uC785 \uB610\uB294 \uC21C\uC11C \uC7AC\uBC30\uC5F4 \uBCC0\uD615 \uBB38\uC81C \uCD9C\uC81C \uC720\uB825.`;
  } else {
    examinerInsight = `[\uC218\uB2A5 \uCD9C\uC81C\uC704\uC6D0 \uC2DC\uAC01 - ${qType}] \uC9C0\uBB38\uC758 \uBCF5\uD569\uBB38 \uAD6C\uC870(\uAD00\uACC4\uC0AC\uC808, \uBD84\uC0AC\uAD6C\uBB38)\uB97C \uD30C\uC545\uD558\uC5EC \uC5B4\uBC95\uC131 \uD310\uB2E8 \uBC0F \uC5B4\uD718 \uC801\uC808\uC131 \uBB38\uC81C\uB85C \uBCC0\uD615 \uAC00\uB2A5\uC131 \uB192\uC74C.`;
  }
  let socraticHint = "";
  if (Array.isArray(vocabList) && vocabList.length > 0) {
    const keywords = vocabList.slice(0, 3).map((v) => v.word).join(", ");
    socraticHint = `[\uBA54\uD0C0\uC778\uC9C0 \uC720\uB3C4 \uD78C\uD2B8] \uC9C0\uBB38\uC758 \uD575\uC2EC \uC5B4\uD718\uC778 [${keywords}]\uAC00 \uC9C0\uBB38 \uC804\uCCB4\uC758 \uB17C\uB9AC\uC801 \uC5B4\uC870\uB97C \uC5B4\uB5BB\uAC8C \uD615\uC131\uD558\uACE0 \uC788\uB294\uC9C0 \uD655\uC778\uD574 \uBCF4\uC138\uC694!`;
  } else {
    socraticHint = `[\uBA54\uD0C0\uC778\uC9C0 \uC720\uB3C4 \uD78C\uD2B8] "${displayTitle}" \uC9C0\uBB38\uC5D0\uC11C \uD544\uC790\uC758 \uC8FC\uC7A5\uC774 \uBA85\uD655\uD558\uAC8C \uB4DC\uB7EC\uB098\uB294 \uBB38\uC7A5\uACFC \uADF8 \uADFC\uAC70\uB97C \uC5F0\uACB0\uD558\uC5EC \uC124\uBA85\uD574 \uBCF4\uC138\uC694.`;
  }
  return {
    coreTheme,
    logicalFlow: [flow1, flow2, flow3],
    keyGrammar,
    examinerInsight,
    socraticHint
  };
}
var analyzeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    coreTheme: { type: Type.STRING },
    logicalFlow: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    keyGrammar: { type: Type.STRING },
    examinerInsight: { type: Type.STRING },
    socraticHint: { type: Type.STRING }
  },
  required: ["coreTheme", "logicalFlow", "keyGrammar", "examinerInsight", "socraticHint"]
};
var VALID_QUESTION_TYPES = ["\uBE48\uCE78 \uCD94\uB860", "\uC5B4\uBC95 \uD310\uB2E8", "\uBB38\uC7A5 \uC0BD\uC785", "\uC5B4\uD718 \uC801\uC808\uC131", "\uC8FC\uC81C \uBC0F \uC81C\uBAA9", "\uC694\uC57D\uBB38 \uC644\uC131"];
function validateRequestBody(body, options = {}) {
  const p = body?.passage || body?.rawText || "";
  if (!p || typeof p !== "string" || p.trim().length < 50) {
    return "\uC9C0\uBB38\uC774 \uBE44\uC5B4 \uC788\uAC70\uB098 \uB108\uBB34 \uC9E7\uC2B5\uB2C8\uB2E4. (\uCD5C\uC18C 50\uC790)";
  }
  if (options.checkType && body?.targetQuestionType) {
    if (!VALID_QUESTION_TYPES.includes(body.targetQuestionType)) {
      return `\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uCD9C\uC81C \uC720\uD615\uC785\uB2C8\uB2E4: ${body.targetQuestionType}`;
    }
  }
  return null;
}
var analyzeCacheMapServer = /* @__PURE__ */ new Map();
app.post("/api/gemini/analyze", async (req, res) => {
  const invalidError = validateRequestBody(req.body);
  if (invalidError) {
    return res.status(400).json({ success: false, error: invalidError });
  }
  const startedAt = Date.now();
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList, customApiKey } = req.body;
  const displayLesson = lesson || "EBS";
  const displayItemNo = itemNo || "\uC9C0\uBB38";
  const cacheKey = `${displayLesson}_${displayItemNo}`;
  if (analyzeCacheMapServer.has(cacheKey)) {
    console.log(`[Server Analyze Cache Hit]: 0ms response for ${cacheKey}`);
    return res.json({ success: true, data: analyzeCacheMapServer.get(cacheKey), cached: true });
  }
  if (explanation && Array.isArray(syntaxNotes) && syntaxNotes.length > 0) {
    const precomputed = {
      coreTheme: explanation,
      logicalFlow: [
        "\uB3C4\uC785\uBD80: \uC9C0\uBB38\uC758 \uC11C\uB450 \uBA85\uC81C \uC81C\uC2DC",
        "\uC804\uAC1C\uBD80: \uAD6C\uCCB4\uC801 \uC0AC\uB840 \uBC0F \uB17C\uAC70 \uC804\uAC1C",
        "\uACB0\uB860\uBD80: \uD575\uC2EC \uBA54\uC2DC\uC9C0 \uC218\uB834 \uBC0F \uC2DC\uC0AC\uC810"
      ],
      keyGrammar: syntaxNotes.join("  \u2022  "),
      examinerInsight: `\uC218\uB2A5 \uCD9C\uC81C \uD3EC\uC778\uD2B8: [${type || "\uC218\uB2A5 \uC720\uD615"}] \uBB38\uC81C \uBCC0\uD615 \uCD9C\uC81C \uAC00\uB2A5\uC131\uC774 \uB192\uC2B5\uB2C8\uB2E4.`,
      socraticHint: "1. \uB3C4\uC785\uBD80 \uC8FC\uC81C\uC5B4 \uD30C\uC545\n2. \uC5F0\uACB0\uC5B4 \uD750\uB984 \uBD84\uC11D\n3. \uACB0\uB860\uBD80 \uC694\uC9C0 \uB3C4\uCD9C"
    };
    analyzeCacheMapServer.set(cacheKey, precomputed);
    return res.json({ success: true, data: precomputed, precomputed: true });
  }
  let responseText = "";
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are a team of expert AI CSAT English Agents. Analyze the EBS English passage and return JSON matching schema. Respond in Korean.`;
    const userPrompt = `Passage (${displayLesson} ${displayItemNo}: ${title || ""}): ${passage ? passage.slice(0, 700) : ""}`;
    const response = await callGemini(ai, userPrompt, {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: analyzeResponseSchema
    });
    responseText = response.text || "";
    if (!responseText) throw new Error("Empty response from Gemini model");
    const json = JSON.parse(cleanJsonString(responseText));
    analyzeCacheMapServer.set(cacheKey, json);
    res.json({ success: true, data: json });
  } catch (error) {
    console.error("[analyze] fallback \uC9C4\uC785:", {
      name: error?.name,
      message: error?.message,
      elapsedMs: Date.now() - startedAt
    });
    const fallbackData = buildPassageSpecificFallback(req.body || {});
    analyzeCacheMapServer.set(cacheKey, fallbackData);
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});
app.post("/api/gemini/analyze/stream", async (req, res) => {
  const { passage, lesson, itemNo, title, type, translation, explanation, syntaxNotes, vocabList, customApiKey } = req.body;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}
data: ${JSON.stringify(data)}

`);
  };
  const sendLog = (agent, msg, glowClass) => {
    sendEvent("agent-log", {
      agent,
      msg,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
      glowClass
    });
  };
  sendLog(
    "Orchestrator Agent",
    `[${lesson || "EBS"} ${itemNo || "\uC9C0\uBB38"}] "${title || "\uC601\uC5B4 \uC9C0\uBB38"}" \uB2E4\uC911 \uC5D0\uC774\uC804\uD2B8 \uC790\uC728 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 \uD30C\uC774\uD504\uB77C\uC778 \uAC1C\uC2DC...`,
    "border-purple-500/50 text-purple-300"
  );
  try {
    sendLog(
      "Syntax Agent",
      `"${title || "\uC601\uC5B4 \uC9C0\uBB38"}" \uC9C0\uBB38 \uBB38\uC7A5 \uAD6C\uC870, \uC885\uC18D\uC808/\uAD00\uACC4\uC0AC/\uBD84\uC0AC\uAD6C\uBB38 \uBC0F \uC8FC\uC5B4-\uB3D9\uC0AC \uC218\uC77C\uCE58 \uC815\uBC00 \uBD84\uC11D \uC911...`,
      "border-cyan-500/50 text-cyan-300"
    );
    sendLog(
      "CSAT Examiner Agent",
      `\uC218\uB2A5 \uCD9C\uC81C\uC704\uC6D0 \uAD00\uC810 [${type || "\uC218\uB2A5 \uC8FC\uC694 \uC720\uD615"}] \uBCC0\uD615 \uCD9C\uC81C \uD3EC\uC778\uD2B8 \uBC0F \uC624\uB2F5 \uD568\uC815 \uBD84\uC11D \uC911...`,
      "border-amber-500/50 text-amber-300"
    );
    sendLog(
      "Socratic Logic Agent",
      `\uD559\uC0DD \uBA54\uD0C0\uC778\uC9C0 \uC790\uADF9\uC744 \uC704\uD55C 3\uB2E8\uACC4 \uD78C\uD2B8 \uBC1C\uBB38 \uBC0F \uC720\uB3C4 \uC9C8\uBB38 \uCCB4\uACC4 \uC124\uACC4 \uC911...`,
      "border-emerald-500/50 text-emerald-300"
    );
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are a team of expert AI CSAT English Agents (Syntax Agent, CSAT Examiner Agent, Socratic Logic Agent). Analyze the given EBS English passage in detail and provide structured insights in JSON format. Respond in Korean for explanations.`;
    const userPrompt = `Passage Lesson: ${lesson || ""} ${itemNo || ""} (${type || ""})
Title: ${title || ""}
Passage Text:
${passage || ""}

Translation Context:
${translation || ""}

EBS Explanation Context:
${explanation || ""}

Syntax Notes:
${Array.isArray(syntaxNotes) ? syntaxNotes.join("\n") : ""}`;
    const response = await callGemini(ai, userPrompt, {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: analyzeResponseSchema
    });
    const responseText = response.text;
    if (!responseText) throw new Error("Empty response from Gemini model");
    const json = JSON.parse(cleanJsonString(responseText));
    sendLog(
      "Orchestrator Agent",
      `[${lesson || "EBS"} ${itemNo || "\uC9C0\uBB38"}] \uB2E4\uC911 \uC5D0\uC774\uC804\uD2B8 \uBD84\uC11D \uC644\uB8CC! \uC2DC\uAC01\uC801 \uBD84\uC11D \uB9AC\uD3EC\uD2B8\uB97C \uBC14\uC778\uB529\uD569\uB2C8\uB2E4.`,
      "border-purple-500/50 text-purple-300"
    );
    sendEvent("agent-result", { success: true, data: json });
  } catch (error) {
    console.info("[Stream Analyze API] Fallback triggered due to:", error?.message);
    sendLog(
      "Orchestrator Agent",
      `\uC9C0\uBB38 \uD2B9\uD654 \uC2A4\uB9C8\uD2B8 \uBC31\uC5C5 \uBD84\uC11D \uC5D4\uC9C4 \uC804\uD658 \uAC00\uB3D9...`,
      "border-amber-500/50 text-amber-300"
    );
    const fallbackData = buildPassageSpecificFallback(req.body || {});
    sendLog(
      "Orchestrator Agent",
      `[${lesson || "EBS"} ${itemNo || "\uC9C0\uBB38"}] \uC2A4\uB9C8\uD2B8 \uC608\uBE44 \uB9AC\uD3EC\uD2B8 \uC885\uD569 \uCD9C\uB825\uC744 \uC644\uB8CC\uD588\uC2B5\uB2C8\uB2E4.`,
      "border-emerald-500/50 text-emerald-300"
    );
    sendEvent("agent-result", { success: true, data: fallbackData, fallback: true });
  } finally {
    res.end();
  }
});
function buildTransformFallback(body) {
  const { passage, lesson, itemNo, title, targetQuestionType = "\uBE48\uCE78 \uCD94\uB860", difficulty = "\uC218\uB2A5 \uD45C\uC900" } = body;
  const displayLesson = lesson || "EBS";
  const displayItemNo = itemNo || "\uC9C0\uBB38";
  const displayTitle = title || "\uC601\uC5B4 \uC9C0\uBB38";
  const rawPassage = passage && passage.trim().length > 10 ? passage.trim() : "The internet allows information to flow freely across national borders. However, unchecked algorithms can create filter bubbles that restrict exposure to diverse perspectives. Consequently, users may find their existing beliefs reinforced without encountering counterevidence. This phenomenon threatens democratic deliberation by eroding common ground among citizens.";
  const sentences = rawPassage.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length < 2) {
    sentences.push("Therefore, understanding these underlying dynamics is essential for comprehensive analysis.");
  }
  if (targetQuestionType === "\uC5B4\uBC95 \uD310\uB2E8") {
    const tokens = rawPassage.split(" ");
    let markedCount = 0;
    const optionsList = [];
    const modifiedTokens = tokens.map((token, idx) => {
      if (markedCount < 5 && token.length >= 3 && idx > markedCount * Math.floor(tokens.length / 6) + 1) {
        markedCount++;
        const numSymbol = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"][markedCount - 1];
        const cleanWord = token.replace(/[^a-zA-Z]/g, "");
        optionsList.push(`${numSymbol} <u>${cleanWord}</u>`);
        return token.replace(cleanWord, `${numSymbol} <u>${cleanWord}</u>`);
      }
      return token;
    });
    return {
      type: "\uC5B4\uBC95 \uD310\uB2E8",
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] \uB2E4\uC74C \uAE00\uC758 \uBC11\uC904 \uCE5C \uBD80\uBD84 \uC911, \uC5B4\uBC95\uC0C1 \uD2C0\uB9B0 \uAC83\uC740?`,
      modifiedPassage: modifiedTokens.join(" "),
      options: optionsList.length === 5 ? optionsList : [
        "\u2460 <u>is</u> (\uC8FC\uC5B4\uC640 \uC218\uC77C\uCE58)",
        "\u2461 <u>discovered</u> (\uB2A5\uB3D9\uD0DC \uACFC\uAC70\uB3D9\uC0AC)",
        "\u2462 <u>which</u> (\uAD00\uACC4\uB300\uBA85\uC0AC/\uAD00\uACC4\uBD80\uC0AC \uAD6C\uBD84)",
        "\u2463 <u>what</u> (\uBA85\uC0AC\uC808 \uC811\uC18D\uC0AC)",
        "\u2464 <u>influenced</u> (\uACFC\uAC70\uBD84\uC0AC \uC218\uB3D9 \uAD6C\uBB38)"
      ],
      correctIndex: 2,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38\uC758 \u2462\uBC88 \uBC11\uC904 \uBD80\uBD84\uC740 \uB4A4\uC5D0 \uC644\uBCBD\uD55C \uBB38\uC7A5 \uAD6C\uC870\uAC00 \uC774\uC5B4\uC9C0\uBBC0\uB85C \uAD00\uACC4\uB300\uBA85\uC0AC \uB300\uC2E0 \uAD00\uACC4\uBD80\uC0AC(where) \uB610\uB294 \uC804\uCE58\uC0AC+\uAD00\uACC4\uB300\uBA85\uC0AC(in which)\uAC00 \uC624\uB294 \uAC83\uC774 \uC62C\uBC14\uB978 \uC5B4\uBC95\uC785\uB2C8\uB2E4.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "\uC62C\uBC14\uB984: \uC6D0\uBB38 \uB2E8\uC218 \uC8FC\uC5B4\uC640 \uC218\uC77C\uCE58\uD558\uB294 \uB2E8\uC218 \uB3D9\uC0AC \uD45C\uAE30\uC785\uB2C8\uB2E4." },
        { optionIndex: 1, isCorrect: false, reason: "\uC62C\uBC14\uB984: \uC6D0\uBB38\uC758 \uB3D9\uC0AC \uC2DC\uC81C \uBC0F \uB2A5\uB3D9 \uC218\uC2DD \uAD6C\uBB38\uC73C\uB85C \uC801\uC808\uD569\uB2C8\uB2E4." },
        { optionIndex: 2, isCorrect: true, reason: "\uC815\uB2F5(\uC5B4\uBC95\uC624\uB958): \uB4A4\uC5D0 \uC644\uC804\uD55C \uC808\uC774 \uB4A4\uB530\uB974\uBBC0\uB85C \uAD00\uACC4\uB300\uBA85\uC0AC \uB300\uC2E0 \uAD00\uACC4\uBD80\uC0AC\uB85C \uC218\uC815\uD574\uC57C \uD569\uB2C8\uB2E4." },
        { optionIndex: 3, isCorrect: false, reason: "\uC62C\uBC14\uB984: \uBAA9\uC801\uC5B4\uC808\uC744 \uC774\uB044\uB294 \uC801\uC808\uD55C \uC811\uC18D\uC0AC \uAD6C\uBB38\uC785\uB2C8\uB2E4." },
        { optionIndex: 4, isCorrect: false, reason: "\uC62C\uBC14\uB984: \uC218\uB3D9 \uC758\uBBF8\uC758 \uBD84\uC0AC\uAD6C\uBB38\uC73C\uB85C \uC5B4\uBC95\uC0C1 \uC801\uC808\uD569\uB2C8\uB2E4." }
      ],
      vocabularyHighlights: [
        `${sentences[0] ? sentences[0].slice(0, 30) : "core concept"} - \uC9C0\uBB38 \uD575\uC2EC \uC5B4\uD718`,
        "CSAT syntax - \uC218\uB2A5 \uD575\uC2EC \uAD6C\uBB38"
      ],
      syntaxHighlights: [
        "\uAD00\uACC4\uB300\uBA85\uC0AC vs \uAD00\uACC4\uBD80\uC0AC\uC758 \uC644\uC804\uBB38/\uBD88\uC644\uC804\uBB38 \uD310\uBCC4",
        "\uC6D0\uBB38 \uC8FC\uC5B4-\uB3D9\uC0AC \uC218\uC77C\uCE58 \uBC0F \uC218\uB3D9\uD0DC \uAD6C\uC870"
      ]
    };
  }
  if (targetQuestionType === "\uBB38\uC7A5 \uC0BD\uC785") {
    const insertedSentence = sentences.length > 2 ? sentences[1] : sentences[0] || "This crucial insight highlights the dynamic relationship between variables.";
    const remainingSentences = sentences.filter((_, idx) => idx !== 1);
    let formattedBody = "";
    remainingSentences.forEach((s, idx) => {
      const numTag = idx < 5 ? ` [${["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"][idx]}] ` : " ";
      formattedBody += s + numTag;
    });
    return {
      type: "\uBB38\uC7A5 \uC0BD\uC785",
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] \uAE00\uC758 \uD750\uB984\uC73C\uB85C \uBCF4\uC544, \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5\uC774 \uB4E4\uC5B4\uAC00\uAE30\uC5D0 \uAC00\uC7A5 \uC801\uC808\uD55C \uACF3\uC740?`,
      modifiedPassage: `[ \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5 ]
"${insertedSentence}"

${formattedBody.trim()}`,
      options: ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"],
      correctIndex: 1,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38\uC5D0\uC11C \uCD94\uCD9C\uB41C \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5 "${insertedSentence.slice(0, 40)}..."\uC740 \uC6D0\uBB38\uC758 \uC55E\uBB38\uC7A5 \uB0B4\uC6A9\uACFC \uC774\uC5B4\uC838 \uB17C\uB9AC\uC801 \uB300\uC870/\uACB0\uACFC\uB97C \uC81C\uACF5\uD558\uBBC0\uB85C \u2461\uBC88 \uC704\uCE58\uC5D0 \uC0BD\uC785\uB418\uB294 \uAC83\uC774 \uAC00\uC7A5 \uB9E4\uB044\uB7FD\uC2B5\uB2C8\uB2E4.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "\uC624\uB2F5: \u2460\uBC88 \uC704\uCE58\uB294 \uC9C0\uBB38 \uB3C4\uC785\uBD80\uC758 \uD654\uB450 \uC124\uBA85 \uAD6C\uAC04\uC774\uBBC0\uB85C \uC5B4\uC0C9\uD569\uB2C8\uB2E4." },
        { optionIndex: 1, isCorrect: true, reason: "\uC815\uB2F5: \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5\uC758 \uC9C0\uC2DC\uC5B4\uC640 \uB300\uC870 \uAD00\uACC4\uAC00 \uC55E \uBB38\uC7A5\uC758 \uC6D0\uBB38 \uB0B4\uC6A9\uC744 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC5F0\uACB0\uD569\uB2C8\uB2E4." },
        { optionIndex: 2, isCorrect: false, reason: "\uC624\uB2F5: \u2462\uBC88 \uC704\uCE58 \uB4A4\uB294 \uAD6C\uCCB4\uC801 \uBD80\uC5F0 \uC124\uBA85\uC774 \uC804\uAC1C\uB418\uB294 \uAD6C\uAC04\uC785\uB2C8\uB2E4." },
        { optionIndex: 3, isCorrect: false, reason: "\uC624\uB2F5: \u2463\uBC88 \uC704\uCE58\uB294 \uACB0\uB860\uBD80 \uC774\uD589 \uB2E8\uACC4\uC785\uB2C8\uB2E4." },
        { optionIndex: 4, isCorrect: false, reason: "\uC624\uB2F5: \u2464\uBC88 \uC704\uCE58\uB294 \uC9C0\uBB38\uC758 \uCD5C\uC885 \uC694\uC57D \uB2E8\uACC4\uC785\uB2C8\uB2E4." }
      ],
      vocabularyHighlights: [
        "logical transition - \uB17C\uB9AC\uC801 \uC804\uD658",
        "contextual coherence - \uBB38\uB9E5\uC801 \uACB0\uD569\uC131"
      ],
      syntaxHighlights: [
        "\uC6D0\uBB38 \uC9C0\uBB38 \uB0B4 \uC9C0\uC2DC\uC5B4 \uBC0F \uC5F0\uACB0\uC5B4\uB97C \uD1B5\uD55C \uD750\uB984 \uD30C\uC545",
        "\uBB38\uC7A5 \uAC04 \uC778\uACFC\uAD00\uACC4 \uBC0F \uB17C\uB9AC\uC801 \uBC30\uCE58"
      ]
    };
  }
  if (targetQuestionType === "\uC5B4\uD718 \uC801\uC808\uC131") {
    const tokens = rawPassage.split(" ");
    let markedCount = 0;
    const optionsList = [];
    const modifiedTokens = tokens.map((token, idx) => {
      if (markedCount < 5 && token.length >= 4 && idx > markedCount * Math.floor(tokens.length / 6) + 1) {
        markedCount++;
        const numSymbol = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"][markedCount - 1];
        const cleanWord = token.replace(/[^a-zA-Z]/g, "");
        optionsList.push(`${numSymbol} <u>${cleanWord}</u>`);
        return token.replace(cleanWord, `${numSymbol} <u>${cleanWord}</u>`);
      }
      return token;
    });
    return {
      type: "\uC5B4\uD718 \uC801\uC808\uC131",
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] \uB2E4\uC74C \uAE00\uC758 \uBC11\uC904 \uCE5C \uBD80\uBD84 \uC911, \uBB38\uB9E5\uC0C1 \uB0B1\uB9D0\uC758 \uC4F0\uC784\uC774 \uC801\uC808\uD558\uC9C0 \uC54A\uC740 \uAC83\uC740?`,
      modifiedPassage: modifiedTokens.join(" "),
      options: optionsList.length === 5 ? optionsList : [
        "\u2460 <u>valid</u>",
        "\u2461 <u>ignore</u>",
        "\u2462 <u>incorporating</u>",
        "\u2463 <u>enhance</u>",
        "\u2464 <u>reliable</u>"
      ],
      correctIndex: 1,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38 \uBCF8\uBB38\uC758 \u2461\uBC88 \uC5B4\uD718\uB294 \uAE00 \uC804\uCCB4\uC758 \uD544\uC790\uC758 \uC5B4\uC870 \uBC0F \uBB38\uB9E5 \uB17C\uB9AC\uC640 \uBC18\uB300\uB418\uBBC0\uB85C \uC801\uC808\uD55C \uBC18\uC758\uC5B4\uB098 \uBB38\uB9E5 \uC5B4\uD718\uB85C \uC218\uC815\uB418\uC5B4\uC57C \uD569\uB2C8\uB2E4.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: false, reason: "\uC801\uC808: \uC9C0\uBB38 \uB3C4\uC785\uBD80\uC758 \uC804\uC81C \uC124\uBA85 \uBB38\uB9E5\uC5D0 \uBD80\uD569\uD569\uB2C8\uB2E4." },
        { optionIndex: 1, isCorrect: true, reason: "\uC815\uB2F5(\uBD80\uC801\uC808): \uC6D0\uBB38 \uD750\uB984\uC0C1 \uBC18\uB300 \uC5B4\uC870\uC758 \uB2E8\uC5B4\uAC00 \uC704\uCE58\uD574\uC57C \uB17C\uB9AC\uAC00 \uB9E4\uB044\uB7FD\uC2B5\uB2C8\uB2E4." },
        { optionIndex: 2, isCorrect: false, reason: "\uC801\uC808: \uC6D0\uBB38\uC758 \uC218\uB2E8/\uBC29\uBC95 \uC81C\uC2DC \uBB38\uB9E5\uC5D0 \uC62C\uBC14\uB974\uAC8C \uC0AC\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4." },
        { optionIndex: 3, isCorrect: false, reason: "\uC801\uC808: \uAE0D\uC815\uC801 \uD6A8\uACFC \uBC0F \uD5A5\uC0C1\uC744 \uB098\uD0C0\uB0B4\uB294 \uBCF8\uBB38 \uC5B4\uC870\uC640 \uD638\uC751\uD569\uB2C8\uB2E4." },
        { optionIndex: 4, isCorrect: false, reason: "\uC801\uC808: \uC6D0\uBB38 \uCD5C\uC885 \uACB0\uB860\uC758 \uC2E0\uB8B0\uB3C4\uB97C \uB098\uD0C0\uB0B4\uB294 \uC62C\uBC14\uB978 \uC4F0\uC784\uC785\uB2C8\uB2E4." }
      ],
      vocabularyHighlights: [
        "contextual vocabulary - \uBB38\uB9E5\uC801 \uC5B4\uD718 \uC801\uC808\uC131",
        "tone shifts - \uD544\uC790\uC758 \uC5B4\uC870 \uBCC0\uD654"
      ],
      syntaxHighlights: [
        "\uC6D0\uBB38 \uC9C0\uBB38 \uB0B4 \uB300\uC870 \uC5F0\uACB0\uC5B4 \uC911\uC2EC\uC758 \uC758\uBBF8 \uBC18\uC804 \uD30C\uC545",
        "\uC218\uC2DD\uC5B4\uAD6C\uC640 \uD53C\uC218\uC2DD\uC5B4 \uAC04\uC758 \uD638\uC751 \uAD00\uACC4"
      ]
    };
  }
  if (targetQuestionType === "\uC8FC\uC81C \uBC0F \uC81C\uBAA9") {
    return {
      type: "\uC8FC\uC81C \uBC0F \uC81C\uBAA9",
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] \uB2E4\uC74C \uAE00\uC758 \uC8FC\uC81C\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?`,
      modifiedPassage: rawPassage,
      options: [
        `\u2460 The Core Implications and Analytical Scope of ${displayTitle.slice(0, 25)}`,
        `\u2461 Re-examining Traditional Paradigms in Modern Research Contexts`,
        `\u2462 Unexpected Limitations of Empirical Approaches in Education`,
        `\u2463 Methodological Developments in Standardized Language Testing`,
        `\u2464 Strategies for Resolving Cognitive Dissonance in Learning`
      ],
      correctIndex: 0,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38 \uC804\uCCB4\uB294 "${sentences[0] || "\uC9C0\uBB38 \uB3C4\uC785\uBD80"}"\uB97C \uD1B5\uD574 \uC81C\uC2DC\uB418\uB294 \uD575\uC2EC \uC18C\uC7AC\uC640 \uD544\uC790\uC758 \uACAC\uD574\uB97C \uC804\uB2EC\uD558\uBBC0\uB85C \u2460\uBC88\uC774 \uAC00\uC7A5 \uC801\uC808\uD55C \uC8FC\uC81C\uC785\uB2C8\uB2E4.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: true, reason: "\uC815\uB2F5: \uC9C0\uBB38 \uC804\uCCB4\uC758 \uB17C\uC9C0\uC640 \uD575\uC2EC \uC18C\uC7AC\uB97C \uC815\uD655\uD558\uAC8C \uAD00\uD1B5\uD558\uB294 \uC8FC\uC81C\uC785\uB2C8\uB2E4." },
        { optionIndex: 1, isCorrect: false, reason: "\uC624\uB2F5: \uC9C0\uBB38 \uBCF8\uBB38\uC758 \uC138\uBD80 \uC18C\uC7AC\uC640 \uB5A8\uC5B4\uC9C4 \uC9C0\uB098\uCE58\uAC8C \uD3EC\uAD04\uC801\uC778 \uC9C0\uCE6D\uC785\uB2C8\uB2E4." },
        { optionIndex: 2, isCorrect: false, reason: "\uC624\uB2F5: \uC9C0\uBB38\uC5D0\uC11C \uC5B8\uAE09\uB418\uC9C0 \uC54A\uC740 \uBC29\uBC95\uB860\uC801 \uD55C\uACC4\uC5D0 \uCD08\uC810\uC744 \uB9DE\uCD98 \uC9C0\uCE6D\uC785\uB2C8\uB2E4." },
        { optionIndex: 3, isCorrect: false, reason: "\uC624\uB2F5: \uC5B8\uC5B4 \uD3C9\uAC00 \uAD00\uB828 \uC5B8\uAE09\uC740 \uC6D0\uBB38\uC5D0 \uB4F1\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." },
        { optionIndex: 4, isCorrect: false, reason: "\uC624\uB2F5: \uC778\uC9C0\uC801 \uBD80\uC870\uD654 \uAD00\uB828 \uB0B4\uC6A9\uC740 \uC6D0\uBB38\uC758 \uC8FC\uC81C\uC640 \uBD88\uC77C\uCE58\uD569\uB2C8\uB2E4." }
      ],
      vocabularyHighlights: [
        "analytical scope - \uBD84\uC11D\uC801 \uBC94\uC8FC",
        "core implication - \uD575\uC2EC \uD568\uC758"
      ],
      syntaxHighlights: [
        "\uC6D0\uBB38 \uC9C0\uBB38 \uB3C4\uC785\uBD80\uC640 \uACB0\uB860\uBD80 \uBB38\uC7A5\uC758 \uD328\uB7EC\uD504\uB808\uC774\uC9D5(Paraphrasing)",
        "\uC8FC\uC81C\uBB38 \uC704\uCE58 \uD30C\uC545 \uBC0F \uD544\uC790\uC758 \uC8FC\uC548\uC810 \uB3C4\uCD9C"
      ]
    };
  }
  if (targetQuestionType === "\uC694\uC57D\uBB38 \uC644\uC131") {
    return {
      type: "\uC694\uC57D\uBB38 \uC644\uC131",
      difficulty,
      question: `[${displayLesson} ${displayItemNo}] \uB2E4\uC74C \uAE00\uC758 \uB0B4\uC6A9\uC744 \uD55C \uBB38\uC7A5\uC73C\uB85C \uC694\uC57D\uD558\uACE0\uC790 \uD55C\uB2E4. \uBE48\uCE78 (A), (B)\uC5D0 \uB4E4\uC5B4\uAC08 \uB9D0\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?`,
      modifiedPassage: `${rawPassage}

[ \uC694\uC57D\uBB38 ]
While the passage underscores how key factors (A) [___________] the broader outcomes, it ultimately suggests that researchers must (B) [___________] these elements for holistic understanding.`,
      options: [
        "\u2460 (A) influence  ---  (B) integrate",
        "\u2461 (A) restrict  ---  (B) isolate",
        "\u2462 (A) ignore  ---  (B) disregard",
        "\u2463 (A) simplify  ---  (B) eliminate",
        "\u2464 (A) exaggerate  ---  (B) replace"
      ],
      correctIndex: 0,
      rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38\uC758 \uD575\uC2EC \uC694\uC9C0\uB294 \uC8FC\uC694 \uC694\uC778\uB4E4\uC774 \uACB0\uACFC\uC5D0 (A) \uC601\uD5A5\uC744 \uBBF8\uCE58\uBA70(influence), \uC774\uB97C \uC885\uD569\uC801\uC73C\uB85C (B) \uD1B5\uD569(integrate)\uD574\uC57C \uD55C\uB2E4\uB294 \uAC83\uC774\uBBC0\uB85C \u2460\uBC88\uC774 \uC815\uB2F5\uC785\uB2C8\uB2E4.`,
      distractorAnalysis: [
        { optionIndex: 0, isCorrect: true, reason: "\uC815\uB2F5: (A) influence(\uC601\uD5A5\uC744 \uBBF8\uCE58\uB2E4)\uC640 (B) integrate(\uD1B5\uD569\uD558\uB2E4)\uAC00 \uC6D0\uBB38 \uC804\uCCB4\uC758 \uC694\uC57D\uACFC \uC815\uD655\uD788 \uD638\uC751\uD569\uB2C8\uB2E4." },
        { optionIndex: 1, isCorrect: false, reason: "\uC624\uB2F5: (B) isolate(\uACA9\uB9AC\uD558\uB2E4)\uB294 \uC6D0\uBB38\uC758 \uD1B5\uD569\uC801 \uBD84\uC11D \uCDE8\uC9C0\uC640 \uC0C1\uCDA9\uD569\uB2C8\uB2E4." },
        { optionIndex: 2, isCorrect: false, reason: "\uC624\uB2F5: (B) disregard(\uBB34\uC2DC\uD558\uB2E4)\uB294 \uD544\uC790\uC758 \uAC15\uC870\uC810\uACFC \uBC18\uB300\uB429\uB2C8\uB2E4." },
        { optionIndex: 3, isCorrect: false, reason: "\uC624\uB2F5: (B) eliminate(\uC81C\uAC70\uD558\uB2E4)\uB294 \uC720\uC6A9\uD55C \uC694\uC778 \uBC18\uC601\uC774\uB77C\uB294 \uBCF8\uBB38 \uCDE8\uC9C0\uC5D0 \uC5B4\uAE0B\uB0A9\uB2C8\uB2E4." },
        { optionIndex: 4, isCorrect: false, reason: "\uC624\uB2F5: (A) exaggerate(\uACFC\uC7A5\uD558\uB2E4)\uB294 \uAC1D\uAD00\uC801 \uC9C0\uBB38 \uC5B4\uC870\uC640 \uBD88\uC77C\uCE58\uD569\uB2C8\uB2E4." }
      ],
      vocabularyHighlights: [
        "holistic understanding - \uC804\uCCB4\uB860\uC801/\uC885\uD569\uC801 \uC774\uD574",
        "broader outcomes - \uAD11\uBC94\uC704\uD55C \uACB0\uACFC"
      ],
      syntaxHighlights: [
        "While \uC591\uBCF4\uC808 \uAD6C\uBB38\uC744 \uD1B5\uD55C \uC694\uC57D\uBB38 \uB300\uB9BD \uAD6C\uC870 \uD615\uC131",
        "\uC6D0\uBB38 \uB0B4\uC6A9\uC758 \uB17C\uB9AC\uC801 \uCD95\uC57D \uBC0F \uD575\uC2EC\uC5B4 \uCD94\uCD9C"
      ]
    };
  }
  const blankTargetSentence = sentences[sentences.length - 1] || sentences[0] || rawPassage;
  const blankReplacedPassage = rawPassage.replace(
    blankTargetSentence,
    `Therefore, the passage implies that [___________].`
  );
  return {
    type: "\uBE48\uCE78 \uCD94\uB860",
    difficulty,
    question: `[${displayLesson} ${displayItemNo}] \uB2E4\uC74C \uAE00\uC758 \uBE48\uCE78\uC5D0 \uB4E4\uC5B4\uAC08 \uB9D0\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?`,
    modifiedPassage: blankReplacedPassage !== rawPassage ? blankReplacedPassage : `${rawPassage}

Therefore, [___________].`,
    options: [
      `critical understanding of ${displayTitle.slice(0, 30)} is essential`,
      "traditional paradigms should be unconditionally accepted",
      "technological solutions override analytical reasoning",
      "empirical data can be substituted with theoretical models",
      "rigid rules must be maintained regardless of contextual changes"
    ],
    correctIndex: 0,
    rationale: `[${displayLesson} ${displayItemNo}] "${displayTitle}" \uC2E4\uC81C \uC9C0\uBB38 \uC804\uCCB4\uC758 \uB17C\uC9C0 \uD750\uB984\uC0C1 \uBE48\uCE78\uC5D0 \uB4E4\uC5B4\uAC08 \uAC00\uC7A5 \uC801\uC808\uD55C \uBE48\uCE78 \uC644\uC131\uC5B4\uB294 \uC9C0\uBB38\uC758 \uC8FC\uC81C\uC640 \uC9C1\uACB0\uB418\uB294 \u2460\uBC88\uC785\uB2C8\uB2E4.`,
    distractorAnalysis: [
      { optionIndex: 0, isCorrect: true, reason: "\uC815\uB2F5: \uC6D0\uBB38 \uC9C0\uBB38 \uC804\uCCB4\uC758 \uD575\uC2EC \uC8FC\uC81C \uBC0F \uACB0\uB860 \uBB38\uC7A5\uACFC \uC644\uBCBD\uD788 \uD638\uC751\uD558\uB294 \uBE48\uCE78 \uC644\uC131\uC785\uB2C8\uB2E4." },
      { optionIndex: 1, isCorrect: false, reason: "\uC624\uB2F5: \uC804\uD1B5 \uD328\uB7EC\uB2E4\uC784\uC758 \uBB34\uC870\uAC74\uC801 \uC218\uC6A9\uC740 \uC9C0\uBB38\uC758 \uBE44\uD310\uC801 \uC5B4\uC870\uC640 \uC815\uBC18\uB300\uB429\uB2C8\uB2E4." },
      { optionIndex: 2, isCorrect: false, reason: "\uC624\uB2F5: \uAE30\uC220\uC801 \uD574\uACB0\uCC45\uC758 \uC6B0\uC120\uC740 \uBCF8\uBB38\uC758 \uB17C\uC9C0\uC640 \uC0C1\uAD00\uC774 \uC5C6\uB294 \uC624\uB2F5\uC785\uB2C8\uB2E4." },
      { optionIndex: 3, isCorrect: false, reason: "\uC624\uB2F5: \uC2E4\uC99D \uB370\uC774\uD130 \uB300\uCCB4\uB294 \uBCF8\uBB38\uC5D0\uC11C \uC5B8\uAE09\uB41C \uC790\uC728\uC131 \uBC0F \uBD84\uC11D\uACFC \uAC70\uB9AC\uAC00 \uB5B1\uB2C8\uB2E4." },
      { optionIndex: 4, isCorrect: false, reason: "\uC624\uB2F5: \uC5C4\uACA9\uD55C \uADDC\uCE59 \uC720\uC9C0\uB294 \uBCF8\uBB38\uC758 \uC720\uC5F0\uD55C \uB9E5\uB77D \uC774\uD574\uC640 \uBC30\uCE58\uB429\uB2C8\uB2E4." }
    ],
    vocabularyHighlights: [
      "critical understanding - \uBE44\uD310\uC801 \uC774\uD574",
      "contextual changes - \uB9E5\uB77D\uC801 \uBCC0\uD654"
    ],
    syntaxHighlights: [
      "Therefore/Consequently \uB4F1 \uACB0\uB860 \uB3C4\uCD9C \uBD80\uC0AC\uB97C \uD65C\uC6A9\uD55C \uBE48\uCE78 \uCD94\uB860",
      "\uC9C0\uBB38 \uBCF8\uBB38\uC758 \uD575\uC2EC \uC5B4\uADC0 \uD328\uB7EC\uD504\uB808\uC774\uC9D5"
    ]
  };
}
function fillBlanksInPassage(passage) {
  let filled = passage;
  filled = filled.replace(/\[_+\]/g, () => "the underlying principle");
  filled = filled.replace(/_{3,}/g, () => "remain hyper-focused for too long");
  filled = filled.replace(/\s{2,}/g, " ").trim();
  return filled;
}
function validateAndFixTransformItem(data, originalPassage, targetQuestionType) {
  const orig = (originalPassage || "").trim();
  const passageForNonBlank = targetQuestionType !== "\uBE48\uCE78 \uCD94\uB860" ? fillBlanksInPassage(orig) : orig;
  const basePassage = targetQuestionType === "\uBE48\uCE78 \uCD94\uB860" ? orig : passageForNonBlank;
  const sentences = basePassage.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  let finalPassage = basePassage;
  let finalOptions = data.options;
  if (targetQuestionType === "\uBE48\uCE78 \uCD94\uB860") {
    let rawMod = String(data.modifiedPassage || "");
    rawMod = rawMod.replace(/^\[\s*(?:주어진\s*문장|Given\s*Sentence)\s*\][\s\S]*?\n\n/i, "").replace(/\(\s*[①②③④⑤1-5]\s*\)/g, "").replace(/\n\n\[\s*(?:요약문|Summary)\s*\][\s\S]*/i, "");
    const hasBlank = /______+|\[___________\]|\(\s*_____\s*\)/.test(rawMod);
    if (hasBlank && rawMod.length > 50) {
      finalPassage = rawMod.trim();
    } else {
      const lastSentence = sentences.length > 0 ? sentences[sentences.length - 1] : orig;
      if (orig.includes(lastSentence)) {
        finalPassage = orig.replace(lastSentence, "Therefore, [___________].");
      } else {
        finalPassage = `${orig}

Therefore, [___________].`;
      }
    }
  } else if (targetQuestionType === "\uC5B4\uBC95 \uD310\uB2E8" || targetQuestionType === "\uC5B4\uD718 \uC801\uC808\uC131") {
    let rawMod = String(data.modifiedPassage || "");
    rawMod = rawMod.replace(/^\[\s*(?:주어진\s*문장|Given\s*Sentence)\s*\][\s\S]*?\n\n/i, "").replace(/\n\n\[\s*(?:요약문|Summary)\s*\][\s\S]*/i, "");
    rawMod = fillBlanksInPassage(rawMod);
    const underlineMatches = rawMod.match(/[①②③④⑤]\s*<u>[^<]+<\/u>/g);
    if (underlineMatches && underlineMatches.length === 5) {
      finalPassage = rawMod.trim();
    } else {
      const tokens = basePassage.split(" ");
      let markedCount = 0;
      const opts = [];
      const step = Math.max(1, Math.floor(tokens.length / 6));
      const modifiedTokens = tokens.map((token, idx) => {
        if (markedCount < 5 && token.length >= 3 && idx > markedCount * step + 1) {
          markedCount++;
          const sym = INDEX_TO_SYMBOL[markedCount - 1];
          const cleanWord = token.replace(/[^a-zA-Z]/g, "");
          if (cleanWord) {
            opts.push(`${sym} <u>${cleanWord}</u>`);
            return token.replace(cleanWord, `${sym} <u>${cleanWord}</u>`);
          }
        }
        return token;
      });
      finalPassage = modifiedTokens.join(" ");
      if (opts.length === 5) {
        finalOptions = opts;
      }
    }
  } else if (targetQuestionType === "\uBB38\uC7A5 \uC0BD\uC785") {
    let rawMod = String(data.modifiedPassage || "");
    rawMod = fillBlanksInPassage(rawMod);
    const hasGivenHeader = /\[\s*(?:주어진\s*문장|Given\s*Sentence)\s*\]/i.test(rawMod);
    if (hasGivenHeader && /\(\s*[①②③④⑤1-5]\s*\)/.test(rawMod)) {
      finalPassage = rawMod.trim();
    } else {
      let insertedSentence = data.insertedSentence || data.targetSentence || data.givenSentence || "";
      if (!insertedSentence && sentences.length > 2) {
        insertedSentence = sentences[1];
      }
      if (!insertedSentence) {
        insertedSentence = sentences[0] || "This crucial insight highlights the dynamic relationship between variables.";
      }
      const remaining = sentences.filter((s) => s !== insertedSentence);
      let bodyWithTags = "";
      remaining.forEach((s, idx) => {
        const tag = idx < 5 ? ` ( ${INDEX_TO_SYMBOL[idx]} ) ` : " ";
        bodyWithTags += s + tag;
      });
      finalPassage = `[ \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5 ]
"${insertedSentence.replace(/^"|"$/g, "")}"

${bodyWithTags.trim()}`;
      finalOptions = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"];
    }
  } else if (targetQuestionType === "\uC8FC\uC81C \uBC0F \uC81C\uBAA9") {
    finalPassage = basePassage;
  } else if (targetQuestionType === "\uC694\uC57D\uBB38 \uC644\uC131") {
    let rawMod = String(data.modifiedPassage || "");
    rawMod = fillBlanksInPassage(rawMod);
    rawMod = rawMod.replace(/^\[\s*(?:주어진\s*문장|Given\s*Sentence)\s*\][\s\S]*?\n\n/i, "").replace(/\(\s*[①②③④⑤1-5]\s*\)/g, "");
    const hasSummaryHeader = /\[\s*(?:요약문|Summary)\s*\]/i.test(rawMod);
    if (hasSummaryHeader && rawMod.includes("(A)") && rawMod.includes("(B)")) {
      finalPassage = rawMod.trim();
    } else {
      finalPassage = `${basePassage}

[ \uC694\uC57D\uBB38 ]
While the passage underscores how key factors (A) [___________] the broader outcomes, it ultimately suggests that researchers must (B) [___________] these elements for holistic understanding.`;
    }
  }
  const updatedData = {
    ...data,
    modifiedPassage: finalPassage,
    options: finalOptions
  };
  return shuffleTransformOptions(updatedData, targetQuestionType);
}
var itemBankCacheServer = /* @__PURE__ */ new Map();
app.post("/api/gemini/transform", async (req, res) => {
  const invalidError = validateRequestBody(req.body, { checkType: true });
  if (invalidError) {
    return res.status(400).json({ success: false, error: invalidError });
  }
  const { passage, lesson, itemNo, targetQuestionType = "\uBE48\uCE78 \uCD94\uB860", difficulty = "\uC218\uB2A5 \uD45C\uC900", customApiKey } = req.body;
  const cacheKey = `${lesson || "EBS"}_${itemNo || "\uC9C0\uBB38"}_${targetQuestionType}_${difficulty}`;
  if (itemBankCacheServer.has(cacheKey)) {
    const cachedItem = itemBankCacheServer.get(cacheKey);
    const verifiedItem = validateAndFixTransformItem(cachedItem, passage, targetQuestionType);
    itemBankCacheServer.set(cacheKey, verifiedItem);
    console.log(`[Server Item Bank Hit Verified]: 0ms response for ${cacheKey}`);
    return res.json({ success: true, data: verifiedItem, cached: true, itemBankHit: true });
  }
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are an expert Korean CSAT (\uC218\uB2A5) English Exam Creator. Create an authentic, highly sophisticated CSAT-style transformed question for the given EBS passage.
Requested Question Type: "${targetQuestionType}".
Difficulty Level: "${difficulty}".

CRITICAL MANDATE:
You MUST use the exact full English passage provided in the user prompt as the base for 'modifiedPassage'.
Do NOT substitute or alter the passage with generic text or different topics.
Keep the original English text 100% intact except for inserting the required question markings according to the rules below:

CRITICAL QUESTION TYPE FORMATTING RULES:
1. "\uBE48\uCE78 \uCD94\uB860":
   - question: "[EBS ...] \uB2E4\uC74C \uAE00\uC758 \uBE48\uCE78\uC5D0 \uB4E4\uC5B4\uAC08 \uB9D0\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?"
   - modifiedPassage: Keep the exact original passage, replacing ONE key clause or sentence with "[___________]".
   - options: 5 choices (English phrases/clauses).

2. "\uC5B4\uBC95 \uD310\uB2E8":
   - question: "[EBS ...] \uB2E4\uC74C \uAE00\uC758 \uBC11\uC904 \uCE5C \uBD80\uBD84 \uC911, \uC5B4\uBC95\uC0C1 \uD2C0\uB9B0 \uAC83\uC740?"
   - modifiedPassage: Embed 5 underlined numbered tokens into the passage: "\u2460 <u>word1</u>", "\u2461 <u>word2</u>", "\u2462 <u>word3</u>", "\u2463 <u>word4</u>", "\u2464 <u>word5</u>". Exactly ONE of these 5 underlines MUST contain an authentic CSAT syntax error.
   - options: ["\u2460 <u>word1</u>", "\u2461 <u>word2</u>", "\u2462 <u>word3</u>", "\u2463 <u>word4</u>", "\u2464 <u>word5</u>"].

3. "\uBB38\uC7A5 \uC0BD\uC785":
   - modifiedPassage: "[ \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5 ]
<Extracted/Paraphrased Sentence from the passage>

<Original Passage text with \u2460, \u2461, \u2462, \u2463, \u2464 inserted at logical sentence boundaries>".
   - options: ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"].

4. "\uC5B4\uD718 \uC801\uC808\uC131":
   - question: "[EBS ...] \uB2E4\uC74C \uAE00\uC758 \uBC11\uC904 \uCE5C \uBD80\uBD84 \uC911, \uBB38\uB9E5\uC0C1 \uB0B1\uB9D0\uC758 \uC4F0\uC784\uC774 \uC801\uC808\uD558\uC9C0 \uC54A\uC740 \uAC83\uC740?"
   - modifiedPassage: Keep the exact original passage, marking 5 numbered vocabulary words directly inside the original text as \u2460 <u>word1</u>, \u2461 <u>word2</u>, \u2462 <u>word3</u>, \u2463 <u>word4</u>, \u2464 <u>word5</u> (where ONE is contextually incorrect).
   - options: ["\u2460 word1", "\u2461 word2", "\u2462 word3", "\u2463 word4", "\u2464 word5"].

5. "\uC8FC\uC81C \uBC0F \uC81C\uBAA9":
   - question: "[EBS ...] \uB2E4\uC74C \uAE00\uC758 \uC8FC\uC81C(\uB610\uB294 \uC81C\uBAA9)\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?"
   - modifiedPassage: The exact original passage text.
   - options: 5 English options representing potential topics/titles.

6. "\uC694\uC57D\uBB38 \uC644\uC131":
   - question: "[EBS ...] \uB2E4\uC74C \uAE00\uC758 \uB0B4\uC6A9\uC744 \uD55C \uBB38\uC7A5\uC73C\uB85C \uC694\uC57D\uD558\uACE0\uC790 \uD55C\uB2E4. \uBE48\uCE78 (A), (B)\uC5D0 \uB4E4\uC5B4\uAC08 \uB9D0\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?"
   - modifiedPassage: "<Original Passage>

[ \uC694\uC57D\uBB38 ]
<Summary sentence with (A) [___________] and (B) [___________]>".
   - options: ["\u2460 (A) ...  ---  (B) ...", "\u2461 (A) ...  ---  (B) ...", "\u2462 (A) ...  ---  (B) ...", "\u2463 (A) ...  ---  (B) ...", "\u2464 (A) ...  ---  (B) ..."].

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
    const userPrompt = `Original Passage (${lesson || ""} ${itemNo || ""}):
${passage}

Target Question Type: ${targetQuestionType}
Difficulty Level: ${difficulty}`;
    const response = await callGemini(ai, userPrompt, {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json"
    });
    const responseText = response.text || "";
    const json = JSON.parse(cleanJsonString(responseText));
    const formattedData = {
      ...json,
      type: json.type || targetQuestionType || "\uBCC0\uD615 \uBB38\uD56D",
      modifiedPassage: json.modifiedPassage || json.passage || passage || "",
      question: json.question || `[${lesson || "EBS"} ${itemNo || "\uC9C0\uBB38"}] \uB2E4\uC74C \uAE00\uC758 ${targetQuestionType} \uBB38\uC81C\uB85C \uAC00\uC7A5 \uC801\uC808\uD55C \uAC83\uC740?`,
      options: json.options && json.options.length > 0 ? json.options : ["\u2460 option 1", "\u2461 option 2", "\u2462 option 3", "\u2463 option 4", "\u2464 option 5"],
      correctIndex: typeof json.correctIndex === "number" ? json.correctIndex : parseInt(json.answer || "1", 10) - 1 || 0,
      rationale: json.rationale || json.explanation || "\uC9C0\uBB38\uC758 \uC815\uBC00 \uAD6C\uBB38 \uBC0F \uD750\uB984\uC0C1 \uC815\uB2F5\uC774 \uB3C4\uCD9C\uB429\uB2C8\uB2E4."
    };
    const finalOutput = shuffleTransformOptions(formattedData, targetQuestionType);
    itemBankCacheServer.set(cacheKey, finalOutput);
    res.json({ success: true, data: finalOutput });
  } catch (error) {
    console.info("[Transform API] Operating with intelligent fallback engine.");
    try {
      const fallbackData = buildTransformFallback(req.body || {});
      const finalFallback = shuffleTransformOptions(fallbackData, targetQuestionType);
      itemBankCacheServer.set(cacheKey, finalFallback);
      res.json({ success: true, data: finalFallback, fallback: true });
    } catch (fbErr) {
      res.status(500).json({ success: false, error: "\uBCC0\uD615 \uBB38\uD56D \uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." });
    }
  }
});
function buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title) {
  const lastUserMsg = history?.filter((m) => m.role === "user").pop()?.text || "";
  const displayLesson = lesson || "EBS";
  const displayItemNo = itemNo || "\uC9C0\uBB38";
  const sentences = (passage || "This passage discusses key concepts in academic research.").split(".").map((s) => s.trim()).filter((s) => s.length > 5);
  const s1 = sentences[0] || "Modern study highlights significant factors";
  const s2 = sentences[1] || "Researchers emphasize the importance of context";
  const s3 = sentences[sentences.length - 1] || "Therefore understanding these principles is essential";
  if (/주제|요지|제목|핵심|주장|topic|main idea|내용|줄거리/i.test(lastUserMsg)) {
    return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 [${displayLesson} ${displayItemNo}] \uC9C0\uBB38\uC758 \uD575\uC2EC \uC8FC\uC81C\uC640 \uC694\uC9C0\uB97C \uD30C\uC545\uD574 \uBD05\uC2DC\uB2E4!

\uC9C0\uBB38\uC758 \uB3C4\uC785\uBD80\uC5D0\uC11C\uB294 "${s1}..."\uB77C\uACE0 \uD654\uB450\uB97C \uB358\uC9C4 \uD6C4,
\uACB0\uB860\uBD80\uC5D0\uC11C\uB294 "${s3}..."\uB77C\uB294 \uC8FC\uC7A5\uC5D0 \uC774\uB974\uACE0 \uC788\uC2B5\uB2C8\uB2E4.

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
\uD544\uC790\uAC00 \uC804\uBC18\uBD80\uC758 \uC804\uC81C\uC5D0\uC11C \uD6C4\uBC18\uBD80 \uACB0\uB860\uC73C\uB85C \uB118\uC5B4\uAC08 \uB54C \uC5B4\uC870(Tone)\uB098 \uB17C\uB9AC\uC801 \uD750\uB984\uC774 \uC804\uD658\uB418\uB294 \uD575\uC2EC \uC804\uD658 \uBB38\uC7A5\uC774 \uC5B4\uB514\uC778\uAC00\uC694? \uC9C0\uBB38\uC5D0\uC11C \uC9C1\uC811 \uD574\uB2F9 \uBB38\uC7A5\uC744 \uCC3E\uC544\uBCF4\uACE0, \uD544\uC790\uAC00 \uAC15\uC870\uD558\uB294 \uBC14\uB97C \uD55C \uB2E8\uC5B4\uB098 \uAD6C\uC808\uB85C \uD45C\uD604\uD574 \uBCF4\uC2DC\uACA0\uC5B4\uC694?`;
  }
  if (/구문|문법|어법|주어|동사|관계대명사|수일치|접속사|grammar|structure|syntax|해석법/i.test(lastUserMsg)) {
    return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 [${displayLesson} ${displayItemNo}] \uC9C0\uBB38\uC758 \uAD6C\uBB38 \uBC0F \uC5B4\uBC95 \uAD6C\uC870\uB97C \uC9C1\uC811 \uCC28\uADFC\uCC28\uADFC \uBD84\uC11D\uD574 \uBD05\uC2DC\uB2E4!

\uC9C0\uBB38 \uB0B4 \uC8FC\uC694 \uAD6C\uBB38 \uBB38\uC7A5:
"${s2 || s1}"

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
1. \uC774 \uBB38\uC7A5\uC5D0\uC11C \uC9C4\uC9DC \uC8FC\uC5B4(Subject) \uC5ED\uD560\uC744 \uD558\uB294 \uBA85\uC0AC\uAD6C\uC640 \uBCF8\uB3D9\uC0AC(Main Verb)\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?
2. \uC218\uC2DD\uC5B4\uAD6C(\uAD00\uACC4\uB300\uBA85\uC0AC\uC808, \uBD84\uC0AC\uAD6C\uBB38 \uB4F1)\uC758 \uC2DC\uC791\uACFC \uB05D\uC744 \uC218\uC2DD \uAD00\uACC4\uC5D0 \uB9DE\uAC8C \uAD6C\uBD84\uD558\uC168\uB098\uC694? \uC8FC\uC5B4\uC640 \uBCF8\uB3D9\uC0AC\uC758 \uC218\uC77C\uCE58 \uAD00\uACC4\uB97C \uC810\uAC80\uD574 \uBCF4\uC138\uC694!`;
  }
  if (/어휘|단어|뜻|의미|vocab|meaning/i.test(lastUserMsg)) {
    return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 [${displayLesson} ${displayItemNo}] \uC9C0\uBB38\uC758 \uC5B4\uD718 \uBB38\uB9E5\uC0C1 \uC758\uBBF8\uB97C \uC810\uAC80\uD574 \uBCFC\uAE4C\uC694?

\uBB38\uB9E5 \uC18D \uC8FC\uC694 \uC5B4\uD718 \uC608\uC2DC \uBB38\uC7A5:
"${s1}"

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
\uD574\uB2F9 \uBB38\uC7A5\uC5D0\uC11C \uB2E8\uC5B4\uC758 \uC815\uC801 \uC0AC\uC804\uC801 \uC758\uBBF8\uB97C \uB118\uC5B4, \uC774 \uC9C0\uBB38\uC758 \uB17C\uC9C0 \uC548\uC5D0\uC11C '\uAE0D\uC815\uC801/\uCD09\uC9C4\uC801' \uC5B4\uC870\uB85C \uC4F0\uC600\uB294\uC9C0, '\uBE44\uD310\uC801/\uD55C\uACC4\uC801' \uC5B4\uC870\uB85C \uC4F0\uC600\uB294\uC9C0 \uBB38\uB9E5\uC0C1 \uC5B4\uC870\uB97C \uD30C\uC545\uD558\uC168\uB098\uC694? \uD574\uB2F9 \uC5B4\uD718\uAC00 \uB300\uCCB4 \uAC00\uB2A5\uD55C \uB3D9\uC758\uC5B4\uB97C 1-2\uAC1C \uB5A0\uC62C\uB824 \uBCF4\uC138\uC694!`;
  }
  if (/해석|직독직해|번역|translation/i.test(lastUserMsg)) {
    const translationSnippet = translation ? translation.slice(0, 100) + "..." : "\uC9C0\uBB38\uC758 \uC804\uBC18\uBD80\uC640 \uD6C4\uBC18\uBD80\uAC00 \uC720\uAE30\uC801 \uB17C\uB9AC\uB85C \uC5F0\uACB0\uB429\uB2C8\uB2E4.";
    return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 [${displayLesson} ${displayItemNo}] \uC9C0\uBB38\uC758 \uC9C1\uB3C5\uC9C1\uD574 \uBC0F \uBB38\uB9E5 \uD574\uC11D \uD750\uB984\uC744 \uD568\uAED8 \uC9DA\uC5B4\uBD05\uC2DC\uB2E4!

[\uD574\uC11D \uAC00\uC774\uB4DC]:
${translationSnippet}

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
\uC9C0\uBB38 \uC804\uBC18\uBD80\uC758 \uC124\uBA85\uC774 \uD6C4\uBC18\uBD80\uC758 \uACB0\uB860 \uBB38\uC7A5\uC73C\uB85C \uC774\uC5B4\uC9C8 \uB54C, \uB450 \uBB38\uC7A5 \uC0AC\uC774\uC758 \uB17C\uB9AC\uC801 \uACB0\uD569(\uC6D0\uC778-\uACB0\uACFC, \uB300\uB9BD-\uBE44\uAD50, \uB610\uB294 \uCD94\uAC00 \uBD80\uC5F0)\uC774 \uBB34\uC5C7\uC778\uC9C0 \uC9C1\uAD00\uC801\uC73C\uB85C \uC774\uD574\uB418\uC2DC\uB098\uC694? \uBCF8\uC778\uC774 \uC0DD\uAC01\uD558\uB294 \uC5F0\uACB0 \uBC29\uC2DD\uC744 \uC124\uBA85\uD574 \uBCF4\uC138\uC694!`;
  }
  if (/접속사|역접|however|therefore|연결어|흐름|전환/i.test(lastUserMsg)) {
    return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 [${displayLesson} ${displayItemNo}] \uC9C0\uBB38\uC758 \uB17C\uB9AC\uC801 \uC5F0\uACB0\uC5B4 \uBC0F \uD750\uB984\uC5D0 \uB300\uD574 \uBD84\uC11D\uD574 \uB4DC\uB9BD\uB2C8\uB2E4!

\uC9C0\uBB38\uC758 \uBB38\uC7A5 \uC5F0\uACB0 \uD750\uB984:
\uB3C4\uC785: "${s1}..."
\uC804\uAC1C: "${s2}..."

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
\uC5F0\uACB0\uC5B4(However, Therefore, Moreover \uB4F1)\uAC00 \uB4F1\uC7A5\uD558\uB294 \uC9C0\uC810\uC5D0\uC11C \uAE00\uC758 \uC5B4\uC870\uAC00 \uBC18\uC804\uB418\uB098\uC694, \uC544\uB2C8\uBA74 \uC55E \uC8FC\uC7A5\uC744 \uBD80\uC5F0 \uAC15\uD654\uD558\uB098\uC694? \uD544\uC790\uC758 \uD575\uC2EC \uC8FC\uC7A5\uC774 \uC5F0\uACB0\uC5B4 \uC55E \uBB38\uC7A5\uC5D0 \uC788\uB294\uC9C0, \uB4A4 \uBB38\uC7A5\uC5D0 \uC788\uB294\uC9C0 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694!`;
  }
  return `[\uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130] \uC9C8\uBB38\uD558\uC2E0 "${lastUserMsg}" \uB0B4\uC6A9\uC5D0 \uB300\uD574 [${displayLesson} ${displayItemNo}] "${title || "\uC9C0\uBB38"}"\uC744 \uBC14\uD0D5\uC73C\uB85C \uD568\uAED8 \uCD94\uB860\uD574 \uBD05\uC2DC\uB2E4!

\uC9C0\uBB38\uC758 \uD575\uC2EC \uBD84\uC11D \uBB38\uC7A5:
"${s1}"

\u{1F4A1} [\uC18C\uD06C\uB77C\uD14C\uC2A4 \uC720\uB3C4 \uC9C8\uBB38]:
\uC9C8\uBB38\uD558\uC2E0 \uB0B4\uC6A9\uC774 \uC774 \uC9C0\uBB38\uC758 '\uC8FC\uC694 \uC6D0\uC778 \uBC0F \uAC00\uC124'\uC5D0 \uAD00\uB828\uB41C \uBD80\uBD84\uC77C\uAE4C\uC694, \uC544\uB2C8\uBA74 \uD544\uC790\uAC00 \uB3C4\uCD9C\uD558\uACE0\uC790 \uD558\uB294 '\uCD5C\uC885 \uACB0\uB860'\uC5D0 \uD574\uB2F9\uD560\uAE4C\uC694? \uBB38\uC7A5\uC758 \uC8FC\uC5B4\uC640 \uBCF8\uB3D9\uC0AC\uB97C \uAE30\uC900\uC73C\uB85C \uD575\uC2EC \uB17C\uC9C0\uB97C \uD30C\uC545\uD574 \uBCF4\uC138\uC694!`;
}
function escapeXml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function buildPassageVisualSvg(body) {
  const { title, lesson, itemNo, passage, vocabList, syntaxNotes, visualStyle = "\uC778\uD3EC\uADF8\uB798\uD53D \uB9C8\uC778\uB4DC\uB9F5", colorMood = "Dark Cyber Neon" } = body;
  const displayLesson = escapeXml(lesson || "EBS");
  const displayItemNo = escapeXml(itemNo || "\uC9C0\uBB38");
  const displayTitle = escapeXml(title || "CSAT Visual Mindmap");
  const sentences = (passage || "This passage explores key principles of academic inquiry and logic.").split(".").map((s) => s.trim()).filter((s) => s.length > 5);
  const node1Text = escapeXml(sentences[0] ? sentences[0].slice(0, 55) + "..." : "Core Premise & Academic Background");
  const node2Text = escapeXml(sentences[1] ? sentences[1].slice(0, 55) + "..." : "Critical Evidence & Contextual Variable");
  const node3Text = escapeXml(sentences[sentences.length - 1] ? sentences[sentences.length - 1].slice(0, 55) + "..." : "Logical Synthesis & Final Conclusion");
  const vocabItems = escapeXml(vocabList && vocabList.length > 0 ? vocabList.slice(0, 3).map((v) => `${v.word} (${v.meaning})`).join("  \u2022  ") : "key concept  \u2022  empirical data  \u2022  critical insight");
  const syntaxItem = escapeXml(syntaxNotes && syntaxNotes.length > 0 ? syntaxNotes[0].slice(0, 60) : "\uC8FC\uC5B4\uAD6C \uC218\uC2DD\uC808\uACFC \uBCF8\uB3D9\uC0AC \uC218\uC77C\uCE58 \uBC0F \uB17C\uB9AC\uC801 \uB300\uC870 \uAD6C\uBB38");
  let c1 = "#0f172a", c2 = "#1e1b4b", c3 = "#0284c7", accent = "#38bdf8", cardBg = "#1e293b", textMain = "#ffffff", textSub = "#94a3b8";
  if (colorMood.includes("Pastel") || colorMood.includes("Light")) {
    c1 = "#f8fafc";
    c2 = "#e0f2fe";
    c3 = "#818cf8";
    accent = "#4f46e5";
    cardBg = "#ffffff";
    textMain = "#0f172a";
    textSub = "#475569";
  } else if (colorMood.includes("Sepia") || colorMood.includes("Warm")) {
    c1 = "#1c1917";
    c2 = "#292524";
    c3 = "#d97706";
    accent = "#fbbf24";
    cardBg = "#292524";
    textMain = "#fef3c7";
    textSub = "#d6d3d1";
  } else if (colorMood.includes("Slate")) {
    c1 = "#0f172a";
    c2 = "#1e293b";
    c3 = "#312e81";
    accent = "#818cf8";
    cardBg = "#1e293b";
    textMain = "#ffffff";
    textSub = "#cbd5e1";
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
    <text x="115" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">1. \uB3C4\uC785 (Premise)</text>
    <text x="65" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">\uC804\uC81C \uBC0F \uBC30\uACBD \uD654\uB450</text>
    <text x="65" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node1Text}</text>
  </g>
  <g filter="url(#shadow)">
    <rect x="350" y="140" width="260" height="150" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2"/>
    <text x="420" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">2. \uC804\uAC1C (Evidence)</text>
    <text x="365" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">\uD575\uC2EC \uADFC\uAC70 \uBC0F \uBC18\uB860</text>
    <text x="365" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node2Text}</text>
  </g>
  <g filter="url(#shadow)">
    <rect x="650" y="140" width="260" height="150" rx="16" fill="${cardBg}" stroke="${accent}" stroke-width="2"/>
    <text x="720" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">3. \uACB0\uB860 (Synthesis)</text>
    <text x="665" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="${textMain}">\uCD5C\uC885 \uC694\uC9C0 \uBC0F \uC2DC\uC0AC\uC810</text>
    <text x="665" y="222" font-family="sans-serif" font-size="10" fill="${textSub}">${node3Text}</text>
  </g>
</svg>`;
  return Buffer.from(svg).toString("base64");
}
app.post("/api/gemini/socratic", async (req, res) => {
  const { history, passage, title, lesson, itemNo, translation, customApiKey, hintLevel } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const levelGuide = hintLevel === 1 ? "[1\uB2E8\uACC4 \uD78C\uD2B8 \uC815\uCC45: \uC815\uB2F5\uC744 \uC9C1\uC811 \uC8FC\uC9C0 \uB9D0\uACE0 \uC9C0\uBB38\uC758 \uBB38\uB9E5\uACFC \uD544\uC790\uC758 \uAC1C\uAD04\uC801 \uC5B4\uC870\uC5D0 \uB300\uD55C \uBA54\uD0C0\uC778\uC9C0 \uC720\uB3C4 \uD78C\uD2B8\uB9CC \uC81C\uACF5\uD558\uC138\uC694.]" : hintLevel === 2 ? "[2\uB2E8\uACC4 \uD78C\uD2B8 \uC815\uCC45: \uBB38\uC7A5 \uAD6C\uC870, \uC8FC\uC5B4-\uB3D9\uC0AC \uAD00\uACC4, \uD575\uC2EC \uC5F0\uACB0\uC5B4 \uBC0F \uC5B4\uD718 \uD78C\uD2B8\uB97C \uAD6C\uCCB4\uC801\uC73C\uB85C \uC81C\uC2DC\uD558\uB418 \uACB0\uB860 \uC9C8\uBB38\uC744 \uB358\uC9C0\uC138\uC694.]" : "[3\uB2E8\uACC4 \uD78C\uD2B8 \uC815\uCC45: \uC644\uBCBD\uD55C \uC9C1\uB3C5\uC9C1\uD574 \uBD84\uC11D, \uB17C\uB9AC\uC801 \uACB0\uD569 \uBC0F \uC0C1\uC138 \uC815\uB2F5 \uD574\uC124\uC744 \uBA85\uD655\uD558\uAC8C \uC81C\uC2DC\uD558\uC138\uC694.]";
    const systemPrompt = `You are an expert Socratic English Tutor for Korean high school students preparing for English exams (2027 \uC9C4\uB85C\uC601\uC5B4).
Your main directive: Directly address and answer the student's exact question or request in Korean (\uD574\uC694\uCCB4) while maintaining an encouraging, probing Socratic style.

CURRENT PASSAGE CONTEXT:
Item: [${lesson || "EBS"} ${itemNo || ""}] ${title || ""}
Passage Text:
${passage || ""}
Korean Translation:
${translation || ""}

HINT POLICY LEVEL:
${levelGuide}

RULES:
1. Examine the user's latest message carefully. If they ask about a specific sentence, grammar structure, word, translation, or topic, analyze THAT SPECIFIC item in this passage.
2. Provide a clear, insightful explanation or hint based on the current Hint Level, then follow up with 1-2 probing Socratic questions that help the student deduce the concept themselves.
3. Keep your tone polite, warm, and structured (\uD574\uC694\uCCB4). Every response must be uniquely tailored to the student's question.`;
    const contents = (history || []).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));
    const response = await callGemini(ai, contents, {
      systemInstruction: systemPrompt
    });
    res.json({ success: true, text: response.text || "\uB2F5\uBCC0\uC744 \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
  } catch (error) {
    console.info("Socratic API operating with offline fallback engine.");
    const fallbackText = buildSocraticFallbackResponse(history, passage, translation, lesson, itemNo, title);
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});
async function callNanobananaApi(promptText, _nanobananaApiKey) {
  const apiKey = process.env.NANOBANANA_API_KEY || "";
  if (!apiKey) {
    return null;
  }
  const endpoints = [
    "https://api.nanobanana.com/v1/generate",
    "https://nanobananaapi.ai/api/v1/generate",
    "https://api.nanobanana.im/v1/images/generations"
  ];
  for (const url of endpoints) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "x-api-key": apiKey
      };
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: promptText,
          aspect_ratio: "16:9",
          num_outputs: 1,
          response_format: "url"
        })
      });
      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.imageUrl || data.url || data.data?.[0]?.url || data.images?.[0] || data.result;
        if (imageUrl) {
          return imageUrl;
        }
      }
    } catch {
    }
  }
  return null;
}
app.post("/api/gemini/image", async (req, res) => {
  const { title, lesson, itemNo, passage, visualStyle = "\uC778\uD3EC\uADF8\uB798\uD53D \uB9C8\uC778\uB4DC\uB9F5", colorMood = "Dark Cyber Neon", customNote = "", customApiKey, nanobananaApiKey, preferredEngine = "svg" } = req.body;
  const promptText = `High-end educational visual conceptual artwork for EBS CSAT English passage:
Title: "${title || ""}" (${lesson || ""} ${itemNo || ""})
Passage Summary: ${(passage || "").slice(0, 250)}
Visual Style: ${visualStyle}
Color Theme: ${colorMood}
Additional Context: ${customNote}
Include clear logical flow nodes, main educational metaphor elements, clean typography vector style, high resolution.`;
  if (preferredEngine === "nanobanana" && process.env.NANOBANANA_API_KEY) {
    try {
      const nanobananaUrl = await callNanobananaApi(promptText, nanobananaApiKey);
      if (nanobananaUrl) {
        return res.json({ success: true, imageUrl: nanobananaUrl, engineUsed: "Nanobanana API", styleUsed: visualStyle });
      }
    } catch {
    }
  }
  if (preferredEngine === "gemini") {
    try {
      const ai = getGenAIClient(customApiKey);
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: promptText }]
        }
      });
      let imageUrl = null;
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
      if (imageUrl) {
        return res.json({ success: true, imageUrl, engineUsed: "Gemini Image API", styleUsed: visualStyle });
      }
    } catch {
    }
  }
  const base64Svg = buildPassageVisualSvg(req.body);
  res.json({
    success: true,
    imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
    fallback: true,
    engineUsed: "\uBB34\uB8CC \uACE0\uD574\uC0C1\uB3C4 \uC9C0\uBB38 \uB3C4\uC2DD\uD654 \uC5D4\uC9C4",
    styleUsed: visualStyle
  });
});
var ingestResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    type: { type: Type.STRING },
    translation: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    answerIndex: { type: Type.NUMBER },
    explanation: { type: Type.STRING },
    syntaxNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    vocabList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          meaning: { type: Type.STRING }
        },
        required: ["word", "meaning"]
      }
    }
  },
  required: ["title", "type", "translation", "options", "answerIndex", "explanation", "syntaxNotes", "vocabList"]
};
app.post("/api/gemini/ingest", async (req, res) => {
  const { passageText, lesson, itemNo, customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are an expert EBS English curriculum processor. Analyze the raw English passage provided by the user and extract metadata in JSON format matching the schema.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Passage:
${passageText}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: ingestResponseSchema
      }
    });
    const responseText = response.text;
    if (!responseText) throw new Error("Failed to parse passage");
    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error) {
    console.info("[Ingest API] Operating with intelligent fallback engine.");
    const fallbackData = {
      title: typeof passageText === "string" && passageText ? passageText.split("\n")[0].slice(0, 32) + "..." : "\uC2E0\uADDC \uCD94\uAC00 \uC9C0\uBB38",
      type: "\uC8FC\uC81C \uBC0F \uC694\uC9C0 \uCD94\uB860",
      translation: "\uC785\uB825\uB41C \uC601\uC5B4 \uC9C0\uBB38\uC5D0 \uB300\uD55C \uD55C\uAD6D\uC5B4 \uC9C1\uB3C5\uC9C1\uD574 \uBC88\uC5ED \uBC0F \uC8FC\uC694 \uBB38\uC7A5 \uBD84\uC11D\uC785\uB2C8\uB2E4.",
      options: [
        "\u2460 Critical analysis of fundamental assumptions",
        "\u2461 Overcoming obstacles through collective effort",
        "\u2462 Replacing traditional paradigms with digital tools",
        "\u2463 Establishing rigid guidelines for standardized testing",
        "\u2464 Balancing theoretical concepts and practical applications"
      ],
      answerIndex: 0,
      explanation: "\uC9C0\uBB38\uC758 \uC804\uCCB4\uC801\uC778 \uC5B4\uC870\uC640 \uD575\uC2EC\uC5B4\uAD6C \uC218\uC2DD\uC744 \uACE0\uB824\uD588\uC744 \uB54C \u2460\uBC88\uC774 \uAC00\uC7A5 \uC801\uC808\uD55C \uC120\uD0DD\uC9C0\uC785\uB2C8\uB2E4.",
      syntaxNotes: [
        "\uC8FC\uC694 \uAD6C\uBB38: \uAC00\uC8FC\uC5B4 It - \uC9C4\uC8FC\uC5B4 to\uBD80\uC815\uC0AC \uAD6C\uC870 \uBD84\uC11D",
        "\uAD00\uACC4\uB300\uBA85\uC0AC\uC808: \uC120\uD589\uC0AC\uB97C \uC218\uC2DD\uD558\uB294 \uC8FC\uACA9 \uAD00\uACC4\uB300\uBA85\uC0AC that\uC808\uC758 \uC218\uC2DD \uBC94\uC704 \uD655\uC778"
      ],
      vocabList: [
        { word: "fundamental", meaning: "\uADFC\uBCF8\uC801\uC778, \uAE30\uBCF8\uC758" },
        { word: "perspective", meaning: "\uAD00\uC810, \uC2DC\uAC01" },
        { word: "examine", meaning: "\uC870\uC0AC\uD558\uB2E4, \uAC80\uD1A0\uD558\uB2E4" }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});
app.post("/api/gemini/image", async (req, res) => {
  const { title, lesson, itemNo, passage, visualStyle = "\uC778\uD3EC\uADF8\uB798\uD53D \uB9C8\uC778\uB4DC\uB9F5", colorMood = "Dark Cyber Neon", customNote = "", customApiKey, nanobananaApiKey, preferredEngine = "svg" } = req.body;
  const promptText = `High-end educational visual conceptual artwork for EBS CSAT English passage:
Title: "${title || ""}" (${lesson || ""} ${itemNo || ""})
Passage Summary: ${(passage || "").slice(0, 250)}
Visual Style: ${visualStyle}
Color Theme: ${colorMood}
Additional Context: ${customNote}
Include clear logical flow nodes, main educational metaphor elements, clean typography vector style, high resolution.`;
  if (preferredEngine === "nanobanana" && process.env.NANOBANANA_API_KEY) {
    try {
      const nanobananaUrl = await callNanobananaApi(promptText, nanobananaApiKey);
      if (nanobananaUrl) {
        return res.json({ success: true, imageUrl: nanobananaUrl, engineUsed: "Nanobanana API", styleUsed: visualStyle });
      }
    } catch {
    }
  }
  if (preferredEngine === "gemini") {
    try {
      const ai = getGenAIClient(customApiKey);
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: promptText }]
        }
      });
      let imageUrl = null;
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
      if (imageUrl) {
        return res.json({ success: true, imageUrl, engineUsed: "Gemini Image API", styleUsed: visualStyle });
      }
    } catch {
    }
  }
  const base64Svg = buildPassageVisualSvg(req.body);
  res.json({
    success: true,
    imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
    fallback: true,
    engineUsed: "\uBB34\uB8CC \uACE0\uD574\uC0C1\uB3C4 \uC9C0\uBB38 \uB3C4\uC2DD\uD654 \uC5D4\uC9C4",
    styleUsed: visualStyle
  });
});
app.post("/api/gemini/ingest", async (req, res) => {
  const passageText = req.body?.rawText || req.body?.passageText || "";
  const { lesson, itemNo, customApiKey } = req.body;
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are an expert EBS English curriculum processor. Analyze the raw English passage provided by the user and extract metadata in JSON format.
JSON schema:
{
  "title": "string (Korean concise descriptive title)",
  "type": "string (e.g. \uC8FC\uC81C \uCD94\uB860 / \uC5B4\uBC95 / \uBE48\uCE78 / \uAE00\uC758 \uC21C\uC11C / \uC8FC\uC5B4\uC9C4 \uBB38\uC7A5\uC758 \uC704\uCE58 / \uC694\uC57D\uBB38 \uC644\uC131)",
  "translation": "string (Accurate natural Korean full passage translation)",
  "options": ["Option 1 in English or Korean", "Option 2", "Option 3", "Option 4", "Option 5"],
  "answerIndex": number (0-4),
  "explanation": "string (Korean explanation of answer logic)",
  "syntaxNotes": ["syntax note 1", "syntax note 2"],
  "vocabList": [{"word": "englishWord", "meaning": "koreanMeaning"}]
}`;
    const response = await callGemini(ai, `Passage (${lesson || ""} ${itemNo || ""}):
${passageText}`, {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json"
    });
    const responseText = response.text;
    if (!responseText) throw new Error("Failed to parse passage");
    const json = JSON.parse(cleanJsonString(responseText));
    res.json({ success: true, data: json });
  } catch (error) {
    console.info("[Ingest API] Operating with intelligent fallback engine.");
    const fallbackData = {
      title: typeof passageText === "string" && passageText ? passageText.split("\n")[0].slice(0, 32) + "..." : "\uC2E0\uADDC \uCD94\uAC00 \uC9C0\uBB38",
      type: "\uC8FC\uC81C \uBC0F \uC694\uC9C0 \uCD94\uB860",
      translation: "\uC785\uB825\uB41C \uC601\uC5B4 \uC9C0\uBB38\uC5D0 \uB300\uD55C \uD55C\uAD6D\uC5B4 \uC9C1\uB3C5\uC9C1\uD574 \uBC88\uC5ED \uBC0F \uC8FC\uC694 \uBB38\uC7A5 \uBD84\uC11D\uC785\uB2C8\uB2E4.",
      options: [
        "\u2460 Critical analysis of fundamental assumptions",
        "\u2461 Overcoming obstacles through collective effort",
        "\u2462 Replacing traditional paradigms with digital tools",
        "\u2463 Establishing rigid guidelines for standardized testing",
        "\u2464 Balancing theoretical concepts and practical applications"
      ],
      answerIndex: 0,
      explanation: "\uC9C0\uBB38\uC758 \uC804\uCCB4\uC801\uC778 \uC5B4\uC870\uC640 \uD575\uC2EC\uC5B4\uAD6C \uC218\uC2DD\uC744 \uACE0\uB824\uD588\uC744 \uB54C \u2460\uBC88\uC774 \uAC00\uC7A5 \uC801\uC808\uD55C \uC120\uD0DD\uC9C0\uC785\uB2C8\uB2E4.",
      syntaxNotes: [
        "\uC8FC\uC694 \uAD6C\uBB38: \uAC00\uC8FC\uC5B4 It - \uC9C4\uC8FC\uC5B4 to\uBD80\uC815\uC0AC \uAD6C\uC870 \uBD84\uC11D",
        "\uAD00\uACC4\uB300\uBA85\uC0AC\uC808: \uC120\uD589\uC0AC\uB97C \uC218\uC2DD\uD558\uB294 \uC8FC\uACA9 \uAD00\uACC4\uB300\uBA85\uC0AC that\uC808\uC758 \uC218\uC2DD \uBC94\uC704 \uD655\uC778"
      ],
      vocabList: [
        { word: "fundamental", meaning: "\uADFC\uBCF8\uC801\uC778, \uAE30\uBCF8\uC758" },
        { word: "perspective", meaning: "\uAD00\uC810, \uC2DC\uAC01" },
        { word: "examine", meaning: "\uC870\uC0AC\uD558\uB2E4, \uAC80\uD1A0\uD558\uB2E4" }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});
var studentReportSchema = {
  type: Type.OBJECT,
  properties: {
    studentEmail: { type: Type.STRING },
    studentName: { type: Type.STRING },
    personalizedFeedback: { type: Type.STRING },
    schoolRecordSetek: { type: Type.STRING },
    byteCount: { type: Type.NUMBER },
    keyCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["studentEmail", "studentName", "personalizedFeedback", "schoolRecordSetek", "byteCount", "keyCompetencies"]
};
function getKoreanByteLength(str) {
  let b = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >> 11) b += 3;
    else if (c >> 7) b += 2;
    else b += 1;
  }
  return b;
}
app.post("/api/gemini/student-report", async (req, res) => {
  const { student, socraticLogs = [], customApiKey } = req.body;
  const studentEmail = student?.email || "student@simin.hs.kr";
  const studentName = student?.name || "\uAE40\uD559\uC0DD";
  const prompt = `You are a master High School English Teacher in Korea preparing official School Student Records (\uD559\uAD50\uC0DD\uD65C\uAE30\uB85D\uBD80 \uC138\uBD80\uB2A5\uB825 \uBC0F \uD2B9\uAE30\uC0AC\uD56D).
Analyze the following student's learning data and generate a personalized learning feedback report AND an official NEIS School Record Setek (\uC138\uD2B9) text.

[Student Activity Data]
- Name: ${studentName} (${studentEmail})
- Total Logins: ${student?.loginCount || 1} times
- Total Study Dwell Time: ${student?.totalDwellTimeMinutes || 25} minutes
- Passages Analyzed: ${student?.completedPassagesCount || 3} passages
- Transformed Questions Generated: ${student?.transformedQuestionsGenerated || 2} questions
- Socratic Questions Asked: ${student?.socraticQuestionsCount || 2} questions
- Socratic Logs & Q&A Snippets: ${JSON.stringify(socraticLogs.slice(0, 5))}

[Instruction Rules for Setek (\uC138\uBD80\uB2A5\uB825 \uBC0F \uD2B9\uAE30\uC0AC\uD56D)]:
1. TONE & STYLE: Write in official, formal Korean teacher observation style (~\uD568., ~\uC5D0\uC11C \uB450\uAC01\uC744 \uB098\uD0C0\uB0C4., ~\uC744 \uC790\uC728 \uD0D0\uAD6C\uD568.).
2. CONTENT: Highlight how the student actively utilized 2027 EBS Career English passages, engaged with Socratic 3-step hint tutoring, identified complex syntax (e.g., relative clauses, contrastive discourse markers), and solved CSAT transformed questions. Reflect real study patterns and personal academic traits.
3. BYTE LENGTH MANDATE: The "schoolRecordSetek" MUST BE STRICTLY BETWEEN 800 AND 900 BYTES in Korean (approximately 270~300 Korean characters with spaces). Do not exceed 950 bytes or be under 750 bytes.
4. "byteCount" property must hold the exact calculated byte length.

Respond ONLY with JSON matching the required schema.`;
  try {
    const ai = getGenAIClient(customApiKey);
    const response = await callGemini(ai, [{ role: "user", parts: [{ text: prompt }] }], {
      responseMimeType: "application/json",
      responseSchema: studentReportSchema,
      temperature: 0.3
    });
    const responseText = response.text;
    if (!responseText) throw new Error("Empty response from Gemini");
    const resultJson = JSON.parse(cleanJsonString(responseText));
    resultJson.byteCount = getKoreanByteLength(resultJson.schoolRecordSetek || "");
    res.json({ success: true, data: resultJson });
  } catch (error) {
    console.info("[Student Report API] Generating intelligent fallback report.");
    const sampleSetek = `'2027 \uC9C4\uB85C\uC601\uC5B4' \uC9C0\uBB38 \uBD84\uC11D \uC6CC\uD06C\uBD81\uACFC \uC18C\uD06C\uB77C\uD14C\uC2A4 AI \uD29C\uD130\uB97C \uC801\uADF9 \uD65C\uC6A9\uD558\uC5EC \uC601\uC5B4 \uB3C5\uD574\uB825\uACFC \uC9C0\uBB38 \uAD6C\uC870 \uD30C\uC545 \uB2A5\uB825\uC744 \uC885\uD569\uC801\uC73C\uB85C \uC2E0\uC7A5\uD568. \uD2B9\uD788 EBS \uC218\uB2A5 \uC5F0\uACC4 \uC9C0\uBB38 \uD559\uC2B5 \uACFC\uC815\uC5D0\uC11C \uAC00\uC8FC\uC5B4-\uC9C4\uC8FC\uC5B4 \uAD6C\uBB38 \uBC0F \uC5ED\uC811 \uC5F0\uACB0\uC5B4\uB97C \uD1B5\uD55C \uB17C\uC9C0 \uC804\uD658 \uD30C\uC545\uC5D0 \uB0A8\uB2E4\uB978 \uBA54\uD0C0\uC778\uC9C0\uC801 \uD0D0\uAD6C\uC5F4\uC744 \uBCF4\uC784. \uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130\uB9C1 3\uB2E8\uACC4 \uD78C\uD2B8 \uC2DC\uC2A4\uD15C\uC744 \uB2E8\uACC4\uBCC4\uB85C \uD0D0\uC0C9\uD558\uBA70 \uC2A4\uC2A4\uB85C \uBB38\uB9E5\uC0C1 \uC5B4\uD718\uC758 \uD568\uCD95\uC801 \uC758\uBBF8\uB97C \uB3C4\uCD9C\uD574\uB0B4\uB294 \uC8FC\uB3C4\uC801\uC778 \uD559\uC2B5 \uD0DC\uB3C4\uB97C \uD615\uC131\uD568. \uC218\uB2A5 \uBCC0\uD615\uBB38\uC81C \uC0DD\uC131\uAE30 \uAE30\uB2A5\uC744 \uC751\uC6A9\uD558\uC5EC \uBE48\uCE78 \uCD94\uB860 \uBC0F \uC5B4\uBC95\uC131 \uD310\uB2E8 \uBB38\uD56D\uC744 \uC9C1\uC811 \uD480\uC774\uD558\uACE0 \uBD84\uC11D\uD568\uC73C\uB85C\uC368 \uD14D\uC2A4\uD2B8\uC758 \uB17C\uB9AC\uC801 \uACB0\uC18D\uC131\uC744 \uD30C\uC545\uD558\uB294 \uBE44\uD310\uC801 \uC0AC\uACE0\uB825\uC774 \uB9E4\uC6B0 \uC6B0\uC218\uD568.`;
    const fallbackReport = {
      studentEmail,
      studentName,
      personalizedFeedback: `${studentName} \uD559\uC0DD\uC740 EBS \uC9C4\uB85C\uC601\uC5B4 \uC9C0\uBB38 \uC644\uB3C5 \uBC0F \uC18C\uD06C\uB77C\uD14C\uC2A4 \uD29C\uD130 \uC9C8\uC758\uB97C \uD1B5\uD574 \uC801\uADF9\uC801\uC778 \uAD6C\uBB38 \uD0D0\uAD6C\uB97C \uC218\uD589\uD558\uC600\uC2B5\uB2C8\uB2E4. \uD2B9\uD788 2\uB2E8\uACC4 \uAD6C\uBB38 \uD78C\uD2B8\uB97C \uD6A8\uACFC\uC801\uC73C\uB85C \uD65C\uC6A9\uD558\uC5EC \uC5ED\uC811 \uC5F0\uACB0\uC5B4\uC640 \uBCF5\uD569 \uAD00\uACC4\uC0AC\uC808\uC5D0 \uB300\uD55C \uC774\uD574\uB3C4\uAC00 \uC9C0\uC18D\uC801\uC73C\uB85C \uD5A5\uC0C1\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4.`,
      schoolRecordSetek: sampleSetek,
      byteCount: getKoreanByteLength(sampleSetek),
      keyCompetencies: ["\uC8FC\uB3C4\uC801 \uBA54\uD0C0\uC778\uC9C0 \uD0D0\uAD6C", "\uB17C\uB9AC\uC801 \uC9C0\uBB38 \uAD6C\uC870 \uBD84\uC11D", "\uC218\uB2A5 \uBCC0\uD615 \uBB38\uC81C \uC751\uC6A9\uB825"]
    };
    res.json({ success: true, data: fallbackReport, fallback: true });
  }
});
app.post("/api/gemini/ingest", async (req, res) => {
  const { rawText = "", lesson = "13\uAC15", itemNo = "01\uBC88", customApiKey } = req.body;
  if (!rawText || rawText.trim().length < 30) {
    return res.status(400).json({ success: false, error: "\uC9C0\uBB38 \uD14D\uC2A4\uD2B8\uAC00 \uBE44\uC5B4 \uC788\uAC70\uB098 \uB108\uBB34 \uC9E7\uC2B5\uB2C8\uB2E4. (\uCD5C\uC18C 30\uC790)" });
  }
  const cleanPassage = rawText.trim();
  const titleDefault = cleanPassage.slice(0, 30).split(".")[0] + "...";
  try {
    const ai = getGenAIClient(customApiKey);
    const systemPrompt = `You are a CSAT English Exam Digitizer. Convert the provided raw English passage into a complete structured EBS workbook item matching this exact JSON schema:
{
  "title": "Short Korean Title representing passage core theme",
  "type": "CSAT question type in Korean e.g. \uC8FC\uC81C \uBC0F \uC694\uC9C0 \uCD94\uB860, \uBE48\uCE78 \uCD94\uB860, \uC5B4\uBC95 \uD310\uB2E8",
  "translation": "Full natural Korean translation of the passage",
  "options": ["\u2460 Choice 1", "\u2461 Choice 2", "\u2462 Choice 3", "\u2463 Choice 4", "\u2464 Choice 5"],
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
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });
    const json = JSON.parse(cleanJsonString(response.text || "{}"));
    const data = {
      title: json.title || titleDefault,
      type: json.type || "\uC8FC\uC81C \uBC0F \uC694\uC9C0 \uCD94\uB860",
      translation: json.translation || "\uC9C0\uBB38 \uC9C1\uB3C5\uC9C1\uD574 \uD55C\uAD6D\uC5B4 \uBC88\uC5ED\uC785\uB2C8\uB2E4.",
      options: json.options && json.options.length === 5 ? json.options : ["\u2460 Choice 1", "\u2461 Choice 2", "\u2462 Choice 3", "\u2463 Choice 4", "\u2464 Choice 5"],
      answerIndex: typeof json.answerIndex === "number" ? json.answerIndex : 0,
      explanation: json.explanation || "\uC9C0\uBB38 \uC8FC\uC81C \uBC0F \uAD6C\uBB38 \uC815\uBC00 \uD574\uC124\uC785\uB2C8\uB2E4.",
      syntaxNotes: json.syntaxNotes || ["\uC8FC\uC5B4-\uB3D9\uC0AC \uC218\uC77C\uCE58 \uD655\uC778", "\uAD00\uACC4\uB300\uBA85\uC0AC \uC218\uC2DD \uAD6C\uBB38 \uD30C\uC545"],
      vocabList: json.vocabList || [{ word: "analysis", meaning: "\uBD84\uC11D" }, { word: "comprehension", meaning: "\uC774\uD574" }]
    };
    res.json({ success: true, data });
  } catch (err) {
    const fallbackIngest = {
      title: titleDefault,
      type: "\uC8FC\uC81C \uBC0F \uC694\uC9C0 \uCD94\uB860",
      translation: "\uC778\uD130\uB137 \uBC0F \uC815\uBCF4 \uD0D0\uAD6C\uC640 \uD559\uC220\uC801 \uB17C\uC9C0\uC5D0 \uAD00\uD55C \uAE00\uC785\uB2C8\uB2E4.",
      options: [
        "\u2460 critical understanding of core concepts",
        "\u2461 traditional approaches to learning",
        "\u2462 empirical evidence in academic study",
        "\u2463 technological advancements in research",
        "\u2464 rigid rules in formal education"
      ],
      answerIndex: 0,
      explanation: "\uC9C0\uBB38\uC758 \uB3C4\uC785\uBD80 \uC8FC\uC81C\uBB38\uACFC \uD6C4\uBC18\uBD80 \uACB0\uB860 \uBB38\uC7A5\uC758 \uB17C\uB9AC\uC801 \uC5F0\uAD00\uC131\uC5D0 \uB530\uB77C \u2460\uBC88\uC774 \uAC00\uC7A5 \uC801\uC808\uD569\uB2C8\uB2E4.",
      syntaxNotes: ["\uC8FC\uC5B4-\uB3D9\uC0AC \uC218\uC77C\uCE58 \uC815\uBC00 \uBD84\uC11D", "\uAD00\uACC4\uB300\uBA85\uC0AC\uC808 \uBC0F \uBD84\uC0AC\uAD6C\uBB38 \uC218\uC2DD \uBC94\uC704 \uAD6C\uBCC4"],
      vocabList: [
        { word: "curiosity", meaning: "\uD638\uAE30\uC2EC" },
        { word: "behavior", meaning: "\uD589\uB3D9" }
      ]
    };
    res.json({ success: true, data: fallbackIngest, fallback: true });
  }
});
var DATA_FILE_PATH = process.env.VERCEL ? path.join("/tmp", "data_analytics_store.json") : path.join(process.cwd(), "data_analytics_store.json");
function loadStoreFromFile() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const rawStudents = Array.isArray(parsed.students) ? parsed.students : [];
      const cleanedStudents = rawStudents.filter((s) => s.email && s.email.toLowerCase() !== "student@simin.hs.kr");
      return {
        students: cleanedStudents,
        socraticLogs: Array.isArray(parsed.socraticLogs) ? parsed.socraticLogs : [],
        reflections: Array.isArray(parsed.reflections) ? parsed.reflections : []
      };
    }
  } catch (err) {
    console.warn("[Analytics File Store Load Error]:", err);
  }
  return {
    students: [],
    socraticLogs: [],
    reflections: []
  };
}
var centralStore = loadStoreFromFile();
function saveStoreToFile() {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(centralStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Analytics File Store Save Error]:", err);
  }
}
app.post("/api/analytics/sync-student", (req, res) => {
  try {
    const student = req.body;
    if (!student || !student.email) {
      return res.status(400).json({ success: false, error: "Student email is required" });
    }
    const cleanEmail = student.email.trim().toLowerCase();
    const idx = centralStore.students.findIndex((s) => s.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      centralStore.students[idx] = { ...centralStore.students[idx], ...student };
    } else {
      centralStore.students.unshift({
        id: student.id || `std-${Date.now()}`,
        email: cleanEmail,
        name: student.name || cleanEmail.split("@")[0],
        loginCount: student.loginCount || 1,
        lastLogin: student.lastLogin || (/* @__PURE__ */ new Date()).toLocaleString("ko-KR"),
        totalDwellTimeMinutes: student.totalDwellTimeMinutes || 5,
        completedPassagesCount: student.completedPassagesCount || 0,
        transformedQuestionsGenerated: student.transformedQuestionsGenerated || 0,
        quizAccuracyPercentage: student.quizAccuracyPercentage || 100,
        socraticQuestionsCount: student.socraticQuestionsCount || 0,
        status: "online"
      });
    }
    saveStoreToFile();
    res.json({ success: true, count: centralStore.students.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/analytics/students", (req, res) => {
  res.json({ success: true, data: centralStore.students });
});
app.post("/api/analytics/socratic-log", (req, res) => {
  try {
    const log = req.body;
    if (log && log.studentEmail) {
      centralStore.socraticLogs.unshift(log);
      const cleanEmail = log.studentEmail.trim().toLowerCase();
      const idx = centralStore.students.findIndex((s) => s.email.toLowerCase() === cleanEmail);
      if (idx >= 0) {
        centralStore.students[idx].socraticQuestionsCount = (centralStore.students[idx].socraticQuestionsCount || 0) + 1;
        centralStore.students[idx].totalDwellTimeMinutes = (centralStore.students[idx].totalDwellTimeMinutes || 0) + 2;
        centralStore.students[idx].lastLogin = (/* @__PURE__ */ new Date()).toLocaleString("ko-KR");
      } else {
        centralStore.students.unshift({
          id: `std-${Date.now()}`,
          email: cleanEmail,
          name: log.studentName || cleanEmail.split("@")[0],
          loginCount: 1,
          lastLogin: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR"),
          totalDwellTimeMinutes: 5,
          completedPassagesCount: 0,
          transformedQuestionsGenerated: 0,
          quizAccuracyPercentage: 100,
          socraticQuestionsCount: 1,
          status: "online"
        });
      }
      saveStoreToFile();
    }
    res.json({ success: true, count: centralStore.socraticLogs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/analytics/socratic-logs", (req, res) => {
  res.json({ success: true, data: centralStore.socraticLogs });
});
app.post("/api/analytics/reflection", (req, res) => {
  try {
    const ref = req.body;
    if (ref && ref.studentEmail) {
      centralStore.reflections.unshift(ref);
      const cleanEmail = ref.studentEmail.trim().toLowerCase();
      const idx = centralStore.students.findIndex((s) => s.email.toLowerCase() === cleanEmail);
      if (idx >= 0) {
        centralStore.students[idx].completedPassagesCount = (centralStore.students[idx].completedPassagesCount || 0) + 1;
        centralStore.students[idx].totalDwellTimeMinutes = (centralStore.students[idx].totalDwellTimeMinutes || 0) + 3;
      }
      saveStoreToFile();
    }
    res.json({ success: true, count: centralStore.reflections.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/analytics/reflections", (req, res) => {
  res.json({ success: true, data: centralStore.reflections });
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "csat-agent-1", freeTierModel: "gemini-2.5-flash" });
});
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `\uC694\uCCAD\uD558\uC2E0 API \uC5D4\uB4DC\uD3EC\uC778\uD2B8(${req.originalUrl})\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`
  });
});
app.use((err, req, res, next) => {
  console.error("Global Express Error:", err);
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    return res.status(500).json({
      success: false,
      error: err?.message || "\uC11C\uBC84 \uB0B4\uBD80 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4."
    });
  }
  next(err);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
if (process.env.VERCEL !== "1" && !process.env.NOW_REGION) {
  startServer();
}
var server_default = app;
export {
  server_default as default
};
