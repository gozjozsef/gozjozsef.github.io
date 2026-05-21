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
          .then(()=>{ toast.textContent = `Score submitted — ${pct}% on ${chapterId}. View the leaderboard.`; })
          .catch(e=>{ toast.className='lb-toast bad'; toast.textContent = 'Could not submit: ' + (e.message || e); });
      }
    }
  });
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

document.addEventListener('DOMContentLoaded', setupTabs);
