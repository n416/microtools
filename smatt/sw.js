const CACHE_NAME = 'smatt-v1';
const urlsToCache = [
  './',
  './index.html',
  // アイコン画像があればここに追加
  // './icon-192.png',
  // './icon-512.png'
];

// インストール時にキャッシュする
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// リクエスト時にキャッシュから返す
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});