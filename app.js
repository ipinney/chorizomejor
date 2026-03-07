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

// ===================== GOOGLE PLACES PHOTO CACHE =====================
const _photoCache = {};

/**
 * Fetch a real food photo URL from Google Places API via /api/photos proxy.
 * Returns the first photo URL or null. Results cached in-memory.
 */
async function fetchPlacePhoto(name, lat, lng, size) {
  const key = `${name}|${lat}|${lng}`;
  if (_photoCache[key] !== undefined) return _photoCache[key];

  try {
    const params = new URLSearchParams({ name, lat, lng, size: size || 400 });
    const res = await fetch(`/api/photos?${params}`);
    if (!res.ok) { _photoCache[key] = null; return null; }
    const data = await res.json();
    const url = data.photos && data.photos.length > 0 ? data.photos[0].url : null;
    _photoCache[key] = url;
    return url;
  } catch {
    _photoCache[key] = null;
    return null;
  }
}

/**
 * Lazily load a real photo for a place card image element.
 * Replaces satellite/emoji placeholder with a real food photo.
 */
function lazyLoadPlacePhoto(imgEl, place) {
  if (!place.name || !place.lat || !place.lng) return;
  if (place.photoURL || place.imageURL || place.googlePhotoURL) return; // already has a photo

  fetchPlacePhoto(place.name, place.lat, place.lng, 200).then(url => {
    if (url && imgEl && imgEl.isConnected) {
      imgEl.src = url;
      imgEl.alt = place.name;
      imgEl.classList.add('place-card-img');
      imgEl.style.objectFit = 'cover';
    }
  });
}

// ===================== GAMIFICATION CONFIG =====================
const TACO_TIERS = [
  { level: 1, name: 'Taco Newbie', icon: '🌱', minReviews: 0, minXP: 0 },
  { level: 2, name: 'Taco Curious', icon: '🌮', minReviews: 3, minXP: 50 },
  { level: 3, name: 'Taco Explorer', icon: '🗺️', minReviews: 10, minXP: 200 },
  { level: 4, name: 'Taco Enthusiast', icon: '🔥', minReviews: 25, minXP: 500 },
  { level: 5, name: 'Taco Connoisseur', icon: '👑', minReviews: 50, minXP: 1200 },
  { level: 6, name: 'Taco Legend', icon: '🏆', minReviews: 100, minXP: 3000 }
];

const BADGES_CONFIG = [
  // Review Quality
  { id: 'shutterbug', name: 'Shutterbug', icon: '📸', desc: 'Upload 5+ review photos', category: 'quality', secret: false },
  { id: 'wordsmith', name: 'Wordsmith', icon: '📝', desc: 'Write 5 detailed reviews (200+ chars)', category: 'quality', secret: false },
  { id: 'perfect10', name: 'Perfect 10', icon: '⭐', desc: 'Give a place a perfect 5/5', category: 'quality', secret: false },
  // Exploration
  { id: 'hood_hopper', name: 'Hood Hopper', icon: '🏘️', desc: 'Review in 5+ neighborhoods', category: 'exploration', secret: false },
  { id: 'truck_hunter', name: 'Truck Hunter', icon: '🚚', desc: 'Review 3+ food trucks', category: 'exploration', secret: false },
  { id: 'city_explorer', name: 'City Explorer', icon: '🗺️', desc: 'Review in 10+ neighborhoods', category: 'exploration', secret: false },
  // Social
  { id: 'conversation_starter', name: 'Conversation Starter', icon: '💬', desc: 'Get 10+ comments on your reviews', category: 'social', secret: false },
  { id: 'crowd_favorite', name: 'Crowd Favorite', icon: '❤️', desc: 'Get 25+ total likes', category: 'social', secret: false },
  { id: 'influencer', name: 'Influencer', icon: '👥', desc: 'Gain 10+ followers', category: 'social', secret: false },
  { id: 'social_butterfly', name: 'Social Butterfly', icon: '📢', desc: 'Share 5+ reviews', category: 'social', secret: false },
  // Dedication
  { id: 'on_fire', name: 'On Fire', icon: '🔥', desc: '7-day review streak', category: 'dedication', secret: false },
  { id: 'monthly_regular', name: 'Monthly Regular', icon: '📅', desc: 'Review 4 weeks in a row', category: 'dedication', secret: false },
  { id: 'veteran', name: 'Veteran', icon: '🎖️', desc: 'Account 6+ months with 20+ reviews', category: 'dedication', secret: false },
  // Secret (not shown until earned)
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', desc: 'Review before 7 AM', category: 'secret', secret: true },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Review after 11 PM', category: 'secret', secret: true },
  { id: 'first_reviewer', name: 'First!', icon: '🎯', desc: 'First to review a new place', category: 'secret', secret: true },
  { id: 'taco_newbie', name: 'First Taco', icon: '🌮', desc: 'Submit your first review', category: 'milestone', secret: false },
  { id: 'ten_reviews', name: 'Double Digits', icon: '🔟', desc: 'Reach 10 reviews', category: 'milestone', secret: false },
  { id: 'fifty_reviews', name: 'Half Century', icon: '5️⃣0️⃣', desc: 'Reach 50 reviews', category: 'milestone', secret: false },
  { id: 'hundred_club', name: '100 Club', icon: '💯', desc: 'Reach 100 reviews', category: 'milestone', secret: false }
];

const XP_REWARDS = {
  submitReview: 10,
  uploadPhoto: 5,
  detailedReview: 5,   // 200+ chars
  receiveLike: 2,
  receiveComment: 3,
  shareReview: 3,
  dailyLogin: 5,
  firstReviewBonus: 25
};

let userGameData = null; // cached gamification data for current user

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
  auth.onAuthStateChanged(async user => {
    currentUser = user;
    updateAuthUI();
    if (window.location.hash) {
      handleRoute();
    } else {
      navigate('feed');
    }
    // Daily login XP bonus
    if (user) {
      checkDailyLoginBonus(user.uid);
      checkWeeklyChallenge(user.uid);
    }
  });

  // Handle ?place=xxx query params (from social share links — X strips hash fragments)
  const urlParams = new URLSearchParams(window.location.search);
  const sharedPlaceId = urlParams.get('place');
  if (sharedPlaceId) {
    window.history.replaceState(null, '', '/#/place/' + sharedPlaceId);
  }

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
      // Track map exploration for onboarding
      if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({ exploredMap: true }).catch(() => {});
      }
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
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        xp: 0,
        streakCurrent: 0,
        streakLongest: 0,
        streakFreezeAvailable: true,
        shareCount: 0,
        photoReviewCount: 0,
        badgeIds: [],
        onboardingComplete: false,
        exploredMap: false
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
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        xp: 0,
        streakCurrent: 0,
        streakLongest: 0,
        streakFreezeAvailable: true,
        shareCount: 0,
        photoReviewCount: 0,
        badgeIds: [],
        onboardingComplete: false,
        exploredMap: false
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
    let query = db.collection('reviews').limit(50);
    let needsClientSort = true;

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
          .limit(50);
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

    // Sort client-side to avoid composite index requirement
    const sortedDocs = snap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || 0;
      const bTime = b.data().createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    }).slice(0, 20);

    feedList.innerHTML = '';
    for (const doc of sortedDocs) {
      const review = doc.data();
      feedList.appendChild(createReviewCard(doc.id, review));
    }

    // Check onboarding quest
    if (currentUser) {
      checkOnboarding(currentUser.uid);
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

  // Only show real uploaded photos, not avatar/placeholder URLs
  const hasRealReviewPhoto = review.photoURL && !review.photoURL.includes('dicebear.com');
  const photoHTML = hasRealReviewPhoto
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
        <div class="card-username" onclick="navigate('profile','${escapeHtml(review.userId)}')">${escapeHtml(review.userName || 'Anonymous')} <span class="card-tier-badge">${review.userTier || '🌱'}</span></div>
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
      <button class="card-action-btn ${Array.isArray(review.likes) && currentUser && review.likes.includes(currentUser.uid) ? 'liked' : ''}"
              onclick="toggleLike('${reviewId}', this)">
        <span class="material-icons-round" style="font-size:18px">favorite</span>
        <span class="like-count">${Array.isArray(review.likes) ? (review.likes.length || '') : (review.likes || '')}</span>
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
    incrementChallengeProgress(currentUser.uid, 'weeklyLikes');
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
    incrementChallengeProgress(currentUser.uid, 'weeklyComments');
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
  const hasRealPhoto = place.photoURL || place.imageURL || place.googlePhotoURL;
  if (hasRealPhoto) {
    const photoSrc = place.googlePhotoURL || place.photoURL || place.imageURL;
    imgHtml = `<img class="place-card-img" src="${escapeHtml(photoSrc)}" alt="${escapeHtml(place.name)}" loading="lazy" style="object-fit:cover" onerror="this.outerHTML='<div class=\\'place-card-img\\'>${typeEmoji[place.type] || '🌮'}</div>'" />`;
  } else if (place.lat && place.lng && mbToken) {
    // Temporary satellite placeholder — will be replaced by real photo
    imgHtml = `<img class="place-card-img" data-needs-photo="true" src="https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${place.lng},${place.lat},16,0/72x72@2x?access_token=${mbToken}" alt="${escapeHtml(place.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'place-card-img\\'>${typeEmoji[place.type] || '🌮'}</div>'" />`;
  } else {
    imgHtml = `<div class="place-card-img">${typeEmoji[place.type] || '🌮'}</div>`;
  }

  // Place card badges
  const badges = [];
  const reviewCount = place.reviewCount || 0;
  const createdMs = place.createdAt?.toMillis?.() || 0;
  const isNew = createdMs > Date.now() - 14 * 86400000; // less than 2 weeks old
  const isTrending = reviewCount >= 5 && (place.avgOverall || 0) >= 4;
  const needsReviews = reviewCount === 0;

  if (needsReviews) badges.push('<span class="place-badge needs-review">🎯 Be First!</span>');
  else if (isNew) badges.push('<span class="place-badge new-spot">✨ New</span>');
  if (isTrending) badges.push('<span class="place-badge trending">🔥 Trending</span>');

  card.innerHTML = `
    <div class="place-card">
      ${imgHtml}
      <div class="place-card-info">
        <div class="place-card-name">${escapeHtml(place.name)}</div>
        <div class="place-card-address">${escapeHtml(place.address || '')}</div>
        <div class="place-card-badges">${badges.join('')}</div>
        <div class="place-card-stats">
          <span class="place-card-score">★ ${score}${score !== '-' ? '/5' : ''}</span>
          <span>${reviewCount} reviews</span>
          <span>${formatNeighborhood(place.neighborhood)}</span>
        </div>
      </div>
    </div>
  `;

  // Lazy-load real Google Places photo for cards without a photo
  if (!hasRealPhoto && place.lat && place.lng) {
    const imgEl = card.querySelector('img[data-needs-photo]');
    if (imgEl) lazyLoadPlacePhoto(imgEl, place);
  }

  return card;
}

// ===================== MAP =====================
let mapInstance = null;
let mapMarkers = [];
let mapReady = false;
let pendingPlaces = null;
let allMapPlaces = null; // Cache ALL places for the map (fetched once)

// Fetch ALL places from Firestore for map markers (no limit)
async function fetchAllPlacesForMap() {
  if (allMapPlaces) return allMapPlaces;
  try {
    const snap = await db.collection('places').get();
    allMapPlaces = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return allMapPlaces;
  } catch (err) {
    console.error('Failed to fetch all places for map:', err);
    return null;
  }
}

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

  // Fetch ALL places for map markers (not just the grid's limited 30)
  const allPlaces = await fetchAllPlacesForMap();
  const mapPlaces = allPlaces || places; // fallback to grid places if fetch fails

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
    addMarkers(mapPlaces);
  } else {
    pendingPlaces = mapPlaces;
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
      'fill-opacity': 0.10
    }
  }, mapInstance.getStyle().layers.find(l => l.type === 'symbol')?.id);

  mapInstance.addLayer({
    id: 'hood-outline',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#D84315',
      'line-width': 2,
      'line-opacity': 0.5,
      'line-dasharray': [4, 3]
    }
  });

  mapInstance.addLayer({
    id: 'hood-labels',
    type: 'symbol',
    source: 'neighborhoods',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#BF360C',
      'text-halo-color': '#fff',
      'text-halo-width': 2,
      'text-opacity': 0.85
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

    // Enriched info: description, hours, price level
    const enrichedEl = document.getElementById('place-enriched-info');
    const descEl = document.getElementById('place-description');
    const hoursSection = document.getElementById('place-hours-section');
    const hoursStatus = document.getElementById('place-hours-status');
    const hoursList = document.getElementById('place-hours-list');
    const priceEl = document.getElementById('place-price-level');

    let hasEnrichedInfo = false;

    if (place.description) {
      descEl.textContent = place.description;
      descEl.style.display = '';
      hasEnrichedInfo = true;
    } else {
      descEl.style.display = 'none';
    }

    if (place.hours && place.hours.length > 0) {
      hoursSection.style.display = '';
      hoursSection.classList.remove('expanded');
      // Show today's hours in the toggle
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = dayNames[new Date().getDay()];
      const todayHours = place.hours.find(h => h.startsWith(today));
      hoursStatus.textContent = todayHours || 'See hours';
      hoursList.innerHTML = place.hours.map(h => `<div>${escapeHtml(h)}</div>`).join('');
      hasEnrichedInfo = true;
    } else {
      hoursSection.style.display = 'none';
    }

    if (place.priceLevel) {
      const priceLevels = {
        'PRICE_LEVEL_FREE': { dots: 0, label: 'Free' },
        'PRICE_LEVEL_INEXPENSIVE': { dots: 1, label: 'Inexpensive' },
        'PRICE_LEVEL_MODERATE': { dots: 2, label: 'Moderate' },
        'PRICE_LEVEL_EXPENSIVE': { dots: 3, label: 'Expensive' },
        'PRICE_LEVEL_VERY_EXPENSIVE': { dots: 4, label: 'Very Expensive' }
      };
      const pl = priceLevels[place.priceLevel] || { dots: 0, label: '' };
      if (pl.label) {
        const active = '<span class="price-active">$</span>'.repeat(pl.dots);
        const inactive = '<span style="opacity:0.3">$</span>'.repeat(Math.max(0, 4 - pl.dots));
        priceEl.innerHTML = `${active}${inactive} · ${pl.label}`;
        priceEl.style.display = '';
        hasEnrichedInfo = true;
      } else {
        priceEl.style.display = 'none';
      }
    } else {
      priceEl.style.display = 'none';
    }

    enrichedEl.style.display = hasEnrichedInfo ? '' : 'none';

    // Banner — fallback chain: imageURL → googlePhotoURL → photoURL → Google Places API → Mapbox satellite → emoji
    (() => {
      const imgEl = document.getElementById('place-banner-img');
      const emojiEl = document.querySelector('#place-photo-banner .place-banner-emoji');
      const mbToken = (window.__mb || []).join('');
      let src = null;
      if (place.imageURL) {
        src = place.imageURL;
      } else if (place.googlePhotoURL) {
        src = place.googlePhotoURL;
      } else if (place.photoURL) {
        src = place.photoURL;
      }

      if (src) {
        imgEl.src = src;
        imgEl.alt = place.name || 'Place photo';
        imgEl.style.display = 'block';
        imgEl.style.objectFit = 'cover';
        emojiEl.style.display = 'none';
      } else if (place.lat && place.lng) {
        // Show satellite as temp placeholder, then try Google Places photo
        if (mbToken) {
          imgEl.src = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${place.lng},${place.lat},15,0/600x200@2x?access_token=${mbToken}`;
          imgEl.alt = place.name || 'Place photo';
          imgEl.style.display = 'block';
          emojiEl.style.display = 'none';
        }
        // Async upgrade to real photo
        fetchPlacePhoto(place.name, place.lat, place.lng, 600).then(url => {
          if (url) {
            imgEl.src = url;
            imgEl.style.objectFit = 'cover';
            imgEl.style.display = 'block';
            emojiEl.style.display = 'none';
          }
        });
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

    // Check if user has favorited this place
    updateFavButton(placeId);

    // Load reviews
    loadPlaceReviews(placeId);
  } catch (err) {
    console.error('Place detail error:', err);
    showToast('Could not load place');
  }
}

// ===================== PLACE FAVORITES =====================
async function updateFavButton(placeId) {
  const icon = document.getElementById('fav-place-icon');
  const btn = document.getElementById('btn-fav-place');
  if (!icon || !btn) return;

  if (!currentUser) {
    icon.textContent = 'favorite_border';
    btn.classList.remove('is-fav');
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const favPlaces = userDoc.data()?.favoritePlaces || [];
    if (favPlaces.includes(placeId)) {
      icon.textContent = 'favorite';
      btn.classList.add('is-fav');
    } else {
      icon.textContent = 'favorite_border';
      btn.classList.remove('is-fav');
    }
  } catch {
    icon.textContent = 'favorite_border';
    btn.classList.remove('is-fav');
  }
}

async function toggleFavoritePlace() {
  if (!currentUser) {
    navigate('auth');
    return;
  }
  if (!currentPlaceId) return;

  const icon = document.getElementById('fav-place-icon');
  const btn = document.getElementById('btn-fav-place');
  const userRef = db.collection('users').doc(currentUser.uid);

  try {
    const userDoc = await userRef.get();
    const favPlaces = userDoc.data()?.favoritePlaces || [];
    const isFav = favPlaces.includes(currentPlaceId);

    if (isFav) {
      // Remove from favorites
      await userRef.update({
        favoritePlaces: firebase.firestore.FieldValue.arrayRemove(currentPlaceId)
      });
      icon.textContent = 'favorite_border';
      btn.classList.remove('is-fav');
      showToast('Removed from favorites');
    } else {
      // Add to favorites
      await userRef.update({
        favoritePlaces: firebase.firestore.FieldValue.arrayUnion(currentPlaceId)
      });
      icon.textContent = 'favorite';
      btn.classList.add('is-fav');
      showToast('Added to favorites!');

      // Award XP for first favorite
      if (favPlaces.length === 0) {
        await awardXP(currentUser.uid, 3, 'firstFavorite');
      }
    }
  } catch (err) {
    console.error('Favorite error:', err);
    showToast('Could not update favorite');
  }
}

async function loadPlaceReviews(placeId) {
  const list = document.getElementById('place-reviews');
  list.innerHTML = '<div class="spinner"></div>';

  try {
    // Fetch without orderBy to avoid composite index; sort client-side
    const snap = await db.collection('reviews')
      .where('placeId', '==', placeId)
      .limit(30).get();

    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = `
        <div class="first-review-cta">
          <div class="first-review-icon">🎯</div>
          <h3>No reviews yet!</h3>
          <p>Be the first to review this spot and earn the <strong>First!</strong> badge + bonus XP</p>
          <button class="btn-primary first-review-btn" onclick="openReviewModal()">
            <span class="material-icons-round">rate_review</span> Be the First to Review
          </button>
          <div class="first-review-rewards">
            <span class="reward-chip">🎯 First! Badge</span>
            <span class="reward-chip">⭐ +25 Bonus XP</span>
          </div>
        </div>
      `;
      return;
    }

    const sortedDocs = snap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || 0;
      const bTime = b.data().createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    sortedDocs.forEach(doc => {
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

    allMapPlaces = null; // Invalidate map cache so new place shows up
    closePlaceModal();
    showToast(`${name} added!`);
    if (currentUser) incrementChallengeProgress(currentUser.uid, 'weeklyNewSpots');
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
  const t = parseFloat(document.getElementById('rate-tortilla').value);
  const p = parseFloat(document.getElementById('rate-protein').value);
  const s = parseFloat(document.getElementById('rate-salsa').value);
  const v = parseFloat(document.getElementById('rate-value').value);
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

  const tortilla = parseFloat(document.getElementById('rate-tortilla').value);
  const protein = parseFloat(document.getElementById('rate-protein').value);
  const salsa = parseFloat(document.getElementById('rate-salsa').value);
  const value = parseFloat(document.getElementById('rate-value').value);
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

    // Get place name and data
    const placeDoc = await db.collection('places').doc(currentPlaceId).get();
    const placeName = placeDoc.exists ? placeDoc.data().name : 'Unknown';

    // Get user tier icon for the review
    const userSnap = await db.collection('users').doc(currentUser.uid).get();
    const userTierIcon = getUserTier(userSnap.data()?.reviewCount || 0, userSnap.data()?.xp || 0).icon;

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
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      userTier: userTierIcon,
      placeNeighborhood: placeDoc.data()?.neighborhood || '',
      placeType: placeDoc.data()?.type || ''
    });

    // Update place aggregates
    await updatePlaceAggregates(currentPlaceId, ratings, wouldWait, selectedTags);

    // Update user review count
    await db.collection('users').doc(currentUser.uid).update({
      reviewCount: firebase.firestore.FieldValue.increment(1)
    });

    // Check for badges
    await checkBadges(currentUser.uid);

    // Gamification hooks
    let reviewXP = XP_REWARDS.submitReview;
    if (photoURL) {
      reviewXP += XP_REWARDS.uploadPhoto;
      await db.collection('users').doc(currentUser.uid).update({
        photoReviewCount: firebase.firestore.FieldValue.increment(1)
      }).catch(() => {});
    }
    if (text.length >= 200) reviewXP += XP_REWARDS.detailedReview;
    await awardXP(currentUser.uid, reviewXP, 'submitReview');
    await updateStreak(currentUser.uid);

    // Weekly challenge tracking
    incrementChallengeProgress(currentUser.uid, 'weeklyReviews');
    if (photoURL) incrementChallengeProgress(currentUser.uid, 'weeklyPhotos');
    if (text.length >= 200) incrementChallengeProgress(currentUser.uid, 'weeklyDetailed');

    // Review count milestone celebrations
    const newCount = (await db.collection('users').doc(currentUser.uid).get()).data()?.reviewCount || 0;
    if ([5, 10, 25, 50, 75, 100].includes(newCount)) {
      setTimeout(() => showMilestoneToast(newCount), 2000);
    }

    // Trigger share prompt after review
    setTimeout(() => {
      triggerSharePrompt('review', {
        placeName: placeName,
        shareText: `Just rated ${placeName} ${ratings.overall}/5 on Chorizo Mejor! 🌮`,
        shareUrl: `https://www.chorizomejor.com/#/place/${currentPlaceId}`
      });
    }, 1500);

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
      const categories = ['tortilla', 'protein', 'salsa', 'value'];
      const updates = { reviewCount: count };

      categories.forEach(cat => {
        const key = `avg${capitalize(cat)}`;
        const oldAvg = data[key] || 0;
        const oldCount = data.reviewCount || 0;
        updates[key] = ((oldAvg * oldCount) + newRatings[cat]) / count;
      });

      // Derive overall from component averages (never store independently)
      updates.avgOverall = Math.round(((updates.avgTortilla + updates.avgProtein + updates.avgSalsa + updates.avgValue) / 4) * 10) / 10;

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
  // Check if user leaderboard tab is selected
  if (leaderboardTab === 'users') {
    renderUserLeaderboard();
    return;
  }

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

      // Tier & XP display
      const tier = getUserTier(user.reviewCount || 0, user.xp || 0);
      const nextTier = getNextTier(tier);
      const tierProgress = getTierProgress(user.reviewCount || 0, tier, nextTier);

      const tierEl = document.getElementById('profile-tier');
      if (tierEl) {
        const xp = user.xp || 0;
        const reviewCount = user.reviewCount || 0;
        const streak = user.streakCurrent || 0;
        tierEl.innerHTML = `
          <div class="tier-badge tier-${tier.level}">${tier.icon} ${tier.name}</div>
          <div class="profile-stats-row">
            <div class="profile-stat-card xp-card">
              <div class="stat-value">${xp.toLocaleString()}</div>
              <div class="stat-label">⭐ XP</div>
            </div>
            <div class="profile-stat-card">
              <div class="stat-value">${reviewCount}</div>
              <div class="stat-label">📝 Reviews</div>
            </div>
            <div class="profile-stat-card">
              <div class="stat-value">${streak}</div>
              <div class="stat-label">🔥 Streak</div>
            </div>
          </div>
          ${nextTier ? `
            <div class="tier-progress-section">
              <div class="tier-progress-bar">
                <div class="tier-progress-fill" style="width:${tierProgress}%"></div>
              </div>
              <div class="tier-progress-label">${reviewCount}/${nextTier.minReviews} reviews to ${nextTier.icon} ${nextTier.name}</div>
            </div>
          ` : '<div class="tier-progress-label">Max tier reached!</div>'}
        `;
      }

      // Badges
      const badgesEl = document.getElementById('profile-badges');
      const badgeIds = user.badgeIds || [];
      const displayBadges = badgeIds.map(id => {
        const b = BADGES_CONFIG.find(x => x.id === id);
        return b ? `<span class="badge badge-${b.category}" title="${b.desc}">${b.icon} ${b.name}</span>` : '';
      }).filter(Boolean);
      badgesEl.innerHTML = displayBadges.join('') || '<span style="font-size:13px;color:#8D6E63">No badges yet — start reviewing!</span>';

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
      // Fetch without orderBy to avoid composite index requirement; sort client-side
      const snap = await db.collection('reviews')
        .where('userId', '==', userId)
        .limit(20).get();

      content.innerHTML = '';
      if (snap.empty) {
        content.innerHTML = '<div class="empty-state"><p>No reviews yet</p></div>';
        return;
      }
      const docs = snap.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis?.() || 0;
        const bTime = b.data().createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      docs.forEach(doc => {
        content.appendChild(createReviewCard(doc.id, doc.data()));
      });
    } else if (profileTab === 'favorites') {
      // Fetch without orderBy to avoid composite index requirement; sort client-side
      const snap = await db.collection('reviews')
        .where('likes', 'array-contains', userId)
        .limit(20).get();

      content.innerHTML = '';
      if (snap.empty) {
        content.innerHTML = '<div class="empty-state"><p>No favorites yet</p></div>';
        return;
      }
      const docs = snap.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis?.() || 0;
        const bTime = b.data().createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      docs.forEach(doc => {
        content.appendChild(createReviewCard(doc.id, doc.data()));
      });
    } else if (profileTab === 'lists') {
      await renderTacoTrails(userId);
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

// ===================== GAMIFICATION ENGINE =====================
function getUserTier(reviewCount, xp) {
  let tier = TACO_TIERS[0];
  for (const t of TACO_TIERS) {
    if (reviewCount >= t.minReviews) tier = t;
  }
  return tier;
}

function getNextTier(currentTier) {
  const idx = TACO_TIERS.findIndex(t => t.level === currentTier.level);
  return idx < TACO_TIERS.length - 1 ? TACO_TIERS[idx + 1] : null;
}

function getTierProgress(reviewCount, currentTier, nextTier) {
  if (!nextTier) return 100;
  const range = nextTier.minReviews - currentTier.minReviews;
  const progress = reviewCount - currentTier.minReviews;
  return Math.min(100, Math.round((progress / range) * 100));
}

async function awardXP(userId, amount, reason) {
  if (!userId) return;
  try {
    await db.collection('users').doc(userId).update({
      xp: firebase.firestore.FieldValue.increment(amount)
    });
    // Random bonus (20% chance for extra XP)
    if (Math.random() < 0.2 && reason === 'submitReview') {
      const bonus = Math.floor(Math.random() * 10) + 5;
      await db.collection('users').doc(userId).update({
        xp: firebase.firestore.FieldValue.increment(bonus)
      });
      showToast(`🎉 Bonus! +${bonus} XP for a great review!`);
    }
  } catch (err) {
    console.error('XP award error:', err);
  }
}

// ===================== STREAK SYSTEM =====================
async function updateStreak(userId) {
  if (!userId) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const data = userDoc.data();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const lastDate = data.streakLastDate ? data.streakLastDate.toDate().getTime() : 0;
    const lastDay = new Date(new Date(lastDate).getFullYear(), new Date(lastDate).getMonth(), new Date(lastDate).getDate()).getTime();
    const dayDiff = Math.floor((today - lastDay) / 86400000);

    let current = data.streakCurrent || 0;
    let longest = data.streakLongest || 0;

    if (dayDiff === 0) {
      // Already reviewed today, no streak change
      return;
    } else if (dayDiff === 1) {
      // Consecutive day!
      current += 1;
    } else if (dayDiff === 2 && data.streakFreezeAvailable) {
      // Missed one day but have freeze
      current += 1;
      await db.collection('users').doc(userId).update({
        streakFreezeAvailable: false,
        streakFreezeUsedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('❄️ Streak freeze used! Your streak lives on!');
    } else {
      // Streak broken
      if (current > 0) {
        showToast(`Streak reset! Previous: ${current} days`);
      }
      current = 1;
    }

    if (current > longest) longest = current;

    await db.collection('users').doc(userId).update({
      streakCurrent: current,
      streakLongest: longest,
      streakLastDate: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Streak milestone celebrations
    if ([3, 7, 14, 30, 50, 100].includes(current)) {
      showToast(`🔥 ${current}-day streak! You're on fire!`);
      awardXP(userId, current * 2, 'streak');
    }
  } catch (err) {
    console.error('Streak error:', err);
  }
}

// ===================== DAILY LOGIN BONUS =====================
async function checkDailyLoginBonus(userId) {
  if (!userId) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const data = userDoc.data();

    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const lastLogin = data.lastLoginDate || '';

    if (lastLogin === today) return; // Already got bonus today

    // Random multiplier: 10% chance of 2x, 5% chance of 5x
    const roll = Math.random();
    let multiplier = 1;
    let multiplierText = '';
    if (roll < 0.05) {
      multiplier = 5;
      multiplierText = ' (5x Lucky Day!)';
    } else if (roll < 0.15) {
      multiplier = 2;
      multiplierText = ' (2x Bonus!)';
    }

    const xpAmount = XP_REWARDS.dailyLogin * multiplier;
    await db.collection('users').doc(userId).update({
      lastLoginDate: today,
      xp: firebase.firestore.FieldValue.increment(xpAmount),
      loginDays: firebase.firestore.FieldValue.increment(1)
    });

    setTimeout(() => {
      showToast(`☀️ Daily login: +${xpAmount} XP${multiplierText}`);
    }, 1500);
  } catch (err) {
    console.error('Daily login bonus error:', err);
  }
}

// ===================== WEEKLY CHALLENGES =====================
const WEEKLY_CHALLENGES = [
  { id: 'review3', name: 'Review Spree', desc: 'Submit 3 reviews this week', icon: '📝', target: 3, field: 'weeklyReviews', xpReward: 50 },
  { id: 'photo2', name: 'Shutterbug Week', desc: 'Upload 2 photos with reviews', icon: '📸', target: 2, field: 'weeklyPhotos', xpReward: 40 },
  { id: 'hood2', name: 'Hood Crawler', desc: 'Review in 2 different neighborhoods', icon: '🏘️', target: 2, field: 'weeklyHoods', xpReward: 45 },
  { id: 'like5', name: 'Spread the Love', desc: 'Like 5 reviews', icon: '❤️', target: 5, field: 'weeklyLikes', xpReward: 30 },
  { id: 'comment3', name: 'Taco Talk', desc: 'Leave 3 comments', icon: '💬', target: 3, field: 'weeklyComments', xpReward: 35 },
  { id: 'share2', name: 'Word of Mouth', desc: 'Share 2 reviews', icon: '📢', target: 2, field: 'weeklyShares', xpReward: 30 },
  { id: 'detailed2', name: 'Deep Dive', desc: 'Write 2 reviews with 200+ characters', icon: '✍️', target: 2, field: 'weeklyDetailed', xpReward: 45 },
  { id: 'newspot1', name: 'Trailblazer', desc: 'Add a new taco spot', icon: '🗺️', target: 1, field: 'weeklyNewSpots', xpReward: 60 }
];

function getCurrentWeekChallenge() {
  // Rotate challenges weekly using week number
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.floor(((now - startOfYear) / 86400000 + startOfYear.getDay()) / 7);
  return WEEKLY_CHALLENGES[weekNum % WEEKLY_CHALLENGES.length];
}

function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.floor(((now - startOfYear) / 86400000 + startOfYear.getDay()) / 7);
  return `${now.getFullYear()}-W${weekNum}`;
}

async function checkWeeklyChallenge(userId) {
  if (!userId) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const data = userDoc.data();
    const challenge = getCurrentWeekChallenge();
    const weekKey = getWeekKey();

    // Reset weekly progress if new week
    if (data.challengeWeek !== weekKey) {
      await db.collection('users').doc(userId).update({
        challengeWeek: weekKey,
        challengeId: challenge.id,
        challengeProgress: 0,
        challengeCompleted: false
      });
    }

    // Show challenge banner on feed after short delay
    setTimeout(() => renderChallengeBanner(challenge, data.challengeWeek === weekKey ? (data.challengeProgress || 0) : 0, data.challengeCompleted || false), 2000);
  } catch (err) {
    console.error('Weekly challenge error:', err);
  }
}

function renderChallengeBanner(challenge, progress, completed) {
  const existing = document.getElementById('challenge-banner');
  if (existing) existing.remove();

  const feedList = document.getElementById('feed-list');
  if (!feedList) return;

  const pct = Math.min(100, Math.round((progress / challenge.target) * 100));
  const banner = document.createElement('div');
  banner.id = 'challenge-banner';
  banner.className = 'challenge-banner';
  banner.innerHTML = `
    <div class="challenge-header">
      <span class="challenge-icon">${challenge.icon}</span>
      <div class="challenge-info">
        <div class="challenge-title">Weekly Challenge: ${challenge.name}</div>
        <div class="challenge-desc">${challenge.desc}</div>
      </div>
      <span class="challenge-reward">${completed ? '✅' : `+${challenge.xpReward} XP`}</span>
    </div>
    <div class="challenge-progress">
      <div class="challenge-bar">
        <div class="challenge-bar-fill ${completed ? 'complete' : ''}" style="width:${pct}%"></div>
      </div>
      <span class="challenge-count">${Math.min(progress, challenge.target)}/${challenge.target}</span>
    </div>
  `;

  feedList.parentNode.insertBefore(banner, feedList);
}

async function incrementChallengeProgress(userId, field) {
  if (!userId) return;
  try {
    const challenge = getCurrentWeekChallenge();
    if (challenge.field !== field) return; // Not the current challenge

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const data = userDoc.data();

    if (data.challengeCompleted) return; // Already completed this week

    const newProgress = (data.challengeProgress || 0) + 1;
    const updates = { challengeProgress: newProgress };

    if (newProgress >= challenge.target) {
      updates.challengeCompleted = true;
      await db.collection('users').doc(userId).update(updates);
      awardXP(userId, challenge.xpReward, 'weeklyChallenge');
      showToast(`🏆 Weekly challenge complete! +${challenge.xpReward} XP!`);
    } else {
      await db.collection('users').doc(userId).update(updates);
      showToast(`${challenge.icon} Challenge progress: ${newProgress}/${challenge.target}`);
    }
  } catch (err) {
    console.error('Challenge progress error:', err);
  }
}

// ===================== SOCIAL SHARING =====================
function shareToX(text, url) {
  const tweetText = encodeURIComponent(text);
  const tweetUrl = encodeURIComponent(url);
  window.open(`https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`, '_blank', 'width=600,height=400');
}

function shareToFacebook(url) {
  const fbUrl = encodeURIComponent(url);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${fbUrl}`, '_blank', 'width=600,height=400');
}

function shareToInstagram(text) {
  // Instagram doesn't have a web share API - copy text for the user
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Caption copied! Open Instagram to share your photo');
  }).catch(() => {
    showToast('Could not copy to clipboard');
  });
}

function getShareText(review, place) {
  const score = review.ratings?.overall || '-';
  const excerpt = review.text ? review.text.slice(0, 80) + (review.text.length > 80 ? '...' : '') : '';
  return `Just rated ${place || review.placeName} ${score}/5 on Chorizo Mejor! 🌮 ${excerpt}`;
}

function getShareUrl(placeId) {
  // Use query param so X/Twitter crawler sees a unique URL per place
  // (hash fragments are stripped by crawlers, so #/place/... never reaches Twitterbot)
  return `https://www.chorizomejor.com/?place=${placeId}`;
}

async function trackShare(userId) {
  if (!userId) return;
  try {
    await db.collection('users').doc(userId).update({
      shareCount: firebase.firestore.FieldValue.increment(1)
    });
    awardXP(userId, XP_REWARDS.shareReview, 'share');
    incrementChallengeProgress(userId, 'weeklyShares');
  } catch (err) {
    console.error('Share tracking error:', err);
  }
}

// Contextual share prompts after key moments
function triggerSharePrompt(type, data) {
  if (!currentUser) return;
  const modal = document.getElementById('share-prompt-modal');
  const title = document.getElementById('share-prompt-title');
  const subtitle = document.getElementById('share-prompt-subtitle');

  switch (type) {
    case 'review':
      title.textContent = '🌮 Share your discovery!';
      subtitle.textContent = `Let your friends know about ${data.placeName}`;
      break;
    case 'badge':
      title.textContent = `🏅 Badge earned: ${data.badgeName}!`;
      subtitle.textContent = 'Show off your achievement!';
      break;
    case 'tierUp':
      title.textContent = `🎉 You're now a ${data.tierName}!`;
      subtitle.textContent = 'Share your taco journey!';
      break;
    case 'neighborhood':
      title.textContent = `🏘️ ${data.hoodName} conquered!`;
      subtitle.textContent = "You've reviewed every spot in this neighborhood!";
      break;
  }

  // Store share data for button handlers
  modal.dataset.shareText = data.shareText || '';
  modal.dataset.shareUrl = data.shareUrl || window.location.href;
  modal.classList.remove('hidden');
}

function closeSharePrompt() {
  document.getElementById('share-prompt-modal').classList.add('hidden');
}

function sharePromptAction(platform) {
  const modal = document.getElementById('share-prompt-modal');
  const text = modal.dataset.shareText;
  const url = modal.dataset.shareUrl;

  switch (platform) {
    case 'x': shareToX(text, url); break;
    case 'facebook': shareToFacebook(url); break;
    case 'instagram': shareToInstagram(text + '\n' + url); break;
    case 'copy':
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
      break;
  }
  if (currentUser) trackShare(currentUser.uid);
  closeSharePrompt();
}

// ===================== LEVEL UP CELEBRATION =====================
function showLevelUpModal(tier) {
  const modal = document.getElementById('levelup-modal');
  document.getElementById('levelup-icon').textContent = tier.icon;
  document.getElementById('levelup-title').textContent = tier.name;
  document.getElementById('levelup-desc').textContent = `Level ${tier.level} achieved!`;
  modal.classList.remove('hidden');

  // Auto-close after 4 seconds
  setTimeout(() => modal.classList.add('hidden'), 4000);
}

// ===================== MILESTONE CELEBRATIONS =====================
function showMilestoneToast(count) {
  const milestones = {
    5: { title: '5 Reviews!', msg: "You're building taco expertise!", icon: '🌮' },
    10: { title: 'Double Digits!', msg: 'A true taco explorer!', icon: '🔟' },
    25: { title: '25 Reviews!', msg: "Quarter century of tacos!", icon: '🎉' },
    50: { title: 'Half Century!', msg: 'You eat, sleep, breathe tacos!', icon: '🏅' },
    75: { title: '75 Reviews!', msg: 'Legend status approaching...', icon: '⚡' },
    100: { title: 'THE 100 CLUB!', msg: "You've achieved greatness!", icon: '💯' }
  };
  const m = milestones[count];
  if (!m) return;

  const modal = document.getElementById('levelup-modal');
  document.getElementById('levelup-icon').textContent = m.icon;
  document.getElementById('levelup-title').textContent = m.title;
  document.getElementById('levelup-desc').textContent = m.msg;
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('hidden'), 4500);
}

// ===================== ONBOARDING QUEST =====================
async function checkOnboarding(userId) {
  if (!userId) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const data = userDoc.data();

    if (data.onboardingComplete) return; // Already done

    const steps = {
      joined: true, // Always true if they have an account
      profileSet: !!(data.displayName && data.displayName !== 'Taco Lover'),
      firstReview: (data.reviewCount || 0) >= 1,
      firstPhoto: (data.photoReviewCount || 0) >= 1,
      exploredMap: data.exploredMap || false,
      firstFollow: (data.following || 0) >= 1
    };

    const completed = Object.values(steps).filter(Boolean).length;
    const total = Object.keys(steps).length;

    if (completed >= total) {
      // Quest complete!
      await db.collection('users').doc(userId).update({ onboardingComplete: true });
      awardXP(userId, 50, 'questComplete');
      showToast('🎉 Taco Quest complete! +50 XP!');
      return;
    }

    // Show onboarding banner on feed
    renderOnboardingBanner(steps, completed, total);
  } catch (err) {
    console.error('Onboarding check error:', err);
  }
}

function renderOnboardingBanner(steps, completed, total) {
  const existing = document.getElementById('onboarding-banner');
  if (existing) existing.remove();

  const pct = Math.round((completed / total) * 100);
  const banner = document.createElement('div');
  banner.id = 'onboarding-banner';
  banner.className = 'onboarding-banner';
  banner.innerHTML = `
    <div class="onboarding-header">
      <h3>🌮 Your Taco Quest</h3>
      <span class="onboarding-pct">${completed}/${total}</span>
    </div>
    <div class="onboarding-bar">
      <div class="onboarding-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="onboarding-steps">
      <div class="onboarding-step ${steps.joined ? 'done' : ''}">
        <span class="step-check">${steps.joined ? '✅' : '⬜'}</span>
        <span>Join Chorizo Mejor</span>
      </div>
      <div class="onboarding-step ${steps.profileSet ? 'done' : ''}">
        <span class="step-check">${steps.profileSet ? '✅' : '⬜'}</span>
        <span>Set up your profile</span>
      </div>
      <div class="onboarding-step ${steps.firstReview ? 'done' : ''}">
        <span class="step-check">${steps.firstReview ? '✅' : '⬜'}</span>
        <span>Rate your first taco spot</span>
      </div>
      <div class="onboarding-step ${steps.firstPhoto ? 'done' : ''}">
        <span class="step-check">${steps.firstPhoto ? '✅' : '⬜'}</span>
        <span>Upload a taco photo</span>
      </div>
      <div class="onboarding-step ${steps.exploredMap ? 'done' : ''}">
        <span class="step-check">${steps.exploredMap ? '✅' : '⬜'}</span>
        <span>Explore the map</span>
      </div>
      <div class="onboarding-step ${steps.firstFollow ? 'done' : ''}">
        <span class="step-check">${steps.firstFollow ? '✅' : '⬜'}</span>
        <span>Follow another taco fan</span>
      </div>
    </div>
  `;

  const feedList = document.getElementById('feed-list');
  if (feedList) feedList.parentNode.insertBefore(banner, feedList);
}

// ===================== TACO TRAILS (NEIGHBORHOOD COLLECTION) =====================
async function renderTacoTrails(userId) {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    // Get all places grouped by neighborhood (normalize via LEGACY_HOOD_MAP)
    const placesSnap = await db.collection('places').limit(200).get();
    const placesByHood = {};
    placesSnap.forEach(doc => {
      const p = doc.data();
      const rawHood = p.neighborhood || 'unknown';
      const hood = LEGACY_HOOD_MAP[rawHood] || rawHood;
      if (!placesByHood[hood]) placesByHood[hood] = [];
      placesByHood[hood].push({ id: doc.id, ...p });
    });

    // Get user's reviews to know which places they've reviewed
    const reviewsSnap = await db.collection('reviews')
      .where('userId', '==', userId).limit(500).get();
    const reviewedPlaceIds = new Set();
    const reviewedHoods = {};
    reviewsSnap.forEach(doc => {
      const r = doc.data();
      reviewedPlaceIds.add(r.placeId);
      const rawHood = r.placeNeighborhood || 'unknown';
      const hood = LEGACY_HOOD_MAP[rawHood] || rawHood;
      if (!reviewedHoods[hood]) reviewedHoods[hood] = new Set();
      reviewedHoods[hood].add(r.placeId);
    });

    // Count reviewed places per hood from place data
    const hoodStats = {};
    for (const [hood, places] of Object.entries(placesByHood)) {
      const reviewed = places.filter(p => reviewedPlaceIds.has(p.id)).length;
      hoodStats[hood] = { total: places.length, reviewed, places };
    }

    // Calculate overall stats
    const totalHoods = Object.keys(placesByHood).length;
    const exploredHoods = Object.values(hoodStats).filter(h => h.reviewed > 0).length;
    const totalPlaces = placesSnap.size;
    const totalReviewed = reviewedPlaceIds.size;

    content.innerHTML = `
      <div class="trails-overview">
        <div class="trails-stat">
          <strong>${exploredHoods}</strong>
          <span>of ${totalHoods} Neighborhoods</span>
        </div>
        <div class="trails-stat">
          <strong>${totalReviewed}</strong>
          <span>of ${totalPlaces} Spots Reviewed</span>
        </div>
        <div class="trails-bar">
          <div class="trails-bar-fill" style="width:${totalPlaces > 0 ? Math.round((totalReviewed/totalPlaces)*100) : 0}%"></div>
        </div>
      </div>
      <div class="trails-grid">
        ${Object.entries(hoodStats)
          .sort((a, b) => (b[1].reviewed / b[1].total) - (a[1].reviewed / a[1].total))
          .map(([hood, stats]) => {
            const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
            const isComplete = pct === 100 && stats.total > 0;
            return `
              <div class="trails-hood ${isComplete ? 'complete' : ''} ${stats.reviewed > 0 ? 'started' : ''}">
                <div class="trails-hood-ring" style="background: conic-gradient(var(--color-primary) ${pct * 3.6}deg, var(--color-border) 0)">
                  <div class="trails-hood-inner">${isComplete ? '✅' : pct + '%'}</div>
                </div>
                <div class="trails-hood-name">${formatNeighborhood(hood)}</div>
                <div class="trails-hood-count">${stats.reviewed}/${stats.total}</div>
              </div>
            `;
          }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Taco trails error:', err);
    content.innerHTML = '<div class="empty-state"><p>Could not load Taco Trails</p></div>';
  }
}

// ===================== USER LEADERBOARD =====================
async function renderUserLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const monthlyList = document.getElementById('monthly-leaders');
  list.innerHTML = '<div class="spinner"></div>';
  monthlyList.innerHTML = '';

  try {
    // Fetch top users by XP
    const snap = await db.collection('users')
      .orderBy('xp', 'desc').limit(20).get();

    if (snap.empty) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">👥</span><h3>No reviewers yet</h3></div>';
      return;
    }

    list.innerHTML = '';
    let rank = 1;
    snap.forEach(doc => {
      const u = doc.data();
      const tier = getUserTier(u.reviewCount || 0, u.xp || 0);
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const streak = u.streakCurrent ? `<span class="user-lb-streak">🔥${u.streakCurrent}</span>` : '';

      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      item.onclick = () => navigate('profile', doc.id);
      item.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${medal}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${tier.icon} ${escapeHtml(u.displayName || 'Anonymous')}</div>
          <div class="leaderboard-neighborhood">${u.reviewCount || 0} reviews · ${u.xp || 0} XP ${streak}</div>
        </div>
        <div class="leaderboard-score user-lb-tier">${tier.icon}</div>
      `;
      list.appendChild(item);
      rank++;
    });
  } catch (err) {
    console.error('User leaderboard error:', err);
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">👥</span><h3>Could not load rankings</h3></div>';
  }
}

// ===================== BADGES & TIER CHECK =====================
async function checkBadges(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data();
    const count = userData.reviewCount || 0;
    const currentBadgeIds = userData.badgeIds || [];
    const newBadgeIds = [...currentBadgeIds];
    const xp = userData.xp || 0;

    // Check tier progression
    const oldTier = getUserTier(count - 1, xp);
    const newTier = getUserTier(count, xp);
    if (newTier.level > oldTier.level) {
      showLevelUpModal(newTier);
      awardXP(userId, newTier.level * 20, 'tierUp');
    }

    // Fetch user's reviews for badge checking
    const reviewsSnap = await db.collection('reviews')
      .where('userId', '==', userId).limit(500).get();
    const reviews = reviewsSnap.docs.map(d => d.data());

    // Collect stats
    const photoCount = reviews.filter(r => r.photoURL).length;
    const detailedCount = reviews.filter(r => r.text && r.text.length >= 200).length;
    const hasPerfect = reviews.some(r => r.ratings?.overall >= 5);
    const neighborhoods = new Set(reviews.map(r => r.placeNeighborhood || '').filter(Boolean));
    const truckReviews = reviews.filter(r => r.placeType === 'truck').length;
    const totalLikes = reviews.reduce((sum, r) => sum + (r.likes?.length || 0), 0);
    const totalComments = reviews.reduce((sum, r) => sum + (r.commentCount || 0), 0);
    const hour = new Date().getHours();

    // First reviewer check — check if user was first to review any place
    let isFirstReviewer = false;
    try {
      const placesSnap = await db.collection('places').limit(200).get();
      const placeReviewCounts = {};
      placesSnap.forEach(d => { placeReviewCounts[d.id] = d.data().reviewCount || 0; });
      // If any place the user reviewed has only 1 review total, they were first
      for (const r of reviews) {
        if (r.placeId && placeReviewCounts[r.placeId] === 1) {
          isFirstReviewer = true;
          break;
        }
      }
    } catch { isFirstReviewer = false; }

    // Check each badge
    const checks = {
      taco_newbie: count >= 1,
      ten_reviews: count >= 10,
      fifty_reviews: count >= 50,
      hundred_club: count >= 100,
      shutterbug: photoCount >= 5,
      wordsmith: detailedCount >= 5,
      perfect10: hasPerfect,
      hood_hopper: neighborhoods.size >= 5,
      truck_hunter: truckReviews >= 3,
      city_explorer: neighborhoods.size >= 10,
      conversation_starter: totalComments >= 10,
      crowd_favorite: totalLikes >= 25,
      influencer: (userData.followers || 0) >= 10,
      social_butterfly: (userData.shareCount || 0) >= 5,
      on_fire: (userData.streakLongest || 0) >= 7,
      monthly_regular: (userData.streakLongest || 0) >= 28,
      veteran: count >= 20 && userData.joinedAt && (Date.now() - userData.joinedAt.toDate().getTime() > 180 * 86400000),
      early_bird: hour < 7,
      night_owl: hour >= 23,
      first_reviewer: isFirstReviewer
    };

    let newlyEarned = [];
    for (const [badgeId, earned] of Object.entries(checks)) {
      if (earned && !currentBadgeIds.includes(badgeId)) {
        newBadgeIds.push(badgeId);
        const badge = BADGES_CONFIG.find(b => b.id === badgeId);
        if (badge) newlyEarned.push(badge);
      }
    }

    if (newBadgeIds.length > currentBadgeIds.length) {
      // Build display badges array for backward compat
      const displayBadges = newBadgeIds.map(id => {
        const b = BADGES_CONFIG.find(x => x.id === id);
        return b ? `${b.name} ${b.icon}` : id;
      });

      await db.collection('users').doc(userId).update({
        badgeIds: newBadgeIds,
        badges: displayBadges
      });

      // Show earned badge notifications
      for (const badge of newlyEarned) {
        showToast(`🏅 Badge earned: ${badge.name} ${badge.icon}`);
        awardXP(userId, 15, 'badge');
      }
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
    const shareText = getShareText(r, r.placeName);
    const shareUrl = getShareUrl(r.placeId);

    // Store for social button handlers
    document.getElementById('share-modal').dataset.shareText = shareText;
    document.getElementById('share-modal').dataset.shareUrl = shareUrl;

    body.innerHTML = `
      <h4 style="margin-bottom:4px">${escapeHtml(r.placeName || 'A taco spot')}</h4>
      <p style="font-size:24px;margin:8px 0">★ ${r.ratings?.overall || '-'}/5</p>
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
  rating = Number(rating) || 0; // handle NaN/undefined
  rating = Math.max(0, Math.min(5, rating)); // clamp to 0-5
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
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
