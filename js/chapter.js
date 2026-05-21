/* ------------------------------------------------------------
   Shared utilities for chapter pages
   ------------------------------------------------------------ */

// Tab switcher
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      t.classList.add('active');
      const id = t.dataset.target;
      document.getElementById(id).classList.add('active');
      window.scrollTo({ top: document.querySelector('.tabs').offsetTop - 20, behavior: 'smooth' });
    });
  });
}

// Build a quiz from an array of question objects
// q = { q: '...', options: [..], answer: index, explain: '...' }
// Optional second arg: chapter id (e.g. "chapter1") for leaderboard submission
function buildQuiz(rootId, questions, chapterId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  // Auto-detect chapter id from filename if not given
  if (!chapterId) {
    const m = location.pathname.match(/chapter(\d+)/i);
    chapterId = m ? ('chapter' + m[1]) : 'unknown';
  }
  questions.forEach((q, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'question';
    wrap.innerHTML =
      `<p class="q">${i + 1}. ${q.q}</p>` +
      `<div class="options">` +
      q.options
        .map(
          (opt, j) =>
            `<label data-i="${j}"><input type="radio" name="q${rootId}_${i}" value="${j}"/><span>${opt}</span></label>`
        )
        .join('') +
      `</div>` +
      `<div class="explanation"><strong>Explanation:</strong> ${q.explain}</div>`;
    root.appendChild(wrap);
  });

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Submit answers';
  root.appendChild(btn);

  const result = document.createElement('div');
  result.className = 'quiz-result';
  root.appendChild(result);

  btn.addEventListener('click', () => {
    let score = 0;
    const qDivs = root.querySelectorAll('.question');
    qDivs.forEach((qd, i) => {
      const labels = qd.querySelectorAll('.options label');
      const selected = qd.querySelector('input:checked');
      if (selected) {
        const idx = +selected.value;
        if (idx === questions[i].answer) score++;
        labels[idx].classList.add(idx === questions[i].answer ? 'correct' : 'wrong');
      }
      labels[questions[i].answer].classList.add('correct');
      qd.querySelector('.explanation').classList.add('show');
    });
    const pct = Math.round((score / questions.length) * 100);
    let msg = '';
    if (pct === 100) msg = `Perfect — ${score}/${questions.length}. Outstanding work.`;
    else if (pct >= 80) msg = `Excellent — ${score}/${questions.length} (${pct}%).`;
    else if (pct >= 60) msg = `Good effort — ${score}/${questions.length} (${pct}%). Re-read the highlighted explanations.`;
    else msg = `${score}/${questions.length} (${pct}%) — review the chapter and try again.`;
    result.textContent = msg;
    btn.disabled = true;
    btn.style.opacity = .5;

    // Push to leaderboard if signed in
    if (window.BioLB && window.BioLB.enabled) {
      const toast = document.createElement('div');
      toast.className = 'lb-toast';
      result.parentNode.appendChild(toast);
      if (!window.BioLB.user) {
        toast.innerHTML = `<strong>Sign in with Google</strong> to put this score on the leaderboard. ` +
          `<button class="btn" style="margin-left:8px">Sign in</button>`;
        toast.querySelector('button').onclick = async () => {
          try {
            await window.BioLB.signIn();
            await window.BioLB.submitScore({ chapter: chapterId, score, total: questions.length });
            toast.textContent = `Score submitted — ${pct}% on ${chapterId}.`;
          } catch (e) { toast.className = 'lb-toast bad'; toast.textContent = 'Sign-in failed: ' + (e.message || e); }
        };
      } else {
        window.BioLB.submitScore({ chapter: chapterId, score, total: questions.length })
          .then(()=>{
            toast.textContent = `Score submitted — ${pct}% on ${chapterId}.`;
            showRankingReveal();
          })
          .catch(e=>{ toast.className='lb-toast bad'; toast.textContent = 'Could not submit: ' + (e.message || e); });
      }
    }
  });
}

/* ------------------------------------------------------------
   Leaderboard reveal animation
   ------------------------------------------------------------ */
async function showRankingReveal() {
  if (!window.BioLB || !window.BioLB.enabled || !window.BioLB.user) return;
  const me = window.BioLB.user;

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'rank-overlay';
  overlay.innerHTML = `
    <div class="rank-modal">
      <h2 class="rank-title">Your place in the class</h2>
      <p class="rank-sub" id="rank-sub">Tallying scores…</p>
      <div class="rank-list" id="rank-list"></div>
      <div class="rank-player" id="rank-player">
        <span class="rank-num">?</span>
        <img class="rank-avatar" src="${me.photo||''}" alt=""/>
        <span class="rank-name">${me.name||'You'}</span>
        <span class="rank-score">…</span>
      </div>
      <button class="btn rank-close" id="rank-close">Continue</button>
    </div>`;
  document.body.appendChild(overlay);
  // Trigger fade-in
  requestAnimationFrame(()=>overlay.classList.add('show'));
  document.getElementById('rank-close').onclick = ()=>overlay.remove();

  let players;
  try { players = await window.BioLB.fetchCombined(); }
  catch (e) {
    document.getElementById('rank-sub').textContent = 'Could not load rankings: ' + (e.message||e);
    return;
  }

  const myIndex = players.findIndex(p=>p.uid === me.uid);
  if (myIndex < 0) {
    document.getElementById('rank-sub').textContent = 'You are not on the board yet — try again in a moment.';
    return;
  }
  const myRank = myIndex + 1;
  const me_ = players[myIndex];

  // Top 8 to render in the list (or however many we have)
  const topN = Math.min(8, players.length);
  const top = players.slice(0, topN);

  const listEl = document.getElementById('rank-list');
  listEl.innerHTML = top.map((p, i) => {
    const isMe = p.uid === me.uid;
    return `<div class="rank-row ${isMe ? 'rank-row-me-target' : ''}" data-rank="${i+1}">
      <span class="rank-num">${i+1}</span>
      <img class="rank-avatar" src="${p.photo||''}" alt=""/>
      <span class="rank-name">${p.name||'Anonymous'}</span>
      <span class="rank-score">${Math.round(p.combined)}</span>
    </div>`;
  }).join('');

  // If user is OUTSIDE top N, add a separator + their row at the bottom
  if (myRank > topN) {
    listEl.insertAdjacentHTML('beforeend',
      `<div class="rank-sep">…</div>
       <div class="rank-row rank-row-me-target" data-rank="${myRank}">
         <span class="rank-num">${myRank}</span>
         <img class="rank-avatar" src="${me.photo||''}" alt=""/>
         <span class="rank-name">${me.name||'You'}</span>
         <span class="rank-score">${Math.round(me_.combined)}</span>
       </div>`);
  }

  // The animated player chip starts at the bottom, off-screen, then climbs to the target row.
  const targetRow = listEl.querySelector('.rank-row-me-target');
  const playerChip = document.getElementById('rank-player');
  playerChip.querySelector('.rank-num').textContent = myRank;
  playerChip.querySelector('.rank-score').textContent = Math.round(me_.combined);
  playerChip.classList.add('animating');

  document.getElementById('rank-sub').innerHTML =
    `Combined across all chapters: <strong>${Math.round(me_.combined)} <i class="atp-icon"></i></strong> ` +
    `(best per chapter, ${me_.chapters} chapter${me_.chapters===1?'':'s'} completed).`;

  // Animate to target position
  await new Promise(r => setTimeout(r, 600));
  const listRect = listEl.getBoundingClientRect();
  const targetRect = targetRow.getBoundingClientRect();
  const dy = targetRect.top - listRect.bottom - playerChip.offsetHeight + targetRect.height;
  // Use FLIP-style: animate transform from below the list up to the target row
  playerChip.style.transition = 'transform 2.8s cubic-bezier(.16,.85,.3,1), opacity .3s';
  playerChip.style.transform = `translateY(${dy}px) scale(1.04)`;

  // After animation, swap the chip into the row so it sits cleanly.
  // Guard every node access — the user may have dismissed the modal
  // before the 3-second delay fires.
  setTimeout(()=>{
    if (!document.body.contains(overlay)) return;
    if (targetRow && targetRow.isConnected) targetRow.classList.add('rank-row-revealed');
    if (playerChip && playerChip.isConnected) playerChip.classList.add('fade-out');
    const sub = document.getElementById('rank-sub');
    if (!sub) return;
    if (myRank === 1) {
      sub.innerHTML = `🥇 <strong>You're #1 in the class!</strong> Combined: ${Math.round(me_.combined)} <i class="atp-icon"></i>.`;
    } else if (myRank <= 3) {
      sub.innerHTML = `🏅 <strong>Podium finish — #${myRank}</strong>. Keep climbing.`;
    } else {
      const diff = Math.round(players[myRank-2].combined - me_.combined);
      sub.innerHTML = `You are <strong>#${myRank}</strong> in the class. Only <strong>${diff} <i class="atp-icon"></i></strong> behind #${myRank-1}.`;
    }
  }, 3000);
}

// Lerp helper
function lerp(a, b, t) { return a + (b - a) * t; }

// Random helpers
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Resize a canvas for device pixel ratio
function fitCanvas(c, w, h) {
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* ------------------------------------------------------------
   Game ATP submission + reveal animation
   Call from a game's finish handler:
     await submitGameATP('chapter1-game1', atp, 100, hostElement)
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Spawn ATP molecules that fly to the reward display.
   Molecule = 3 horizontal phosphate circles + a rectangle
   attached a bit lower to the third circle (adenine/sugar).
   ------------------------------------------------------------ */
function spawnATPMolecules(targetEl, atp) {
  if (!targetEl || atp <= 0) return;
  const count = Math.min(40, Math.max(6, Math.floor(atp / 25)));
  const MOL_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 32'>
    <line x1='8' y1='12' x2='40' y2='12' stroke='#7a3e10' stroke-width='1.8'/>
    <circle cx='8'  cy='12' r='5' fill='#5aa9ff' stroke='#1a2433' stroke-width='1.3'/>
    <circle cx='24' cy='12' r='5' fill='#5aa9ff' stroke='#1a2433' stroke-width='1.3'/>
    <circle cx='40' cy='12' r='5.5' fill='#ffd54f' stroke='#1a2433' stroke-width='1.3'/>
    <line x1='40' y1='17' x2='46' y2='22' stroke='#7a3e10' stroke-width='1.3'/>
    <rect x='44' y='20' width='10' height='8' rx='1.6' fill='#7be0c8' stroke='#1a2433' stroke-width='1.2'/>
  </svg>`;

  function place() {
    const r = targetEl.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'atp-mole';
    el.innerHTML = MOL_SVG;
    const vw = window.innerWidth, vh = window.innerHeight;
    const edge = Math.floor(Math.random()*4);
    let sx, sy;
    if (edge === 0)      { sx = Math.random()*vw; sy = -60; }
    else if (edge === 1) { sx = vw + 60; sy = Math.random()*vh; }
    else if (edge === 2) { sx = Math.random()*vw; sy = vh + 60; }
    else                 { sx = -60; sy = Math.random()*vh; }
    el.style.left = sx + 'px';
    el.style.top  = sy + 'px';
    const startRot = Math.random()*360;
    el.style.transform = `translate(-50%,-50%) rotate(${startRot}deg) scale(.85)`;
    document.body.appendChild(el);

    const delay = i * 55 + Math.random()*120;
    setTimeout(() => {
      const t = place();
      const jitterX = (Math.random()*30 - 15);
      const jitterY = (Math.random()*30 - 15);
      el.style.transition = 'left .95s cubic-bezier(.42,.0,.2,1), top .95s cubic-bezier(.42,.0,.2,1), transform .95s cubic-bezier(.42,.0,.2,1), opacity .35s linear';
      el.style.left = (t.x + jitterX) + 'px';
      el.style.top  = (t.y + jitterY) + 'px';
      const endRot = startRot + (Math.random()*540 - 270);
      el.style.transform = `translate(-50%,-50%) rotate(${endRot}deg) scale(.4)`;
      setTimeout(() => {
        el.style.opacity = '0';
        targetEl.classList.add('atp-pulse');
        setTimeout(() => targetEl.classList.remove('atp-pulse'), 320);
        setTimeout(() => el.remove(), 420);
      }, 950);
    }, delay);
  }
}

async function submitGameATP(key, atp, max, hostEl) {
  const toast = document.createElement('div');
  toast.className = 'lb-toast';
  if (hostEl) hostEl.appendChild(toast);
  const ICON = '<i class="atp-icon"></i>';

  if (!window.BioLB || !window.BioLB.enabled) {
    toast.innerHTML = `You earned ${atp} ${ICON}. (Leaderboard offline.)`;
    if (atp > 0) {
      const t = (hostEl && (hostEl.querySelector('.atp-total') || hostEl.querySelector('strong'))) || hostEl;
      setTimeout(() => spawnATPMolecules(t, atp), 80);
    }
    return;
  }
  if (!window.BioLB.user) {
    toast.className = 'lb-toast bad';
    toast.innerHTML = `<strong>Not signed in.</strong> Scores can only be earned while signed in.`;
    return;
  }

  // First-attempt only: check Firestore for an existing submission under this key.
  let existing = null;
  try { existing = await window.BioLB.hasSubmitted(key); } catch (e) { /* network hiccup — fall through and try to submit */ }
  if (existing) {
    toast.innerHTML = `Practice run — your first attempt of <strong>${existing.score} ${ICON}</strong> still counts. Replays don't add ATP.`;
    return;
  }

  // Genuine first attempt — animate, submit, reveal rank
  if (atp > 0) {
    const t = (hostEl && (hostEl.querySelector('.atp-total') || hostEl.querySelector('strong'))) || hostEl;
    setTimeout(() => spawnATPMolecules(t, atp), 80);
  }
  try {
    await window.BioLB.submitATP({ key, atp, max });
    toast.innerHTML = `Saved — ${atp} ${ICON} earned. <em>(first attempt only)</em>`;
    showRankingReveal();
  } catch (e) {
    toast.className = 'lb-toast bad';
    toast.textContent = 'Could not save: ' + (e.message || e);
  }
}

/* ------------------------------------------------------------
   Fullscreen helpers — when a game/test starts, lock its
   game-card to the viewport so the player can't get lost
   scrolling and the floating chips don't eat space.
   ------------------------------------------------------------ */
function enterGameFullscreen(card) {
  if (!card || card.classList.contains('game-fullscreen')) return;
  card.classList.add('game-fullscreen');
  document.body.classList.add('game-fullscreen-active');
  if (!card.querySelector('.game-fullscreen-exit')) {
    const exit = document.createElement('button');
    exit.className = 'game-fullscreen-exit';
    exit.type = 'button';
    exit.setAttribute('aria-label', 'Exit fullscreen');
    exit.innerHTML = '✕';
    exit.onclick = () => exitGameFullscreen(card);
    card.appendChild(exit);
  }
  // Reset scroll inside the card on entry
  card.scrollTop = 0;
}
function exitGameFullscreen(card) {
  if (!card) return;
  card.classList.remove('game-fullscreen');
  // Only release the body lock if no other card is fullscreen
  if (!document.querySelector('.game-fullscreen')) {
    document.body.classList.remove('game-fullscreen-active');
  }
}

/* ------------------------------------------------------------
   Sign-in gate for a "Start game" button.
   Disables the button until the user signs in; updates live.
   Also enters fullscreen when the player actually starts.
   ------------------------------------------------------------ */
function gateStart(startBtn, startFn, opts) {
  opts = opts || {};
  const card = startBtn.closest('.game-card');
  const wrappedStart = () => {
    enterGameFullscreen(card);
    // Defer the start callback one tick so the layout reflows under
    // fullscreen before any canvas/SVG sizing runs.
    requestAnimationFrame(() => startFn());
  };
  function update() {
    if (!window.BioLB || !window.BioLB.enabled) {
      startBtn.textContent = opts.label || 'Start';
      startBtn.disabled = false;
      startBtn.onclick = wrappedStart;
      return;
    }
    if (window.BioLB.user) {
      startBtn.textContent = opts.label || 'Start';
      startBtn.disabled = false;
      startBtn.onclick = wrappedStart;
    } else {
      startBtn.textContent = 'Sign in with Google to play';
      startBtn.disabled = false;
      startBtn.onclick = () => window.BioLB.signIn();
    }
  }
  if (window.BioLB) window.BioLB.onAuthChange(update);
  else update();
}

/* ------------------------------------------------------------
   Timed weighted test — one question at a time, shuffled order,
   speed bonus up to 200 ATP (linear: 60s left = +100, 120s = +200).
   q = { q, options[], answer, explain, weight }
   ------------------------------------------------------------ */
function buildTimedTest(rootId, questions, opts) {
  opts = opts || {};
  const key = opts.key || 'chapter-test';
  const seconds = opts.seconds || 300;
  const root = document.getElementById(rootId);
  if (!root) return;

  // Shuffle question order AND each question's options (preserve correctness)
  const order = questions.map((q, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = order.map(i => {
    const q = questions[i];
    const optIdx = q.options.map((_, k) => k);
    for (let a = optIdx.length - 1; a > 0; a--) {
      const b = Math.floor(Math.random() * (a + 1));
      [optIdx[a], optIdx[b]] = [optIdx[b], optIdx[a]];
    }
    return {
      q: q.q, explain: q.explain, weight: q.weight,
      options: optIdx.map(k => q.options[k]),
      answer: optIdx.indexOf(q.answer)
    };
  });

  const total = shuffled.reduce((s, q) => s + q.weight, 0);
  const answers = new Array(shuffled.length).fill(-1); // student's chosen index per question

  // Layout
  root.innerHTML = `
    <div class="test-top">
      <div class="test-timer" id="${rootId}-timer">5:00</div>
      <div class="test-info">${shuffled.length} questions · ${total}<i class="atp-icon"></i> · +200<i class="atp-icon"></i> speed bonus</div>
    </div>
    <div class="test-progress"><div class="test-progress-bar" id="${rootId}-bar"></div></div>
    <div class="test-onequestion" id="${rootId}-stage"></div>
    <div class="test-nav">
      <button class="btn btn-ghost" id="${rootId}-back">← Back</button>
      <div class="test-dots" id="${rootId}-dots"></div>
      <button class="btn" id="${rootId}-next">Next →</button>
    </div>
    <div class="quiz-result" id="${rootId}-result"></div>
  `;

  const timerEl = document.getElementById(`${rootId}-timer`);
  const barEl   = document.getElementById(`${rootId}-bar`);
  const stage   = document.getElementById(`${rootId}-stage`);
  const dotsEl  = document.getElementById(`${rootId}-dots`);
  const backBtn = document.getElementById(`${rootId}-back`);
  const nextBtn = document.getElementById(`${rootId}-next`);
  const resultEl = document.getElementById(`${rootId}-result`);

  // dots
  dotsEl.innerHTML = shuffled.map((_, i) =>
    `<button class="test-dot" data-i="${i}" title="Question ${i+1}"></button>`
  ).join('');
  dotsEl.querySelectorAll('.test-dot').forEach(d => {
    d.addEventListener('click', () => { current = +d.dataset.i; render(); });
  });

  let current = 0;
  let done = false;
  let remaining = seconds;

  function fmt(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

  function render() {
    const q = shuffled[current];
    const diff = q.weight >= 100 ? 'hard' : q.weight >= 35 ? 'normal' : 'easy';
    const diffLabel = diff === 'easy' ? 'Easy' : diff === 'normal' ? 'Normal' : 'Hard';
    stage.innerHTML = `
      <div class="question one-q">
        <div class="q-head">
          <span class="q-num">Question ${current + 1} / ${shuffled.length}</span>
          <span class="q-weight q-${diff}">${diffLabel} · ${q.weight}<i class="atp-icon"></i></span>
        </div>
        <p class="q">${q.q}</p>
        <div class="options">
          ${q.options.map((opt, j) => `
            <label data-i="${j}" class="${answers[current] === j ? 'selected' : ''}">
              <input type="radio" name="oneq" value="${j}" ${answers[current] === j ? 'checked' : ''}/>
              <span>${opt}</span>
            </label>`).join('')}
        </div>
      </div>`;
    stage.querySelectorAll('.options label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        answers[current] = +lbl.dataset.i;
        stage.querySelectorAll('.options label').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
        updateDots();
      });
    });
    backBtn.disabled = current === 0;
    nextBtn.textContent = current === shuffled.length - 1 ? 'Submit ✓' : 'Next →';
    nextBtn.classList.toggle('btn-submit', current === shuffled.length - 1);
    barEl.style.width = `${((current + 1) / shuffled.length) * 100}%`;
    updateDots();
  }

  function updateDots() {
    dotsEl.querySelectorAll('.test-dot').forEach((d, i) => {
      d.classList.toggle('answered', answers[i] !== -1);
      d.classList.toggle('current', i === current);
    });
  }

  backBtn.addEventListener('click', () => { if (current > 0) { current--; render(); } });
  nextBtn.addEventListener('click', () => {
    if (current < shuffled.length - 1) { current++; render(); }
    else finish(false);
  });

  // Timer
  timerEl.textContent = fmt(remaining);
  const iv = setInterval(() => {
    remaining--;
    timerEl.textContent = fmt(remaining);
    if (remaining <= 30) timerEl.classList.add('low');
    if (remaining <= 0) { clearInterval(iv); finish(true); }
  }, 1000);

  function finish(auto) {
    if (done) return;
    done = true;
    clearInterval(iv);

    let baseATP = 0;
    let correct = 0;
    shuffled.forEach((q, i) => {
      if (answers[i] === q.answer) { baseATP += q.weight; correct++; }
    });

    // Speed bonus: linear, capped at 200. 60s left = +100, 120s left = +200.
    let speedBonus = 0;
    if (!auto && remaining > 0) {
      speedBonus = Math.min(200, Math.round((remaining / 60) * 100));
    }
    const finalATP = baseATP + speedBonus;
    const maxATP = total + 200;

    // Hide nav, show summary + per-question review
    document.querySelector('.test-progress').style.display = 'none';
    backBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    dotsEl.style.display = 'none';

    stage.innerHTML = `
      <div class="test-summary">
        <h2>${auto ? '⏰ Time up!' : 'Submitted'}</h2>
        <div class="atp-breakdown">
          <div><span>Correct</span><b>${correct} / ${shuffled.length}</b></div>
          <div><span>Test <i class="atp-icon"></i></span><b>${baseATP} / ${total}</b></div>
          <div><span>Speed bonus</span><b>+${speedBonus} <i class="atp-icon"></i></b></div>
          <div class="atp-total"><span>Total</span><b>${finalATP} <i class="atp-icon atp-icon-lg"></i></b></div>
        </div>
        <button class="btn btn-ghost" id="${rootId}-review">Review answers</button>
      </div>
      <div class="test-review" id="${rootId}-review-list" hidden></div>
    `;
    document.getElementById(`${rootId}-review`).onclick = () => {
      const list = document.getElementById(`${rootId}-review-list`);
      list.hidden = !list.hidden;
      if (!list.dataset.built) {
        list.dataset.built = '1';
        list.innerHTML = shuffled.map((q, i) => {
          const got = answers[i];
          const ok = got === q.answer;
          return `<div class="review-q ${ok ? 'ok' : 'bad'}">
            <p class="q"><span class="q-num">${i+1}.</span> ${q.q}</p>
            <div class="options">
              ${q.options.map((opt, j) => {
                let cls = '';
                if (j === q.answer) cls = 'correct';
                else if (j === got) cls = 'wrong';
                return `<label class="${cls}"><span>${opt}</span></label>`;
              }).join('')}
            </div>
            <div class="explanation show"><strong>Explanation:</strong> ${q.explain}</div>
          </div>`;
        }).join('');
      }
    };

    submitGameATP(key, finalATP, maxATP, stage);
  }

  render();
}

document.addEventListener('DOMContentLoaded', setupTabs);
