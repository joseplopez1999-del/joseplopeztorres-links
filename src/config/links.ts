import { DOCK_SOCIAL_HREF } from './socialLinks';

/** Formularios que se abren dentro de la propia página. */
export type LinkAction = 'project' | 'newsletter' | 'contact';

export type PianoLink = {
  id: string;
  label: string;
  detail: string;
} & ({ href: string; action?: never } | { action: LinkAction; href?: never });

/**
 * Una cuerda por link, de arriba (grave) a abajo (agudo).
 * Si añades o quitas uno, ajusta `STRINGS` en `components/strings/StringsLinks.tsx`.
 */
export const PIANO_LINKS: PianoLink[] = [
  { id: 'web', label: 'Web', detail: 'joseplopeztorres.com', href: 'https://joseplopeztorres.com' },
  { id: 'project', label: '¿Tu proyecto?', detail: 'Cuéntame qué necesitas', action: 'project' },
  { id: 'newsletter', label: 'Newsletter', detail: 'Sin spam, sin humo', action: 'newsletter' },
  { id: 'tiktok-piano', label: 'TikTok Piano', detail: '@josepltpianoestudio', href: DOCK_SOCIAL_HREF.tiktok },
  { id: 'instagram', label: 'Instagram', detail: '@__xus__', href: DOCK_SOCIAL_HREF.instagram },
  { id: 'tiktok-xus', label: 'TikTok Xus', detail: '@___xus___', href: DOCK_SOCIAL_HREF.tiktokPersonal },
  { id: 'github', label: 'GitHub', detail: 'joseplopez1999-del', href: DOCK_SOCIAL_HREF.github },
  { id: 'whatsapp', label: 'WhatsApp', detail: 'Escríbeme directo', href: DOCK_SOCIAL_HREF.whatsapp },
  { id: 'email', label: 'Email', detail: 'Formulario de contacto', action: 'contact' },
];
