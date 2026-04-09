(function() {
  var placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  fetch('/nav.html')
    .then(function(r) { return r.text(); })
    .then(function(html) {
      placeholder.outerHTML = html;
      // Re-run any inline scripts injected by nav.html
      var scripts = document.querySelectorAll('#main-nav ~ script, .nav-tab-bar ~ script');
      scripts.forEach(function(s) {
        var newScript = document.createElement('script');
        newScript.textContent = s.textContent;
        document.head.appendChild(newScript);
      });
    })
    .catch(function(e) { console.error('nav-loader: failed to load nav.html', e); });
})();
