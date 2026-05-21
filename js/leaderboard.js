/* ============================================================
   Leaderboard module
   - Loads Firebase from CDN
   - Provides:
       BioLB.signIn()
       BioLB.signOut()
       BioLB.submitScore({chapter, score, total})
       BioLB.fetchTop({chapter?, limit?})
       BioLB.onAuthChange(cb)
   ============================================================ */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = window.LEADERBOARD_ENABLED && cfg && !String(cfg.apiKey).startsWith('PASTE_');

  // Public API stub — works even when disabled (returns no-ops).
  window.BioLB = {
    enabled,
    user: null,
    _authListeners: [],
    onAuthChange(cb){ this._authListeners.push(cb); cb(this.user); },
    async signIn(){ if (!enabled) return alert('Leaderboard is not configured yet. Open js/config.js and follow the setup steps.'); return _signIn(); },
    async signOut(){ if (!enabled) return; return _signOut(); },
    async submitScore(payload){ if (!enabled) return; return _submitScore(payload); },
    async submitATP(payload){ if (!enabled) return; return _submitATP(payload); },
    async fetchTop(opts){ if (!enabled) return []; return _fetchTop(opts || {}); },
    async fetchAll(){ if (!enabled) return []; return _fetchAll(); },
    // Aggregate per-user combined score: best score per chapter summed,
    // tie-broken by total tests completed. Returns sorted array.
    async fetchCombined(){
      if (!enabled) return [];
      const all = await _fetchAll();
      const byUser = new Map();
      for (const row of all) {
        if (!row.uid) continue;
        let u = byUser.get(row.uid);
        if (!u) {
          u = { uid: row.uid, name: row.name, photo: row.photo, perChapter: {}, chapters: 0 };
          byUser.set(row.uid, u);
        }
        const prev = u.perChapter[row.chapter] || 0;
        if (row.score > prev) u.perChapter[row.chapter] = row.score;
        // refresh display fields with most recent values
        u.name = row.name || u.name;
        u.photo = row.photo || u.photo;
      }
      const players = [...byUser.values()].map(u => {
        const scores = Object.values(u.perChapter);
        u.chapters = scores.length;
        u.combined = scores.reduce((a,b)=>a+b, 0);
        return u;
      });
      players.sort((a,b)=> b.combined - a.combined || b.chapters - a.chapters);
      return players;
    },
    _emit(u){ this.user = u; this._authListeners.forEach(cb=>{ try{ cb(u); }catch(e){} }); }
  };

  if (!enabled) return;

  // Load Firebase modular SDK (v10+) via CDN
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import {
      getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    const app = initializeApp(${JSON.stringify(cfg)});
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    onAuthStateChanged(auth, (u) => {
      window.BioLB._emit(u ? {
        uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL
      } : null);
    });

    window._lbImpl = {
      signIn: () => signInWithPopup(auth, provider),
      signOut: () => signOut(auth),
      submit: async ({chapter, score, total}) => {
        if (!auth.currentUser) throw new Error('Not signed in');
        const pct = Math.round((score / total) * 100);
        await addDoc(collection(db, 'scores'), {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'Anonymous',
          photo: auth.currentUser.photoURL || '',
          chapter, score: pct, raw: score, total,
          createdAt: serverTimestamp()
        });
      },
      submitATP: async ({key, atp, max}) => {
        if (!auth.currentUser) throw new Error('Not signed in');
        await addDoc(collection(db, 'scores'), {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'Anonymous',
          photo: auth.currentUser.photoURL || '',
          chapter: key, score: atp, raw: atp, total: max,
          createdAt: serverTimestamp()
        });
      },
      fetchAll: async () => {
        const col = collection(db, 'scores');
        // No filter — pull a generous slice for client-side aggregation
        const q = query(col, orderBy('score','desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
      },
      fetchTop: async ({chapter, lim = 25}) => {
        const col = collection(db, 'scores');
        let q;
        if (chapter && chapter !== 'all') {
          q = query(col, where('chapter','==',chapter), orderBy('score','desc'), limit(lim));
        } else {
          q = query(col, orderBy('score','desc'), limit(lim));
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
      }
    };
    window.dispatchEvent(new Event('biolb-ready'));
  `;
  document.head.appendChild(script);

  function waitReady(){
    return new Promise(res => {
      if (window._lbImpl) return res();
      window.addEventListener('biolb-ready', res, { once:true });
    });
  }
  async function _signIn(){ await waitReady(); return window._lbImpl.signIn(); }
  async function _signOut(){ await waitReady(); return window._lbImpl.signOut(); }
  async function _submitScore(p){ await waitReady(); return window._lbImpl.submit(p); }
  async function _submitATP(p){ await waitReady(); return window._lbImpl.submitATP(p); }
  async function _fetchTop(o){ await waitReady(); return window._lbImpl.fetchTop(o); }
  async function _fetchAll(){ await waitReady(); return window._lbImpl.fetchAll(); }
})();

/* ============================================================
   Widget — renders a small sign-in / user chip into #lb-widget
   ============================================================ */
(function(){
  function ensureWidget(){
    let el = document.getElementById('lb-widget');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lb-widget';
      el.className = 'lb-widget';
      document.body.appendChild(el);
    }
    return el;
  }

  function render(user){
    const el = ensureWidget();
    if (!window.BioLB.enabled) {
      el.innerHTML = `<span class="lb-tag" title="Open js/config.js to set up the leaderboard">⚙ leaderboard not configured</span>`;
      return;
    }
    if (user) {
      el.innerHTML =
        `<a class="lb-link" href="${linkToLeaderboard()}">🏆 Leaderboard</a>` +
        `<img class="lb-avatar" src="${user.photo||''}" alt=""/>` +
        `<span class="lb-name">${user.name||'Player'}</span>` +
        `<button class="lb-btn lb-out">Sign out</button>`;
      el.querySelector('.lb-out').onclick = ()=>window.BioLB.signOut();
    } else {
      el.innerHTML =
        `<a class="lb-link" href="${linkToLeaderboard()}">🏆 Leaderboard</a>` +
        `<button class="lb-btn lb-in">Sign in with Google</button>`;
      el.querySelector('.lb-in').onclick = ()=>window.BioLB.signIn();
    }
  }

  function linkToLeaderboard(){
    // Works whether we're at root or in /chapters/
    const path = location.pathname.includes('/chapters/') ? '../leaderboard.html' : 'leaderboard.html';
    return path;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    ensureWidget();
    window.BioLB.onAuthChange(render);
  });
})();
