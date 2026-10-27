# Links OS Project

Una "link in bio" que se toca: el interior de un piano de cola donde cada cuerda es uno de mis enlaces.

## Qué hace este proyecto

`links-os-project` es una landing interactiva construida con React + TypeScript + Vite que convierte la "link in bio" en las cuerdas de un piano:

- Cada link es una cuerda: graves de cobre entorchado, agudas de acero en grupos de 2 y 3, como en un piano de cola.
- Arrastrar el dedo agarra la cuerda, la tensa y la suelta; rasgar varias hace un glissando. Un toque en el nombre abre el link.
- Sonido por síntesis de cuerda pulsada (Karplus-Strong) y vibración visual con la física real de la cuerda, a cámara lenta.
- Resonancia simpática entre octavas, apagadores de fieltro para silenciar y teclado del ordenador (1–9, espacio).
- Formularios propios para proyecto, newsletter y contacto.
- Suscripción a newsletter mediante endpoint seguro (`/api/subscribe`) con validaciones, límite de peticiones y protección básica anti abuso.
- Integración con Sentry y Vercel Analytics.

Está pensado para creadoras/es y profesionales que quieren una “link in bio” más expresiva y con identidad visual propia.

## Stack técnico

- `React 19`
- `TypeScript`
- `Vite 8`
- `Tailwind CSS`
- `Vitest` (tests)
- `ESLint` (linting)
- `Vercel Functions` (API serverless en producción)

## Estructura rápida

- `src/`: interfaz principal y componentes de la app.
- `api/`: función serverless de newsletter (`subscribe.ts`).
- `server/`: lógica de seguridad, validaciones y conexión con Beehiiv.
- `docs/`: documentación operativa de seguridad.

## Requisitos

- Node.js 20+ (recomendado 22+)
- npm / pnpm / yarn

## Cómo ejecutarlo en local

1. Clona el repositorio:

```bash
git clone <URL_DEL_REPO>
cd links-os-project
```

2. Instala dependencias:

```bash
npm install
```

3. Crea tu archivo de entorno:

```bash
cp .env.example .env
```

4. Completa las variables necesarias en `.env`:

- `BEEHIIV_API_BASE`
- `BEEHIIV_API_KEY`
- `BEEHIIV_PUBLICATION_ID`
- `BEEHIIV_SUBSCRIBE_TAG`
- `BEEHIIV_UTM_SOURCE`
- `BEEHIIV_UTM_MEDIUM`
- `VITE_SA_COMMUNITY_URL`
- `VITE_SENTRY_DSN` (opcional)

5. Inicia el entorno de desarrollo:

```bash
npm run dev
```

## Scripts útiles

- `npm run dev`: arranca Vite en desarrollo.
- `npm run build`: compila TypeScript y genera build de producción.
- `npm run preview`: sirve la build localmente.
- `npm run lint`: ejecuta ESLint.
- `npm run test`: ejecuta tests con Vitest.

## Despliegue

El proyecto está preparado para desplegarse en Vercel:

- Frontend estático con Vite.
- Endpoint `/api/subscribe` como función serverless.
- Variables sensibles definidas en entorno de Vercel (nunca en cliente).

Flujo recomendado:

1. Subir repositorio a GitHub.
2. Importar proyecto en Vercel.
3. Configurar variables de entorno.
4. Desplegar.

## Personalización para otras personas

Si quieres reutilizar este proyecto para tu marca personal:

- Cambia los links en `src/config/links.ts` (perfiles en `src/config/socialLinks.ts`).
- Afinación, material y grosor de cada cuerda en `src/components/strings/StringsLinks.tsx` (una cuerda por link).
- Sustituye iconos e imágenes en `public/`.
- La física del sonido y de la vibración está en `src/lib/stringPhysics.ts` (con tests).
- Personaliza estilos y paleta en `src/index.css` (sección *Cuerdas*).

## Seguridad y privacidad

Se incluyen guías prácticas para operación y cumplimiento:

- `docs/security-checklist.md`
- `docs/security-runbook.md`

Estas guías cubren validaciones, rate limiting, cabeceras de seguridad, respuesta ante incidentes y buenas prácticas RGPD.