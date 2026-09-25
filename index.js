// Lara Director — режиссёр сцены для SillyTavern и Divinax.
// Отдельная модель читает ролевую сцену, иногда подбрасывает события (не управляя персонажами)
// и оставляет реплики на полях.
import { initLocale, t } from './src/i18n.js';
import { saveSettings, settings } from './src/settings.js';
import {
    forgetScene,
    laraComment,
    notify,
    onCharMessage,
    onChatChanged,
    onUserMessage,
    setEnabled,
    setPaused,
    statusInfo,
    syncPrompts,
    throwEvent,
} from './src/director.js';
import { initRender, scheduleRender } from './src/render.js';
import { mountBox, toggleBox } from './src/box.js';
import { mountPanel } from './src/panel.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Cormorant+SC:wght@600;700&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

function loadFonts() {
    if (document.querySelector('link[data-lara-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.dataset.laraFonts = '1';
    document.head.appendChild(l);
}

function mountWandItem() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lara_director_wand')) return;
    const item = document.createElement('div');
    item.id = 'lara_director_wand';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.innerHTML = `<div class="fa-solid fa-masks-theater extensionsMenuExtensionButton"></div><span>${t('Ложа режиссёра')}</span>`;
    item.addEventListener('click', () => toggleBox());
    menu.appendChild(item);
}

async function directorCommand(value) {
    const [sub = 'status', ...rest] = String(value ?? '').trim().split(/\s+/);
    const arg = rest.join(' ');
    switch (sub.toLowerCase()) {
        case 'event':
        case 'throw':
            await throwEvent({ idea: arg });
            return '';
        case 'pause':
        case 'stop':
            setPaused(true);
            globalThis.toastr?.info?.(t('Лара на паузе до конца сцены'));
            return '';
        case 'resume':
        case 'continue':
            setPaused(false);
            globalThis.toastr?.info?.(t('Лара снова смотрит'));
            return '';
        case 'forget':
            forgetScene();
            globalThis.toastr?.info?.(t('Лара забыла сцену'));
            return '';
        case 'on':
            setEnabled(true);
            saveSettings();
            globalThis.toastr?.info?.(t('Режиссёр включён'));
            return '';
        case 'off':
            setEnabled(false);
            saveSettings();
            globalThis.toastr?.info?.(t('Режиссёр выключен'));
            return '';
        case 'box':
            toggleBox();
            return '';
        case 'status': {
            const text = statusInfo().text;
            globalThis.toastr?.info?.(text);
            return text;
        }
        default:
            globalThis.toastr?.warning?.(t('Неизвестная команда. Есть: event [идея], pause, resume, forget, status, on, off, box'));
            return '';
    }
}

function registerCommands() {
    const c = SillyTavern.getContext();
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = c;
    if (!SlashCommandParser?.addCommandObject || !SlashCommand?.fromProps) return;
    const arg = (description) =>
        SlashCommandArgument?.fromProps
            ? [SlashCommandArgument.fromProps({ description, typeList: [ARGUMENT_TYPE?.STRING ?? 'string'], isRequired: false })]
            : [];
    SlashCommandParser.addCommandObject(
        SlashCommand.fromProps({
            name: 'director',
            callback: (_args, value) => directorCommand(value),
            unnamedArgumentList: arg(t('подкоманда и её аргумент')),
            helpString: t('Режиссёр Lara Director: event [идея] — событие сейчас, pause — тишина до конца сцены, resume — вернуть, forget — забыть сцену, status — состояние, on/off — включить/выключить, box — ложа режиссёра'),
        }),
    );
    SlashCommandParser.addCommandObject(
        SlashCommand.fromProps({
            name: 'lara',
            callback: async (_args, value) => (await laraComment({ question: String(value ?? '').trim() })) || '',
            unnamedArgumentList: arg(t('вопрос Ларе (необязательно)')),
            helpString: t('Спросить мнение Лары о сцене: /lara [вопрос]. Ответ появится на полях.'),
        }),
    );
}

function bindEvents() {
    const { eventSource, event_types: ev } = SillyTavern.getContext();
    // USER_MESSAGE_RENDERED: сообщение пользователя уже в чате и на экране, а промпт персонажа ещё не собран
    eventSource.on(ev.USER_MESSAGE_RENDERED, (idx) => onUserMessage(Number(idx)));
    eventSource.on(ev.MESSAGE_RECEIVED, (idx, type) => onCharMessage(Number(idx), type));
    eventSource.on(ev.CHAT_CHANGED, () => {
        onChatChanged();
        scheduleRender();
    });
    for (const name of ['MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MORE_MESSAGES_LOADED', 'CHARACTER_MESSAGE_RENDERED']) {
        if (ev[name]) eventSource.on(ev[name], scheduleRender);
    }
}

function init() {
    initLocale();
    settings();
    loadFonts();
    mountPanel();
    mountBox();
    mountWandItem();
    registerCommands();
    initRender();
    bindEvents();
    syncPrompts();
    notify();
}

if (globalThis.jQuery) jQuery(init);
else init();
