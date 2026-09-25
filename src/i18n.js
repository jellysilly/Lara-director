// Строки интерфейса: русский — основной (ключи), английский — перевод.

let lang = 'ru';

export function initLocale() {
    let loc = '';
    try {
        loc = String(SillyTavern.getContext().getCurrentLocale?.() ?? '');
    } catch { /* нет контекста */ }
    if (!loc) loc = String(localStorage.getItem('language') ?? navigator.language ?? 'en');
    lang = /^(ru|uk|be|kk)/i.test(loc) ? 'ru' : 'en';
}

export const isRu = () => lang === 'ru';

/** t('Текст {0}', x) — перевод с подстановкой. */
export function t(s, ...args) {
    let out = lang === 'ru' ? s : (EN[s] ?? s);
    args.forEach((v, i) => (out = out.replaceAll(`{${i}}`, String(v))));
    return out;
}

/** «5 сообщений» / «5 messages». Формы передаются уже переведёнными. */
export function plural(n, one, few, many) {
    if (lang !== 'ru') return `${n} ${n === 1 ? one : many}`;
    const a = Math.abs(n) % 100;
    const b = a % 10;
    const form = a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
    return `${n} ${form}`;
}

export const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const laraName = () => t('Лара');

const KIND = { weather: 'Погода и свет', stranger: 'Незнакомец', find: 'Находка', trouble: 'Осложнение', rumor: 'Слух', twist: 'Поворот сюжета' };
const INTENSITY = { whisper: ['Шёпот', 'детали, фон'], turn: ['Поворот', 'новый повод'], storm: ['Гроза', 'встряска'] };
const TONE = { dry: ['Сухо', 'по делу'], sharp: ['Колко', 'с иронией'], soft: ['Тепло', 'бережно'] };
const TALK = ['молчит', 'изредка', 'иногда', 'часто', 'без умолку'];
const TEMPO = ['затишье', 'спокойно', 'нарастает', 'напряжённо', 'буря'];

export const kindLabel = (id) => (KIND[id] ? t(KIND[id]) : '');
export const intensityLabel = (id) => (INTENSITY[id] ? t(INTENSITY[id][0]) : '');
export const intensityHint = (id) => (INTENSITY[id] ? t(INTENSITY[id][1]) : '');
export const toneLabel = (id) => (TONE[id] ? t(TONE[id][0]) : '');
export const toneHint = (id) => (TONE[id] ? t(TONE[id][1]) : '');
export const talkLabel = (n) => t(TALK[n] ?? TALK[1]);
export const tempoWord = (n) => t(TEMPO[n] ?? TEMPO[1]);

const EN = {
    'Лара': 'Lara',
    // события и голос
    'Погода и свет': 'Weather & light',
    'Незнакомец': 'Stranger',
    'Находка': 'Discovery',
    'Осложнение': 'Complication',
    'Слух': 'Rumour',
    'Поворот сюжета': 'Plot twist',
    'Шёпот': 'Whisper',
    'детали, фон': 'details, backdrop',
    'Поворот': 'Turn',
    'новый повод': 'a new hook',
    'Гроза': 'Storm',
    'встряска': 'a shake-up',
    'Сухо': 'Dry',
    'по делу': 'to the point',
    'Колко': 'Sharp',
    'с иронией': 'ironic',
    'Тепло': 'Warm',
    'бережно': 'gentle',
    'молчит': 'silent',
    'изредка': 'rarely',
    'иногда': 'sometimes',
    'часто': 'often',
    'без умолку': 'nonstop',
    'затишье': 'lull',
    'спокойно': 'calm',
    'нарастает': 'rising',
    'напряжённо': 'tense',
    'буря': 'storm',
    'сообщение': 'message',
    'сообщения': 'messages',
    'сообщений': 'messages',
    // статус
    'Ушла из зала': 'Left the theatre',
    'ушла': 'away',
    'Думает…': 'Thinking…',
    'думает': 'thinking',
    'Ждёт начала сцены': 'Waiting for a scene',
    'ждёт': 'waiting',
    'Тишина до конца сцены': 'Silent until the scene ends',
    'пауза': 'paused',
    'Наблюдает': 'Watching',
    'наблюдает': 'watching',
    'ход на вашей следующей реплике': 'moves on your next message',
    'следующий ход через ~{0}': 'next move in ~{0}',
    'раз в {0}': 'every {0}',
    // сообщения и ошибки
    'Лара не ответила за {0} с': 'Lara did not answer within {0} s',
    'Лара не смогла: {0}': 'Lara failed: {0}',
    'Профили подключений недоступны — включите Connection Manager или выберите другое подключение': 'Connection profiles are unavailable — enable Connection Manager or pick another connection',
    'Выберите профиль подключения для Лары': 'Choose a connection profile for Lara',
    'Укажите адрес API для Лары': 'Enter an API URL for Lara',
    'Укажите модель для Лары': 'Enter a model for Lara',
    'Лара уже думает': 'Lara is already thinking',
    'Сначала откройте чат': 'Open a chat first',
    'Лара промолчала — попробуйте ещё раз': 'Lara kept silent — try again',
    'Скрытая подсказка ждёт ответа персонажа': 'The hidden hint waits for the next character reply',
    'Лара предлагает событие': 'Lara suggests an event',
    'Можно поправить текст. «Выпустить» — событие уйдёт в сцену, «Отказаться» — Лара промолчит.': 'You can edit the text. “Release” sends the event into the scene, “Decline” keeps Lara silent.',
    'Выпустить': 'Release',
    'Отказаться': 'Decline',
    'Лара услышала. Использует, когда придёт время.': 'Lara heard you. She will use it when the time comes.',
    // чат
    'Оставить': 'Keep',
    'Переиграть': 'Replay',
    'Убрать': 'Remove',
    'Ремарка режиссёра': 'Director’s note',
    'Подбросила {0}': 'Thrown in by {0}',
    '{0} · на полях': '{0} · in the margins',
    'персонажи не слышат': 'characters can’t hear',
    'персонажи слышат': 'characters can hear',
    'Убрать реплику': 'Remove remark',
    // ложа
    'Ложа режиссёра': 'Director’s box',
    'Открыть ложу режиссёра': 'Open the director’s box',
    'Свернуть': 'Collapse',
    'Закрыть': 'Close',
    'Подсказка для Лары': 'Hint for Lara',
    'Шепнуть Ларе идею…': 'Whisper an idea to Lara…',
    'Шепнуть': 'Whisper',
    'Подбросить сейчас': 'Throw it now',
    'Лара думает…': 'Lara is thinking…',
    'Откройте чат — Лара сядет в ложу и начнёт смотреть.': 'Open a chat — Lara will take her seat and start watching.',
    'Бросить': 'Throw',
    'Пока пусто: Лара присматривается к сцене.': 'Nothing yet: Lara is still sizing up the scene.',
    'Ждёт ответа персонажа': 'Waiting for a character reply',
    'Вы шепнули': 'You whispered',
    'Темп сцены': 'Scene tempo',
    'Следующий ход': 'Next move',
    'Лара ушла из зала': 'Lara has left the theatre',
    'В рукаве': 'Up her sleeve',
    // настройки
    'Лара — режиссёр': 'Lara, the director',
    'Режиссёр сцены': 'Scene director',
    '«Я не трогаю ваших персонажей. Я только переставляю свечи — и смотрю, что вы сделаете в темноте».': '“I never touch your characters. I only move the candles — and watch what you do in the dark.”',
    'Режиссёр в зале': 'Director in the house',
    'Включить режиссёра': 'Enable the director',
    'Модель режиссёра': 'Director’s model',
    'Лара работает на отдельной модели: она читает сцену, но пишет не в неё, а поверх.': 'Lara runs on a separate model: she reads the scene but writes on top of it, not inside it.',
    'Подключение': 'Connection',
    'Отдельный профиль подключения': 'Separate connection profile',
    'Свой адрес API (OpenAI-совместимый)': 'Own API URL (OpenAI-compatible)',
    'Как в основном чате': 'Same as the main chat',
    'Профиль': 'Profile',
    'Обновить список': 'Refresh list',
    'Адрес API': 'API URL',
    'Ключ API': 'API key',
    'Ключ хранится в настройках расширений на этом устройстве/сервере.': 'The key is stored in extension settings on this device/server.',
    'Модель': 'Model',
    'Как в профиле': 'As in the profile',
    'Название модели': 'Model name',
    'Сколько сцены видит': 'How much of the scene she sees',
    'События': 'Events',
    'Что Лара может подбросить в сцену. Реагируют на это только персонажи — сама она за них не решает.': 'What Lara may throw into the scene. Only the characters react to it — she never decides for them.',
    'Как часто задумываться': 'How often to consider a move',
    'Шанс, что вмешается': 'Chance to intervene',
    'Сила вмешательства': 'Intensity',
    'Что может случиться': 'What may happen',
    'Как подавать событие': 'How to deliver an event',
    'Ремаркой в чате': 'As a note in the chat',
    'Скрытой подсказкой в промпт': 'As a hidden prompt hint',
    'Сначала показать мне': 'Show me first',
    'Ремарка видна в чате и уходит в контекст персонажей, как часть мира.': 'The note is visible in the chat and goes into the characters’ context as part of the world.',
    'Событие не появится в чате: оно тайно подсказывается модели персонажа на один ответ.': 'The event won’t appear in the chat: it is secretly hinted to the character model for one reply.',
    'Перед выходом Лара покажет событие вам — можно поправить или отказаться.': 'Lara shows you the event first — you can edit or decline it.',
    'Голос Лары': 'Lara’s voice',
    'Иногда она комментирует происходящее — на полях, как зритель из ложи.': 'Sometimes she comments on what happens — in the margins, like a spectator in a box.',
    'Комментарии на полях': 'Margin comments',
    'Разговорчивость': 'Talkativeness',
    'Тон': 'Tone',
    'Не пускать комментарии в контекст': 'Keep comments out of the context',
    'Персонажи не слышат Лару. Её реплики видите только вы.': 'Characters can’t hear Lara. Only you see her remarks.',
    'Границы': 'Boundaries',
    'Не говорит и не действует за персонажей и за вас': 'Never speaks or acts for the characters or for you',
    'Не отменяет того, что уже случилось в сцене': 'Never undoes what already happened in the scene',
    'Чего Ларе нельзя': 'What Lara must not do',
    'Например: без смертей, без новых романтических линий': 'E.g.: no deaths, no new romance lines',
    'Тонкая настройка': 'Fine tuning',
    'Длина ответа Лары, токенов': 'Lara’s reply length, tokens',
    'Дополнительные указания Ларе': 'Extra instructions for Lara',
    'Например: мир — киберпанк, события должны быть связаны с корпорацией': 'E.g.: the world is cyberpunk, events should involve the corporation',
    'Кнопка Лары поверх чата': 'Lara’s button over the chat',
    'Открывает ложу режиссёра. Кнопку можно перетащить.': 'Opens the director’s box. You can drag the button.',
    'Вернуть кнопку на место': 'Reset button position',
    'Подбросить событие': 'Throw an event',
    'Спросить Лару': 'Ask Lara',
    'Забыть сцену': 'Forget the scene',
    'событие сейчас': 'event right now',
    'спросить мнение': 'ask her opinion',
    'тишина до конца сцены': 'silence until the scene ends',
    'вернуть Лару': 'bring Lara back',
    '— профилей нет —': '— no profiles —',
    '— выберите профиль —': '— choose a profile —',
    'Тот же API и модель, что у персонажей, но отдельный запрос без их промпта.': 'Same API and model as the characters, but a separate request without their prompt.',
    'Лара обращается к своему API напрямую из браузера. Нужен адрес с поддержкой CORS, например OpenRouter.': 'Lara calls her own API straight from the browser. The URL must allow CORS, e.g. OpenRouter.',
    'Профили недоступны: включите встроенное расширение Connection Manager.': 'Profiles are unavailable: enable the built-in Connection Manager extension.',
    'Создайте профиль подключения (значок вилки в SillyTavern, «Профили подключений» в Divinax) и выберите его здесь.': 'Create a connection profile (the plug icon in SillyTavern, “Connection profiles” in Divinax) and pick it here.',
    'Лара берёт API, модель и пресет из профиля. Модель можно переопределить ниже.': 'Lara takes the API, model and preset from the profile. You can override the model below.',
    'Забыть сцену?': 'Forget the scene?',
    'Лара забудет заготовки, шёпот, темп и уже брошенные события этого чата. Ремарки и реплики в чате останутся.': 'Lara forgets her ideas, whispers, tempo and past events for this chat. Notes and remarks in the chat stay.',
    'О чём спросить? Можно оставить пустым — тогда Лара просто скажет, что думает о сцене.': 'What do you want to ask? Leave it empty and Lara will just say what she thinks of the scene.',
    'Спросить': 'Ask',
    'Отмена': 'Cancel',
    // команды
    'Лара на паузе до конца сцены': 'Lara is paused until the scene ends',
    'Лара снова смотрит': 'Lara is watching again',
    'Лара забыла сцену': 'Lara forgot the scene',
    'Режиссёр включён': 'Director enabled',
    'Режиссёр выключен': 'Director disabled',
    'Неизвестная команда. Есть: event [идея], pause, resume, forget, status, on, off, box': 'Unknown subcommand. Available: event [idea], pause, resume, forget, status, on, off, box',
    'Режиссёр Lara Director: event [идея] — событие сейчас, pause — тишина до конца сцены, resume — вернуть, forget — забыть сцену, status — состояние, on/off — включить/выключить, box — ложа режиссёра': 'Lara Director: event [idea] — throw an event now, pause — silence until the scene ends, resume — bring her back, forget — forget the scene, status — state, on/off — enable/disable, box — director’s box',
    'Спросить мнение Лары о сцене: /lara [вопрос]. Ответ появится на полях.': 'Ask Lara about the scene: /lara [question]. The answer appears in the margins.',
    'подкоманда и её аргумент': 'subcommand and its argument',
    'вопрос Ларе (необязательно)': 'question for Lara (optional)',
};
