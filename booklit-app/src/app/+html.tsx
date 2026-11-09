import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web shell for the installable app (PWA):
 * - no pinch / double-tap zoom, no text selection or long-press menus except where reading needs it,
 * - manifest + icons so phones offer "Install" / "Add to Home Screen",
 * - service worker for offline start and "Share to Booklit".
 */
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#F4F4F8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0E0E16" media="(prefers-color-scheme: dark)" />
        <meta name="description" content="Booklit: dental booklets, ministry MCQs and an AI study buddy." />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Booklit" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

const CSS = `
html, body { background: #F4F4F8; overscroll-behavior: none; -webkit-text-size-adjust: 100%; touch-action: manipulation; }
@media (prefers-color-scheme: dark) { html, body { background: #0E0E16; } }
* { -webkit-tap-highlight-color: transparent; }
body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
img { -webkit-user-drag: none; user-drag: none; }
`;

// Language/direction before first paint, block zoom gestures (iOS ignores user-scalable), register the service worker.
const BOOT = `
try { var l = localStorage.getItem('booklit.lang'); if (l === 'ar') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; } } catch (e) {}
document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) >= 0) e.preventDefault(); });
document.addEventListener('contextmenu', function (e) { var t = e.target; if (!(t && (t.closest && t.closest('input,textarea')))) e.preventDefault(); });
// Copy only from fields and from text marked selectable (AI answers, translations); never booklet pages.
document.addEventListener('copy', function (e) { try { var t = document.activeElement; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return; var n = window.getSelection().anchorNode; var el = n && (n.nodeType === 1 ? n : n.parentElement); var us = el && getComputedStyle(el); if (us && (us.userSelect === 'text' || us.webkitUserSelect === 'text')) return; } catch (x) {} e.preventDefault(); });
window.__bipEvent = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__bipEvent = e; window.dispatchEvent(new Event('booklit-installable')); });
if ('serviceWorker' in navigator && location.hostname !== 'localhost') { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }
`;
