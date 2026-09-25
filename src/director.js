// Логика режиссёра: когда задуматься, что подбросить, как подать и что сказать на полях.
import { DELIVERY, TALK_CHANCE, chatState, resetChatState, saveChatState, settings } from './settings.js';
import { askModel } from './llm.js';
import { buildMessages, isLaraMessage, parseReply } from './prompt.js';
import { escapeHtml, laraName, plural, t } from './i18n.js';
import { AVATAR } from './assets.js';

const ctx = () => SillyTavern.getContext();

// ключи setExtensionPrompt; позиция IN_CHAT = 1, роль SYSTEM = 0 (одинаково в ST и Divinax)
const HINT_KEY = 'lara_director_hint';
const COMMENT_KEY = 'lara_director_voice';
const IN_CHAT = 1;
const ROLE_SYSTEM = 0;

/** Типы генерации, после которых Лара не считает ход (свайпы, продолжения, служебные запросы). */
const NOT_A_TURN = new Set(['swipe', 'regenerate', 'continue', 'impersonate', 'quiet', 'first_message', 'command', 'extension', 'appendFinal']);

export const runtime = { busy: false, lastError: '' };

const listeners = new Set();
export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
export function notify() {
    for (const fn of listeners) {
        try {
            fn();
        } catch (e) {
            console.error('[Lara Director]', e);
        }
    }
}

const toast = (kind, text) => (globalThis.toastr?.[kind] ?? console.log)(text, 'Lara Director');

function report(e, quiet = false) {
    const msg = e?.cause?.message ? `${e.message}: ${e.cause.message}` : (e?.message ?? String(e));
    runtime.lastError = msg;
    console.error('[Lara Director]', e);
    if (!quiet) toast('error', t('Лара не смогла: {0}', msg));
    notify();
}

const hasChat = () => Boolean(ctx().getCurrentChatId?.());

// ── Статус для интерфейса ──

export function statusInfo() {
    const s = settings();
    if (!s.enabled) return { key: 'off', text: t('Ушла из зала'), word: t('ушла') };
    if (runtime.busy) return { key: 'busy', text: t('Думает…'), word: t('думает') };
    if (!hasChat()) return { key: 'idle', text: t('Ждёт начала сцены'), word: t('ждёт') };
    const st = chatState();
    if (st.paused) return { key: 'paused', text: t('Тишина до конца сцены'), word: t('пауза') };
    return { key: 'watch', text: `${t('Наблюдает')} · ${nextMoveText()}`, word: t('наблюдает') };
}

export function nextMoveText() {
    const s = settings();
    const left = Math.max(0, s.frequency - chatState().counter);
    if (left === 0) return t('ход на вашей следующей реплике');
    return t('следующий ход через ~{0}', plural(left, t('сообщение'), t('сообщения'), t('сообщений')));
}

// ── Один «взгляд» Лары на сцену ──

async function think(task) {
    if (runtime.busy) throw new Error(t('Лара уже думает'));
    const chatId = ctx().getCurrentChatId?.();
    runtime.busy = true;
    runtime.lastError = '';
    notify();
    try {
        const raw = await askModel(buildMessages(task));
        if (ctx().getCurrentChatId?.() !== chatId) return {}; // пока думала, сменился чат
        const r = parseReply(raw, task);
        const st = chatState();
        if (r.tempo !== undefined) st.tempo = r.tempo;
        if (r.tempoLabel) st.tempoLabel = r.tempoLabel;
        if (r.place) st.place = r.place;
        if (r.sleeve?.length) st.sleeve = r.sleeve;
        saveChatState();
        return r;
    } finally {
        runtime.busy = false;
        notify();
    }
}

// ── Подача события ──

function eventMessage(ev) {
    const s = settings();
    return {
        name: laraName(),
        is_user: false,
        is_system: false,
        send_date: new Date().toISOString(),
        mes: ev.text,
        force_avatar: AVATAR,
        extra: {
            type: 'narrator',
            swipeable: false,
            api: 'lara-director',
            model: 'Lara Director',
            lara: { kind: 'event', kinds: ev.kinds ?? [], intensity: s.intensity, kept: false, date: Date.now() },
        },
    };
}

async function insertEvent(ev) {
    const c = ctx();
    const msg = eventMessage(ev);
    c.chat.push(msg);
    c.addOneMessage?.(msg);
    await c.saveChat?.();
}

function setHint(text) {
    const c = ctx();
    const value = text
        ? `[Director's note — this has just happened in the world of the story. Let the characters notice and react to it in their own way, without contradicting it: ${text}]`
        : '';
    c.setExtensionPrompt?.(HINT_KEY, value, IN_CHAT, 0, false, ROLE_SYSTEM);
}

function setVoicePrompt(text) {
    const c = ctx();
    const value = text ? `[Lara, the director watching this scene, remarks from her box: "${text}"]` : '';
    c.setExtensionPrompt?.(COMMENT_KEY, value, IN_CHAT, 1, false, ROLE_SYSTEM);
}

/** Восстанавливает инъекции в промпт для текущего чата (после смены чата или настроек). */
export function syncPrompts() {
    const s = settings();
    if (!hasChat() || !s.enabled) {
        setHint('');
        setVoicePrompt('');
        return;
    }
    const st = chatState();
    setHint(st.hint?.text ?? '');
    const last = st.comments[st.comments.length - 1];
    setVoicePrompt(!s.commentsHidden && s.comments && last ? last.text : '');
}

async function confirmEvent(ev) {
    const c = ctx();
    const html = `<div class="ld-popup"><h3>${escapeHtml(t('Лара предлагает событие'))}</h3><p>${escapeHtml(t('Можно поправить текст. «Выпустить» — событие уйдёт в сцену, «Отказаться» — Лара промолчит.'))}</p></div>`;
    const res = await c.callGenericPopup(html, c.POPUP_TYPE?.INPUT ?? 3, ev.text, {
        okButton: t('Выпустить'),
        cancelButton: t('Отказаться'),
        rows: 7,
        wide: true,
    });
    if (res === null || res === false || res === undefined) return null;
    const text = String(res).trim();
    return text ? { ...ev, text } : null;
}

/**
 * Подбросить событие.
 * @param {{ idea?: string, auto?: boolean }} o auto — сработало само, по счётчику (тогда без лишних уведомлений)
 */
export async function throwEvent({ idea = '', auto = false } = {}) {
    const s = settings();
    if (!hasChat()) {
        toast('info', t('Сначала откройте чат'));
        return false;
    }
    if (runtime.busy) {
        if (!auto) toast('info', t('Лара уже думает'));
        return false;
    }
    let r;
    try {
        r = await think({ event: true, idea });
    } catch (e) {
        report(e, false);
        return false;
    }
    let ev = r.event;
    if (!ev?.text) {
        if (!auto) toast('info', t('Лара промолчала — попробуйте ещё раз'));
        return false;
    }
    const st = chatState();
    const mode = DELIVERY.includes(s.delivery) ? s.delivery : 'remark';
    if (mode === 'confirm') {
        ev = await confirmEvent(ev);
        if (!ev) return false;
        await insertEvent(ev);
    } else if (mode === 'hidden') {
        st.hint = { text: ev.text, date: Date.now() };
        setHint(ev.text);
        if (!auto) toast('info', t('Скрытая подсказка ждёт ответа персонажа'));
    } else {
        await insertEvent(ev);
    }
    st.history.push({ text: ev.text, kinds: ev.kinds ?? [], via: mode, date: Date.now() });
    st.history = st.history.slice(-20);
    st.whispers = [];
    if (idea) st.sleeve = st.sleeve.filter((x) => x !== idea);
    st.counter = 0;
    saveChatState();
    notify();
    return true;
}

/** Бросить заготовку «из рукава». */
export function throwFromSleeve(i) {
    const idea = chatState().sleeve[i];
    if (idea) return throwEvent({ idea });
}

// ── Реплики на полях ──

export const anchorOf = (m) => (m ? `${m.send_date ?? ''}|${m.name ?? ''}` : '');

function lastSceneIndex() {
    const chat = ctx().chat ?? [];
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i] && !isLaraMessage(chat[i])) return i;
    return chat.length - 1;
}

/** Реплика Лары на полях (или ответ на вопрос зрителя). */
export async function laraComment({ question = '', index, quiet = false } = {}) {
    if (!hasChat()) {
        toast('info', t('Сначала откройте чат'));
        return '';
    }
    if (runtime.busy) {
        if (!quiet) toast('info', t('Лара уже думает'));
        return '';
    }
    let r;
    try {
        r = await think({ comment: true, question });
    } catch (e) {
        report(e, quiet);
        return '';
    }
    if (!r.comment) {
        if (!quiet) toast('info', t('Лара промолчала — попробуйте ещё раз'));
        return '';
    }
    const chat = ctx().chat ?? [];
    const idx = index ?? lastSceneIndex();
    const m = chat[idx];
    const st = chatState();
    if (!m) {
        toast('info', `${laraName()}: «${r.comment}»`);
    } else {
        st.comments.push({ id: Math.random().toString(36).slice(2, 10), anchor: anchorOf(m), text: r.comment, question: question || undefined, date: Date.now() });
        st.comments = st.comments.slice(-200);
    }
    saveChatState();
    syncPrompts();
    notify();
    return r.comment;
}

export function removeComment(id) {
    const st = chatState();
    st.comments = st.comments.filter((x) => x.id !== id);
    saveChatState();
    syncPrompts();
    notify();
}

/** Тихий взгляд без события: обновить темп, место и заготовки. */
async function observe() {
    try {
        await think({});
    } catch (e) {
        report(e, true);
    }
}

// ── Реакция на ход игры ──

/** Сообщение пользователя уже в чате, ответ персонажа ещё не начат — лучший момент для события. */
export async function onUserMessage(idx) {
    const s = settings();
    if (!s.enabled || !hasChat()) return;
    const m = ctx().chat?.[idx];
    if (!m || !m.is_user) return;
    const st = chatState();
    if (st.paused) return;
    st.counter += 1;
    if (st.counter < s.frequency) {
        saveChatState();
        notify();
        return;
    }
    st.counter = 0;
    saveChatState();
    if (Math.random() * 100 < s.chance) await throwEvent({ auto: true });
    else void observe();
    notify();
}

/** Ответ персонажа получен. */
export function onCharMessage(idx, type) {
    const s = settings();
    if (!hasChat()) return;
    const st = chatState();
    // скрытая подсказка живёт ровно до первого ответа персонажа
    if (st.hint && type !== 'quiet' && type !== 'impersonate') {
        st.hint = null;
        setHint('');
        saveChatState();
    }
    if (!s.enabled || st.paused || NOT_A_TURN.has(String(type ?? ''))) {
        notify();
        return;
    }
    const m = ctx().chat?.[idx];
    if (!m || m.is_user || isLaraMessage(m)) return;
    st.counter += 1;
    saveChatState();
    notify();
    if (s.comments && !runtime.busy && Math.random() < (TALK_CHANCE[s.talk] ?? 0)) void laraComment({ index: idx, quiet: true });
}

export function onChatChanged() {
    syncPrompts();
    notify();
}

// ── Действия с ремаркой ──

function laraEventAt(idx) {
    const m = ctx().chat?.[idx];
    return m?.extra?.lara?.kind === 'event' ? m : null;
}

export async function keepEvent(idx) {
    const m = laraEventAt(idx);
    if (!m) return;
    m.extra = { ...m.extra, lara: { ...m.extra.lara, kept: true } };
    await ctx().saveChat?.();
    notify();
}

export async function rethrowEvent(idx) {
    const m = laraEventAt(idx);
    if (!m) return;
    if (runtime.busy) {
        toast('info', t('Лара уже думает'));
        return;
    }
    let r;
    try {
        r = await think({ event: true, replace: m.mes, until: idx });
    } catch (e) {
        report(e);
        return;
    }
    if (!r.event?.text) {
        toast('info', t('Лара промолчала — попробуйте ещё раз'));
        return;
    }
    const c = ctx();
    const cur = c.chat?.[idx];
    if (cur !== m) return; // сообщение успели удалить или сдвинуть
    m.mes = r.event.text;
    if (Array.isArray(m.swipes)) m.swipes[m.swipe_id ?? 0] = m.mes;
    m.extra = { ...m.extra, lara: { ...m.extra.lara, kinds: r.event.kinds ?? [], date: Date.now() } };
    const st = chatState();
    st.history.push({ text: r.event.text, kinds: r.event.kinds ?? [], via: 'remark', date: Date.now() });
    st.history = st.history.slice(-20);
    saveChatState();
    c.updateMessageBlock?.(idx, m);
    await c.saveChat?.();
    notify();
}

export async function removeEvent(idx) {
    const c = ctx();
    if (!laraEventAt(idx)) return;
    if (typeof c.deleteMessage === 'function') {
        await c.deleteMessage(idx);
    } else {
        c.chat.splice(idx, 1);
        await c.saveChat?.();
        await c.reloadCurrentChat?.();
    }
    notify();
}

// ── Прочие команды ──

export function whisper(text) {
    const idea = String(text ?? '').trim();
    if (!idea) return;
    if (!hasChat()) {
        toast('info', t('Сначала откройте чат'));
        return;
    }
    const st = chatState();
    st.whispers = [...st.whispers, idea].slice(-5);
    saveChatState();
    toast('success', t('Лара услышала. Использует, когда придёт время.'));
    notify();
}

export function setPaused(on) {
    if (!hasChat()) return;
    chatState().paused = on;
    saveChatState();
    notify();
}

export function forgetScene() {
    if (!hasChat()) return;
    const keep = chatState().comments;
    resetChatState();
    chatState().comments = keep;
    saveChatState();
    syncPrompts();
    notify();
}

export function setEnabled(on) {
    settings().enabled = on;
    syncPrompts();
    notify();
}
