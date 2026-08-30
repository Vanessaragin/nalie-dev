import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

export const messages = { 'en-US': enUS, 'pt-BR': ptBR } as const;
export type Locale = keyof typeof messages;
