### Task 5: PWA — Manifest, Icons, Service Worker

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/sw.js`
- Create: `frontend/public/icons/icon-192.png` (generated)
- Create: `frontend/public/icons/icon-512.png` (generated)
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing external
- Produces: installable PWA with offline-capable static assets

- [ ] **Step 1: Create `frontend/public/` directory and `manifest.json`**

```json
{
  "name": "FitMe",
  "short_name": "FitMe",
  "description": "Your AI-powered wardrobe assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF7F0",
  "theme_color": "#FF6B5E",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create `frontend/public/sw.js`**

```js
const CACHE_NAME = "fitme-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api") || url.hostname !== location.hostname) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

- [ ] **Step 3: Generate icon PNGs**

Use a canvas-based approach or simply create minimal coral-background PNG icons with a white "F" letter. Create them programmatically via a Node script or manually place placeholder PNGs.

Generate with an inline Node script:

```bash
cd frontend && node -e "
const { createCanvas } = require('canvas');
// If canvas is not available, create a minimal valid PNG manually
" 2>/dev/null || echo "Generate icons manually — 192x192 and 512x512 coral background with white F"
```

Alternative: create SVG-based favicons and use the Playwright MCP to screenshot them, or place placeholder solid-coral PNGs.

For now, create minimal placeholder files that will be replaced with proper icons later. The manifest will still work.

- [ ] **Step 4: Add SW registration to `layout.tsx`**

Add a script tag in the body to register the service worker:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js").catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/public/ frontend/src/app/layout.tsx
git commit -m "feat: add PWA manifest, service worker, icon placeholders"
```

---

