import type { DealFinderAnalysis } from "./types";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character] || character));

const statusOf = (analysis: DealFinderAnalysis) => analysis.status || analysis.analysis_status || "pending";
const list = (title: string, values: string[]) => values.length
  ? `<section><h3>${escapeHtml(title)}</h3><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`
  : "";

export function renderDealFinderAnalysis(analysis: DealFinderAnalysis | null, canAnalyze = true) {
  const runButton = (label: string, force = false) => canAnalyze
    ? `<button class="button button-primary" type="button" data-deal-action="analyze"${force ? ' data-deal-force="true"' : ""}>${escapeHtml(label)}</button>`
    : "";
  if (!analysis) return `<section class="deal-finder-ai-panel deal-finder-ai-empty"><strong>AI не запущен</strong><p>Запустите анализ: результат обычно появится в течение двух минут.</p>${runButton("Запустить AI-анализ")}</section>`;
  const status = statusOf(analysis);
  if (status === "pending") return `<section class="deal-finder-ai-panel"><strong>В очереди</strong><p>Задача сохранена. AI-обработчик заберёт её автоматически.</p></section>`;
  if (status === "processing") return `<section class="deal-finder-ai-panel"><strong>Анализируется</strong><p>Worker обрабатывает сохранённые данные объявления.</p></section>`;
  if (status === "failed") return `<section class="deal-finder-ai-panel deal-finder-error"><strong>Ошибка анализа</strong><p>Безопасный код: ${escapeHtml(analysis.error_code || "UNKNOWN_ANALYSIS_ERROR")}</p>${runButton("Повторить AI-анализ", true)}</section>`;
  if (status !== "completed") return `<section class="deal-finder-ai-panel"><strong>Анализ недоступен</strong><p>Предыдущая задача имеет статус ${escapeHtml(status)}.</p>${runButton("Запустить новый анализ", true)}</section>`;
  const score = (label: string, display: string) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(display)}</dd></div>`;
  const scoreValue = (value: number | null | undefined) => typeof value === "number" ? `${Math.round(value)}/100` : "—";
  const confidence = typeof analysis.confidence_score === "number" ? `${Math.round(analysis.confidence_score * 100)}%` : "—";
  const isV1 = analysis.analysis_version === "deal-finder-v1";
  const defectsTitle = isV1 ? "Возможные замечания из текста объявления" : "Известные дефекты";
  const defectsNote = isV1 && analysis.known_defects?.length
    ? `<p class="deal-finder-ai-list-note">Эти пункты автоматически извлечены AI и могут включать нейтральные факты. Они не подтверждают техническую неисправность.</p>`
    : "";
  return `<section class="deal-finder-ai-panel deal-finder-ai-completed">
    <div class="deal-finder-ai-heading"><div><span class="eyebrow">AI-АНАЛИЗ</span><h2>Анализ завершён</h2></div><div class="deal-finder-ai-badges">${isV1 ? '<span class="deal-ai-version-badge">AI v1 · Beta</span>' : ""}<span class="deal-status-badge">${escapeHtml(analysis.recommendation || "REVIEW")}</span></div></div>
    <dl class="deal-finder-ai-scores">${score("Deal score", scoreValue(analysis.deal_score))}${score("Риск", scoreValue(analysis.risk_score))}${score("Ликвидность", scoreValue(analysis.liquidity_score))}${score("Качество данных", scoreValue(analysis.data_quality_score))}${score("Уверенность", confidence)}</dl>
    <p>${escapeHtml(analysis.ai_summary || "Краткое резюме не предоставлено.")}</p>
    <div class="deal-finder-ai-lists">${list("Положительные сигналы", analysis.positive_signals || [])}${list("Риски", analysis.negative_signals || [])}${list(defectsTitle, analysis.known_defects || [])}${defectsNote}${list("Недостающие данные", analysis.missing_information || [])}${list("Вопросы продавцу", analysis.recommended_questions || [])}</div>
    <p class="deal-finder-meta">Модель: ${escapeHtml(analysis.model || analysis.model_used || "—")} · Завершено: ${escapeHtml(analysis.completed_at || analysis.analyzed_at || "—")}</p>
    <p class="deal-finder-notice">AI-оценка основана только на данных объявления. Она не является технической диагностикой, подтверждённой рыночной оценкой или гарантией выгоды.</p>
    <div class="deal-finder-ai-refresh"><p>Если данные объявления не менялись, запрос вернёт этот же результат без новой AI-задачи.</p>${runButton("Проверить актуальность")}</div>
  </section>`;
}
