/* ========================================
   CHORIZO MEJOR - Houston's Taco Rating App
   Firebase-powered SPA
   ======================================== */

// ===================== FIREBASE CONFIG =====================
const firebaseConfig = {
  apiKey: "AIzaSyDP4onqsMuQjaJQQtWPKxjM1EWXm5Aa8Oc",
  authDomain: "chorizomejor.firebaseapp.com",
  projectId: "chorizomejor",
  storageBucket: "chorizomejor.firebasestorage.app",
  messagingSenderId: "42155167020",
  appId: "1:42155167020:web:fb8f4964b051af6e2cb089",
  measurementId: "G-BVDSY8FGFB"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

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
        <span class="card-rating-chip highlight">Overall ${overallScore}/10</span>
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
async function loadPlaces() {
  const grid = document.getElementById('places-grid');
  const mapEl = document.getElementById('map');
  grid.innerHTML = '<div class="spinner"></div>';
  mapEl.textContent = '📍 Map loading...';

  try {
    const neighborhood = document.getElementById('filter-neighborhood').value;
    const sort = document.getElementById('filter-sort').value;

    let query = db.collection('places');

    if (neighborhood) {
      query = query.where('neighborhood', '==', neighborhood);
    }

    if (sort === 'rating') {
      query = query.orderBy('avgOverall', 'desc');
    } else if (sort === 'reviews') {
      query = query.orderBy('reviewCount', 'desc');
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    query = query.limit(30);

    const snap = await query.get();

    if (snap.empty) {
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

    grid.innerHTML = '';
    snap.forEach(doc => {
      const place = doc.data();
      grid.appendChild(createPlaceCard(doc.id, place));
    });

    // Init map if Google Maps is available
    initMap(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
  loadPlaces();
}

function createPlaceCard(placeId, place) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cursor = 'pointer';
  card.onclick = () => navigate('place', placeId);

  const score = place.avgOverall ? place.avgOverall.toFixed(1) : '-';
  const typeEmoji = { truck: '🚚', restaurant: '🏪', bakery: '🍞', 'gas-station': '⛽' };

  card.innerHTML = `
    <div class="place-card">
      <div class="place-card-img">${typeEmoji[place.type] || '🌮'}</div>
      <div class="place-card-info">
        <div class="place-card-name">${escapeHtml(place.name)}</div>
        <div class="place-card-address">${escapeHtml(place.address || '')}</div>
        <div class="place-card-stats">
          <span class="place-card-score">★ ${score}</span>
          <span>${place.reviewCount || 0} reviews</span>
          <span>${formatNeighborhood(place.neighborhood)}</span>
        </div>
      </div>
    </div>
  `;

  return card;
}

// ===================== MAP =====================
function initMap(places) {
  const mapEl = document.getElementById('map');

  if (typeof google === 'undefined' || !google.maps) {
    mapEl.innerHTML = '<span style="font-size:24px">📍</span> Map (enable Google Maps API)';
    return;
  }

  const houston = { lat: 29.7604, lng: -95.3698 };
  const map = new google.maps.Map(mapEl, {
    center: houston,
    zoom: 11,
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] }
    ]
  });

  places.forEach(place => {
    if (place.lat && place.lng) {
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: map,
        title: place.name,
      });

      marker.addListener('click', () => {
        navigate('place', place.id);
      });
    }
  });
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

    // Rating bars
    const categories = ['overall', 'tortilla', 'protein', 'salsa', 'value'];
    categories.forEach(cat => {
      const avg = place[`avg${capitalize(cat)}`] || 0;
      const bar = document.getElementById(`bar-${cat}`);
      const score = document.getElementById(`score-${cat}`);
      bar.style.width = `${avg * 10}%`;
      score.textContent = avg ? avg.toFixed(1) : '-';
    });

    // Tags
    const tagsEl = document.getElementById('place-tags');
    const tags = place.topTags || [];
    tagsEl.innerHTML = tags.map(t => `<span class="taco-tag">${escapeHtml(formatTag(t))}</span>`).join('');

    // Banner
    const banner = document.getElementById('place-photo-banner');
    if (place.photoURL) {
      banner.style.backgroundImage = `url(${place.photoURL})`;
      banner.style.backgroundSize = 'cover';
      banner.style.backgroundPosition = 'center';
      banner.textContent = '';
    } else {
      banner.textContent = '🌮';
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

async function submitPlace(e) {
  e.preventDefault();
  if (!currentUser) { navigate('auth'); return; }

  const name = document.getElementById('new-place-name').value.trim();
  const address = document.getElementById('new-place-address').value.trim();
  const neighborhood = document.getElementById('new-place-neighborhood').value;
  const type = document.getElementById('new-place-type').value;

  if (!name || !address || !neighborhood) {
    showToast('Please fill in all fields');
    return;
  }

  try {
    const docRef = await db.collection('places').add({
      name,
      address,
      neighborhood,
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
    });

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

  const ratings = {
    overall: parseInt(document.getElementById('rate-overall').value),
    tortilla: parseInt(document.getElementById('rate-tortilla').value),
    protein: parseInt(document.getElementById('rate-protein').value),
    salsa: parseInt(document.getElementById('rate-salsa').value),
    value: parseInt(document.getElementById('rate-value').value),
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

    let query = db.collection('places')
      .orderBy(ratingField, 'desc')
      .limit(20);

    if (neighborhood) {
      query = db.collection('places')
        .where('neighborhood', '==', neighborhood)
        .orderBy(ratingField, 'desc')
        .limit(20);
    }

    const snap = await query.get();

    if (snap.empty) {
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
    snap.forEach(doc => {
      const place = doc.data();
      const score = place[ratingField] ? place[ratingField].toFixed(1) : '-';
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      item.onclick = () => navigate('place', doc.id);
      item.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${medal}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${escapeHtml(place.name)}</div>
          <div class="leaderboard-neighborhood">${formatNeighborhood(place.neighborhood)} · ${place.reviewCount || 0} reviews</div>
        </div>
        <div class="leaderboard-score">${score}</div>
      `;
      list.appendChild(item);
      rank++;
    });

    // Monthly leaders - same query limited to 5
    const top5 = snap.docs.slice(0, 5);
    top5.forEach((doc, i) => {
      const place = doc.data();
      const score = place[ratingField] ? place[ratingField].toFixed(1) : '-';
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      monthlyList.innerHTML += `
        <div class="leaderboard-item" onclick="navigate('place','${doc.id}')">
          <div class="leaderboard-rank">${medals[i]}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(place.name)}</div>
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
    'other': 'Other'
  };
  return tagNames[tag] || tag;
}

function formatNeighborhood(code) {
  const names = {
    'heights': 'The Heights',
    'montrose': 'Montrose',
    'east-end': 'East End',
    'midtown': 'Midtown',
    'eado': 'EaDo',
    'washington-ave': 'Washington Ave',
    'memorial': 'Memorial',
    'bellaire': 'Bellaire',
    'spring-branch': 'Spring Branch',
    'katy': 'Katy',
    'sugar-land': 'Sugar Land',
    'pasadena': 'Pasadena'
  };
  return names[code] || code || '';
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
