// Installed-app icons, built to /icons/<name>.png. See src/utils/appIcons.mjs.
import type { APIRoute, GetStaticPaths } from 'astro';
import { APP_ICONS, renderAppIcon } from '../../utils/appIcons.mjs';

export const getStaticPaths = (() => Object.keys(APP_ICONS).map((name) => ({ params: { name } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(await renderAppIcon(params.name!), { headers: { 'Content-Type': 'image/png' } });
