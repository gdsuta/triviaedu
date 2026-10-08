(function () {
  var root = document.documentElement;
  var isDark = function () {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-toggle-theme]');
    if (el) {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('trivia-theme', next); } catch (err) {}
      return;
    }
    if (e.target.closest('[data-toggle-sitenav]')) { document.body.classList.toggle('site-nav-open'); return; }
    if (e.target.closest('[data-toggle-sidebar]')) { document.body.classList.toggle('nav-open'); return; }
    if (e.target.closest('[data-close-sidebar]')) { document.body.classList.remove('nav-open'); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }

    // Availability: click a day header to toggle the whole column
    var col = e.target.closest('[data-col]');
    if (col && !col.disabled) {
      var boxes = document.querySelectorAll('input[data-day="' + col.getAttribute('data-col') + '"]');
      var allOn = Array.prototype.every.call(boxes, function (b) { return b.checked; });
      boxes.forEach(function (b) { b.checked = !allOn; });
      return;
    }

    // Buttons that ask before submitting
    var btn = e.target.closest('button[data-confirm]');
    if (btn && !window.confirm(btn.getAttribute('data-confirm'))) e.preventDefault();
  });

  // Forms that ask before submitting
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Auto-submit filters
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
    var all = e.target.getAttribute && e.target.getAttribute('data-select-all');
    if (all) document.querySelectorAll('input[name="' + all + '"]').forEach(function (b) { b.checked = e.target.checked; });
  });

  // Availability: drag across cells to tick many at once
  var table = document.querySelector('table.avail.editing');
  if (table) {
    var dragging = false, setTo = true;
    table.addEventListener('pointerdown', function (e) {
      var label = e.target.closest('label.slot'); if (!label) return;
      e.preventDefault();
      var input = label.querySelector('input');
      dragging = true; setTo = !input.checked; input.checked = setTo;
    });
    table.addEventListener('pointerover', function (e) {
      if (!dragging) return;
      var label = e.target.closest('label.slot'); if (label) label.querySelector('input').checked = setTo;
    });
    table.addEventListener('click', function (e) { if (e.target.closest('label.slot')) e.preventDefault(); });
    document.addEventListener('pointerup', function () { dragging = false; });
  }
})();
