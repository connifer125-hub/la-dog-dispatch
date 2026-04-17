(function() {
  var placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  fetch('/nav.html')
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var div = document.createElement('div');
      div.innerHTML = html;
      placeholder.replaceWith(div);

      // Execute scripts from nav.html
      // Use a script tag directly — nav.html uses window.* for globals
      // and var for locals, so no collision with page-level let/const
      div.querySelectorAll('script').forEach(function(oldScript) {
        var newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent;
        document.head.appendChild(newScript);
      });

      window.dispatchEvent(new Event('nav-loaded'));
    })
    .catch(function(e) { console.error('nav-loader: failed to load nav.html', e); });
})();
