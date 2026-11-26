// One business shared from the Gracio app: https://gracioapp.com/p.html#<business id>. The id is after "#",
// so it never reaches this website's server. Everything shown is already public in the app: the business,
// its stored scores and its published reviews (approved entries only), read with the public key the app,
// the admin page and c.html use. Who wrote a review shows as the name they chose in the app.
// Photos (Nov 26): approved photos of published reviews, shown through short-lived signed links like the app; the
// strip and the reviews use each photo's small copy (".thumb.jpg"), and a photo opens full size.
(function () {
  var URL_ = 'https://afjoucvqxxtwfpbpweph.supabase.co';
  var KEY = 'sb_publishable_77n-uOCZ_p2ZI6JreiJylQ_1Mk4igKn';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  var KINDS = { restaurant: 'Restaurant', cafe: 'Café & bakery', bar: 'Bar', fastfood: 'Fast food', grocery: 'Grocery', retail: 'Shop',
    salon: 'Salon & barber', spa: 'Nails & spa', gym: 'Gym', medical: 'Doctor & dentist', pharmacy: 'Pharmacy', auto: 'Auto repair',
    home: 'Home services', hotel: 'Hotel', bank: 'Bank', pet: 'Pet care', cleaners: 'Dry cleaner', pro: 'Professional service',
    learning: 'Classes & child care', misc: 'Other' };
  var DETAILS = { food: 'Food', drinks: 'Drinks', value: 'Value', cleanliness: 'Cleanliness', wait: 'Wait time', selection: 'Selection',
    result: 'Result', onTime: 'On time', pricing: 'Honest pricing', firstTime: 'Done right first time', communication: 'Communication',
    equipment: 'Equipment', comfort: 'Comfort' };
  var WORDS = ['Rude', 'Cold', 'Fine', 'Polite', 'Gracious'];
  var PAGE = 10, FIRST = 3;
  var WINGS = 'M21 10 L4.4 0.3 Q3.5 0 2.6 0 Q0 0 0 2.8 L0 17.2 Q0 20 2.6 20 Q3.5 20 4.4 19.7 Z M21 10 L37.6 0.3 Q38.5 0 39.4 0 Q42 0 42 2.8 L42 17.2 Q42 20 39.4 20 Q38.5 20 37.6 19.7 Z';
  var $ = function (id) { return document.getElementById(id); };
  var id = decodeURIComponent(location.hash.slice(1));
  var word = function (v) { return WORDS[Math.min(5, Math.max(1, Math.round(v))) - 1]; };
  var gone = function () {
    $('name').textContent = 'Not available';
    $('meta').textContent = 'This business isn’t available on Gracio.';
  };
  var get = function (path) {
    return fetch(URL_ + '/rest/v1/' + path, { headers: H }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  };
  // Bow ties like the app's: the app icon's shape, a darker knot on every tie when the score is above 4.
  var ties = function (value, color, width) {
    var h = (width / 2.1).toFixed(1), knot = value > 4 ? '<rect x="16.9" y="5.3" width="8.2" height="9.4" rx="1.9" fill="#000" fill-opacity="0.2"/>' : '';
    var out = '';
    for (var i = 0; i < 5; i++) {
      var f = Math.max(0, Math.min(1, value - i));
      out += '<svg width="' + width + '" height="' + h + '" viewBox="0 0 42 20"><g fill="' + color + '" fill-opacity="0.18"><path d="' + WINGS + '"/><rect x="16.9" y="5.3" width="8.2" height="9.4" rx="1.9"/></g>' +
        (f > 0 ? '<svg width="' + (42 * f) + '" height="20" viewBox="0 0 ' + (42 * f) + ' 20" overflow="hidden"><g fill="' + color + '"><path d="' + WINGS + '"/><rect x="16.9" y="5.3" width="8.2" height="9.4" rx="1.9"/></g>' + knot + '</svg>' : '') +
        '</svg>';
    }
    return out;
  };
  var fmtDate = function (iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return gone();
  var q = 'place_id=eq.' + id;

  Promise.all([
    get('places?id=eq.' + id + '&select=id,name,category,kind,town,address,lat,lng'),
    get('place_scores?' + q + '&select=time_window,score,review_count'),
    get('place_detail_scores?' + q + '&select=time_window,detail,score,rating_count'),
    get('reviews?' + q + '&select=id,author:profiles!reviews_author_id_fkey(display_name),review_entries(created_at,service,comment,review_photos(id,path,tag,position,status))')
  ]).then(function (res) {
    var p = res[0][0];
    if (!p) return gone();
    document.title = p.name + ' · Gracio';
    $('name').textContent = p.name;
    $('meta').textContent = [p.kind || KINDS[p.category] || '', p.address ? p.address + (p.town ? ', ' + p.town : '') : p.town || ''].filter(Boolean).join(' · ');
    $('openLink').href = 'gracio://place/' + p.id;
    if (typeof p.lat === 'number' && typeof p.lng === 'number' && !(p.lat === 0 && p.lng === 0)) {
      $('directions').href = 'https://maps.apple.com/?daddr=' + p.lat + ',' + p.lng + '&q=' + encodeURIComponent(p.name);
      $('directions').hidden = false;
    }

    // Score: the last 12 months, like the app; all time when there's nothing recent.
    var pick = function (w) { return res[1].filter(function (s) { return s.time_window === w && s.review_count > 0; })[0]; };
    var win = pick('12m') ? '12m' : 'all';
    var s = pick(win);
    if (s) {
      var v = Number(s.score);
      $('scoreNum').textContent = v.toFixed(1);
      $('scoreTies').innerHTML = ties(v, '#D9C383', 30);
      $('scoreWord').textContent = word(v);
      $('scoreMeta').textContent = s.review_count + (s.review_count === 1 ? ' review · ' : ' reviews · ') + (win === '12m' ? 'last 12 months' : 'all time');
    } else {
      $('scoreRow').hidden = true;
      $('scoreMeta').textContent = 'No reviews yet. Be the first, in the Gracio app.';
    }
    var details = res[2].filter(function (d) { return d.time_window === win && d.rating_count > 0 && DETAILS[d.detail]; });
    details.forEach(function (d) {
      var li = document.createElement('li');
      var n = document.createElement('span'); n.textContent = DETAILS[d.detail];
      var b = document.createElement('strong'); b.textContent = Number(d.score).toFixed(1);
      li.appendChild(n); li.appendChild(b);
      $('details').appendChild(li);
    });
    $('detailsCard').hidden = details.length === 0;

    // Reviews: each one's latest published entry.
    var all = res[3].map(function (r) {
      var es = (r.review_entries || []).slice().sort(function (a, b) { return Date.parse(a.created_at) - Date.parse(b.created_at); });
      var e = es[es.length - 1];
      if (!e) return null;
      var author = Array.isArray(r.author) ? r.author[0] : r.author;
      // Its photos, from every published version of the review, newest version first.
      var photos = [];
      es.slice().reverse().forEach(function (x) {
        (x.review_photos || []).filter(function (ph) { return ph.status === 'approved'; })
          .sort(function (a, b) { return a.position - b.position; })
          .forEach(function (ph) { photos.push({ path: ph.path, tag: ph.tag, date: x.created_at }); });
      });
      return { id: r.id, name: (author && author.display_name) || 'Gracio member', service: e.service, comment: e.comment || '', date: e.created_at, helpful: 0, photos: photos };
    }).filter(Boolean);
    var redraw = setUpReviews(all);
    $('body').hidden = false;
    showPhotos(all, redraw);
  }).catch(function () {
    $('meta').textContent = 'Couldn’t open this business. Check your connection and reload the page.';
  });

  // Signed links for these stored photos (Supabase answers with a link per path it lets us see).
  function signLinks(paths) {
    if (!paths.length) return Promise.resolve({});
    return fetch(URL_ + '/storage/v1/object/sign/review-photos', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600, paths: paths })
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var out = {};
      (rows || []).forEach(function (x) { if (x && x.path && x.signedURL) out[x.path] = URL_ + '/storage/v1' + x.signedURL; });
      return out;
    }).catch(function () { return {}; });
  }
  var TAGS = { food: 'Food', drinks: 'Drinks', menu: 'Menu', products: 'Products', prices: 'Prices', result: 'Result', rooms: 'Rooms', equipment: 'Equipment', inside: 'Inside', outside: 'Outside', other: 'Photo' };
  var small = function (path) { return path.replace(/\.jpg$/, '.thumb.jpg'); };
  // One photo: its small copy (or the full photo for photos from before small copies), opening full size.
  var photoLink = function (ph, size) {
    var a = document.createElement('a');
    a.href = ph.full; a.target = '_blank'; a.rel = 'noopener';
    var img = document.createElement('img');
    img.src = ph.small || ph.full; img.alt = (TAGS[ph.tag] || 'Photo') + ' photo'; img.loading = 'lazy'; img.width = size; img.height = size;
    a.appendChild(img);
    return a;
  };
  function showPhotos(all, redraw) {
    var photos = [];
    all.forEach(function (r) { r.photos.forEach(function (ph) { photos.push(ph); }); });
    if (!photos.length) return;
    var paths = photos.map(function (ph) { return ph.path; });
    // Small copies in a request of their own: photos from before Nov 26 have none, and that mustn't cost the full ones.
    Promise.all([signLinks(paths), signLinks(paths.map(small))]).then(function (res) {
      photos.forEach(function (ph) { ph.full = res[0][ph.path]; ph.small = res[1][small(ph.path)]; });
      var ok = photos.filter(function (ph) { return ph.full; }).sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); });
      if (!ok.length) return;
      var strip = $('photoStrip');
      strip.textContent = '';
      ok.forEach(function (ph) { strip.appendChild(photoLink(ph, 120)); });
      $('photosTitle').textContent = 'Photos · ' + ok.length;
      $('photosCard').hidden = false;
      redraw();
    });
  }

  function setUpReviews(all) {
    var shown = FIRST, votesLoaded = false;
    $('reviewsTitle').textContent = all.length ? 'Reviews · ' + all.length : 'Reviews';
    $('reviewTools').hidden = all.length < 2;
    var matches = function () {
      var text = $('q').value.trim().toLowerCase(), stars = Number($('stars').value), sort = $('sort').value;
      var list = all.filter(function (r) {
        return (!stars || r.service === stars) && (!text || r.comment.toLowerCase().indexOf(text) !== -1);
      });
      var t = function (r) { return Date.parse(r.date); };
      list.sort(function (a, b) {
        if (sort === 'old') return t(a) - t(b);
        if (sort === 'high') return b.service - a.service || t(b) - t(a);
        if (sort === 'low') return a.service - b.service || t(b) - t(a);
        if (sort === 'helpful') return b.helpful - a.helpful || t(b) - t(a);
        return t(b) - t(a);
      });
      return { list: list, text: text, stars: stars };
    };
    var highlight = function (el, comment, text) {
      if (!text) { el.textContent = comment; return; }
      var low = comment.toLowerCase(), at = 0, i;
      while ((i = low.indexOf(text, at)) !== -1) {
        el.appendChild(document.createTextNode(comment.slice(at, i)));
        var m = document.createElement('mark'); m.textContent = comment.slice(i, i + text.length);
        el.appendChild(m);
        at = i + text.length;
      }
      el.appendChild(document.createTextNode(comment.slice(at)));
    };
    var draw = function () {
      var m = matches(), ul = $('reviewList');
      ul.textContent = '';
      m.list.slice(0, shown).forEach(function (r) {
        var li = document.createElement('li');
        var top = document.createElement('div'); top.className = 'review-top';
        var n = document.createElement('strong'); n.textContent = r.name;
        var d = document.createElement('span'); d.textContent = fmtDate(r.date);
        top.appendChild(n); top.appendChild(d);
        var rate = document.createElement('div'); rate.className = 'review-rate';
        var tie = document.createElement('span'); tie.className = 'ties'; tie.setAttribute('aria-hidden', 'true'); tie.innerHTML = ties(r.service, '#391021', 22);
        var w = document.createElement('span'); w.textContent = word(r.service) + ' · ' + r.service + ' of 5';
        rate.appendChild(tie); rate.appendChild(w);
        li.appendChild(top); li.appendChild(rate);
        if (r.comment) { var c = document.createElement('p'); highlight(c, r.comment, m.text); li.appendChild(c); }
        var shownPhotos = r.photos.filter(function (ph) { return ph.full; });
        if (shownPhotos.length) {
          var row = document.createElement('div'); row.className = 'review-photos';
          shownPhotos.forEach(function (ph) { row.appendChild(photoLink(ph, 72)); });
          li.appendChild(row);
        }
        if (r.helpful > 0) { var h = document.createElement('p'); h.className = 'helpful'; h.textContent = r.helpful + (r.helpful === 1 ? ' person' : ' people') + ' found this helpful'; li.appendChild(h); }
        ul.appendChild(li);
      });
      var filtered = m.text || m.stars;
      $('reviewCount').textContent = !all.length ? 'No reviews yet.'
        : !m.list.length ? 'No reviews match. Try other words or another bow-tie rating.'
        : filtered ? m.list.length + (m.list.length === 1 ? ' review' : ' reviews') + (m.stars ? ' with ' + m.stars + (m.stars === 1 ? ' bow tie' : ' bow ties') : '') + (m.text ? ' mention “' + $('q').value.trim() + '”' : '')
        : '';
      $('more').hidden = m.list.length <= shown;
    };
    var restart = function () { shown = Math.max(FIRST, PAGE); draw(); };
    $('q').addEventListener('input', restart);
    $('stars').addEventListener('change', restart);
    $('sort').addEventListener('change', function () {
      if ($('sort').value === 'helpful' && !votesLoaded && all.length) {
        votesLoaded = true;
        fetch(URL_ + '/rest/v1/rpc/review_vote_counts', {
          method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_review_ids: all.map(function (r) { return r.id; }) })
        }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
          var by = {}; (rows || []).forEach(function (x) { by[x.review_id] = x.helpful_count || 0; });
          all.forEach(function (r) { r.helpful = by[r.id] || 0; });
          restart();
        }).catch(restart);
      } else restart();
    });
    $('more').addEventListener('click', function () { shown += PAGE; draw(); });
    draw();
    return draw;
  }
})();
