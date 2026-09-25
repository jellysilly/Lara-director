// Настройки расширения (общие для всех чатов) и состояние Лары в конкретном чате.

export const MODULE = 'lara_director';

export const EVENT_TYPES = ['weather', 'stranger', 'find', 'trouble', 'rumor', 'twist'];
export const INTENSITIES = ['whisper', 'turn', 'storm'];
export const TONES = ['dry', 'sharp', 'soft'];
export const DELIVERY = ['remark', 'hidden', 'confirm'];
/** Вероятность реплики на полях после ответа персонажа — по ступеням «Разговорчивости». */
export const TALK_CHANCE = [0, 0.12, 0.25, 0.45, 0.75];

export const DEFAULTS = Object.freeze({
    enabled: true,
    // модель режиссёра
    source: 'profile', // profile | main | custom
    profileId: '',
    model: '',
    customUrl: 'https://openrouter.ai/api/v1',
    customKey: '',
    maxTokens: 700,
    contextSize: 20,
    // события
    frequency: 8,
    chance: 35,
    intensity: 'turn',
    types: { weather: true, stranger: true, find: false, trouble: true, rumor: false, twist: false },
    delivery: 'remark',
    // голос
    comments: true,
    talk: 1,
    tone: 'dry',
    commentsHidden: true,
    // границы
    taboo: '',
    extraPrompt: '',
    // интерфейс
    showButton: true,
    buttonPos: null, // { right, bottom } в px
});

const ctx = () => SillyTavern.getContext();

export function settings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE] || typeof es[MODULE] !== 'object') es[MODULE] = structuredClone(DEFAULTS);
    const s = es[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) s[k] = structuredClone(v);
    }
    s.types = { ...DEFAULTS.types, ...(s.types ?? {}) };
    return s;
}

export function saveSettings() {
    ctx().saveSettingsDebounced();
}

// ── Состояние в чате (chat_metadata) ──

const EMPTY_STATE = {
    counter: 0, // сообщений с последнего «хода»
    paused: false, // «тишина до конца сцены»
    tempo: 1, // 0 — затишье … 4 — буря
    tempoLabel: '',
    place: '',
    sleeve: [], // заготовки «в рукаве»
    whispers: [], // подсказки зрителя
    history: [], // что уже подбрасывала: { text, types, via, date }
    comments: [], // реплики на полях: { id, anchor, text, question?, date }
    hint: null, // скрытая подсказка, ждущая ответа персонажа: { text, date }
};

/** Состояние Лары для текущего чата. Без открытого чата — временный объект. */
export function chatState() {
    const meta = ctx().chatMetadata;
    if (!meta || typeof meta !== 'object') return structuredClone(EMPTY_STATE);
    if (!meta[MODULE] || typeof meta[MODULE] !== 'object') meta[MODULE] = structuredClone(EMPTY_STATE);
    const st = meta[MODULE];
    for (const [k, v] of Object.entries(EMPTY_STATE)) {
        if (st[k] === undefined) st[k] = structuredClone(v);
    }
    return st;
}

export function resetChatState() {
    const meta = ctx().chatMetadata;
    if (meta && typeof meta === 'object') meta[MODULE] = structuredClone(EMPTY_STATE);
    saveChatState();
}

export function saveChatState() {
    const c = ctx();
    if (!c.getCurrentChatId?.()) return;
    (c.saveMetadataDebounced ?? c.saveMetadata)?.call(c);
}
