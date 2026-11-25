// The link in a Gracio email: https://gracioapp.com/open.html#n=<message id>. The id is after "#", so it
// never reaches this website's server, and it's only a random id: the app opens it only for the account
// it was sent to (the Inbox shows your own messages). Anything that isn't an id just opens the Inbox.
(function () {
  var m = /^#n=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(location.hash);
  var url = 'gracio://inbox' + (m ? '?open=' + m[1].toLowerCase() : '');
  document.getElementById('openLink').href = url;
  // Try once on its own; Safari may ask "Open in Gracio?" first. The button works either way.
  setTimeout(function () { location.href = url; }, 300);
  setTimeout(function () { document.getElementById('meta').textContent = 'Tap the button to open the app.'; }, 1500);
})();
