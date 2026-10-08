// Runs in <head> so the page never flashes the wrong theme
(function () {
  try {
    var t = localStorage.getItem('trivia-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
