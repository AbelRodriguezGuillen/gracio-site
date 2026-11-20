// Gracio for business: Google sign-in, two-step sign-in (required for business accounts), claim a business,
// your claims and your businesses. Everything is checked again on the server (submit_business_claim and the
// other functions); this page only shows what they answer. Uses the public key, like the app.
(function () {
  'use strict';
  var URL_ = 'https://afjoucvqxxtwfpbpweph.supabase.co';
  var KEY = 'sb_publishable_77n-uOCZ_p2ZI6JreiJylQ_1Mk4igKn';
  var HOME = { lat: 40.9276, lng: -73.9976 }; // Bergenfield, NJ: search starts here
  var STATUS = { pending: 'Waiting for our call', approved: 'Approved', declined: 'Not approved', withdrawn: 'Taken back' };
  var DECLINED = { not_verified: 'We couldn’t confirm it by phone.', not_owner: 'We couldn’t confirm you own or run it.', duplicate: 'It was already claimed or sent twice.', other: '' };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id, on) { $(id).hidden = on === false; };
  var hideAll = function () { ['signedOut', 'twoStep', 'home'].forEach(function (s) { $(s).hidden = true; }); };
  var setStatus = function (t) { $('status').textContent = t; };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var day = function (t) { return t ? new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };

  var sb, factorId = null, picked = null, requestId = null, searchTimer = null, searchSeq = 0;

  function start() {
    if (!window.supabase) { setStatus('This page couldn’t load. Refresh to try again.'); return; }
    sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, storageKey: 'gracio-business-auth', flowType: 'pkce' } });
    // ?place=<id> from a link in the app goes straight to that business.
    var q = new URLSearchParams(location.search).get('place');
    if (q && UUID.test(q)) { try { sessionStorage.setItem('gracio-business-place', q); } catch (e) {} }
    sb.auth.getSession().then(function (r) { r.data.session ? signedIn(r.data.session) : signedOut(); });
  }

  function signedOut() {
    hideAll();
    $('who').textContent = '';
    show('account', false);
    setStatus('Claim your business and reply to your reviews.');
    show('signedOut');
  }

  $('google').onclick = function () {
    $('signInError').textContent = '';
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/business/' } }).then(function (r) {
      if (r.error) $('signInError').textContent = r.error.message;
    });
  };

  $('signOut').onclick = function () {
    sb.auth.signOut().finally(function () { picked = null; signedOut(); });
  };

  function signedIn(session) {
    $('who').textContent = session.user.email || '';
    show('account');
    sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
      if (r.data && r.data.currentLevel === 'aal2') enter();
      else twoStep();
    }, twoStep);
  }

  // ---------- two-step sign-in ----------
  function twoStep() {
    hideAll();
    setStatus('One more step.');
    $('twoStepError').textContent = '';
    $('code').value = '';
    show('enroll', false);
    show('twoStep');
    sb.auth.mfa.listFactors().then(function (r) {
      if (r.error) { $('twoStepError').textContent = r.error.message; return; }
      var ready = (r.data.totp || [])[0];
      if (ready) { factorId = ready.id; $('askCode').textContent = 'Enter the 6-digit code from your authenticator app.'; $('code').focus(); return; }
      // First time: clear any unfinished setup, then show a new code to scan.
      var unfinished = (r.data.all || []).filter(function (f) { return f.factor_type === 'totp' && f.status !== 'verified'; });
      return Promise.all(unfinished.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); })).then(function () {
        return sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Gracio business ' + new Date().toISOString().slice(0, 16) });
      }).then(function (en) {
        if (en.error) { $('twoStepError').textContent = en.error.message; return; }
        factorId = en.data.id;
        $('qr').src = en.data.totp.qr_code;
        $('secret').textContent = en.data.totp.secret;
        $('askCode').textContent = 'Then enter the 6-digit code it shows.';
        show('enroll');
        $('code').focus();
      });
    });
  }

  $('verify').onclick = function () {
    var code = $('code').value.replace(/\D/g, '');
    if (code.length !== 6 || !factorId) { $('twoStepError').textContent = 'Enter the 6-digit code.'; return; }
    $('twoStepError').textContent = '';
    $('verify').disabled = true;
    sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code }).then(function (r) {
      $('verify').disabled = false;
      if (r.error) { $('twoStepError').textContent = 'That code didn’t work. Check the time on your phone and try the newest code.'; return; }
      enter();
    });
  };
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('verify').click(); });

  // ---------- signed in ----------
  function enter() {
    hideAll();
    setStatus('');
    show('home');
    loadMine();
    var p = null;
    try { p = sessionStorage.getItem('gracio-business-place'); sessionStorage.removeItem('gracio-business-place'); } catch (e) {}
    if (p) {
      sb.from('places').select('id, name, town, address').eq('id', p).maybeSingle().then(function (r) { if (r.data) pick(r.data); });
    }
  }

  function loadMine() {
    sb.rpc('my_businesses').then(function (r) {
      var list = $('owned');
      list.textContent = '';
      (r.data || []).forEach(function (b) {
        var li = el('li', 'card');
        li.appendChild(el('strong', null, b.place_name));
        li.appendChild(el('span', 'small', [b.town, 'since ' + day(b.since)].filter(Boolean).join(' · ')));
        var open = el('button', 'link', 'Reviews and replies');
        open.type = 'button';
        open.onclick = function () { openReviews(b); };
        li.appendChild(open);
        var details = el('button', 'link', 'Business details');
        details.type = 'button';
        details.onclick = function () { openDetails(b); };
        li.appendChild(details);
        list.appendChild(li);
      });
      show('ownedBox', !!(r.data && r.data.length));
    });
    sb.rpc('my_business_claims').then(function (r) {
      var list = $('claims');
      list.textContent = '';
      (r.data || []).forEach(function (c) {
        var li = el('li', 'card');
        li.appendChild(el('strong', null, c.place_name));
        var line = [c.town, 'sent ' + day(c.submitted_at)].filter(Boolean).join(' · ');
        li.appendChild(el('span', 'small', line));
        var st = el('span', 'pill ' + c.status, STATUS[c.status] || c.status);
        li.appendChild(st);
        if (c.status === 'declined' && DECLINED[c.decision_code]) li.appendChild(el('p', 'small', DECLINED[c.decision_code] + ' Questions? Email support@gracioapp.com.'));
        if (c.status === 'pending') {
          var b = el('button', 'link', 'Take back');
          b.type = 'button';
          b.onclick = function () {
            if (!confirm('Take back your claim for ' + c.place_name + '?')) return;
            b.disabled = true;
            sb.rpc('withdraw_business_claim', { p_claim_id: c.id }).then(function (w) {
              if (w.error) { b.disabled = false; alert(w.error.message); return; }
              loadMine();
            });
          };
          li.appendChild(b);
        }
        list.appendChild(li);
      });
      show('claimsBox', !!(r.data && r.data.length));
    });
  }

  // ---------- business details ----------
  var DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
  var EDIT_DECLINED = { wrong_info: 'It didn’t look right to us.', not_allowed: 'It isn’t allowed on Gracio.', promotion: 'It was advertising.', other: '' };
  var FIELD_NAMES = { phone: 'Phone', website: 'Website', about: 'Description', hours: 'Hours' };
  var detailsPlace = null, detailsReq = null;

  // One row per day: Open / Closed, then from and to.
  (function buildHours() {
    var box = $('dHours');
    DAYS.forEach(function (d) {
      var row = el('div', 'hours-row');
      var name = el('span', 'day', d[1]);
      var closed = el('label', 'closed');
      var cb = el('input'); cb.type = 'checkbox'; cb.id = 'h-' + d[0] + '-closed';
      closed.appendChild(cb); closed.appendChild(document.createTextNode(' Closed'));
      var from = el('input'); from.type = 'time'; from.id = 'h-' + d[0] + '-open'; from.value = '09:00'; from.setAttribute('aria-label', d[1] + ' opens');
      var to = el('input'); to.type = 'time'; to.id = 'h-' + d[0] + '-close'; to.value = '17:00'; to.setAttribute('aria-label', d[1] + ' closes');
      var dash = el('span', 'small', 'to');
      cb.onchange = function () { from.disabled = to.disabled = cb.checked; };
      [name, closed, from, dash, to].forEach(function (x) { row.appendChild(x); });
      box.appendChild(row);
    });
  })();
  $('dHoursOn').onchange = function () {
    var on = $('dHoursOn').checked;
    show('dHours', on); show('dNoteLabel', on); show('dNote', on);
  };
  $('dAbout').oninput = function () { $('dAboutCount').textContent = $('dAbout').value.length + ' / 300'; };

  function openDetails(b) {
    detailsPlace = b;
    setStatus('');
    ['ownedBox', 'claimsBox', 'claimArea'].forEach(function (id) { show(id, false); });
    $('detailsTitle').textContent = 'Details of ' + b.place_name;
    $('dError').textContent = '';
    show('detailsBox');
    loadDetails();
    window.scrollTo(0, 0);
  }

  $('detailsBack').onclick = function () {
    detailsPlace = null;
    show('detailsBox', false);
    show('claimArea');
    loadMine();
  };

  function fillHours(h) {
    $('dHoursOn').checked = !!h;
    DAYS.forEach(function (d) {
      var r = h && h[d[0]] && h[d[0]][0];
      var cb = $('h-' + d[0] + '-closed');
      cb.checked = !!h && !r;
      $('h-' + d[0] + '-open').value = r ? r.open : '09:00';
      $('h-' + d[0] + '-close').value = r ? r.close : '17:00';
      cb.onchange();
    });
    $('dNote').value = (h && h.note) || '';
    $('dHoursOn').onchange();
  }

  function loadDetails() {
    var forPlace = detailsPlace;
    sb.rpc('business_place_details', { p_place_id: forPlace.place_id }).then(function (r) {
      if (detailsPlace !== forPlace) return;
      if (r.error) { $('dError').textContent = r.error.message; return; }
      var d = (r.data || [])[0] || {};
      $('dPhone').value = d.phone || '';
      $('dWebsite').value = d.website || '';
      $('dAbout').value = d.about || '';
      $('dAbout').oninput();
      fillHours(d.hours);
      detailsReq = crypto.randomUUID ? crypto.randomUUID() : null;
      var st = $('detailsState');
      st.textContent = '';
      if (d.pending_id) {
        st.appendChild(el('span', 'pill', 'Changes waiting for approval'));
        st.appendChild(el('p', 'small', 'Waiting: ' + Object.keys(d.pending_changes || {}).map(function (k) { return FIELD_NAMES[k] || k; }).join(', ') + ' · sent ' + day(d.pending_at)));
        var back = el('button', 'link', 'Take back');
        back.type = 'button';
        back.onclick = function () {
          if (!confirm('Take back these changes before they’re approved?')) return;
          back.disabled = true;
          sb.rpc('withdraw_place_edit', { p_edit_id: d.pending_id }).then(function (w) {
            if (w.error) { back.disabled = false; alert(w.error.message); return; }
            loadDetails();
          });
        };
        st.appendChild(back);
      } else if (d.last_status === 'declined') {
        st.appendChild(el('span', 'pill declined', 'Your last changes weren’t approved'));
        if (EDIT_DECLINED[d.last_code]) st.appendChild(el('p', 'small', EDIT_DECLINED[d.last_code] + ' You can send new ones.'));
      } else if (d.last_status === 'approved') {
        st.appendChild(el('span', 'pill approved', 'Your last changes are live · ' + day(d.last_decided_at)));
      }
      show('detailsState', !!st.children.length);
      show('detailsForm', !d.pending_id);
    });
  }

  $('dSend').onclick = function () {
    var err = $('dError');
    err.textContent = '';
    var changes = { phone: $('dPhone').value.trim(), website: $('dWebsite').value.trim(), about: $('dAbout').value.trim() };
    if ($('dHoursOn').checked) {
      var h = {};
      for (var i = 0; i < DAYS.length; i++) {
        var d = DAYS[i][0];
        if ($('h-' + d + '-closed').checked) { h[d] = []; continue; }
        var o = $('h-' + d + '-open').value, c = $('h-' + d + '-close').value;
        if (!o || !c || o === c) { err.textContent = 'Check the hours for ' + DAYS[i][1] + '.'; return; }
        h[d] = [{ open: o, close: c }];
      }
      if ($('dNote').value.trim()) h.note = $('dNote').value.trim();
      changes.hours = h;
    }
    $('dSend').disabled = true;
    sb.rpc('submit_place_edit', { p_place_id: detailsPlace.place_id, p_changes: changes, p_request_id: detailsReq }).then(function (r) {
      $('dSend').disabled = false;
      if (r.error) { err.textContent = r.error.message; return; }
      loadDetails();
      window.scrollTo(0, 0);
    });
  };

  // ---------- reviews and replies ----------
  var REPLY_DECLINED = { not_respectful: 'It wasn’t respectful.', private_info: 'It shared private details about the customer.', off_topic: 'It didn’t answer the review.', promotion: 'It was advertising.', other: '' };
  var place = null, reviewsShown = 0, PAGE = 10;


  function openReviews(b) {
    place = b;
    setStatus('');
    ['ownedBox', 'claimsBox', 'claimArea'].forEach(function (id) { show(id, false); });
    $('reviewsTitle').textContent = 'Reviews of ' + b.place_name;
    $('reviews').textContent = '';
    $('reviewsError').textContent = '';
    reviewsShown = 0;
    show('reviewsBox');
    loadReviews();
    window.scrollTo(0, 0);
  }

  $('backToHome').onclick = function () {
    place = null;
    show('reviewsBox', false);
    show('claimArea');
    loadMine(); // shows your businesses and claims again
  };

  $('moreReviews').onclick = loadReviews;

  function loadReviews() {
    var forPlace = place;
    $('moreReviews').disabled = true;
    sb.rpc('business_reviews', { p_place_id: forPlace.place_id, p_limit: PAGE, p_offset: reviewsShown }).then(function (r) {
      $('moreReviews').disabled = false;
      if (place !== forPlace) return;
      if (r.error) { $('reviewsError').textContent = r.error.message; return; }
      var rows = r.data || [];
      if (!reviewsShown && !rows.length) $('reviews').appendChild(el('li', 'small', 'No reviews yet.'));
      rows.forEach(function (v) { $('reviews').appendChild(reviewItem(v)); });
      reviewsShown += rows.length;
      show('moreReviews', rows.length === PAGE);
    });
  }

  function reviewItem(v) {
    var li = el('li', 'card review');
    li.appendChild(el('strong', null, v.reviewer));
    li.appendChild(el('span', 'small', v.service + ' of 5 · ' + day(v.reviewed_at) + (v.verified ? ' · Verified visit' : '')));
    if (v.comment) li.appendChild(el('p', 'quote', v.comment));
    var state = el('div', 'reply-state');
    li.appendChild(state);
    var takeBack = function (id, label, ask) {
      var b = el('button', 'link', label);
      b.type = 'button';
      b.onclick = function () {
        if (!confirm(ask)) return;
        b.disabled = true;
        sb.rpc('withdraw_business_reply', { p_reply_id: id }).then(function (w) {
          if (w.error) { b.disabled = false; alert(w.error.message); return; }
          refresh(li, v.review_id);
        });
      };
      return b;
    };
    if (v.reply_id) {
      state.appendChild(el('span', 'pill approved', 'Your reply, shown in the app'));
      state.appendChild(el('p', 'quote', v.reply_body));
      state.appendChild(takeBack(v.reply_id, 'Take it down', 'Take down your reply? It disappears from the app.'));
    }
    if (v.pending_id) {
      state.appendChild(el('span', 'pill', v.reply_id ? 'New reply waiting for approval' : 'Waiting for approval'));
      state.appendChild(el('p', 'quote', v.pending_body));
      state.appendChild(takeBack(v.pending_id, 'Take back', 'Take back this reply before it’s approved?'));
    } else {
      if (v.declined_code) {
        state.appendChild(el('span', 'pill declined', 'Your last reply wasn’t approved'));
        if (REPLY_DECLINED[v.declined_code]) state.appendChild(el('p', 'small', REPLY_DECLINED[v.declined_code] + ' You can write a new one.'));
      }
      state.appendChild(replyForm(li, v));
    }
    return li;
  }

  function replyForm(li, v) {
    var box = el('div', 'reply-form');
    var id = 'reply-' + v.review_id;
    var label = el('label', null, v.reply_id ? 'Write a new reply (it replaces yours once approved)' : 'Reply');
    label.htmlFor = id;
    var text = el('textarea');
    text.id = id;
    text.rows = 3;
    text.maxLength = 600;
    var count = el('span', 'small', '0 / 600');
    text.oninput = function () { count.textContent = text.value.length + ' / 600'; };
    var send = el('button', 'btn primary', 'Send reply');
    send.type = 'button';
    var err = el('p', 'error');
    err.setAttribute('role', 'alert');
    var req = crypto.randomUUID ? crypto.randomUUID() : null;
    send.onclick = function () {
      var body = text.value.trim();
      if (body.length < 2) { err.textContent = 'Write your reply first.'; return; }
      send.disabled = true;
      err.textContent = '';
      sb.rpc('submit_business_reply', { p_review_id: v.review_id, p_body: body, p_request_id: req }).then(function (r) {
        send.disabled = false;
        if (r.error) { err.textContent = r.error.message; return; }
        refresh(li, v.review_id);
      });
    };
    [label, text, count, send, err].forEach(function (x) { box.appendChild(x); });
    return box;
  }

  // Shows one review again after a change (asks for this business's reviews and picks it out).
  function refresh(li, reviewId) {
    var forPlace = place;
    sb.rpc('business_reviews', { p_place_id: forPlace.place_id, p_limit: 50, p_offset: 0 }).then(function (r) {
      if (place !== forPlace || r.error) return;
      var v = (r.data || []).filter(function (x) { return x.review_id === reviewId; })[0];
      if (v) li.replaceWith(reviewItem(v));
      else openReviews(forPlace); // an older review: show the list again from the top
    });
  }

  // ---------- find a business ----------
  $('search').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(search, 300);
  });

  function search() {
    var text = $('search').value.trim();
    var list = $('results');
    if (text.length < 2) { list.textContent = ''; return; }
    var seq = ++searchSeq;
    sb.rpc('search_places', { search: text, only_categories: null, near_lat: HOME.lat, near_lng: HOME.lng, within_miles: null, page_size: 8, page_number: 0 })
      .then(function (r) {
        if (seq !== searchSeq) return; // an older search answered late
        list.textContent = '';
        if (r.error) { list.appendChild(el('li', 'small', 'Search isn’t working right now. Try again in a minute.')); return; }
        if (!r.data || !r.data.length) { list.appendChild(el('li', 'small', 'No businesses match that name.')); return; }
        r.data.forEach(function (p) {
          var li = el('li');
          var b = el('button', 'result');
          b.type = 'button';
          b.appendChild(el('strong', null, p.name));
          b.appendChild(el('span', 'small', [p.address, p.town].filter(Boolean).join(', ')));
          b.onclick = function () { pick(p); };
          li.appendChild(b);
          list.appendChild(li);
        });
      });
  }

  function pick(p) {
    picked = p;
    requestId = (crypto.randomUUID ? crypto.randomUUID() : null);
    $('pickedName').textContent = p.name;
    $('pickedWhere').textContent = [p.address, p.town].filter(Boolean).join(', ');
    $('formError').textContent = '';
    show('find', false);
    show('form');
    $('first').focus();
  }

  $('change').onclick = function () {
    picked = null;
    show('form', false);
    show('find');
    $('search').focus();
  };

  $('send').onclick = function () {
    if (!picked) return;
    var v = function (id) { return $(id).value.trim(); };
    var err = $('formError');
    err.textContent = '';
    if (!v('first')) { err.textContent = 'Enter your first name.'; return $('first').focus(); }
    if (!v('last')) { err.textContent = 'Enter your last name.'; return $('last').focus(); }
    if (v('role').length < 2) { err.textContent = 'Enter your role at the business.'; return $('role').focus(); }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('email'))) { err.textContent = 'Enter a work email address.'; return $('email').focus(); }
    if (v('phone').replace(/\D/g, '').length < 10) { err.textContent = 'Enter a phone number with area code.'; return $('phone').focus(); }
    if (!$('confirm').checked) { err.textContent = 'Please confirm that you own or are authorized to represent this business.'; return; }
    $('send').disabled = true;
    sb.rpc('submit_business_claim', {
      p_place_id: picked.id, p_name: v('first') + ' ' + v('last'), p_role: v('role'), p_email: v('email'), p_phone: v('phone'),
      p_note: v('note'), p_confirm: true, p_request_id: requestId,
    }).then(function (r) {
      $('send').disabled = false;
      if (r.error) { err.textContent = r.error.message; return; }
      if (r.data && r.data.status === 'refused') { err.textContent = r.data.message; return; }
      ['first', 'last', 'role', 'email', 'phone', 'note', 'search'].forEach(function (id) { $(id).value = ''; });
      $('confirm').checked = false;
      $('results').textContent = '';
      picked = null;
      show('form', false);
      show('find');
      setStatus('Claim sent. We’ll call the number on the listing to confirm.');
      loadMine();
      window.scrollTo(0, 0);
    });
  };

  start();
})();
