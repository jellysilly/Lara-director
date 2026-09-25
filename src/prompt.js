// Промпт Лары: кто она, что ей можно, что она видит в сцене и что вернуть. Разбор ответа.
import { EVENT_TYPES, chatState, settings } from './settings.js';
import { isRu } from './i18n.js';

const ctx = () => SillyTavern.getContext();

const KIND_TEXT = {
    weather: 'weather, light and the elements',
    stranger: 'a stranger or a minor extra appears (never a player character)',
    find: 'a discovery: an object, a trace, a letter',
    trouble: 'a complication: an obstacle, a hitch, bad timing',
    rumor: 'a rumour, news or gossip reaches the characters',
    twist: 'a plot twist: something turns out to be different',
};

const INTENSITY_TEXT = {
    whisper: 'WHISPER — a small atmospheric detail or background change; 1–3 sentences; nothing that forces a reaction.',
    turn: 'TURN — a new reason to act, a hook the characters can pick up; 2–4 sentences.',
    storm: 'STORM — a strong shake-up that demands a reaction, but still leaves every choice to the characters; 3–5 sentences.',
};

const TONE = {
    dry: {
        text: 'DRY — laconic, observant, matter-of-fact, like a stage manager taking notes.',
        ru: 'Третий раз за сцену он обещает «всё объяснить потом». Я записываю.',
        en: 'Third time this scene he promises to "explain everything later". I\'m taking notes.',
    },
    sharp: {
        text: 'SHARP — ironic, teasing, a raised eyebrow; never cruel to the viewer.',
        ru: 'Ах, снова дверь, которую никто не запер. Какое совпадение. Совершенно случайное.',
        en: 'Ah, another door nobody locked. What a coincidence. A completely accidental one.',
    },
    soft: {
        text: 'WARM — gentle, attentive, enjoying the quiet moments.',
        ru: 'Мне нравится эта тишина между ними. Я пока ничего не трону.',
        en: 'I like this silence between them. I won\'t touch anything yet.',
    },
};

export const toneSample = (tone) => (isRu() ? TONE[tone]?.ru : TONE[tone]?.en) ?? '';

/** Убирает из текста сообщения служебное: рассуждения, стили, скрипты, HTML-разметку. */
export function cleanText(text, max = 1400) {
    let s = String(text ?? '')
        .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
        .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (s.length > max) s = s.slice(0, max) + '…';
    return s;
}

export const isLaraMessage = (m) => Boolean(m?.extra?.lara);

/** Последние сообщения сцены в виде «Имя: текст». */
export function transcript(limit, until) {
    const chat = ctx().chat ?? [];
    const out = [];
    const from = Math.min(chat.length, until ?? chat.length) - 1;
    for (let i = from; i >= 0 && out.length < limit; i--) {
        const m = chat[i];
        if (!m || (m.is_system && !isLaraMessage(m))) continue;
        const text = cleanText(m.mes);
        if (!text) continue;
        if (isLaraMessage(m)) out.push(`[DIRECTOR'S EVENT — already happened]: ${text}`);
        else out.push(`${m.name || (m.is_user ? 'User' : 'Character')}: ${text}`);
    }
    return out.reverse();
}

function sceneCast() {
    const c = ctx();
    const user = c.name1 || 'User';
    const names = new Set();
    for (const m of (c.chat ?? []).slice(-60)) {
        if (!m || m.is_user || isLaraMessage(m) || m.extra?.type === 'narrator') continue;
        if (m.name) names.add(m.name);
    }
    if (c.name2) names.add(c.name2);
    names.delete(user);
    return { user, chars: [...names] };
}

function cardInfo() {
    const c = ctx();
    const ch = c.characterId !== undefined && c.characterId !== null ? c.characters?.[Number(c.characterId)] : undefined;
    if (!ch) return '';
    const scenario = cleanText(ch.scenario ?? ch.data?.scenario ?? '', 500);
    const desc = cleanText(ch.description ?? ch.data?.description ?? '', 700);
    const sub = (x) => (typeof c.substituteParams === 'function' ? c.substituteParams(x) : x);
    return [scenario && `Scenario: ${sub(scenario)}`, desc && `About ${ch.name}: ${sub(desc)}`].filter(Boolean).join('\n');
}

function systemPrompt(cast) {
    const s = settings();
    const kinds = EVENT_TYPES.filter((k) => s.types[k]);
    const allowed = (kinds.length ? kinds : EVENT_TYPES).map((k) => `- ${k}: ${KIND_TEXT[k]}`).join('\n');
    const tone = TONE[s.tone] ?? TONE.dry;
    const taboo = s.taboo.trim();
    return [
        'You are Lara, the Director of an interactive role-play scene. You sit in the director\'s box and watch the story unfold.',
        'You never play a character. Your craft is to occasionally introduce EVENTS into the world — things that happen around the characters — and sometimes to leave a short COMMENT in the margins, like a spectator in a theatre box talking to the viewer.',
        '',
        'HARD RULES',
        `- Never speak, act, think or feel for ${cast.user} or for any existing character (${cast.chars.join(', ') || 'the characters'}). Never decide how they react or what they notice. Describe only the world: surroundings, weather, light, sounds, objects, news, and minor strangers or extras who are not player characters.`,
        '- Never undo, retcon or contradict anything that already happened in the scene.',
        '- An event is a hook, not a resolution: it opens a possibility and stops. The characters decide what to do with it.',
        '- Events are written in present tense, in the prose style of the scene, with no headings, no meta-talk, no dialogue from existing characters.',
        '- Write everything (event, comment, tempo_label, place, sleeve) in the language the scene is written in.',
        taboo ? `- The viewer forbids: ${taboo}. Never go there.` : '',
        s.extraPrompt.trim() ? `- ${s.extraPrompt.trim()}` : '',
        '',
        'EVENTS',
        'Allowed kinds:',
        allowed,
        `Intensity: ${INTENSITY_TEXT[s.intensity] ?? INTENSITY_TEXT.turn}`,
        'Do not repeat events you already threw. Fit the place, time and mood of the scene.',
        '',
        'YOUR VOICE (comments)',
        `Tone: ${tone.text}`,
        `Example of your voice: "${toneSample(s.tone)}"`,
        'A comment is 1–2 sentences, first person, addressed to the viewer. It observes and teases; it never gives orders to characters and never reveals your plans.',
        '',
        'OUTPUT',
        'Reply with ONE JSON object and nothing else:',
        '{"tempo": 0-4, "tempo_label": "1-2 words", "place": "short tag", "event": null | {"text": "...", "kinds": ["..."]}, "comment": null | "...", "sleeve": ["...", "..."]}',
        '- tempo: how tense the scene is right now, 0 = lull, 4 = storm; tempo_label names it ("rising", "calm"…).',
        '- place: a tiny tag of where and when the scene is, e.g. "cathedral · night".',
        '- sleeve: 2–3 short ideas (up to 8 words each) for events you could throw later.',
    ].filter((x) => x !== '').join('\n');
}

/**
 * @param {{ event?: boolean, comment?: boolean, question?: string, idea?: string, replace?: string, until?: number }} task
 */
export function buildMessages(task) {
    const s = settings();
    const st = chatState();
    const cast = sceneCast();
    const lines = transcript(s.contextSize, task.until);
    const parts = [];
    parts.push(`CAST: the viewer plays ${cast.user}. Characters: ${cast.chars.join(', ') || '—'}.`);
    const card = cardInfo();
    if (card) parts.push(`SETTING\n${card}`);
    if (st.history.length) parts.push('EVENTS YOU ALREADY THREW (do not repeat)\n' + st.history.slice(-6).map((h) => `- ${cleanText(h.text, 240)}`).join('\n'));
    if (st.whispers.length) parts.push('THE VIEWER WHISPERED THESE IDEAS TO YOU (use one if it fits)\n' + st.whispers.map((w) => `- ${w}`).join('\n'));
    parts.push(`SCENE (last ${lines.length} messages)\n` + (lines.join('\n\n') || '(the scene has not started yet)'));

    const todo = [];
    if (task.event) {
        todo.push('Throw an EVENT now: fill "event".');
        if (task.replace) todo.push(`The viewer rejected this event of yours: «${cleanText(task.replace, 600)}». Throw a clearly DIFFERENT one instead.`);
        if (task.idea) todo.push(`Build the event on this idea: ${task.idea}`);
    } else {
        todo.push('Do NOT throw an event now: "event" must be null.');
    }
    if (task.question) todo.push(`The viewer asks you: «${task.question}». Answer in "comment", in your voice, 1–3 sentences.`);
    else if (task.comment) todo.push('Leave a margin COMMENT about the latest moment: fill "comment".');
    else todo.push('"comment" must be null.');
    todo.push('Always update tempo, tempo_label, place and sleeve.');
    parts.push('TASK\n' + todo.join('\n'));

    return [
        { role: 'system', content: systemPrompt(cast) },
        { role: 'user', content: parts.join('\n\n') },
    ];
}

function tryJson(text) {
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const body = text.slice(a, b + 1);
    for (const candidate of [body, body.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')]) {
        try {
            return JSON.parse(candidate);
        } catch { /* следующий вариант */ }
    }
    return null;
}

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Разбирает ответ модели. Если JSON не получился, весь текст считается тем, о чём просили.
 * @returns {{ tempo?: number, tempoLabel?: string, place?: string, event?: { text: string, kinds: string[] }, comment?: string, sleeve?: string[] }}
 */
export function parseReply(raw, task) {
    let text = String(raw ?? '')
        .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
        .replace(/^[\s\S]*<\/think(?:ing)?>/i, '')
        .trim();
    const j = tryJson(text.replace(/```(?:json)?/gi, ''));
    if (!j || typeof j !== 'object') {
        text = cleanText(text, 2000);
        if (!text) return {};
        return task.event ? { event: { text, kinds: [] } } : { comment: text };
    }
    const out = {};
    const tempo = Number(j.tempo);
    if (Number.isFinite(tempo)) out.tempo = Math.max(0, Math.min(4, Math.round(tempo)));
    out.tempoLabel = str(j.tempo_label ?? j.tempoLabel, 40);
    out.place = str(j.place, 60);
    const ev = j.event;
    const evText = typeof ev === 'string' ? str(ev) : str(ev?.text);
    if (evText) {
        const kinds = (Array.isArray(ev?.kinds) ? ev.kinds : Array.isArray(ev?.types) ? ev.types : []).map(String).filter((k) => EVENT_TYPES.includes(k));
        out.event = { text: evText, kinds };
    }
    const comment = str(j.comment, 600);
    if (comment) out.comment = comment.replace(/^[«"]|[»"]$/g, '');
    if (Array.isArray(j.sleeve)) out.sleeve = j.sleeve.map((x) => str(x, 90)).filter(Boolean).slice(0, 4);
    return out;
}
