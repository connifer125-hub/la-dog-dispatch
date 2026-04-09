(function() {
  var placeholder = document.getElementById('footer-placeholder');
  if (!placeholder) return;

  fetch('/footer.html')
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var div = document.createElement('div');
      div.innerHTML = html;
      placeholder.replaceWith(div);

      // Execute any scripts inside the injected footer
      div.querySelectorAll('script').forEach(function(oldScript) {
        var newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent;
        document.head.appendChild(newScript);
      });
    })
    .catch(function(e) { console.error('footer-loader: failed to load footer.html', e); });
})();
