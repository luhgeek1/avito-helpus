import { guideTopics } from "@/shared/config";
import type { GuideTopicId } from "@/shared/config";

export type GuideAnswer = { text: string; topics: GuideTopicId[] };

/** A public documentation helper: bounded answers, no credentials or corporate actions. */
export function answerInstallationQuestion(question: string, previous: GuideTopicId[] = []): GuideAnswer {
  const normalized = question.toLowerCase().replaceAll("ё", "е").trim();
  if (/^(привет|здравствуй|добрый день|спасибо|благодарю)[!.\s]*$/.test(normalized)) {
    return { text: "Привет! Помогу установить Орби: запустить проект, встроить спутника, подключить API и разобраться с ошибками. С чего начнём?", topics: [] };
  }
  if (/^(а )?(что )?(дальше|следующ[а-я]* шаг)[?!.\s]*$/.test(normalized) && previous.length) {
    const index = guideTopics.findIndex((topic) => topic.id === previous.at(-1));
    const topic = guideTopics[Math.min(index + 1, guideTopics.length - 1)];
    return { text: topic.answer, topics: [topic.id] };
  }
  const scored = guideTopics.map((topic) => ({ topic, score: topic.terms.reduce((score, term) => score + (normalized.includes(term.replaceAll("ё", "е")) ? term.length : 0), 0) }))
    .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  // Error codes and transport failures need a specific diagnosis before general setup advice.
  const diagnostic = /\b(401|403)\b/.test(normalized) ? "auth" : /\b(502|504)\b|sse|буфер|cors/.test(normalized) ? "api" : null;
  const contextual = /^(а |и )?(где (это|его)|как это|что это|покажи (код|пример)|подробнее|объясни подробнее)/.test(normalized);
  const ids = diagnostic ? [diagnostic] : contextual && previous.length ? previous
    : scored.length ? scored.filter(({ score }) => score >= Math.max(2, scored[0].score * 0.65)).slice(0, 2).map(({ topic }) => topic.id) : [];
  const topics = guideTopics.filter((topic) => ids.includes(topic.id));
  if (!topics.length) return {
    text: "В руководстве нет точного ответа на этот вопрос. Я могу помочь с запуском Docker, встраиванием в React / Next.js, API, входом, LLM и типовыми ошибками установки. Напиши, на каком шаге ты остановился, и точный текст ошибки. Я не вижу твой компьютер и не запускаю команды за тебя.", topics: [],
  };
  return { text: topics.map((topic) => topic.answer).join("\n\n"), topics: topics.map((topic) => topic.id) };
}
