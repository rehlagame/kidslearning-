const CACHE_NAME = 'kids-learning-v6';

// قائمة بجميع الملفات الأساسية التي يحتاجها التطبيق ليعمل بدون إنترنت
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './css/canvas.css',
    './js/app.js',
    './js/canvas.js',
    './js/tracking.js',
    './data/arabic_letters.json',
    './data/arabic_numbers.json',
    './data/english_letters.json',
    './data/english_numbers.json',
    './data/arabic_words.json',
    './data/math_equations.json',
    './data/english_words.json',
    './data/english_advanced.json',
    './data/quizzes_arabic.json',
    './data/quizzes_math.json',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@500;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

// حدث التثبيت: حفظ الملفات في الذاكرة
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// حدث الجلب: جلب أحدث نسخة من الشبكة وتخزينها، والعودة للذاكرة فوراً عند انقطاع الإنترنت
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});

// حدث التفعيل: تنظيف أي ملفات قديمة والسيطرة على الصفحات المفتوحة فوراً
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});