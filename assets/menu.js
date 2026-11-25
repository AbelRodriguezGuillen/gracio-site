// The phone Menu closes when one of its links is tapped (same-page links like /#how would otherwise leave it open).
document.querySelectorAll('.nav-menu nav a').forEach(function (a) { a.addEventListener('click', function () { a.closest('details').open = false; }); });
