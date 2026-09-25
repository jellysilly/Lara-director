// Картинки расширения. Адрес считается от файла модуля — так он верен и в SillyTavern, и в Divinax.
const img = (name) => new URL(`../img/${name}`, import.meta.url).href;

export const AVATAR = img('lara-avatar.jpg');
export const PORTRAIT = img('lara-portrait.jpg');
export const BANNER = img('remark-banner.jpg');
