// Лара в чате: ремарка-карточка вместо обычного сообщения и реплики на полях под сообщениями.
// Работает поверх разметки SillyTavern (#chat .mes[mesid] .mes_block), которую повторяет и Divinax.
import { chatState, settings } from './settings.js';
import { anchorOf, keepEvent, onChange, removeComment, removeEvent, rethrowEvent } from './director.js';
import { AVATAR, BANNER } from './assets.js';
import { escapeHtml, kindLabel, intensityLabel, laraName, t } from './i18n.js';

const ctx = () => SillyTavern.getContext();

const CORNER = `<svg class="lara-corner" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1 21V7C1 3.7 3.7 1 7 1h14"/><circle cx="7" cy="7" r="1.6" fill="currentColor"/></svg>`;
const RULE_L = `<svg width="46" height="12" viewBox="0 0 46 12" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M0 6h30"/><path d="M36 1l5 5-5 5-5-5z"/></svg>`;
const RULE_R = `<svg width="46" height="12" viewBox="0 0 46 12" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M16 6h30"/><path d="M10 1l5 5-5 5-5-5z"/></svg>`;
const ICON_KEEP = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>`;
const ICON_AGAIN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5"/></svg>`;
const ICON_X = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;
const ICON_DEAF = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><path d="M2 14L14 2"/></svg>`;
const ICON_EAR = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>`;

/** Текст события → абзацы; *курсив* как в чате. */
function prose(text) {
    return String(text ?? '')
        .trim()
        .split(/\n\s*\n/)
        .map((p) => `<p>${escapeHtml(p).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

function cardHtml(m) {
    const lara = m.extra.lara;
    const tags = [intensityLabel(lara.intensity), ...(lara.kinds ?? []).map(kindLabel)].filter(Boolean);
    const acts = lara.kept
        ? ''
        : `<div class="lara-card__acts">
            <button type="button" class="lara-act" data-lara-act="keep">${ICON_KEEP}<span>${t('Оставить')}</span></button>
            <button type="button" class="lara-act" data-lara-act="again">${ICON_AGAIN}<span>${t('Переиграть')}</span></button>
            <button type="button" class="lara-act" data-lara-act="remove">${ICON_X}<span>${t('Убрать')}</span></button>
        </div>`;
    return `<div class="lara-card__frame">
        <div class="lara-card__banner">
            <img src="${BANNER}" alt="" loading="lazy">
            <div class="lara-card__title">${RULE_L}<span>${t('Ремарка режиссёра')}</span>${RULE_R}</div>
        </div>
        <div class="lara-card__text">${prose(m.mes)}</div>
        <div class="lara-card__foot">
            <img class="lara-card__ava" src="${AVATAR}" alt="">
            <span class="lara-card__by">${t('Подбросила {0}', escapeHtml(laraName()))}${tags.length ? ` <span class="lara-muted">· ${tags.map(escapeHtml).join(' · ')}</span>` : ''}</span>
            ${acts}
        </div>
    </div>
    <span class="lara-c lara-c--tl">${CORNER}</span><span class="lara-c lara-c--tr">${CORNER}</span><span class="lara-c lara-c--bl">${CORNER}</span><span class="lara-c lara-c--br">${CORNER}</span>`;
}

function notesHtml(list) {
    const s = settings();
    const deaf = s.commentsHidden
        ? `<span class="lara-note__deaf">${ICON_DEAF}${t('персонажи не слышат')}</span>`
        : `<span class="lara-note__deaf">${ICON_EAR}${t('персонажи слышат')}</span>`;
    return list
        .map(
            (n) => `<div class="lara-note" data-lara-note="${escapeHtml(n.id)}">
        <div class="lara-note__box">
            <div class="lara-note__head">
                <span class="lara-note__who">${t('{0} · на полях', escapeHtml(laraName()))}</span>
                ${deaf}
                <button type="button" class="lara-note__x" data-lara-act="unnote" title="${t('Убрать реплику')}" aria-label="${t('Убрать реплику')}">${ICON_X}</button>
            </div>
            ${n.question ? `<div class="lara-note__q">— ${escapeHtml(n.question)}</div>` : ''}
            <p class="lara-note__text">«${escapeHtml(n.text)}»</p>
        </div>
        <img class="lara-note__ava" src="${AVATAR}" alt="${escapeHtml(laraName())}">
    </div>`,
        )
        .join('');
}

/** Один проход по видимым сообщениям: добавить/обновить/убрать наши вставки. */
function decorate() {
    const c = ctx();
    const chat = c.chat;
    const els = document.querySelectorAll('#chat .mes[mesid]');
    if (!els.length || !Array.isArray(chat)) return;
    const s = settings();
    const byAnchor = new Map();
    if (c.getCurrentChatId?.()) {
        for (const n of chatState().comments) {
            const list = byAnchor.get(n.anchor) ?? [];
            list.push(n);
            byAnchor.set(n.anchor, list);
        }
    }
    for (const el of els) {
        const idx = Number(el.getAttribute('mesid'));
        const m = chat[idx];
        const block = el.querySelector(':scope > .mes_block') ?? el;

        // ремарка
        let card = block.querySelector(':scope > .lara-card');
        if (m?.extra?.lara?.kind === 'event') {
            const sig = hash(`${m.mes}|${m.extra.lara.kept}|${(m.extra.lara.kinds ?? []).join()}|${m.extra.lara.intensity}`);
            if (!card || card.dataset.sig !== sig) {
                const fresh = document.createElement('div');
                fresh.className = 'lara-card ld-root';
                fresh.dataset.sig = sig;
                fresh.innerHTML = cardHtml(m);
                if (card) card.replaceWith(fresh);
                else block.appendChild(fresh);
                card = fresh;
            }
        } else if (card) card.remove();

        // реплики на полях
        let notes = block.querySelector(':scope > .lara-notes');
        const list = m ? byAnchor.get(anchorOf(m)) : undefined;
        if (list?.length) {
            const sig = hash(list.map((n) => n.id + n.text).join('|') + s.commentsHidden);
            if (!notes || notes.dataset.sig !== sig) {
                const fresh = document.createElement('div');
                fresh.className = 'lara-notes ld-root';
                fresh.dataset.sig = sig;
                fresh.innerHTML = notesHtml(list);
                if (notes) notes.replaceWith(fresh);
                else block.appendChild(fresh);
                notes = fresh;
            }
        } else if (notes) notes.remove();
    }
}

let frame = 0;
export function scheduleRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        try {
            decorate();
        } catch (e) {
            console.error('[Lara Director] render', e);
        }
    });
}

async function onClick(e) {
    const btn = e.target instanceof Element ? e.target.closest('[data-lara-act]') : null;
    if (!btn) return;
    const mes = btn.closest('.mes[mesid]');
    if (!mes) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = Number(mes.getAttribute('mesid'));
    const act = btn.getAttribute('data-lara-act');
    if (act === 'unnote') {
        const id = btn.closest('[data-lara-note]')?.getAttribute('data-lara-note');
        if (id) removeComment(id);
        return;
    }
    if (act === 'keep') return keepEvent(idx);
    if (act === 'remove') return removeEvent(idx);
    if (act === 'again') {
        btn.disabled = true;
        btn.classList.add('is-busy');
        try {
            await rethrowEvent(idx);
        } finally {
            btn.disabled = false;
            btn.classList.remove('is-busy');
        }
    }
}

export function initRender() {
    document.addEventListener('click', onClick, true);
    // сообщения перерисовываются и в ST, и в Divinax — следим за чатом и возвращаем свои вставки
    const obs = new MutationObserver((records) => {
        for (const r of records) {
            const tgt = r.target;
            if (tgt instanceof Element && (tgt.id === 'chat' || tgt.closest?.('#chat'))) return scheduleRender();
            for (const n of r.addedNodes) if (n instanceof Element && (n.id === 'chat' || n.querySelector?.('#chat'))) return scheduleRender();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    onChange(scheduleRender);
    scheduleRender();
}
