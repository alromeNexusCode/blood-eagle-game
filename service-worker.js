// Service Worker for Blood Eagle Game - Enhanced offline functionality
// Version: 1.0.0

const CACHE_NAME = 'blood-eagle-v1.0.0';
const OFFLINE_URL = 'index_new.html';

// Assets to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index_new.html',
  '/blood_eagle_game.html',
  '/manifest.json',
  '/service-worker.js',
  // External resources that should be cached
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;700;900&family=Cairo:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache all essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('fonts.googleapis.com') && 
      !event.request.url.includes('cdnjs.cloudflare.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then((fetchResponse) => {
          // Don't cache POST requests or non-successful responses
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response
          const responseToCache = fetchResponse.clone();

          // Cache the fetched resource
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return fetchResponse;
        });
      })
      .catch(() => {
        // Fallback to offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      })
  );
});

// Background sync for resource updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Push notifications for game events
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'لعبة النسر الدموي - حدث جديد!',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'العب الآن',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'إغلاق',
        icon: '/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('النسر الدموي', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/blood_eagle_game.html')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the main page
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    // Sync game progress when online
    const gameData = await getStoredGameData();
    if (gameData) {
      await syncGameProgress(gameData);
      console.log('Service Worker: Game progress synced');
    }
    
    // Check for game updates
    await checkForUpdates();
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Get stored game data
async function getStoredGameData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const gameDataCache = await cache.match('/game-data');
    
    if (gameDataCache) {
      return await gameDataCache.json();
    }
    
    return null;
  } catch (error) {
    console.error('Service Worker: Failed to get game data', error);
    return null;
  }
}

// Sync game progress (placeholder for future backend integration)
async function syncGameProgress(gameData) {
  try {
    // This would sync with a backend service in a real implementation
    console.log('Service Worker: Syncing progress', gameData);
    
    // For now, just update local storage
    if (self.registration.sync) {
      const response = await fetch('/api/sync-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameData)
      });
      
      if (response.ok) {
        console.log('Service Worker: Progress synced successfully');
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync progress', error);
  }
}

// Check for game updates
async function checkForUpdates() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const manifest = await cache.match('/manifest.json');
    
    if (manifest) {
      const manifestData = await manifest.json();
      const currentVersion = CACHE_NAME.split('-v')[1];
      
      if (manifestData.version !== currentVersion) {
        console.log('Service Worker: New version available');
        
        // Notify users about update
        self.registration.showNotification('تحديث متاح', {
          body: 'يتوفر تحديث جديد للعبة النسر الدموي',
          icon: '/icon-192x192.png',
          actions: [
            {
              action: 'update',
              title: 'تحديث الآن'
            }
          ]
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to check for updates', error);
  }
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker: Global error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
        
      case 'STORE_GAME_DATA':
        storeGameData(event.data.gameData);
        break;
        
      case 'GET_STORED_DATA':
        getStoredGameData().then(data => {
          event.ports[0].postMessage({ data });
        });
        break;
        
      default:
        console.log('Service Worker: Unknown message type', event.data.type);
    }
  }
});

// Store game data for offline sync
async function storeGameData(gameData) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(gameData), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    await cache.put('/game-data', response);
    console.log('Service Worker: Game data stored');
  } catch (error) {
    console.error('Service Worker: Failed to store game data', error);
  }
}

// Cleanup old game data periodically
setInterval(() => {
  cleanupOldData();
}, 24 * 60 * 60 * 1000); // Daily cleanup

async function cleanupOldData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const request of requests) {
      const response = await cache.match(request);
      const date = new Date(response.headers.get('date') || 0);
      
      if (now - date.getTime() > maxAge) {
        await cache.delete(request);
        console.log('Service Worker: Cleaned up old cache entry', request.url);
      }
    }
  } catch (error) {
    console.error('Service Worker: Cleanup failed', error);
  }
}

console.log('Service Worker: Script loaded successfully');
