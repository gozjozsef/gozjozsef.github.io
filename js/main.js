// Tiny global helpers for menu / chapters
(function () {
  // Reveal cards on scroll
  const cards = document.querySelectorAll('.card');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.opacity = 1;
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });
    cards.forEach((c) => {
      c.style.opacity = 0;
      c.style.transform = 'translateY(20px)';
      c.style.transition = 'opacity .5s ease, transform .5s ease';
      io.observe(c);
    });
  }
})();
