// Запросы к модели режиссёра. Лара не пользуется генерацией персонажей:
// у неё свой профиль подключения, своя модель или хотя бы свой «сырой» запрос без промпта чата.
import { settings } from './settings.js';
import { t } from './i18n.js';

const TIMEOUT_MS = 90_000;
const ctx = () => SillyTavern.getContext();

/** Профили Connection Manager (в SillyTavern) или профили подключений (в Divinax). */
export function listProfiles() {
    try {
        const cm = ctx().extensionSettings?.connectionManager;
        const list = Array.isArray(cm?.profiles) ? cm.profiles : [];
        return list.filter((p) => p && p.id).map((p) => ({ id: p.id, name: p.name || p.id, model: p.model || '' }));
    } catch {
        return [];
    }
}

export function hasProfileService() {
    return typeof ctx().ConnectionManagerRequestService?.sendRequest === 'function';
}

function withTimeout(promise, ms, controller) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, rej) => {
            timer = setTimeout(() => {
                controller?.abort();
                rej(new Error(t('Лара не ответила за {0} с', Math.round(ms / 1000))));
            }, ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function extractText(res) {
    if (res == null) return '';
    if (typeof res === 'string') return res;
    if (typeof res.content === 'string') return res.content;
    if (Array.isArray(res.choices)) return res.choices[0]?.message?.content ?? res.choices[0]?.text ?? '';
    return String(res);
}

async function viaProfile(messages, s, signal) {
    const c = ctx();
    if (!hasProfileService()) throw new Error(t('Профили подключений недоступны — включите Connection Manager или выберите другое подключение'));
    if (!s.profileId) throw new Error(t('Выберите профиль подключения для Лары'));
    const override = s.model.trim() ? { model: s.model.trim() } : {};
    const res = await c.ConnectionManagerRequestService.sendRequest(
        s.profileId,
        messages,
        s.maxTokens,
        { stream: false, signal, extractData: true, includePreset: true, includeInstruct: true },
        override,
    );
    return extractText(res);
}

async function viaMain(messages, s) {
    const c = ctx();
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system');
    const prompt = rest.length === 1 ? rest[0].content : rest;
    return extractText(await c.generateRaw({ systemPrompt: system, prompt, responseLength: s.maxTokens, trimNames: false }));
}

async function viaCustom(messages, s, signal) {
    const base = s.customUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    if (!base) throw new Error(t('Укажите адрес API для Лары'));
    if (!s.model.trim()) throw new Error(t('Укажите модель для Лары'));
    const headers = { 'Content-Type': 'application/json' };
    if (s.customKey.trim()) headers.Authorization = `Bearer ${s.customKey.trim()}`;
    if (/openrouter\.ai/.test(base)) {
        headers['HTTP-Referer'] = location.origin;
        headers['X-Title'] = 'Lara Director';
    }
    const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({ model: s.model.trim(), messages, max_tokens: s.maxTokens, temperature: 0.95, stream: false }),
    });
    if (!r.ok) {
        let detail = '';
        try {
            const j = await r.json();
            detail = j?.error?.message ?? j?.message ?? '';
        } catch { /* тело не JSON */ }
        throw new Error(`HTTP ${r.status}${detail ? ': ' + detail : ''}`);
    }
    return extractText(await r.json());
}

/** Отправляет сообщения модели Лары и возвращает её текст. */
export async function askModel(messages) {
    const s = settings();
    const controller = new AbortController();
    const run =
        s.source === 'custom' ? viaCustom(messages, s, controller.signal)
            : s.source === 'main' ? viaMain(messages, s)
                : viaProfile(messages, s, controller.signal);
    const text = await withTimeout(run, TIMEOUT_MS, controller);
    return String(text ?? '');
}
