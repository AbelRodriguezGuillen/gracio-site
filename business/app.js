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
    show('signOut', false);
    setStatus('Claim your business and, soon, reply to reviews.');
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
    show('signOut');
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
    $('name').focus();
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
    if (v('name').length < 2) { err.textContent = 'Enter your name.'; return $('name').focus(); }
    if (v('role').length < 2) { err.textContent = 'Enter your role at the business.'; return $('role').focus(); }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('email'))) { err.textContent = 'Enter a work email address.'; return $('email').focus(); }
    if (v('phone').replace(/\D/g, '').length < 10) { err.textContent = 'Enter a phone number with area code.'; return $('phone').focus(); }
    if (!$('confirm').checked) { err.textContent = 'Please confirm that you own or are authorized to represent this business.'; return; }
    $('send').disabled = true;
    sb.rpc('submit_business_claim', {
      p_place_id: picked.id, p_name: v('name'), p_role: v('role'), p_email: v('email'), p_phone: v('phone'),
      p_note: v('note'), p_confirm: true, p_request_id: requestId,
    }).then(function (r) {
      $('send').disabled = false;
      if (r.error) { err.textContent = r.error.message; return; }
      if (r.data && r.data.status === 'refused') { err.textContent = r.data.message; return; }
      ['name', 'role', 'email', 'phone', 'note', 'search'].forEach(function (id) { $(id).value = ''; });
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
