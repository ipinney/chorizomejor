/* ========================================
   CHORIZO MEJOR - Houston's Taco Rating App
   Firebase-powered SPA
   ======================================== */

// ===================== FIREBASE CONFIG =====================
const firebaseConfig = {
  apiKey: "AIzaSyDf1s-6iPaJ5GmZgTgPnwLJsvwAj_7tYmA",
  authDomain: "chorizomejor-app.firebaseapp.com",
  projectId: "chorizomejor-app",
  storageBucket: "chorizomejor-app.firebasestorage.app",
  messagingSenderId: "616108968942",
  appId: "1:616108968942:web:927666cffd3c0a15851cff"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ===================== NEIGHBORHOOD GEO-FENCING =====================
// Bounding boxes: [minLat, maxLat, minLng, maxLng]
/* Point-in-polygon via ray-casting – works with HOOD_DATA from neighborhoods.js */
function pointInPolygon(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function detectNeighborhood(lat, lng) {
  if (typeof HOOD_DATA === 'undefined') return null;
  // Exact polygon hit-test
  for (const [hood, data] of Object.entries(HOOD_DATA)) {
    if (pointInPolygon(lat, lng, data.coords)) return hood;
  }
  // Fallback: closest polygon centroid
  let closest = null;
  let minDist = Infinity;
  for (const [hood, data] of Object.entries(HOOD_DATA)) {
    const c = data.coords;
    let cx = 0, cy = 0;
    for (const p of c) { cx += p[0]; cy += p[1]; }
    cx /= c.length; cy /= c.length;
    const dist = Math.sqrt(Math.pow(lat - cy, 2) + Math.pow(lng - cx, 2));
    if (dist < minDist) { minDist = dist; closest = hood; }
  }
  return closest;
}

async function geocodeAddress(address) {
  const token = (window.__mb || []).join('');
  if (!token) return null;
  try {
    const query = encodeURIComponent(address + (address.toLowerCase().includes('houston') ? '' : ', Houston, TX'));
    const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1&bbox=-96.0,-29.4,-95.0,30.2`);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }
  return null;
}

// ===================== APP STATE =====================
let currentUser = null;
let currentView = 'feed';
let currentPlaceId = null;
let currentProfileId = null;
let authMode = 'signin'; // 'signin' or 'signup'
let feedTab = 'trending';
let leaderboardTab = 'overall';
let profileTab = 'reviews';
let selectedTags = [];

// ===================== PWA =====================
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

// Capture the install prompt for later use
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show our custom install prompt after a short delay
  setTimeout(() => {
    const dismissed = sessionStorage.getItem('install-dismissed');
    if (!dismissed) {
      document.getElementById('install-prompt').classList.remove('hidden');
    }
  }, 3000);
});

function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      showToast('App installed!');
    }
    deferredInstallPrompt = null;
    document.getElementById('install-prompt').classList.add('hidden');
  });
}

function dismissInstall() {
  document.getElementById('install-prompt').classList.add('hidden');
  sessionStorage.setItem('install-dismissed', 'true');
}

window.addEventListener('appinstalled', () => {
  document.getElementById('install-prompt').classList.add('hidden');
  deferredInstallPrompt = null;
});

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateAuthUI();
    if (window.location.hash) {
      handleRoute();
    } else {
      navigate('feed');
    }
  });

  window.addEventListener('hashchange', handleRoute);
  startTotyCountdown();
});

// ===================== ROUTING =====================
function navigate(view, id) {
  if (view === 'profile' && !id && !currentUser) {
    window.location.hash = '#/auth';
    return;
  }
  if (id) {
    window.location.hash = `#/${view}/${id}`;
  } else {
    window.location.hash = `#/${view}`;
  }
}

function handleRoute() {
  const hash = window.location.hash.slice(2) || 'feed';
  const parts = hash.split('/');
  const view = parts[0];
  const id = parts[1] || null;

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  // Update nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  currentView = view;

  switch (view) {
    case 'feed':
      showView('view-feed');
      loadFeed();
      break;
    case 'explore':
      showView('view-explore');
      loadPlaces();
      break;
    case 'leaderboard':
      showView('view-leaderboard');
      loadLeaderboard();
      break;
    case 'toty':
      showView('view-toty');
      loadTotyLeaders();
      break;
    case 'profile':
      showView('view-profile');
      loadProfile(id || (currentUser && currentUser.uid));
      break;
    case 'place':
      showView('view-place');
      if (id) loadPlaceDetail(id);
      break;
    case 'auth':
      showView('view-auth');
      break;
    default:
      showView('view-feed');
      loadFeed();
  }
}

function showView(id) {
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0, 0);
}

// ===================== AUTH =====================
function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  if (currentUser) {
    authButtons.innerHTML = `
      <button class="btn-icon" onclick="navigate('profile')" title="Profile">
        <span class="material-icons-round">account_circle</span>
      </button>
    `;
  } else {
    authButtons.innerHTML = `
      <button class="btn-icon" onclick="navigate('auth')" title="Sign In">
        <span class="material-icons-round">login</span>
      </button>
    `;
  }
}

function toggleAuthMode(e) {
  e.preventDefault();
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  const nameGroup = document.getElementById('auth-name-group');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');
  const toggleLink = document.getElementById('auth-toggle-link');

  if (authMode === 'signup') {
    nameGroup.classList.remove('hidden');
    submitBtn.textContent = 'Create Account';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Sign In';
  } else {
    nameGroup.classList.add('hidden');
    submitBtn.textContent = 'Sign In';
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Sign Up';
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const displayName = document.getElementById('auth-displayname').value;

  try {
    if (authMode === 'signup') {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const name = displayName || email.split('@')[0];
      await cred.user.updateProfile({ displayName: name });

      // Create user doc in Firestore
      await db.collection('users').doc(cred.user.uid).set({
        displayName: name,
        email: email,
        handle: '@' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        reviewCount: 0,
        followers: 0,
        following: 0,
        badges: [],
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast('Welcome to Chorizo Mejor!');
    } else {
      await auth.signInWithEmailAndPassword(email, password);
      showToast('Welcome back!');
    }
    navigate('feed');
  } catch (err) {
    showToast(err.message);
  }
}

async function signOut() {
  await auth.signOut();
  showToast('Signed out');
  navigate('feed');
}

// ===================== GOOGLE SIGN-IN =====================
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    const isNew = result.additionalUserInfo?.isNewUser;

    if (isNew) {
      // Create user profile for first-time Google sign-in users
      const name = user.displayName || user.email.split('@')[0];
      await db.collection('users').doc(user.uid).set({
        displayName: name,
        email: user.email,
        handle: '@' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        photoURL: user.photoURL || null,
        reviewCount: 0,
        followers: 0,
        following: 0,
        badges: [],
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Welcome to Chorizo Mejor!');
    } else {
      // Update photo URL in case it changed
      if (user.photoURL) {
        await db.collection('users').doc(user.uid).update({
          photoURL: user.photoURL
        }).catch(() => {}); // Ignore if doc doesn't exist yet
      }
      showToast('Welcome back!');
    }

    navigate('feed');
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') return;
    showToast(err.message);
  }
}

// ===================== FEED =====================
function switchFeedTab(btn) {
  document.querySelectorAll('.feed-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  feedTab = btn.dataset.tab;
  loadFeed();
}

async function loadFeed() {
  const feedList = document.getElementById('feed-list');
  const feedEmpty = document.getElementById('feed-empty');
  feedList.innerHTML = '<div class="spinner"></div>';
  feedEmpty.classList.add('hidden');

  try {
    let query = db.collection('reviews').orderBy('createdAt', 'desc').limit(20);

    if (feedTab === 'following' && currentUser) {
      // Get users the current user follows
      const followSnap = await db.collection('follows')
        .where('followerId', '==', currentUser.uid).get();
      const followingIds = followSnap.docs.map(d => d.data().followingId);

      if (followingIds.length > 0) {
        // Firestore 'in' supports max 30 items
        const batch = followingIds.slice(0, 30);
        query = db.collection('reviews')
          .where('userId', 'in', batch)
          .orderBy('createdAt', 'desc').limit(20);
      } else {
        feedList.innerHTML = '';
        feedEmpty.classList.remove('hidden');
        return;
      }
    }

    const snap = await query.get();

    if (snap.empty) {
      feedList.innerHTML = '';
      feedEmpty.classList.remove('hidden');
      return;
    }

    feedList.innerHTML = '';
    for (const doc of snap.docs) {
      const review = doc.data();
      feedList.appendChild(createReviewCard(doc.id, review));
    }
  } catch (err) {
    console.error('Feed error:', err);
    feedList.innerHTML = '';
    feedEmpty.classList.remove('hidden');
  }
}

function createReviewCard(reviewId, review) {
  const card = document.createElement('div');
  card.className = 'card';

  const overallScore = review.ratings?.overall || '-';
  const timeAgo = review.createdAt ? getTimeAgo(review.createdAt.toDate()) : 'just now';

  const photoHTML = review.photoURL
    ? `<img class="card-photo" src="${escapeHtml(review.photoURL)}" alt="Taco photo" loading="lazy" />`
    : '';

  const tagsHTML = (review.tags || [])
    .map(t => `<span class="taco-tag">${escapeHtml(formatTag(t))}</span>`)
    .join('');

  const waitHTML = review.wouldWait
    ? '<span class="card-wait-badge">⏰ Worth the wait!</span>'
    : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar">🌮</div>
      <div class="card-user-info">
        <div class="card-username" onclick="navigate('profile','${escapeHtml(review.userId)}')">${escapeHtml(review.userName || 'Anonymous')}</div>
        <div class="card-meta">${timeAgo}</div>
      </div>
      <button class="btn-icon" onclick="openShareModal('${reviewId}')">
        <span class="material-icons-round" style="font-size:20px">share</span>
      </button>
    </div>
    ${photoHTML}
    <div class="card-body">
      <div class="card-place-name" onclick="navigate('place','${escapeHtml(review.placeId)}')">${escapeHtml(review.placeName || 'Unknown Spot')}</div>
      <div class="card-ratings">
        <span class="card-rating-chip highlight">${overallScore !== '-' ? renderStars(Number(overallScore), 'cm') : ''} ${overallScore}/5</span>
        ${review.ratings?.tortilla ? `<span class="card-rating-chip">Tortilla ${review.ratings.tortilla}</span>` : ''}
        ${review.ratings?.protein ? `<span class="card-rating-chip">Protein ${review.ratings.protein}</span>` : ''}
        ${review.ratings?.salsa ? `<span class="card-rating-chip">Salsa ${review.ratings.salsa}</span>` : ''}
        ${review.ratings?.value ? `<span class="card-rating-chip">Value ${review.ratings.value}</span>` : ''}
      </div>
      ${review.text ? `<p class="card-text">${escapeHtml(review.text)}</p>` : ''}
      <div class="card-tags">${tagsHTML}</div>
      ${waitHTML}
    </div>
    <div class="card-actions">
      <button class="card-action-btn ${review.likes && currentUser && review.likes.includes(currentUser.uid) ? 'liked' : ''}"
              onclick="toggleLike('${reviewId}', this)">
        <span class="material-icons-round" style="font-size:18px">favorite</span>
        <span class="like-count">${(review.likes || []).length || ''}</span>
      </button>
      <button class="card-action-btn" onclick="toggleComments('${reviewId}', this)">
        <span class="material-icons-round" style="font-size:18px">chat_bubble_outline</span>
        <span>${review.commentCount || ''}</span>
      </button>
    </div>
    <div class="comment-section hidden" id="comments-${reviewId}"></div>
  `;

  return card;
}

// ===================== LIKES =====================
async function toggleLike(reviewId, btn) {
  if (!currentUser) { navigate('auth'); return; }

  const ref = db.collection('reviews').doc(reviewId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const likes = doc.data().likes || [];
  const countSpan = btn.querySelector('.like-count');

  if (likes.includes(currentUser.uid)) {
    await ref.update({
      likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    });
    btn.classList.remove('liked');
    countSpan.textContent = likes.length - 1 || '';
  } else {
    await ref.update({
      likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
    btn.classList.add('liked');
    countSpan.textContent = likes.length + 1;
  }
}

// ===================== COMMENTS =====================
async function toggleComments(reviewId) {
  const section = document.getElementById(`comments-${reviewId}`);
  if (!section.classList.contains('hidden')) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  section.innerHTML = '<div class="spinner"></div>';

  try {
    const snap = await db.collection('reviews').doc(reviewId)
      .collection('comments').orderBy('createdAt', 'asc').limit(20).get();

    let html = '';
    snap.forEach(doc => {
      const c = doc.data();
      const time = c.createdAt ? getTimeAgo(c.createdAt.toDate()) : '';
      html += `
        <div class="comment">
          <div class="comment-avatar">🌮</div>
          <div class="comment-body">
            <span class="comment-user">${escapeHtml(c.userName || 'Anon')}</span>
            <span class="comment-text">${escapeHtml(c.text)}</span>
            <div class="comment-time">${time}</div>
          </div>
        </div>
      `;
    });

    if (currentUser) {
      html += `
        <div class="comment-input-row">
          <input type="text" placeholder="Add a comment..." id="comment-input-${reviewId}"
                 onkeydown="if(event.key==='Enter')postComment('${reviewId}')" />
          <button onclick="postComment('${reviewId}')">Post</button>
        </div>
      `;
    }

    section.innerHTML = html || '<p style="padding:8px 14px;font-size:13px;color:#8D6E63">No comments yet</p>' +
      (currentUser ? `
        <div class="comment-input-row">
          <input type="text" placeholder="Be the first to comment..." id="comment-input-${reviewId}"
                 onkeydown="if(event.key==='Enter')postComment('${reviewId}')" />
          <button onclick="postComment('${reviewId}')">Post</button>
        </div>
      ` : '');
  } catch (err) {
    section.innerHTML = '<p style="padding:8px;font-size:13px;color:#999">Could not load comments</p>';
  }
}

async function postComment(reviewId) {
  if (!currentUser) return;
  const input = document.getElementById(`comment-input-${reviewId}`);
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  try {
    await db.collection('reviews').doc(reviewId)
      .collection('comments').add({
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous',
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Update comment count
    await db.collection('reviews').doc(reviewId).update({
      commentCount: firebase.firestore.FieldValue.increment(1)
    });

    // Reload comments
    const section = document.getElementById(`comments-${reviewId}`);
    section.classList.add('hidden');
    toggleComments(reviewId);

    showToast('Comment posted!');
  } catch (err) {
    showToast('Could not post comment');
  }
}

// ===================== EXPLORE / PLACES =====================
let userLocation = null;

function getUserLocation() {
  return new Promise((resolve) => {
    if (userLocation) { resolve(userLocation); return; }
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(userLocation);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function loadPlaces() {
  const grid = document.getElementById('places-grid');
  const mapEl = document.getElementById('map');
  grid.innerHTML = '<div class="spinner"></div>';
  // Only show loading text if map hasn't been initialized yet
  if (!mapInstance) {
    mapEl.textContent = '📍 Map loading...';
  }

  try {
    const neighborhood = document.getElementById('filter-neighborhood').value;
    const sort = document.getElementById('filter-sort').value;

    let places = [];

    if (sort === 'nearest') {
      // For nearest sort: get user location, fetch all, sort client-side
      const loc = await getUserLocation();
      if (!loc) {
        showToast('Enable location access to sort by distance');
        document.getElementById('filter-sort').value = 'rating';
        // Fall through to normal sort
      } else {
        let query = db.collection('places');
        if (neighborhood) {
          query = query.where('neighborhood', '==', neighborhood);
        }
        const snap = await query.limit(100).get();
        places = snap.docs.map(d => {
          const data = d.data();
          const dist = (data.lat && data.lng)
            ? haversineDistance(loc.lat, loc.lng, data.lat, data.lng)
            : 9999;
          return { id: d.id, ...data, _distance: dist };
        });
        places.sort((a, b) => a._distance - b._distance);
        places = places.slice(0, 30);
      }
    }

    // Standard Firestore-sorted query if not already populated
    if (places.length === 0) {
      let query = db.collection('places');
      const currentSort = document.getElementById('filter-sort').value;
      if (neighborhood) {
        // Filter by neighborhood – fetch all then sort client-side
        // (avoids needing composite Firestore indexes for each sort field)
        query = query.where('neighborhood', '==', neighborhood);
        query = query.limit(100);
        const snap = await query.get();
        places = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (currentSort === 'rating') {
          places.sort((a, b) => (b.avgOverall || 0) - (a.avgOverall || 0));
        } else if (currentSort === 'reviews') {
          places.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        } else {
          places.sort((a, b) => {
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
          });
        }
        places = places.slice(0, 30);
      } else {
        // No filter – use Firestore-sorted query (single-field index only)
        if (currentSort === 'rating') {
          query = query.orderBy('avgOverall', 'desc');
        } else if (currentSort === 'reviews') {
          query = query.orderBy('reviewCount', 'desc');
        } else {
          query = query.orderBy('createdAt', 'desc');
        }
        query = query.limit(30);
        const snap = await query.get();
        places = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    if (places.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📍</span>
          <h3>No spots found</h3>
          <p>Be the first to add a taco spot in this area!</p>
          <button class="btn-primary" style="margin-top:16px" onclick="openPlaceModal()">+ Add Spot</button>
        </div>
      `;
      return;
    }

    allLoadedPlaces = places; // cache for search
    grid.innerHTML = '';
    places.forEach(place => {
      const card = createPlaceCard(place.id, place);
      if (place._distance && place._distance < 9999) {
        const distBadge = document.createElement('span');
        distBadge.className = 'distance-badge';
        distBadge.textContent = place._distance < 0.1
          ? 'Right here!'
          : place._distance.toFixed(1) + ' mi';
        card.prepend(distBadge);
      }
      grid.appendChild(card);
    });

    initMap(places);
  } catch (err) {
    console.error('Places error:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📍</span>
        <h3>Explore Houston's tacos</h3>
        <p>Add the first taco spot to get started!</p>
        <button class="btn-primary" style="margin-top:16px" onclick="openPlaceModal()">+ Add Spot</button>
      </div>
    `;
  }
}

function filterPlaces() {
  document.getElementById('place-search').value = '';
  loadPlaces();
}

let allLoadedPlaces = []; // cache for search filtering

function searchPlaces(query) {
  const grid = document.getElementById('places-grid');
  const q = query.toLowerCase().trim();
  if (!q) {
    // Show all
    grid.innerHTML = '';
    allLoadedPlaces.forEach(p => grid.appendChild(createPlaceCard(p.id, p)));
    return;
  }
  const filtered = allLoadedPlaces.filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.address && p.address.toLowerCase().includes(q)) ||
    (p.neighborhood && formatNeighborhood(p.neighborhood).toLowerCase().includes(q))
  );
  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><h3>No matches</h3><p>Try a different search term</p></div>';
    return;
  }
  filtered.forEach(p => grid.appendChild(createPlaceCard(p.id, p)));
}

function createPlaceCard(placeId, place) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cursor = 'pointer';
  card.onclick = () => navigate('place', placeId);

  const score = place.avgOverall ? place.avgOverall.toFixed(1) : (place.googleRating ? place.googleRating.toFixed(1) : '-');
  const typeEmoji = { truck: '🚚', restaurant: '🏪', bakery: '🍞', 'gas-station': '⛽' };
  const mbToken = (window.__mb || []).join('');

  let imgHtml;
  if (place.photoURL) {
    imgHtml = `<img class="place-card-img" src="${escapeHtml(place.photoURL)}" alt="${escapeHtml(place.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'place-card-img\\'>${typeEmoji[place.type] || '🌮'}</div>'" />`;
  } else if (place.lat && place.lng && mbToken) {
    // Use Mapbox satellite thumbnail as placeholder
    imgHtml = `<img class="place-card-img" src="https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${place.lng},${place.lat},16,0/72x72@2x?access_token=${mbToken}" alt="${escapeHtml(place.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'place-card-img\\'>${typeEmoji[place.type] || '🌮'}</div>'" />`;
  } else {
    imgHtml = `<div class="place-card-img">${typeEmoji[place.type] || '🌮'}</div>`;
  }

  card.innerHTML = `
    <div class="place-card">
      ${imgHtml}
      <div class="place-card-info">
        <div class="place-card-name">${escapeHtml(place.name)}</div>
        <div class="place-card-address">${escapeHtml(place.address || '')}</div>
        <div class="place-card-stats">
          <span class="place-card-score">★ ${score}${score !== '-' ? '/5' : ''}</span>
          <span>${place.reviewCount || 0} reviews</span>
          <span>${formatNeighborhood(place.neighborhood)}</span>
        </div>
      </div>
    </div>
  `;

  return card;
}

// ===================== MAP =====================
let mapInstance = null;
let mapMarkers = [];
let mapReady = false;
let pendingPlaces = null;

// Neighborhood polygon coordinates [lng, lat] rings
function buildHoodGeoJSON() {
  if (typeof HOOD_DATA === 'undefined') return { type: 'FeatureCollection', features: [] };
  const features = Object.entries(HOOD_DATA).map(([name, data]) => ({
    type: 'Feature',
    properties: { name, label: data.label },
    geometry: { type: 'Polygon', coordinates: [data.coords] }
  }));
  return { type: 'FeatureCollection', features };
}

function waitForMapbox() {
  return new Promise(resolve => {
    if (typeof mapboxgl !== 'undefined') { resolve(); return; }
    const check = setInterval(() => {
      if (typeof mapboxgl !== 'undefined') { clearInterval(check); resolve(); }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(); }, 5000);
  });
}

async function initMap(places) {
  const mapEl = document.getElementById('map');

  await waitForMapbox();

  if (typeof mapboxgl === 'undefined') {
    mapEl.innerHTML = '<span style="font-size:24px">📍</span> Map unavailable';
    return;
  }

  mapboxgl.accessToken = (window.__mb || []).join('');

  // Clear old markers
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  // If map container was destroyed (textContent overwrite), reset and recreate
  if (mapInstance) {
    try {
      mapInstance.getContainer(); // throws if container is gone
      mapInstance.resize(); // ensure canvas fits
    } catch (e) {
      mapInstance = null;
      mapReady = false;
      mapEl.innerHTML = '';
    }
  }

  if (!mapInstance) {
    mapEl.innerHTML = ''; // clear any loading text
    mapInstance = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-95.3698, 29.7604],
      zoom: 11,
      cooperativeGestures: true,
      attributionControl: false,
      fadeDuration: 0
    });

    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapInstance.addControl(new mapboxgl.AttributionControl({ compact: true }));

    mapInstance.on('load', () => {
      mapReady = true;
      addNeighborhoodLayers();
      if (pendingPlaces) { addMarkers(pendingPlaces); pendingPlaces = null; }
    });
  }

  if (mapReady) {
    addMarkers(places);
  } else {
    pendingPlaces = places;
  }
}

function addNeighborhoodLayers() {
  if (!mapInstance || mapInstance.getSource('neighborhoods')) return;

  mapInstance.addSource('neighborhoods', {
    type: 'geojson',
    data: buildHoodGeoJSON()
  });

  mapInstance.addLayer({
    id: 'hood-fill',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': '#D84315',
      'fill-opacity': 0.06
    }
  }, mapInstance.getStyle().layers.find(l => l.type === 'symbol')?.id);

  mapInstance.addLayer({
    id: 'hood-outline',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#D84315',
      'line-width': 1.5,
      'line-opacity': 0.4,
      'line-dasharray': [4, 3]
    }
  });

  mapInstance.addLayer({
    id: 'hood-labels',
    type: 'symbol',
    source: 'neighborhoods',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-anchor': 'center',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#BF360C',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
      'text-opacity': 0.7
    }
  });
}

function addMarkers(places) {
  const bounds = new mapboxgl.LngLatBounds();
  let hasMarkers = false;

  places.forEach(place => {
    if (place.lat && place.lng) {
      hasMarkers = true;

      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.cssText = 'width:28px;height:28px;background:#D84315;border-radius:50%;border:2px solid #fff;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;';
      el.textContent = '🌮';

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
        `<strong style="font-size:13px">${place.name || 'Taco Spot'}</strong>` +
        (place.avgOverall ? `<br><span style="color:#D84315">★ ${place.avgOverall.toFixed(1)}</span>` : '')
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(mapInstance);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate('place', place.id);
      });

      mapMarkers.push(marker);
      bounds.extend([place.lng, place.lat]);
    }
  });

  if (hasMarkers) {
    mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 500 });
  }
}

// ===================== PLACE DETAIL =====================
async function loadPlaceDetail(placeId) {
  currentPlaceId = placeId;

  try {
    const doc = await db.collection('places').doc(placeId).get();
    if (!doc.exists) {
      showToast('Place not found');
      navigate('explore');
      return;
    }

    const place = doc.data();

    document.getElementById('place-name').textContent = place.name;
    document.getElementById('place-address-detail').textContent = place.address || '';
    document.getElementById('place-neighborhood-detail').textContent = formatNeighborhood(place.neighborhood);
    document.getElementById('place-review-count').textContent = `${place.reviewCount || 0} reviews`;

    // Wait percentage
    const waitPct = place.waitYesCount && place.reviewCount
      ? Math.round((place.waitYesCount / place.reviewCount) * 100)
      : 0;
    document.getElementById('place-wait-pct').textContent = waitPct > 0
      ? `⏰ ${waitPct}% would wait in line`
      : '';

    // Hero rating: CM reviews primary, Google fallback
    const hasCMReviews = (place.reviewCount || 0) > 0;
    const heroNumber = document.getElementById('hero-rating-number');
    const heroStars = document.getElementById('hero-rating-stars');
    const heroSource = document.getElementById('hero-rating-source');
    const categoryRatings = document.getElementById('category-ratings');

    if (hasCMReviews) {
      const cmRating = place.avgOverall || 0;
      heroNumber.textContent = cmRating ? cmRating.toFixed(1) : '-';
      heroStars.innerHTML = renderStars(cmRating, 'cm');
      heroSource.textContent = `${place.reviewCount} Chorizo Mejor review${place.reviewCount !== 1 ? 's' : ''}`;
      categoryRatings.style.display = '';

      // Category bars (1-5 scale)
      const categories = ['tortilla', 'protein', 'salsa', 'value'];
      categories.forEach(cat => {
        const avg = place[`avg${capitalize(cat)}`] || 0;
        const bar = document.getElementById(`bar-${cat}`);
        const score = document.getElementById(`score-${cat}`);
        if (bar) bar.style.width = `${(avg / 5) * 100}%`;
        if (score) score.textContent = avg ? avg.toFixed(1) : '-';
      });
    } else {
      // No CM reviews — show placeholder, will be replaced by Google rating async
      heroNumber.textContent = '-';
      heroStars.innerHTML = '';
      heroSource.textContent = 'No reviews yet';
      categoryRatings.style.display = 'none';
      // Mark hero as needing Google fallback
      document.getElementById('hero-rating').dataset.needsFallback = 'true';
    }

    // Tags
    const tagsEl = document.getElementById('place-tags');
    const tags = place.topTags || [];
    tagsEl.innerHTML = tags.map(t => `<span class="taco-tag">${escapeHtml(formatTag(t))}</span>`).join('');

    // Banner — fallback chain: imageURL → photoURL → Mapbox satellite → emoji
    (() => {
      const imgEl = document.getElementById('place-banner-img');
      const emojiEl = document.querySelector('#place-photo-banner .place-banner-emoji');
      const mbToken = (window.__mb || []).join('');
      let src = null;
      if (place.imageURL) {
        src = place.imageURL;
      } else if (place.photoURL) {
        src = place.photoURL;
      } else if (place.lat && place.lng && mbToken) {
        src = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${place.lng},${place.lat},15,0/600x200@2x?access_token=${mbToken}`;
      }
      if (src) {
        imgEl.src = src;
        imgEl.alt = place.name || 'Place photo';
        imgEl.style.display = 'block';
        emojiEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        emojiEl.style.display = 'flex';
      }
    })();

    // Action buttons
    const linksEl = document.getElementById('place-links');
    const buttons = [];
    // Directions — always show if lat/lng
    if (place.lat && place.lng) {
      buttons.push(`<a class="place-link-btn primary" href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}" target="_blank" rel="noopener"><span class="link-icon">📍</span> Directions</a>`);
    }
    // Order Online
    if (place.orderURL) {
      buttons.push(`<a class="place-link-btn" href="${escapeHtml(place.orderURL)}" target="_blank" rel="noopener"><span class="link-icon">🛒</span> Order Online</a>`);
    }
    // Website
    if (place.websiteURL) {
      buttons.push(`<a class="place-link-btn" href="${escapeHtml(place.websiteURL)}" target="_blank" rel="noopener"><span class="link-icon">🌐</span> Website</a>`);
    }
    // Call
    if (place.phone) {
      buttons.push(`<a class="place-link-btn" href="tel:${escapeHtml(place.phone)}" ><span class="link-icon">📞</span> Call</a>`);
    }
    // Yelp — branded static link (no live rating due to API cost)
    if (place.yelpURL) {
      buttons.push(`<a class="place-link-btn yelp-btn" href="${escapeHtml(place.yelpURL)}" target="_blank" rel="noopener"><svg class="brand-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#FF1A1A" d="M12.14 11.26c.15.07.09.42.09.42l-1.67 6.62s-.08.29-.27.28c-.12-.01-.26-.15-.26-.15L6.5 14.1s-.2-.24-.15-.4c.06-.17.32-.22.32-.22l5.11-2.3s.22-.1.36.08zm-1.7-1.76c-.07.16-.42.12-.42.12l-6.6-1.67s-.28-.09-.27-.28c.01-.12.16-.26.16-.26l4.33-3.53s.24-.2.4-.14c.17.06.2.32.2.32l1.28 5.02s.07.25-.08.42zM11.5 8.3c.17.02.28.36.28.36l1.69 6.6s.06.29-.1.38c-.1.06-.28 0-.28 0l-5.19-2.56s-.27-.12-.3-.3c0-.19.2-.34.2-.34L11.1 8.3s.2-.15.38-.01h.02zm2.12 3.72c-.02-.18.3-.32.3-.32l6.04-3.12s.26-.15.37-.02c.07.08.08.28.08.28l-.44 5.56s-.03.3-.16.38c-.15.08-.35-.1-.35-.1l-5.6-2.34s-.24-.1-.24-.32zm.52-1.98c.16.06.17.41.17.41l.2 6.83s0 .3-.17.34c-.11.03-.28-.08-.28-.08l-4.02-3.9s-.2-.22-.17-.39c.04-.18.28-.25.28-.25l3.63-3s.2-.15.36.04z"/></svg><span class="ext-label">Yelp</span></a>`);
    }
    // Google — branded with live rating (loaded async)
    if (place.googleMapsURL) {
      buttons.push(`<a class="place-link-btn google-btn" id="google-link" href="${escapeHtml(place.googleMapsURL)}" target="_blank" rel="noopener"><svg class="brand-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span class="rating-slot" id="google-rating-slot"><span class="rating-loading"></span></span></a>`);
    }
    linksEl.innerHTML = buttons.join('');

    // Fetch live Google rating (async, non-blocking)
    if (place.lat && place.lng && place.googleMapsURL) {
      fetchLiveRatings(place);
    }

    // Load reviews
    loadPlaceReviews(placeId);
  } catch (err) {
    console.error('Place detail error:', err);
    showToast('Could not load place');
  }
}

async function loadPlaceReviews(placeId) {
  const list = document.getElementById('place-reviews');
  list.innerHTML = '<div class="spinner"></div>';

  try {
    const snap = await db.collection('reviews')
      .where('placeId', '==', placeId)
      .orderBy('createdAt', 'desc')
      .limit(30).get();

    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<div class="empty-state"><p>No reviews yet. Be the first!</p></div>';
      return;
    }

    snap.forEach(doc => {
      list.appendChild(createReviewCard(doc.id, doc.data()));
    });
  } catch (err) {
    console.error('Reviews error:', err);
    list.innerHTML = '<p style="color:#999;font-size:14px">Could not load reviews</p>';
  }
}

// ===================== ADD PLACE =====================
function openPlaceModal() {
  if (!currentUser) { navigate('auth'); return; }
  document.getElementById('place-modal').classList.remove('hidden');
}

function closePlaceModal() {
  document.getElementById('place-modal').classList.add('hidden');
  document.getElementById('place-form').reset();
}

async function autoDetectNeighborhood() {
  const address = document.getElementById('new-place-address').value.trim();
  const display = document.getElementById('detected-neighborhood');
  if (!address) {
    display.textContent = 'Enter an address to auto-detect';
    display.className = 'detected-hood';
    return;
  }

  display.textContent = 'Detecting neighborhood...';
  display.className = 'detected-hood detecting';

  const coords = await geocodeAddress(address);
  if (!coords) {
    display.textContent = 'Could not locate address — check the address and try again';
    display.className = 'detected-hood error';
    document.getElementById('new-place-neighborhood').value = '';
    return;
  }

  document.getElementById('new-place-lat').value = coords.lat;
  document.getElementById('new-place-lng').value = coords.lng;

  const hood = detectNeighborhood(coords.lat, coords.lng);
  if (hood) {
    document.getElementById('new-place-neighborhood').value = hood;
    display.textContent = '📍 ' + formatNeighborhood(hood);
    display.className = 'detected-hood success';
  } else {
    display.textContent = 'Address outside Houston area';
    display.className = 'detected-hood error';
    document.getElementById('new-place-neighborhood').value = '';
  }
}

async function submitPlace(e) {
  e.preventDefault();
  if (!currentUser) { navigate('auth'); return; }

  const name = document.getElementById('new-place-name').value.trim();
  const address = document.getElementById('new-place-address').value.trim();
  const neighborhood = document.getElementById('new-place-neighborhood').value;
  const type = document.getElementById('new-place-type').value;
  const lat = parseFloat(document.getElementById('new-place-lat').value) || null;
  const lng = parseFloat(document.getElementById('new-place-lng').value) || null;

  if (!name || !address) {
    showToast('Please fill in name and address');
    return;
  }

  // Auto-detect neighborhood if not yet done
  if (!neighborhood) {
    const coords = await geocodeAddress(address);
    if (coords) {
      const hood = detectNeighborhood(coords.lat, coords.lng);
      if (hood) {
        document.getElementById('new-place-neighborhood').value = hood;
        document.getElementById('new-place-lat').value = coords.lat;
        document.getElementById('new-place-lng').value = coords.lng;
      }
    }
    const finalHood = document.getElementById('new-place-neighborhood').value;
    if (!finalHood) {
      showToast('Could not determine neighborhood from address');
      return;
    }
  }

  const finalNeighborhood = document.getElementById('new-place-neighborhood').value;
  const finalLat = parseFloat(document.getElementById('new-place-lat').value) || null;
  const finalLng = parseFloat(document.getElementById('new-place-lng').value) || null;

  try {
    const placeData = {
      name,
      address,
      neighborhood: finalNeighborhood,
      type,
      reviewCount: 0,
      avgOverall: 0,
      avgTortilla: 0,
      avgProtein: 0,
      avgSalsa: 0,
      avgValue: 0,
      waitYesCount: 0,
      topTags: [],
      addedBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (finalLat && finalLng) {
      placeData.lat = finalLat;
      placeData.lng = finalLng;
    }

    const docRef = await db.collection('places').add(placeData);

    closePlaceModal();
    showToast(`${name} added!`);
    navigate('place', docRef.id);
  } catch (err) {
    showToast('Could not add place');
    console.error(err);
  }
}

// ===================== ADD REVIEW =====================
function openAddFlow() {
  if (!currentUser) { navigate('auth'); return; }

  if (currentPlaceId && currentView === 'place') {
    openReviewModal();
  } else {
    // If not on a place page, go to explore to pick a place
    showToast('Pick a taco spot first!');
    navigate('explore');
  }
}

function openReviewModal() {
  if (!currentUser) { navigate('auth'); return; }
  document.getElementById('review-modal').classList.remove('hidden');
  selectedTags = [];
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
}

function closeReviewModal() {
  document.getElementById('review-modal').classList.add('hidden');
  document.getElementById('review-form').reset();
  document.getElementById('photo-preview').classList.add('hidden');
  selectedTags = [];
}

function updateRatingVal(category, value) {
  document.getElementById(`val-${category}`).textContent = value;
}

function recalcOverall() {
  const t = parseInt(document.getElementById('rate-tortilla').value);
  const p = parseInt(document.getElementById('rate-protein').value);
  const s = parseInt(document.getElementById('rate-salsa').value);
  const v = parseInt(document.getElementById('rate-value').value);
  const avg = (t + p + s + v) / 4;
  document.getElementById('val-overall').textContent = avg.toFixed(1);
  const bar = document.getElementById('overall-bar');
  if (bar) bar.style.width = (avg / 5 * 100) + '%';
}

function toggleTag(btn) {
  const tag = btn.dataset.tag;
  btn.classList.toggle('selected');
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter(t => t !== tag);
  } else {
    selectedTags.push(tag);
  }
}

function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('photo-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitReview(e) {
  e.preventDefault();
  if (!currentUser || !currentPlaceId) return;

  const tortilla = parseInt(document.getElementById('rate-tortilla').value);
  const protein = parseInt(document.getElementById('rate-protein').value);
  const salsa = parseInt(document.getElementById('rate-salsa').value);
  const value = parseInt(document.getElementById('rate-value').value);
  const ratings = {
    overall: Math.round(((tortilla + protein + salsa + value) / 4) * 10) / 10,
    tortilla,
    protein,
    salsa,
    value,
  };

  const text = document.getElementById('review-text').value.trim();
  const wouldWait = document.getElementById('review-wait').checked;
  const photoFile = document.getElementById('review-photo').files[0];

  try {
    let photoURL = null;

    // Upload photo if provided
    if (photoFile) {
      const fileName = `reviews/${currentUser.uid}/${Date.now()}_${photoFile.name}`;
      const ref = storage.ref(fileName);
      await ref.put(photoFile);
      photoURL = await ref.getDownloadURL();
    }

    // Get place name
    const placeDoc = await db.collection('places').doc(currentPlaceId).get();
    const placeName = placeDoc.exists ? placeDoc.data().name : 'Unknown';

    // Create review
    await db.collection('reviews').add({
      placeId: currentPlaceId,
      placeName: placeName,
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Anonymous',
      ratings,
      tags: selectedTags,
      text,
      wouldWait,
      photoURL,
      likes: [],
      commentCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update place aggregates
    await updatePlaceAggregates(currentPlaceId, ratings, wouldWait, selectedTags);

    // Update user review count
    await db.collection('users').doc(currentUser.uid).update({
      reviewCount: firebase.firestore.FieldValue.increment(1)
    });

    // Check for badges
    await checkBadges(currentUser.uid);

    closeReviewModal();
    showToast('Review posted!');

    // Reload current view
    if (currentView === 'place') {
      loadPlaceDetail(currentPlaceId);
    } else {
      loadFeed();
    }
  } catch (err) {
    console.error('Review error:', err);
    showToast('Could not post review');
  }
}

async function updatePlaceAggregates(placeId, newRatings, wouldWait, tags) {
  const placeRef = db.collection('places').doc(placeId);

  try {
    await db.runTransaction(async (transaction) => {
      const placeDoc = await transaction.get(placeRef);
      if (!placeDoc.exists) return;

      const data = placeDoc.data();
      const count = (data.reviewCount || 0) + 1;

      // Running average: newAvg = ((oldAvg * oldCount) + newVal) / newCount
      const categories = ['overall', 'tortilla', 'protein', 'salsa', 'value'];
      const updates = { reviewCount: count };

      categories.forEach(cat => {
        const key = `avg${capitalize(cat)}`;
        const oldAvg = data[key] || 0;
        const oldCount = data.reviewCount || 0;
        updates[key] = ((oldAvg * oldCount) + newRatings[cat]) / count;
      });

      if (wouldWait) {
        updates.waitYesCount = (data.waitYesCount || 0) + 1;
      }

      // Merge tags
      const existingTags = data.topTags || [];
      const merged = [...new Set([...existingTags, ...tags])].slice(0, 10);
      updates.topTags = merged;

      transaction.update(placeRef, updates);
    });
  } catch (err) {
    console.error('Aggregate update error:', err);
  }
}

// ===================== LEADERBOARD =====================
function switchLeaderboardTab(btn) {
  document.querySelectorAll('.leaderboard-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  leaderboardTab = btn.dataset.tab;
  loadLeaderboard();
}

async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const monthlyList = document.getElementById('monthly-leaders');
  list.innerHTML = '<div class="spinner"></div>';
  monthlyList.innerHTML = '';

  try {
    const neighborhood = document.getElementById('leaderboard-neighborhood').value;
    const ratingField = `avg${capitalize(leaderboardTab)}`;
    const isOverall = leaderboardTab === 'overall';

    // Always fetch all places and sort client-side (so we can use Google fallback)
    let query = db.collection('places');
    if (neighborhood) {
      query = query.where('neighborhood', '==', neighborhood);
    }
    const snap = await query.limit(200).get();
    let places = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // For each place, compute display score:
    // - CM review score (primary) if it has reviews
    // - Google rating (fallback) for overall tab when no CM reviews
    places.forEach(p => {
      const cmScore = p[ratingField] || 0;
      const hasCM = (p.reviewCount || 0) > 0 && cmScore > 0;
      if (hasCM) {
        p._displayScore = cmScore;
        p._source = 'cm';
      } else if (isOverall && p.googleRating) {
        p._displayScore = p.googleRating;
        p._source = 'google';
      } else {
        p._displayScore = 0;
        p._source = 'none';
      }
    });

    // Sort by display score descending
    places.sort((a, b) => b._displayScore - a._displayScore);
    places = places.filter(p => p._displayScore > 0).slice(0, 20);

    if (places.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏆</span>
          <h3>No rankings yet</h3>
          <p>Start reviewing tacos to build the leaderboard!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    let rank = 1;
    places.forEach(p => {
      const score = p._displayScore ? p._displayScore.toFixed(1) : '-';
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      const sourceLabel = p._source === 'google' ? ' · <span class="leaderboard-google-badge">G</span>' : '';
      const reviewLabel = p._source === 'cm'
        ? `${p.reviewCount || 0} review${(p.reviewCount || 0) !== 1 ? 's' : ''}`
        : p._source === 'google' ? 'Google' : '';

      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      item.onclick = () => navigate('place', p.id);
      item.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${medal}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${escapeHtml(p.name)}</div>
          <div class="leaderboard-neighborhood">${formatNeighborhood(p.neighborhood)} · ${reviewLabel}${sourceLabel}</div>
        </div>
        <div class="leaderboard-score">${score}</div>
      `;
      list.appendChild(item);
      rank++;
    });

    // Monthly leaders - top 5
    const top5 = places.slice(0, 5);
    top5.forEach((p, i) => {
      const score = p._displayScore ? p._displayScore.toFixed(1) : '-';
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      monthlyList.innerHTML += `
        <div class="leaderboard-item" onclick="navigate('place','${p.id}')">
          <div class="leaderboard-rank">${medals[i]}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(p.name)}</div>
          </div>
          <div class="leaderboard-score">${score}</div>
        </div>
      `;
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏆</span>
        <h3>Leaderboard</h3>
        <p>Add taco spots and reviews to see rankings!</p>
      </div>
    `;
  }
}

// ===================== TACO OF THE YEAR =====================
function startTotyCountdown() {
  function update() {
    const now = new Date();
    const ceremony = new Date('2026-12-15T19:00:00-06:00'); // Dec 15, 2026 Houston time
    const diff = ceremony - now;

    if (diff <= 0) {
      document.getElementById('toty-countdown').innerHTML = '<strong>The 2026 Taco of the Year has been crowned!</strong>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('toty-countdown').innerHTML = `
      <div class="cd-unit"><span class="cd-num">${days}</span><span class="cd-label">Days</span></div>
      <div class="cd-unit"><span class="cd-num">${hours}</span><span class="cd-label">Hours</span></div>
      <div class="cd-unit"><span class="cd-num">${mins}</span><span class="cd-label">Min</span></div>
      <div class="cd-unit"><span class="cd-num">${secs}</span><span class="cd-label">Sec</span></div>
    `;
  }

  update();
  setInterval(update, 1000);
}

async function loadTotyLeaders() {
  const categories = [
    { key: 'overall', el: 'toty-overall-leader' },
    { key: 'tortilla', el: 'toty-tortilla-leader' },
    { key: 'protein', el: 'toty-protein-leader' },
    { key: 'salsa', el: 'toty-salsa-leader' },
    { key: 'value', el: 'toty-value-leader' },
  ];

  for (const cat of categories) {
    try {
      const snap = await db.collection('places')
        .orderBy(`avg${capitalize(cat.key)}`, 'desc')
        .limit(1).get();

      const el = document.getElementById(cat.el);
      if (!snap.empty) {
        const place = snap.docs[0].data();
        const score = place[`avg${capitalize(cat.key)}`]?.toFixed(1) || '-';
        el.innerHTML = `🏆 ${escapeHtml(place.name)} (${score})`;
      } else {
        el.innerHTML = 'No leader yet';
      }
    } catch {
      document.getElementById(cat.el).innerHTML = 'TBD';
    }
  }

  // Newcomer category
  try {
    const el = document.getElementById('toty-newcomer-leader');
    const start2026 = new Date('2026-01-01');
    const snap = await db.collection('places')
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start2026))
      .orderBy('createdAt')
      .limit(10).get();

    if (!snap.empty) {
      // Find the one with highest avgOverall among newcomers
      let best = null;
      let bestScore = -1;
      snap.forEach(doc => {
        const d = doc.data();
        if ((d.avgOverall || 0) > bestScore) {
          bestScore = d.avgOverall || 0;
          best = d;
        }
      });
      if (best) {
        el.innerHTML = `🏆 ${escapeHtml(best.name)}`;
      } else {
        el.innerHTML = 'No newcomers yet';
      }
    } else {
      el.innerHTML = 'No newcomers yet';
    }
  } catch {
    document.getElementById('toty-newcomer-leader').innerHTML = 'TBD';
  }
}

// ===================== PROFILE =====================
async function loadProfile(userId) {
  if (!userId) {
    navigate('auth');
    return;
  }

  currentProfileId = userId;

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const actionBtn = document.getElementById('profile-action-btn');

    if (userDoc.exists) {
      const user = userDoc.data();
      document.getElementById('profile-name').textContent = user.displayName || 'Taco Lover';
      document.getElementById('profile-handle').textContent = user.handle || '';
      document.getElementById('stat-reviews').textContent = user.reviewCount || 0;
      document.getElementById('stat-followers').textContent = user.followers || 0;
      document.getElementById('stat-following').textContent = user.following || 0;

      // Show Google profile photo if available
      const avatarEl = document.getElementById('profile-avatar');
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${escapeHtml(user.photoURL)}" alt="Profile" />`;
        avatarEl.classList.add('has-photo');
      } else {
        avatarEl.innerHTML = '🌮';
        avatarEl.classList.remove('has-photo');
      }

      // Badges
      const badgesEl = document.getElementById('profile-badges');
      const badges = user.badges || [];
      badgesEl.innerHTML = badges.map(b => `<span class="badge">${escapeHtml(b)}</span>`).join('');

      // Follow / Sign Out button
      if (currentUser && currentUser.uid === userId) {
        actionBtn.classList.remove('hidden');
        actionBtn.textContent = 'Sign Out';
        actionBtn.className = 'btn-secondary';
        actionBtn.onclick = signOut;
      } else if (currentUser) {
        actionBtn.classList.remove('hidden');
        const isFollowing = await checkIfFollowing(currentUser.uid, userId);
        actionBtn.textContent = isFollowing ? 'Following' : 'Follow';
        actionBtn.className = isFollowing ? 'btn-follow following' : 'btn-follow';
        actionBtn.onclick = () => toggleFollow(userId);
      } else {
        actionBtn.classList.add('hidden');
      }
    } else if (currentUser && currentUser.uid === userId) {
      document.getElementById('profile-name').textContent = currentUser.displayName || 'Taco Lover';
      document.getElementById('profile-handle').textContent = '';
      actionBtn.classList.remove('hidden');
      actionBtn.textContent = 'Sign Out';
      actionBtn.className = 'btn-secondary';
      actionBtn.onclick = signOut;
    }

    loadProfileContent(userId);
  } catch (err) {
    console.error('Profile error:', err);
  }
}

function switchProfileTab(btn) {
  document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  profileTab = btn.dataset.tab;
  loadProfileContent(currentProfileId);
}

async function loadProfileContent(userId) {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    if (profileTab === 'reviews') {
      const snap = await db.collection('reviews')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(20).get();

      content.innerHTML = '';
      if (snap.empty) {
        content.innerHTML = '<div class="empty-state"><p>No reviews yet</p></div>';
        return;
      }
      snap.forEach(doc => {
        content.appendChild(createReviewCard(doc.id, doc.data()));
      });
    } else if (profileTab === 'favorites') {
      const snap = await db.collection('reviews')
        .where('likes', 'array-contains', userId)
        .orderBy('createdAt', 'desc')
        .limit(20).get();

      content.innerHTML = '';
      if (snap.empty) {
        content.innerHTML = '<div class="empty-state"><p>No favorites yet</p></div>';
        return;
      }
      snap.forEach(doc => {
        content.appendChild(createReviewCard(doc.id, doc.data()));
      });
    } else {
      content.innerHTML = '<div class="empty-state"><p>Taco Trails coming soon! 🌮🗺️</p></div>';
    }
  } catch (err) {
    console.error('Profile content error:', err);
    content.innerHTML = '<div class="empty-state"><p>Could not load content</p></div>';
  }
}

// ===================== FOLLOW SYSTEM =====================
async function checkIfFollowing(followerId, followingId) {
  try {
    const snap = await db.collection('follows')
      .where('followerId', '==', followerId)
      .where('followingId', '==', followingId)
      .limit(1).get();
    return !snap.empty;
  } catch {
    return false;
  }
}

async function toggleFollow(userId) {
  if (!currentUser) { navigate('auth'); return; }

  const isFollowing = await checkIfFollowing(currentUser.uid, userId);
  const btn = document.getElementById('profile-action-btn');

  try {
    if (isFollowing) {
      // Unfollow
      const snap = await db.collection('follows')
        .where('followerId', '==', currentUser.uid)
        .where('followingId', '==', userId)
        .limit(1).get();

      if (!snap.empty) {
        await snap.docs[0].ref.delete();
      }

      await db.collection('users').doc(userId).update({
        followers: firebase.firestore.FieldValue.increment(-1)
      });
      await db.collection('users').doc(currentUser.uid).update({
        following: firebase.firestore.FieldValue.increment(-1)
      });

      btn.textContent = 'Follow';
      btn.className = 'btn-follow';
      showToast('Unfollowed');
    } else {
      // Follow
      await db.collection('follows').add({
        followerId: currentUser.uid,
        followingId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await db.collection('users').doc(userId).update({
        followers: firebase.firestore.FieldValue.increment(1)
      });
      await db.collection('users').doc(currentUser.uid).update({
        following: firebase.firestore.FieldValue.increment(1)
      });

      btn.textContent = 'Following';
      btn.className = 'btn-follow following';
      showToast('Following!');
    }
  } catch (err) {
    console.error('Follow error:', err);
    showToast('Could not update follow');
  }
}

// ===================== BADGES =====================
async function checkBadges(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const count = userData.reviewCount || 0;
    const badges = userData.badges || [];
    const newBadges = [...badges];

    if (count >= 1 && !badges.includes('First Taco 🌮')) {
      newBadges.push('First Taco 🌮');
    }
    if (count >= 10 && !badges.includes('Taco Explorer 🗺️')) {
      newBadges.push('Taco Explorer 🗺️');
    }
    if (count >= 25 && !badges.includes('Taco Enthusiast 🔥')) {
      newBadges.push('Taco Enthusiast 🔥');
    }
    if (count >= 50 && !badges.includes('Taco Connoisseur 👑')) {
      newBadges.push('Taco Connoisseur 👑');
    }
    if (count >= 100 && !badges.includes('100 Tacos Club 💯')) {
      newBadges.push('100 Tacos Club 💯');
    }

    if (newBadges.length > badges.length) {
      await db.collection('users').doc(userId).update({ badges: newBadges });
      const latest = newBadges[newBadges.length - 1];
      showToast(`Badge earned: ${latest}`);
    }
  } catch (err) {
    console.error('Badge check error:', err);
  }
}

// ===================== SEARCH =====================
function toggleSearch() {
  const bar = document.getElementById('search-bar');
  bar.classList.toggle('hidden');
  if (!bar.classList.contains('hidden')) {
    document.getElementById('search-input').focus();
  }
}

async function handleSearch(query) {
  if (query.length < 2) return;

  try {
    const snap = await db.collection('places')
      .where('name', '>=', query)
      .where('name', '<=', query + '\uf8ff')
      .limit(5).get();

    if (!snap.empty) {
      const firstResult = snap.docs[0];
      navigate('place', firstResult.id);
      toggleSearch();
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

// ===================== SHARE =====================
function openShareModal(reviewId) {
  document.getElementById('share-modal').classList.remove('hidden');
  const body = document.getElementById('share-card-body');
  body.innerHTML = `<p style="font-size:14px;color:#6D4C41">Loading review...</p>`;

  db.collection('reviews').doc(reviewId).get().then(doc => {
    if (!doc.exists) return;
    const r = doc.data();
    body.innerHTML = `
      <h4 style="margin-bottom:4px">${escapeHtml(r.placeName || 'A taco spot')}</h4>
      <p style="font-size:24px;margin:8px 0">★ ${r.ratings?.overall || '-'}/10</p>
      ${r.text ? `<p style="font-size:14px;color:#6D4C41;font-style:italic">"${escapeHtml(r.text.slice(0, 120))}"</p>` : ''}
      <p style="font-size:12px;color:#8D6E63;margin-top:8px">— ${escapeHtml(r.userName || 'Anonymous')}</p>
    `;
  });
}

function closeShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
}

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!');
  }).catch(() => {
    showToast('Could not copy link');
  });
}

function shareNative() {
  if (navigator.share) {
    navigator.share({
      title: 'Chorizo Mejor',
      text: 'Check out this taco review on Chorizo Mejor!',
      url: window.location.href
    });
  } else {
    copyShareLink();
  }
}

// ===================== TOAST =====================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===================== UTILITIES =====================
// Fetch live Google rating from the serverless API and update the UI
async function fetchLiveRatings(place) {
  const googleSlot = document.getElementById('google-rating-slot');
  try {
    const params = new URLSearchParams({
      name: place.name,
      lat: place.lat,
      lng: place.lng
    });
    const res = await fetch(`/api/ratings?${params}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    if (data.google && data.google.rating) {
      // Update the Google button with live rating
      if (googleSlot) {
        googleSlot.innerHTML =
          `<span class="ext-rating">${data.google.rating}</span>` +
          `<span class="ext-stars">${renderStars(data.google.rating, 'google')}</span>` +
          (data.google.reviewCount ? `<span class="ext-count">(${data.google.reviewCount.toLocaleString()})</span>` : '');
      }
      // Update link to the canonical Google Maps URL
      const googleLink = document.getElementById('google-link');
      if (googleLink && data.google.url) googleLink.href = data.google.url;

      // Persist Google rating to Firestore (keeps data fresh for leaderboard/explore)
      if (currentPlaceId) {
        db.collection('places').doc(currentPlaceId).update({
          googleRating: data.google.rating,
          googleReviewCount: data.google.reviewCount || 0
        }).catch(() => {}); // fire-and-forget
      }

      // If no CM reviews, use Google rating as the hero fallback
      const heroEl = document.getElementById('hero-rating');
      if (heroEl && heroEl.dataset.needsFallback === 'true') {
        document.getElementById('hero-rating-number').textContent = data.google.rating.toFixed(1);
        document.getElementById('hero-rating-stars').innerHTML = renderStars(data.google.rating, 'google');
        const countStr = data.google.reviewCount ? ` (${data.google.reviewCount.toLocaleString()})` : '';
        document.getElementById('hero-rating-source').textContent = `Google rating${countStr}`;
        heroEl.dataset.needsFallback = 'false';
      }
    } else if (googleSlot) {
      googleSlot.innerHTML = '<span class="ext-label">Google</span>';
    }
  } catch (e) {
    if (googleSlot) googleSlot.innerHTML = '<span class="ext-label">Google</span>';
  }
}

// Render star icons for ratings (CM / Google / Yelp)
function renderStars(rating, platform) {
  const color = platform === 'cm' ? '#D84315' : platform === 'yelp' ? '#FF1A1A' : '#FBBC05';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3 ? 1 : 0;
  const empty = 5 - full - half;
  const uid = Math.random().toString(36).slice(2, 6);
  const s = `<svg viewBox="0 0 12 12" width="12" height="12"><path fill="${color}" d="M6 0l1.76 3.57 3.94.57-2.85 2.78.67 3.93L6 8.88 2.48 10.85l.67-3.93L.3 4.14l3.94-.57z"/></svg>`;
  const h = `<svg viewBox="0 0 12 12" width="12" height="12"><defs><linearGradient id="hg${uid}"><stop offset="50%" stop-color="${color}"/><stop offset="50%" stop-color="#ddd"/></linearGradient></defs><path fill="url(#hg${uid})" d="M6 0l1.76 3.57 3.94.57-2.85 2.78.67 3.93L6 8.88 2.48 10.85l.67-3.93L.3 4.14l3.94-.57z"/></svg>`;
  const e = '<svg viewBox="0 0 12 12" width="12" height="12"><path fill="#ddd" d="M6 0l1.76 3.57 3.94.57-2.85 2.78.67 3.93L6 8.88 2.48 10.85l.67-3.93L.3 4.14l3.94-.57z"/></svg>';
  return s.repeat(full) + (half ? h : '') + e.repeat(empty);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTag(tag) {
  const tagNames = {
    'chorizo': 'Chorizo',
    'barbacoa': 'Barbacoa',
    'bean-cheese': 'Bean & Cheese',
    'carne-guisada': 'Carne Guisada',
    'al-pastor': 'Al Pastor',
    'egg-cheese': 'Egg & Cheese',
    'chicharron': 'Chicharrón',
    'migas': 'Migas',
    'potato-egg': 'Potato & Egg',
    'bacon-egg-cheese': 'Bacon Egg & Cheese',
    'other': 'Other'
  };
  return tagNames[tag] || tag;
}

/* Maps legacy neighborhood keys (from old seed data) to current HOOD_DATA keys */
const LEGACY_HOOD_MAP = {
  'eado': 'east-end',
  'spring-branch': 'spring-branch-central',
  'bellaire': 'meyerland',
  'sugar-land': 'meyerland',
  'spring': 'northline'
};

function formatNeighborhood(code) {
  const mapped = LEGACY_HOOD_MAP[code] || code;
  if (typeof HOOD_DATA !== 'undefined' && HOOD_DATA[mapped]) return HOOD_DATA[mapped].label;
  // Absolute fallback
  const legacy = {
    'eado': 'EaDo', 'spring-branch': 'Spring Branch',
    'bellaire': 'Bellaire', 'sugar-land': 'Sugar Land', 'spring': 'Spring'
  };
  return legacy[code] || code || '';
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}
