// Панель настроек в «Расширениях» — по макету: портрет, четыре раздела, кнопки действий и шпаргалка команд.
import { DEFAULTS, EVENT_TYPES, INTENSITIES, TONES, saveSettings, settings } from './settings.js';
import { forgetScene, laraComment, onChange, setEnabled, statusInfo, syncPrompts, throwEvent } from './director.js';
import { hasProfileService, listProfiles } from './llm.js';
import { toneSample } from './prompt.js';
import { AVATAR, PORTRAIT } from './assets.js';
import { escapeHtml, intensityHint, intensityLabel, kindLabel, plural, t, talkLabel, toneHint, toneLabel } from './i18n.js';
import { refreshFab, toggleBox } from './box.js';

const ctx = () => SillyTavern.getContext();
const VERSION = '0.1.1';

const CORNER = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M1 21V7C1 3.7 3.7 1 7 1h14"/><path d="M5 21V10c0-2.8 2.2-5 5-5h11"/><circle cx="9.5" cy="9.5" r="1.4" fill="currentColor"/></svg>`;
const LOCK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="7" width="10" height="7"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>`;
const SPARK = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 1v4M9 13v4M1 9h4M13 9h4M3.5 3.5l2.5 2.5M12 12l2.5 2.5M3.5 14.5L6 12M12 6l2.5-2.5"/></svg>`;

const section = (num, title, lead) => `
    <div class="ld-sec"><span class="ld-sec__num">${num}</span><h2 class="ld-sec__title">${title}</h2><span class="ld-sec__line"></span></div>
    ${lead ? `<p class="ld-lead">${lead}</p>` : ''}`;

const range = (id, label, min, max, step = 1) => `
    <div class="ld-ctl">
        <div class="ld-ctl__top"><label for="${id}">${label}</label><span class="ld-val" data-val="${id}"></span></div>
        <input id="${id}" class="ld-range" type="range" min="${min}" max="${max}" step="${step}">
    </div>`;

const switchBtn = (id, label) => `<button type="button" id="${id}" class="ld-switch" role="switch" aria-label="${label}"><span></span></button>`;

function template() {
    return `
<div class="inline-drawer lara-drawer">
    <div class="inline-drawer-toggle inline-drawer-header lara-drawer__head">
        <img class="lara-drawer__ava" src="${AVATAR}" alt="">
        <b class="lara-drawer__name">Lara Director</b>
        <span class="lara-drawer__ver">v${VERSION}</span>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
    <div class="ld-root ld-settings">
        <div class="ld-hero">
            <div class="ld-hero__frame">
                <img src="${PORTRAIT}" alt="${t('Лара — режиссёр')}">
                <div class="ld-hero__shade"></div>
                <div class="ld-hero__text">
                    <div class="ld-eyebrow">${t('Режиссёр сцены')}</div>
                    <h1>Lara<br>Director</h1>
                    <p>${t('«Я не трогаю ваших персонажей. Я только переставляю свечи — и смотрю, что вы сделаете в темноте».')}</p>
                </div>
            </div>
            ${['tl', 'tr', 'bl', 'br'].map((p) => `<span class="ld-corner ld-corner--${p}">${CORNER}</span>`).join('')}
        </div>

        <div class="ld-presence">
            <div class="ld-presence__text">
                <div class="ld-presence__title">${t('Режиссёр в зале')}</div>
                <div class="ld-presence__status"><span class="lara-dot"></span><span data-ld="status"></span></div>
            </div>
            ${switchBtn('ld-enabled', t('Включить режиссёра'))}
        </div>

        ${section('I', t('Модель режиссёра'), t('Лара работает на отдельной модели: она читает сцену, но пишет не в неё, а поверх.'))}
        <div class="ld-group">
            <div class="ld-ctl">
                <label for="ld-source">${t('Подключение')}</label>
                <select id="ld-source" class="ld-field">
                    <option value="profile">${t('Отдельный профиль подключения')}</option>
                    <option value="custom">${t('Свой адрес API (OpenAI-совместимый)')}</option>
                    <option value="main">${t('Как в основном чате')}</option>
                </select>
                <span class="ld-note" data-ld="source-note"></span>
            </div>
            <div class="ld-ctl" data-show="profile">
                <label for="ld-profile">${t('Профиль')}</label>
                <div class="ld-inline">
                    <select id="ld-profile" class="ld-field"></select>
                    <button type="button" class="ld-btn ld-icon ld-icon--framed" data-ld="refresh-profiles" title="${t('Обновить список')}" aria-label="${t('Обновить список')}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5"/></svg></button>
                </div>
            </div>
            <div class="ld-ctl" data-show="custom">
                <label for="ld-url">${t('Адрес API')}</label>
                <input id="ld-url" class="ld-field" type="url" placeholder="https://openrouter.ai/api/v1" autocomplete="off">
            </div>
            <div class="ld-ctl" data-show="custom">
                <label for="ld-key">${t('Ключ API')}</label>
                <input id="ld-key" class="ld-field" type="password" placeholder="sk-…" autocomplete="off">
                <span class="ld-note">${t('Ключ хранится в настройках расширений на этом устройстве/сервере.')}</span>
            </div>
            <div class="ld-ctl" data-show="profile custom">
                <label for="ld-model">${t('Модель')}</label>
                <input id="ld-model" class="ld-field" type="text" autocomplete="off">
            </div>
            ${range('ld-ctx', t('Сколько сцены видит'), 4, 60)}
        </div>

        ${section('II', t('События'), t('Что Лара может подбросить в сцену. Реагируют на это только персонажи — сама она за них не решает.'))}
        <div class="ld-group ld-group--wide">
            ${range('ld-freq', t('Как часто задумываться'), 2, 30)}
            ${range('ld-chance', t('Шанс, что вмешается'), 0, 100, 5)}
            <div class="ld-ctl">
                <span class="ld-label">${t('Сила вмешательства')}</span>
                <div class="ld-seg" data-seg="intensity">${INTENSITIES.map((id) => `<button type="button" class="ld-seg__btn" data-id="${id}"><b>${intensityLabel(id)}</b><small>${intensityHint(id)}</small></button>`).join('')}</div>
            </div>
            <div class="ld-ctl">
                <span class="ld-label">${t('Что может случиться')}</span>
                <div class="ld-chips">${EVENT_TYPES.map((id) => `<button type="button" class="ld-chip" data-type="${id}">${kindLabel(id)}</button>`).join('')}</div>
            </div>
            <div class="ld-ctl">
                <label for="ld-delivery">${t('Как подавать событие')}</label>
                <select id="ld-delivery" class="ld-field">
                    <option value="remark">${t('Ремаркой в чате')}</option>
                    <option value="hidden">${t('Скрытой подсказкой в промпт')}</option>
                    <option value="confirm">${t('Сначала показать мне')}</option>
                </select>
                <span class="ld-note" data-ld="delivery-note"></span>
            </div>
        </div>

        ${section('III', t('Голос Лары'), t('Иногда она комментирует происходящее — на полях, как зритель из ложи.'))}
        <div class="ld-group ld-group--wide">
            <div class="ld-row"><span class="ld-row__label">${t('Комментарии на полях')}</span>${switchBtn('ld-comments', t('Комментарии на полях'))}</div>
            ${range('ld-talk', t('Разговорчивость'), 0, 4)}
            <div class="ld-ctl">
                <span class="ld-label">${t('Тон')}</span>
                <div class="ld-seg" data-seg="tone">${TONES.map((id) => `<button type="button" class="ld-seg__btn" data-id="${id}"><b>${toneLabel(id)}</b><small>${toneHint(id)}</small></button>`).join('')}</div>
            </div>
            <div class="ld-sample"><img src="${AVATAR}" alt=""><p data-ld="sample"></p></div>
            <label class="ld-check">
                <input id="ld-hidden" type="checkbox">
                <span><b>${t('Не пускать комментарии в контекст')}</b><small>${t('Персонажи не слышат Лару. Её реплики видите только вы.')}</small></span>
            </label>
        </div>

        ${section('IV', t('Границы'))}
        <div class="ld-group">
            <div class="ld-lock">${LOCK}<span>${t('Не говорит и не действует за персонажей и за вас')}</span></div>
            <div class="ld-lock">${LOCK}<span>${t('Не отменяет того, что уже случилось в сцене')}</span></div>
            <div class="ld-ctl ld-ctl--gap">
                <label for="ld-taboo">${t('Чего Ларе нельзя')}</label>
                <textarea id="ld-taboo" class="ld-field" placeholder="${t('Например: без смертей, без новых романтических линий')}"></textarea>
            </div>
            <details class="ld-more">
                <summary>${t('Тонкая настройка')}</summary>
                <div class="ld-group ld-group--flat">
                    ${range('ld-tokens', t('Длина ответа Лары, токенов'), 200, 2000, 50)}
                    <div class="ld-ctl">
                        <label for="ld-extra">${t('Дополнительные указания Ларе')}</label>
                        <textarea id="ld-extra" class="ld-field" placeholder="${t('Например: мир — киберпанк, события должны быть связаны с корпорацией')}"></textarea>
                    </div>
                    <label class="ld-check">
                        <input id="ld-fab" type="checkbox">
                        <span><b>${t('Кнопка Лары поверх чата')}</b><small>${t('Открывает ложу режиссёра. Кнопку можно перетащить.')}</small></span>
                    </label>
                    <button type="button" class="ld-btn ld-ghost" data-ld="reset-fab">${t('Вернуть кнопку на место')}</button>
                </div>
            </details>
        </div>

        <div class="ld-actions">
            <div class="ld-ornament"><span></span><svg width="40" height="12" viewBox="0 0 40 12" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M2 6h12M26 6h12"/><path d="M20 1l5 5-5 5-5-5z"/></svg><span></span></div>
            <button type="button" class="ld-btn ld-primary" data-ld="throw">${SPARK}<span>${t('Подбросить событие')}</span></button>
            <div class="ld-pair">
                <button type="button" class="ld-btn ld-ghost" data-ld="ask">${t('Спросить Лару')}</button>
                <button type="button" class="ld-btn ld-ghost ld-ghost--dim" data-ld="forget">${t('Забыть сцену')}</button>
            </div>
            <button type="button" class="ld-btn ld-ghost ld-ghost--dim" data-ld="box">${t('Открыть ложу режиссёра')}</button>
            <div class="ld-cheats">
                <div><code>/director event</code><span>— ${t('событие сейчас')}</span></div>
                <div><code>/lara</code><span>— ${t('спросить мнение')}</span></div>
                <div><code>/director pause</code><span>— ${t('тишина до конца сцены')}</span></div>
                <div><code>/director resume</code><span>— ${t('вернуть Лару')}</span></div>
            </div>
        </div>
    </div>
    </div>
</div>`;
}

let root;
const $ = (sel) => root.querySelector(sel);

function fillProfiles() {
    const s = settings();
    const sel = $('#ld-profile');
    const list = listProfiles();
    const opts = list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.model ? ` · ${escapeHtml(p.model)}` : ''}</option>`);
    if (!list.length) opts.unshift(`<option value="">${t('— профилей нет —')}</option>`);
    else if (!list.some((p) => p.id === s.profileId)) opts.unshift(`<option value="">${t('— выберите профиль —')}</option>`);
    sel.innerHTML = opts.join('');
    sel.value = list.some((p) => p.id === s.profileId) ? s.profileId : '';
}

const deliveryNote = {
    remark: () => t('Ремарка видна в чате и уходит в контекст персонажей, как часть мира.'),
    hidden: () => t('Событие не появится в чате: оно тайно подсказывается модели персонажа на один ответ.'),
    confirm: () => t('Перед выходом Лара покажет событие вам — можно поправить или отказаться.'),
};

function sourceNote(s) {
    if (s.source === 'main') return t('Тот же API и модель, что у персонажей, но отдельный запрос без их промпта.');
    if (s.source === 'custom') return t('Лара обращается к своему API напрямую из браузера. Нужен адрес с поддержкой CORS, например OpenRouter.');
    if (!hasProfileService()) return t('Профили недоступны: включите встроенное расширение Connection Manager.');
    if (!listProfiles().length) return t('Создайте профиль подключения (значок вилки в SillyTavern, «Профили подключений» в Divinax) и выберите его здесь.');
    return t('Лара берёт API, модель и пресет из профиля. Модель можно переопределить ниже.');
}

/** Переносит настройки в элементы панели. */
function render() {
    if (!root) return;
    const s = settings();
    const set = (id, v) => {
        const el = $(`#${id}`);
        if (el && document.activeElement !== el) el.value = v;
    };
    // присутствие
    const st = statusInfo();
    root.querySelector('.ld-presence').dataset.state = st.key;
    $('[data-ld="status"]').textContent = st.text;
    $('#ld-enabled').setAttribute('aria-checked', String(s.enabled));
    // модель
    set('ld-source', s.source);
    root.querySelectorAll('[data-show]').forEach((el) => (el.hidden = !el.dataset.show.split(' ').includes(s.source)));
    $('[data-ld="source-note"]').textContent = sourceNote(s);
    set('ld-url', s.customUrl);
    set('ld-key', s.customKey);
    set('ld-model', s.model);
    $('#ld-model').placeholder = s.source === 'profile' ? t('Как в профиле') : t('Название модели');
    set('ld-ctx', s.contextSize);
    $('[data-val="ld-ctx"]').textContent = plural(s.contextSize, t('сообщение'), t('сообщения'), t('сообщений'));
    // события
    set('ld-freq', s.frequency);
    $('[data-val="ld-freq"]').textContent = t('раз в {0}', plural(s.frequency, t('сообщение'), t('сообщения'), t('сообщений')));
    set('ld-chance', s.chance);
    $('[data-val="ld-chance"]').textContent = `${s.chance}%`;
    root.querySelectorAll('[data-seg="intensity"] .ld-seg__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === s.intensity)));
    root.querySelectorAll('.ld-chip').forEach((b) => b.setAttribute('aria-pressed', String(Boolean(s.types[b.dataset.type]))));
    set('ld-delivery', s.delivery);
    $('[data-ld="delivery-note"]').textContent = (deliveryNote[s.delivery] ?? deliveryNote.remark)();
    // голос
    $('#ld-comments').setAttribute('aria-checked', String(s.comments));
    set('ld-talk', s.talk);
    $('[data-val="ld-talk"]').textContent = talkLabel(s.talk);
    root.querySelectorAll('[data-seg="tone"] .ld-seg__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === s.tone)));
    $('[data-ld="sample"]').textContent = `«${toneSample(s.tone)}»`;
    $('#ld-hidden').checked = s.commentsHidden;
    // границы и тонкая настройка
    set('ld-taboo', s.taboo);
    set('ld-tokens', s.maxTokens);
    $('[data-val="ld-tokens"]').textContent = String(s.maxTokens);
    set('ld-extra', s.extraPrompt);
    $('#ld-fab').checked = s.showButton;
}

function commit(fn) {
    fn(settings());
    saveSettings();
    render();
    refreshFab();
}

function bind() {
    const num = (id, key) =>
        $(`#${id}`).addEventListener('input', (e) => commit((s) => (s[key] = Number(e.target.value))));
    const text = (id, key) =>
        $(`#${id}`).addEventListener('input', (e) => {
            settings()[key] = e.target.value;
            saveSettings();
        });

    $('#ld-enabled').addEventListener('click', () => {
        setEnabled(!settings().enabled);
        saveSettings();
        render();
    });
    $('#ld-source').addEventListener('change', (e) => commit((s) => (s.source = e.target.value)));
    $('#ld-profile').addEventListener('change', (e) => commit((s) => (s.profileId = e.target.value)));
    $('[data-ld="refresh-profiles"]').addEventListener('click', () => {
        fillProfiles();
        render();
    });
    text('ld-url', 'customUrl');
    text('ld-key', 'customKey');
    text('ld-model', 'model');
    num('ld-ctx', 'contextSize');
    num('ld-freq', 'frequency');
    num('ld-chance', 'chance');
    num('ld-talk', 'talk');
    num('ld-tokens', 'maxTokens');
    root.querySelectorAll('[data-seg] .ld-seg__btn').forEach((b) =>
        b.addEventListener('click', () => commit((s) => (s[b.parentElement.dataset.seg] = b.dataset.id))),
    );
    root.querySelectorAll('.ld-chip').forEach((b) =>
        b.addEventListener('click', () =>
            commit((s) => {
                const next = { ...s.types, [b.dataset.type]: !s.types[b.dataset.type] };
                // хотя бы один вид событий должен остаться
                if (Object.values(next).some(Boolean)) s.types = next;
            }),
        ),
    );
    $('#ld-delivery').addEventListener('change', (e) => commit((s) => (s.delivery = e.target.value)));
    $('#ld-comments').addEventListener('click', () =>
        commit((s) => {
            s.comments = !s.comments;
        }),
    );
    $('#ld-hidden').addEventListener('change', (e) => {
        commit((s) => (s.commentsHidden = e.target.checked));
        syncPrompts();
    });
    text('ld-taboo', 'taboo');
    text('ld-extra', 'extraPrompt');
    $('#ld-fab').addEventListener('change', (e) => commit((s) => (s.showButton = e.target.checked)));
    $('[data-ld="reset-fab"]').addEventListener('click', () => commit((s) => (s.buttonPos = DEFAULTS.buttonPos)));

    $('[data-ld="throw"]').addEventListener('click', () => void throwEvent());
    $('[data-ld="ask"]').addEventListener('click', () => void askLara());
    $('[data-ld="forget"]').addEventListener('click', async () => {
        const c = ctx();
        const ok = await c.callGenericPopup(
            `<h3>${escapeHtml(t('Забыть сцену?'))}</h3><p>${escapeHtml(t('Лара забудет заготовки, шёпот, темп и уже брошенные события этого чата. Ремарки и реплики в чате останутся.'))}</p>`,
            c.POPUP_TYPE?.CONFIRM ?? 2,
        );
        if (ok) forgetScene();
    });
    $('[data-ld="box"]').addEventListener('click', () => toggleBox(true));
}

/** «Спросить Лару»: вопрос можно не задавать — тогда она просто выскажется о сцене. */
export async function askLara() {
    const c = ctx();
    const q = await c.callGenericPopup(
        `<h3>${escapeHtml(t('Спросить Лару'))}</h3><p>${escapeHtml(t('О чём спросить? Можно оставить пустым — тогда Лара просто скажет, что думает о сцене.'))}</p>`,
        c.POPUP_TYPE?.INPUT ?? 3,
        '',
        { okButton: t('Спросить'), cancelButton: t('Отмена'), rows: 2 },
    );
    if (q === null || q === false || q === undefined) return;
    await laraComment({ question: String(q).trim() });
}

export function mountPanel() {
    const host = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
    if (!host) {
        console.warn('[Lara Director] не найден #extensions_settings — панель настроек не добавлена');
        return;
    }
    root = document.createElement('div');
    root.id = 'lara_director_settings';
    root.className = 'lara-director-settings';
    root.innerHTML = template();
    host.appendChild(root);
    fillProfiles();
    bind();
    render();
    onChange(render);
    // список профилей мог измениться, пока панель была закрыта
    root.querySelector('.inline-drawer-toggle').addEventListener('click', () => {
        fillProfiles();
        render();
    });
}
