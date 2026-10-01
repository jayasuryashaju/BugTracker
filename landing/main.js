(function () {
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');

  /* ---------- theme: swap screenshots to match ---------- */
  function applyShots() {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var next = 'assets/shots/' + img.getAttribute('data-shot') + '-' + theme + '.webp';
      if (img.getAttribute('src') !== next) img.setAttribute('src', next);
    });
  }
  applyShots();
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    applyShots();
  });

  /* ---------- nav: border on scroll, mobile menu ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');
  function setMenu(open) {
    links.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  }
  burger.addEventListener('click', function () { setMenu(!links.classList.contains('open')); });
  links.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- product tabs (WAI-ARIA tabs pattern) ---------- */
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var tabs = Array.prototype.slice.call(group.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        panel.hidden = !on;
        panel.classList.toggle('is-active', on);
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var step = 0;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') step = 1;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') step = -1;
        else if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); return; }
        else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); return; }
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
  });

  /* ---------- scroll reveal ---------- */
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 60 + 'ms';
    io.observe(el);
  });
})();
