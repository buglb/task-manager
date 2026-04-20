// Service Worker 版本
const CACHE_NAME = 'task-manager-v1';

// 需要缓存的文件列表
const CACHE_FILES = [
  './',
  './task-manager.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安装事件 - 缓存资源
self.addEventListener('install', event => {
  console.log('[SW] 安装 Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 缓存文件');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        // 跳过等待，立即激活
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('[SW] 激活 Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 删除旧版本缓存
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // 立即接管所有页面
        return self.clients.claim();
      })
  );
});

// 请求拦截 - 缓存优先
self.addEventListener('fetch', event => {
  // 只处理同源请求
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // 返回缓存
          return cachedResponse;
        }

        // 缓存中没有，发起网络请求
        return fetch(event.request)
          .then(response => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 克隆响应以便缓存
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // 网络请求失败时返回离线提示
            if (event.request.destination === 'document') {
              return new Response(
                '<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#f7f8fa"><h2>📴 离线状态</h2><p>请检查网络连接后刷新页面</p><button onclick="location.reload()" style="padding:12px 24px;background:#4A90D9;color:white;border:none;border-radius:8px;cursor:pointer;">刷新</button></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            }
          });
      })
  );
});

// 后台同步（可选功能）
self.addEventListener('sync', event => {
  if (event.tag === 'sync-todos') {
    console.log('[SW] 后台同步待办事项');
  }
});

// 推送通知（可选功能）
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || '您有待办事项需要处理',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'task-reminder'
    };

    event.waitUntil(
      self.registration.showNotification(data.title || '📋 待办提醒', options)
    );
  }
});

// 点击通知
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 如果已有窗口，打开它
        for (let client of clientList) {
          if (client.url.includes('task-manager.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow('./task-manager.html');
        }
      })
  );
});
