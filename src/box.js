// «Ложа режиссёра»: плавающая кнопка с Ларой и панель с темпом сцены, заготовками и шёпотом.
import { chatState, saveSettings, settings } from './settings.js';
import { nextMoveText, onChange, runtime, statusInfo, throwEvent, throwFromSleeve, whisper } from './director.js';
import { AVATAR, PORTRAIT } from './assets.js';
import { escapeHtml, t, tempoWord } from './i18n.js';

const ctx = () => SillyTavern.getContext();

const CORNER = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M1 21V7C1 3.7 3.7 1 7 1h14"/><path d="M5 21V10c0-2.8 2.2-5 5-5h11"/><circle cx="9.5" cy="9.5" r="1.4" fill="currentColor"/></svg>`;
const corners = () => ['tl', 'tr', 'bl', 'br'].map((p) => `<span class="ld-corner ld-corner--${p}">${CORNER}</span>`).join('');

let layer;
let fab;
let box;
let collapsed = false;

/**
 * Слой размером с экран для кнопки и ложи. Сами они позиционируются внутри него (absolute), а не fixed:
 * мобильная вёрстка SillyTavern задаёт html transform при нулевой высоте, и fixed-элементы
 * отсчитываются от невидимого html — уезжают за верх экрана.
 */
function ensureLayer() {
    if (layer?.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = 'lara-layer';
    layer.className = 'lara-layer';
    document.body.appendChild(layer);
    return layer;
}

const layerSize = () => {
    const r = ensureLayer().getBoundingClientRect();
    return { w: r.width || innerWidth, h: r.height || innerHeight };
};

export function isBoxOpen() {
    return Boolean(box && !box.hidden);
}

export function toggleBox(force) {
    if (!box) return;
    const open = force ?? box.hidden;
    box.hidden = !open;
    if (open) {
        collapsed = false;
        box.classList.remove('is-collapsed');
        renderBox();
    }
    renderFab();
}

function renderFab() {
    if (!fab) return;
    const s = settings();
    fab.hidden = !s.showButton || isBoxOpen();
    const st = statusInfo();
    fab.dataset.state = st.key;
    fab.querySelector('.lara-fab__label').textContent = st.word;
    fab.querySelector('button').title = `${t('Ложа режиссёра')} — ${st.text}`;
    // сохранённое место могло оказаться за экраном (поворот телефона, другое окно) — возвращаем в видимую область
    const pos = s.buttonPos;
    const { w, h } = layerSize();
    const fw = fab.offsetWidth || 64;
    const fh = fab.offsetHeight || 64;
    const clamp = (v, max) => Math.max(4, Math.min(Math.max(4, max), v));
    fab.style.right = `${clamp(pos?.right ?? 16, w - fw - 4)}px`;
    fab.style.bottom = `${clamp(pos?.bottom ?? 120, h - fh - 4)}px`;
}

function tempoBars(tempo) {
    return Array.from({ length: 5 }, (_, i) => `<span class="${i < tempo ? 'on' : i === tempo ? 'now' : ''}"></span>`).join('');
}

function moveCells() {
    const s = settings();
    const counter = chatState().counter;
    const n = Math.min(s.frequency, 16);
    const filled = Math.round((Math.min(counter, s.frequency) / s.frequency) * n);
    return Array.from({ length: n }, (_, i) => `<span class="${i < filled ? 'on' : ''}"></span>`).join('');
}

export function renderBox() {
    if (!box || box.hidden) return;
    const s = settings();
    const hasChat = Boolean(ctx().getCurrentChatId?.());
    const st = hasChat ? chatState() : null;
    const info = statusInfo();
    box.dataset.state = info.key;
    box.querySelector('.lara-box__status').textContent = info.key === 'watch' ? t('Наблюдает') : info.text;
    box.querySelector('.lara-box__place').textContent = st?.place ?? '';
    const body = box.querySelector('.lara-box__body');
    if (!hasChat) {
        body.innerHTML = `<p class="lara-box__empty">${t('Откройте чат — Лара сядет в ложу и начнёт смотреть.')}</p>`;
    } else {
        const sleeve = st.sleeve.length
            ? st.sleeve
                .map(
                    (x, i) => `<div class="lara-sleeve"><span>${escapeHtml(x)}</span><button type="button" class="ld-btn lara-sleeve__throw" data-sleeve="${i}">${t('Бросить')}</button></div>`,
                )
                .join('')
            : `<p class="lara-box__empty">${t('Пока пусто: Лара присматривается к сцене.')}</p>`;
        const hint = st.hint
            ? `<div class="lara-box__group"><span class="lara-box__cap">${t('Ждёт ответа персонажа')}</span><div class="lara-box__hint">${escapeHtml(st.hint.text)}</div></div>`
            : '';
        const whispers = st.whispers.length
            ? `<div class="lara-box__group"><span class="lara-box__cap">${t('Вы шепнули')}</span>${st.whispers.map((w) => `<div class="lara-box__whisper">${escapeHtml(w)}</div>`).join('')}</div>`
            : '';
        const err = runtime.lastError ? `<div class="lara-box__error">${escapeHtml(runtime.lastError)}</div>` : '';
        body.innerHTML = `
            <div class="lara-box__group">
                <div class="lara-box__row"><span class="lara-box__cap">${t('Темп сцены')}</span><span class="lara-box__val">${escapeHtml(st.tempoLabel || tempoWord(st.tempo))}</span></div>
                <div class="lara-tempo">${tempoBars(st.tempo)}</div>
                <div class="lara-box__row lara-box__ends"><span>${t('затишье')}</span><span>${t('буря')}</span></div>
            </div>
            <div class="lara-box__group">
                <div class="lara-box__row"><span class="lara-box__cap">${t('Следующий ход')}</span><span class="lara-box__val">${escapeHtml(st.paused ? t('пауза') : s.enabled ? nextMoveText() : t('Лара ушла из зала'))}</span></div>
                <div class="lara-cells" style="grid-template-columns:repeat(${Math.min(s.frequency, 16)},minmax(0,1fr))">${moveCells()}</div>
            </div>
            ${hint}
            <div class="lara-box__group"><span class="lara-box__cap">${t('В рукаве')}</span>${sleeve}</div>
            ${whispers}
            ${err}`;
    }
    const throwBtn = box.querySelector('.lara-box__throw');
    throwBtn.disabled = runtime.busy || !hasChat;
    throwBtn.textContent = runtime.busy ? t('Лара думает…') : t('Подбросить сейчас');
}

function makeDraggable(el, handle, onTap) {
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const r = el.getBoundingClientRect();
        const l = ensureLayer().getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, right: l.right - r.right, bottom: l.bottom - r.bottom, moved: false };
        handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true;
        const { w, h } = layerSize();
        const right = Math.max(4, Math.min(w - el.offsetWidth - 4, start.right - dx));
        const bottom = Math.max(4, Math.min(h - el.offsetHeight - 4, start.bottom - dy));
        el.style.right = `${right}px`;
        el.style.bottom = `${bottom}px`;
    });
    const end = () => {
        if (!start) return;
        const moved = start.moved;
        start = null;
        if (moved) {
            settings().buttonPos = { right: parseInt(el.style.right, 10), bottom: parseInt(el.style.bottom, 10) };
            saveSettings();
        } else onTap();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', () => (start = null));
    // клавиатура: pointer-событий нет, срабатывает click
    handle.addEventListener('click', (e) => {
        if (e.detail === 0) onTap();
    });
}

export function mountBox() {
    fab = document.createElement('div');
    fab.id = 'lara-fab';
    fab.className = 'ld-root lara-fab';
    fab.innerHTML = `<button type="button" class="lara-fab__btn" aria-label="${t('Открыть ложу режиссёра')}"><img src="${AVATAR}" alt="" draggable="false"></button><span class="lara-fab__label"></span>`;
    ensureLayer().appendChild(fab);
    makeDraggable(fab, fab.querySelector('button'), () => toggleBox(true));

    box = document.createElement('section');
    box.id = 'lara-box';
    box.className = 'ld-root lara-box';
    box.hidden = true;
    box.setAttribute('aria-label', t('Ложа режиссёра'));
    box.innerHTML = `
        <div class="lara-box__inner">
            <div class="lara-box__head">
                <span class="lara-box__title">${t('Ложа режиссёра')}</span>
                <button type="button" class="ld-btn ld-icon" data-box="collapse" aria-label="${t('Свернуть')}" title="${t('Свернуть')}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10"/></svg></button>
                <button type="button" class="ld-btn ld-icon" data-box="close" aria-label="${t('Закрыть')}" title="${t('Закрыть')}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
            </div>
            <div class="lara-box__main">
                <div class="lara-box__portrait">
                    <img src="${PORTRAIT}" alt="${t('Лара')}">
                    <div class="lara-box__shade"></div>
                    <div class="lara-box__state"><span class="lara-dot"></span><span class="lara-box__status"></span><span class="lara-box__place"></span></div>
                </div>
                <div class="lara-box__body"></div>
                <div class="lara-box__foot">
                    <form class="lara-box__whisperform">
                        <label class="ld-sr" for="lara-whisper">${t('Подсказка для Лары')}</label>
                        <input id="lara-whisper" class="ld-field" type="text" autocomplete="off" placeholder="${t('Шепнуть Ларе идею…')}">
                        <button type="submit" class="ld-btn ld-icon ld-icon--framed" aria-label="${t('Шепнуть')}" title="${t('Шепнуть')}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10l14-7-5 14-2-6z"/></svg></button>
                    </form>
                    <button type="button" class="ld-btn ld-primary lara-box__throw">${t('Подбросить сейчас')}</button>
                </div>
            </div>
        </div>
        ${corners()}`;
    ensureLayer().appendChild(box);

    box.addEventListener('click', (e) => {
        const b = e.target instanceof Element ? e.target.closest('button') : null;
        if (!b) return;
        if (b.dataset.box === 'close') toggleBox(false);
        else if (b.dataset.box === 'collapse') {
            collapsed = !collapsed;
            box.classList.toggle('is-collapsed', collapsed);
        } else if (b.dataset.sleeve !== undefined) void throwFromSleeve(Number(b.dataset.sleeve));
        else if (b.classList.contains('lara-box__throw')) void throwEvent();
    });
    box.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = box.querySelector('#lara-whisper');
        whisper(input.value);
        input.value = '';
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isBoxOpen() && box.contains(document.activeElement)) toggleBox(false);
    });

    onChange(() => {
        renderFab();
        renderBox();
    });
    window.addEventListener('resize', renderFab);
    renderFab();
}

export function refreshFab() {
    renderFab();
}
