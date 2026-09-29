/* --------------------------------------------------------------------------
   Lead chat — a scripted, button-driven assistant.

   Loaded on every page with:
       <script src="/chat.js" defer></script>
   A listing page adds data-listing="<address>" to that tag so the property
   being viewed is offered as a topic, and sent along with the lead.

   The flow is short on purpose. It opens with Call / Text / Email buttons
   that go straight to Jeffrey from the visitor's own phone or mail app. For
   anyone who would rather talk later, it asks only: buying or selling, what
   they want to talk about, and how to reach them. No qualifying questions.
   A Schedule button in the header opens Jeffrey's Calendly at any point.

   Scripted on purpose, not an AI model. Nothing it says was not written here,
   so it can never answer "is this a good area for families like mine?" --
   which from a licensee is steering under the Fair Housing Act. Keep it that
   way: add questions and options, never free-text answers from the bot.

   Leads go to a Google Apps Script web app (apps-script/Code.gs) that appends
   a row to a Sheet and emails Jeffrey. Both contact forms post there too,
   through window.JBLead.send, so there is one place leads land.

   TO TURN THIS ON: deploy apps-script/Code.gs (steps at the top of that file)
   and paste its /exec URL into ENDPOINT below. Until then the chat stays
   hidden and the contact forms keep composing an email -- better no widget
   than one that drops leads. Preview it before then with ?chat=demo on any
   page: it runs fully but sends nothing.
   -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var CONFIG = {
    endpoint: 'https://script.google.com/macros/s/AKfycbyK-xUjPbI-LI2kmEEwRJ-1-Yq89ZpxWG8QETi3fLI2D7ESo7VTP9GI7xHs8MkZpQQU/exec',                                           // Apps Script /exec URL
    token:    '2864ed508901358755a8bc54',                   // must match SHARED_TOKEN in Code.gs
    calendly: 'https://calendly.com/jeffreybowenre/30min',  // '' skips the booking step
    phone:    '781-201-9488',
    email:    'jeff@jeffreybowen.com'
  };

  var demo = /[?&]chat=demo\b/.test(location.search);
  var me = document.currentScript;
  var pageListing = me && me.getAttribute('data-listing');

  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  /* Shared transport. Resolves on success, rejects on anything else, so
     callers can fall back to the phone number or a mail draft. */
  function send(data) {
    if (!CONFIG.endpoint) {
      if (demo) return new Promise(function (r) { setTimeout(r, 600); });
      return Promise.reject(new Error('no endpoint'));
    }
    var body = { token: CONFIG.token, page: location.href, submittedAt: new Date().toISOString() };
    for (var k in data) body[k] = data[k];
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      // text/plain keeps this a "simple request", so Apps Script needs no CORS preflight
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error('rejected'); });
  }

  window.JBLead = { ready: !!CONFIG.endpoint, send: send, phone: CONFIG.phone, email: CONFIG.email };

  if (!CONFIG.endpoint && !demo) return;

  /* ---------------------------------------------------------------
     STYLES + MARKUP
  ----------------------------------------------------------------*/
  var css = [
    '#jb-chat{--jb-ink:#0C0C0C;--jb-ink-lt:#1E1E1E;--jb-gold:#C29B40;--jb-gold-lt:#DCC188;--jb-ivory:#F7F5F1;',
    '--jb-white:#fff;--jb-muted:#6A6A6A;--jb-line:rgba(0,0,0,.14);--jb-r:12px;',
    '--jb-display:"Archivo",system-ui,sans-serif;--jb-body:"Source Serif 4",Georgia,serif;',
    'position:fixed;right:20px;bottom:20px;z-index:80;font-family:var(--jb-body);font-size:15.5px;line-height:1.5;color:var(--jb-ink)}',
    '#jb-chat *,#jb-chat *::before,#jb-chat *::after{box-sizing:border-box}',

    '#jb-chat .jb-launch{display:flex;align-items:center;gap:10px;padding:13px 20px 13px 17px;border:1px solid var(--jb-gold);cursor:pointer;',
    'background:var(--jb-gold);color:var(--jb-ink);border-radius:999px;font:600 14.5px/1.2 var(--jb-display);box-shadow:0 8px 28px rgba(0,0,0,.28)}',
    '#jb-chat .jb-launch:hover{background:var(--jb-gold-lt);border-color:var(--jb-gold-lt)}',
    '#jb-chat .jb-launch svg{flex:none;color:var(--jb-ink)}',
    '#jb-chat .jb-launch[hidden]{display:none}',

    '#jb-chat .jb-panel{display:none;flex-direction:column;overflow:hidden;width:390px;height:min(640px,calc(100vh - 40px));',
    'background:var(--jb-ivory);border-radius:var(--jb-r);box-shadow:0 18px 60px rgba(0,0,0,.32)}',
    '#jb-chat .jb-panel.jb-open{display:flex}',
    '#jb-chat .jb-head{background:var(--jb-ink);color:var(--jb-ivory);padding:16px 16px 0}',
    '#jb-chat .jb-head-row{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '#jb-chat .jb-who{font:700 15px/1.3 var(--jb-display);letter-spacing:-.01em}',
    '#jb-chat .jb-sub{font:500 12.5px/1.3 var(--jb-display);color:#A9A9A9;margin-top:3px}',
    '#jb-chat .jb-close{background:transparent;border:0;color:#A9A9A9;cursor:pointer;font-size:24px;line-height:1;padding:4px 8px;border-radius:6px}',
    '#jb-chat .jb-close:hover{color:var(--jb-ivory);background:rgba(255,255,255,.08)}',
    '#jb-chat .jb-acts{display:flex;align-items:center;gap:4px;flex:none}',
    '#jb-chat .jb-sched{display:flex;align-items:center;gap:6px;padding:6px 11px;border:1px solid rgba(220,193,136,.45);border-radius:999px;',
    'background:transparent;color:var(--jb-gold-lt);cursor:pointer;font:600 12.5px/1.2 var(--jb-display)}',
    '#jb-chat .jb-sched:hover{border-color:var(--jb-gold);color:var(--jb-ivory)}',
    '#jb-chat .jb-sched[hidden]{display:none}',
    '#jb-chat .jb-rule{height:2px;background:rgba(255,255,255,.14);margin-top:14px}',
    '#jb-chat .jb-rule i{display:block;height:100%;width:0;background:var(--jb-gold);transition:width .45s cubic-bezier(.4,0,.2,1)}',

    '#jb-chat .jb-log{flex:1;overflow-y:auto;padding:18px 16px 8px}',
    '#jb-chat .jb-msg{max-width:86%;margin-bottom:10px;padding:10px 14px;border-radius:var(--jb-r)}',
    '#jb-chat .jb-bot{background:var(--jb-white);border:1px solid var(--jb-line);border-bottom-left-radius:4px}',
    '#jb-chat .jb-user{background:var(--jb-ink);color:var(--jb-ivory);margin-left:auto;border-bottom-right-radius:4px;width:fit-content}',
    '#jb-chat .jb-note{background:#FBF6EA;border:1px solid #E8D9B4;font-size:14px;max-width:100%}',
    '#jb-chat .jb-typing{display:flex;gap:4px;padding:14px;width:56px}',
    '#jb-chat .jb-typing span{width:6px;height:6px;border-radius:50%;background:var(--jb-muted);animation:jb-bounce 1.1s infinite}',
    '#jb-chat .jb-typing span:nth-child(2){animation-delay:.16s}#jb-chat .jb-typing span:nth-child(3){animation-delay:.32s}',
    '@keyframes jb-bounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}',

    '#jb-chat .jb-zone{padding:10px 16px 16px;border-top:1px solid var(--jb-line);background:var(--jb-ivory);max-height:72%;overflow-y:auto}',
    '#jb-chat .jb-zone:empty{display:none}',
    '#jb-chat .jb-chips{display:flex;flex-wrap:wrap;gap:8px}',
    '#jb-chat .jb-chip{padding:9px 15px;border-radius:999px;cursor:pointer;font:500 13.5px/1.3 var(--jb-display);',
    'background:var(--jb-white);color:var(--jb-ink);border:1px solid var(--jb-line)}',
    '#jb-chat .jb-chip:hover{border-color:var(--jb-gold);background:#FDFBF6}',
    '#jb-chat a.jb-chip{display:inline-block;text-decoration:none}',
    '#jb-chat .jb-chip.jb-primary{background:var(--jb-ink);color:var(--jb-ivory);border-color:var(--jb-ink)}',
    '#jb-chat .jb-chip.jb-primary:hover{background:var(--jb-ink-lt)}',
    '#jb-chat .jb-form{display:flex;gap:8px}',
    '#jb-chat .jb-input{flex:1;padding:11px 13px;border:1px solid var(--jb-line);border-radius:10px;min-width:0;',
    'font:16px/1.4 var(--jb-body);background:var(--jb-white);color:var(--jb-ink);resize:none}',
    '#jb-chat .jb-input:focus{outline:none;border-color:var(--jb-gold);box-shadow:0 0 0 3px rgba(194,155,64,.18)}',
    '#jb-chat .jb-send{padding:11px 18px;border:0;border-radius:10px;cursor:pointer;font:600 14.5px/1.2 var(--jb-display);',
    'background:var(--jb-ink);color:var(--jb-ivory)}',
    '#jb-chat .jb-send:hover{background:var(--jb-ink-lt)}',
    '#jb-chat .jb-send:disabled{opacity:.6;cursor:default}',
    '#jb-chat .jb-wide{width:100%}',
    '#jb-chat .jb-err{color:#9B2C2C;font-size:13.5px;margin-top:7px}',
    '#jb-chat .jb-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}',

    '#jb-chat .jb-recap{background:var(--jb-white);border:1px solid var(--jb-line);border-radius:var(--jb-r);overflow:hidden;margin-bottom:10px}',
    '#jb-chat .jb-row{display:flex;width:100%;gap:10px;align-items:baseline;text-align:left;padding:9px 13px;border:0;',
    'border-bottom:1px solid var(--jb-line);background:transparent;font:inherit;color:inherit;cursor:pointer}',
    '#jb-chat .jb-row:last-child{border-bottom:0}',
    '#jb-chat .jb-row:hover{background:#FDFBF6}',
    '#jb-chat .jb-row b{flex:none;width:100px;font:600 12px/1.4 var(--jb-display);color:var(--jb-muted)}',
    '#jb-chat .jb-row span{flex:1;font-size:14px;overflow-wrap:anywhere}',
    '#jb-chat .jb-row em{flex:none;font:600 12px/1.4 var(--jb-display);font-style:normal;color:var(--jb-gold);opacity:0}',
    '#jb-chat .jb-row:hover em,#jb-chat .jb-row:focus-visible em{opacity:1}',
    '#jb-chat .jb-consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--jb-muted);margin-bottom:10px;cursor:pointer}',
    '#jb-chat .jb-consent input{margin-top:3px;flex:none;accent-color:var(--jb-ink);width:16px;height:16px}',
    '#jb-chat .jb-fine{font-size:12px;color:var(--jb-muted);margin-top:10px}',
    '#jb-chat .jb-cal{display:none;flex:1;flex-direction:column;min-height:0;background:var(--jb-white)}',
    '#jb-chat .jb-panel.jb-booking .jb-cal{display:flex}',
    '#jb-chat .jb-panel.jb-booking .jb-log,#jb-chat .jb-panel.jb-booking .jb-zone{display:none}',
    '#jb-chat .jb-cal-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;',
    'border-bottom:1px solid var(--jb-line);background:var(--jb-ivory);font:600 13px/1.4 var(--jb-display)}',
    '#jb-chat .jb-back{background:transparent;border:0;padding:4px 0;cursor:pointer;font:inherit;color:var(--jb-ink)}',
    '#jb-chat .jb-cal iframe{flex:1;width:100%;border:0;display:block}',
    '#jb-chat a{color:var(--jb-ink)}',
    '#jb-chat :focus-visible{outline:2px solid var(--jb-gold);outline-offset:2px}',
    '#jb-chat .jb-launch:focus-visible{outline-color:var(--jb-ink)}',

    '@media (max-width:480px){#jb-chat{right:12px;bottom:12px;left:12px}',
    '#jb-chat .jb-panel{width:auto;height:calc(100vh - 24px);height:calc(100dvh - 24px)}',
    '#jb-chat .jb-launch{margin-left:auto}}',
    '@media (prefers-reduced-motion:reduce){#jb-chat *,#jb-chat *::before{animation:none!important;transition:none!important}}',
    '@media print{#jb-chat{display:none}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'jb-chat';
  root.innerHTML =
    '<button class="jb-launch" type="button" aria-haspopup="dialog" aria-expanded="false">' +
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>' +
      '<span class="jb-launch-label">Ask Jeffrey</span>' +
    '</button>' +
    '<div class="jb-panel" role="dialog" aria-modal="false" aria-label="Chat with The Bowen Realty Group">' +
      '<div class="jb-head">' +
        '<div class="jb-head-row">' +
          '<div><div class="jb-who">The Bowen Realty Group</div><div class="jb-sub">Jeffrey Bowen &middot; ERealty Advisors</div></div>' +
          '<div class="jb-acts">' +
            '<button class="jb-sched" type="button" aria-label="Schedule a meeting with Jeffrey">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' +
              'Schedule' +
            '</button>' +
            '<button class="jb-close" type="button" aria-label="Close chat">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="jb-rule"><i></i></div>' +
      '</div>' +
      '<div class="jb-log" role="log" aria-live="polite" aria-atomic="false"></div>' +
      '<div class="jb-zone"></div>' +
      '<div class="jb-cal">' +
        '<div class="jb-cal-bar"><button class="jb-back" type="button">&larr; Back to chat</button>' +
        '<a class="jb-cal-new" target="_blank" rel="noopener">Open in new tab</a></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  var panel  = root.querySelector('.jb-panel');
  var log    = root.querySelector('.jb-log');
  var zone   = root.querySelector('.jb-zone');
  var bar    = root.querySelector('.jb-rule i');
  var launch = root.querySelector('.jb-launch');
  var sched  = root.querySelector('.jb-sched');
  var cal    = root.querySelector('.jb-cal');

  var answers = {};    // step id -> { label, value }
  var order   = [];    // answer order, for the recap and the payload
  var editing = false; // set while re-answering a line from the recap
  var opened  = 0;
  var total   = 5;     // questions on the talk-later path, for the progress rule

  var TEL = '+1' + CONFIG.phone.replace(/\D/g, '');

  /* ---------------------------------------------------------------
     FLOW
     Step ids double as the Sheet's column names, so rename with care.
  ----------------------------------------------------------------*/
  var TOPICS = {
    'Buying':            ['Homes for sale', 'How buying works', 'Getting pre-approved'],
    'Selling':           ['What my home is worth', 'Listing my home', 'Timing a sale'],
    'Buying and selling': ['Selling and buying at once', 'What my home is worth'],
    'Just a question':   []
  };

  var STEPS = {
    intent: {
      ask: ['Are you buying or selling?'],
      label: 'Looking to', type: 'choice',
      options: Object.keys(TOPICS),
      next: 'topic'
    },
    topic: {
      ask: ['What would you like to talk to Jeffrey about?'],
      label: 'Topic', type: 'text', placeholder: 'A sentence or two is plenty', long: true,
      suggest: function () {
        var list = (TOPICS[answers.intent && answers.intent.value] || []).slice();
        if (pageListing) list.unshift(pageListing);
        return list;
      },
      next: 'name'
    },
    name:  { ask: ['Great. What\'s your name?'], label: 'Name', type: 'text', placeholder: 'First and last', next: 'email' },
    email: { ask: ['And your email, so Jeffrey can get back to you?'], label: 'Email', type: 'text', placeholder: 'you@example.com', validate: 'email', next: 'phone' },
    phone: { ask: ['A phone number, if you\'d like a call or text. You can skip this.'], label: 'Phone', type: 'text',
             placeholder: '(555) 555-5555', validate: 'phone', optional: true, next: 'review' }
  };

  function val(f) { return typeof f === 'function' ? f() : f; }

  /* ---------------------------------------------------------------
     RENDER HELPERS
  ----------------------------------------------------------------*/
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(cls, text) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function clearZone() { zone.innerHTML = ''; }
  function focusSoon(n) { setTimeout(function () { n.focus({ preventScroll: true }); }, 30); }

  function say(text, kind) {
    var n = el('div', 'jb-msg ' + (kind === 'note' ? 'jb-note' : kind === 'user' ? 'jb-user' : 'jb-bot'), text);
    log.appendChild(n); scroll(); return n;
  }

  function typing(cb, ms) {
    var n = el('div', 'jb-msg jb-bot jb-typing');
    n.appendChild(el('span')); n.appendChild(el('span')); n.appendChild(el('span'));
    n.setAttribute('aria-hidden', 'true');
    log.appendChild(n); scroll();
    setTimeout(function () { n.remove(); cb(); }, ms || 420);
  }

  function progress() {
    bar.style.width = Math.min(95, Math.round(order.length / total * 100)) + '%';
  }

  /* ---------------------------------------------------------------
     STEP RUNNER
  ----------------------------------------------------------------*/
  function go(id) {
    if (id === 'review') return review();
    var step = STEPS[id];
    if (!step) return;
    clearZone();
    var lines = val(step.ask).slice();
    (function emit() {
      if (!lines.length) return render(id, step);
      typing(function () { say(lines.shift()); emit(); }, lines.length > 1 ? 380 : 480);
    })();
  }

  function answer(id, step, value, shown) {
    say(shown || value, 'user');
    clearZone();
    if (!answers[id]) order.push(id);
    answers[id] = { label: step.label, value: value };
    progress();
    if (editing) { editing = false; return review(); }
    go(step.next);
  }

  /* ---------------------------------------------------------------
     GREETING
     Call / Text / Email are plain links, so they open the visitor's own
     dialler, messages or mail app. They stay on screen after a tap in case
     nothing happened (a desktop with no phone app, say).
  ----------------------------------------------------------------*/
  function greet() {
    typing(function () {
      say('Hi, I\'m Jeffrey\'s virtual assistant — happy to help!');
      typing(function () {
        say('You can reach Jeffrey right now, or leave a few details and he\'ll get back to you.');
        var wrap = el('div', 'jb-chips');
        [
          ['Call him now', 'tel:' + TEL, 'call', true],
          ['Text him', 'sms:' + TEL, 'text'],
          ['Email him', 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Question from jeffreybowen.com'), 'email']
        ].forEach(function (c) {
          var a = el('a', 'jb-chip' + (c[3] ? ' jb-primary' : ''), c[0]);
          a.href = c[1];
          a.addEventListener('click', function () {
            track('chat_contact', { method: c[2] });
            if (!a.dataset.told) {
              a.dataset.told = '1';
              say(c[2] === 'email'
                ? 'Opening your email app. If nothing opened, Jeffrey\'s email is ' + CONFIG.email + '.'
                : 'Opening your phone. If nothing opened, Jeffrey\'s cell is ' + CONFIG.phone + '.');
            }
          });
          wrap.appendChild(a);
        });
        var later = button('jb-chip', 'Talk later');
        later.addEventListener('click', function () {
          say('I\'d rather talk later', 'user');
          clearZone();
          go('intent');
        });
        wrap.appendChild(later);
        if (CONFIG.calendly) {
          var meet = button('jb-chip', 'Schedule a meeting');
          meet.addEventListener('click', openCalendar);
          wrap.insertBefore(meet, later);
        }
        zone.appendChild(wrap);
        focusSoon(wrap.firstChild);
      }, 420);
    }, 380);
  }

  function render(id, step) {
    clearZone();
    if (step.type === 'choice') return renderChoice(id, step);
    return renderText(id, step);
  }

  function renderChoice(id, step) {
    var wrap = el('div', 'jb-chips');
    val(step.options).forEach(function (opt, i) {
      var b = button('jb-chip', opt);
      b.addEventListener('click', function () { answer(id, step, opt); });
      wrap.appendChild(b);
      if (i === 0) focusSoon(b);
    });
    zone.appendChild(wrap);
  }

  function renderText(id, step) {
    var optional = val(step.optional);
    var suggest = val(step.suggest);
    if (suggest && suggest.length) {
      var chips = el('div', 'jb-chips');
      chips.style.marginBottom = '9px';
      suggest.forEach(function (s) {
        var c = button('jb-chip', s);
        c.addEventListener('click', function () { submit(s); });
        chips.appendChild(c);
      });
      zone.appendChild(chips);
    }

    var form = el('div', 'jb-form');
    var input = el(step.long ? 'textarea' : 'input', 'jb-input');
    if (step.long) input.rows = 3; else input.type = 'text';
    input.placeholder = step.placeholder || '';
    input.maxLength = step.long ? 1500 : 200;
    input.setAttribute('aria-label', step.label);
    if (step.validate === 'email') { input.type = 'email'; input.autocomplete = 'email'; }
    if (step.validate === 'phone') { input.type = 'tel'; input.autocomplete = 'tel'; }
    if (id === 'name') input.autocomplete = 'name';
    if (answers[id] && answers[id].value !== '—') input.value = answers[id].value;

    var go_ = button('jb-send', 'Send');
    form.appendChild(input); form.appendChild(go_);
    zone.appendChild(form);

    if (optional) {
      var skip = button('jb-chip', 'Skip');
      skip.style.marginTop = '9px';
      skip.addEventListener('click', function () { submit(''); });
      zone.appendChild(skip);
    }

    var err = el('div', 'jb-err');
    err.hidden = true;
    zone.appendChild(err);

    function fail(m) { err.textContent = m; err.hidden = false; input.focus(); }

    function submit(forced) {
      var v = (forced != null ? forced : input.value).trim();
      var digits = v.replace(/\D/g, '');
      if (!v && !optional) return fail('Add something here so Jeffrey knows what to work with.');
      if (v && step.validate === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return fail('That email doesn\'t look right — check for a typo.');
      if (v && step.validate === 'phone' && (digits.length < 10 || digits.length > 11)) return fail('A phone number needs 10 digits.');
      answer(id, step, v || '—', v || 'Skip');
    }

    go_.addEventListener('click', function () { submit(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !(step.long && e.shiftKey)) { e.preventDefault(); submit(); }
    });
    focusSoon(input);
  }

  /* ---------------------------------------------------------------
     REVIEW + SEND
  ----------------------------------------------------------------*/
  function review() {
    clearZone();
    typing(function () {
      say('Here\'s what I\'ll send. Tap any line to change it.');
      bar.style.width = '100%';

      var card = el('div', 'jb-recap');
      order.forEach(function (k) {
        var row = button('jb-row');
        row.appendChild(el('b', null, answers[k].label));
        row.appendChild(el('span', null, answers[k].value));
        row.appendChild(el('em', null, 'change'));
        row.addEventListener('click', function () {
          editing = true;
          say('Change: ' + answers[k].label.toLowerCase(), 'user');
          go(k);
        });
        card.appendChild(row);
      });
      zone.appendChild(card);

      var consent = el('label', 'jb-consent');
      var box = document.createElement('input');
      box.type = 'checkbox';
      consent.appendChild(box);
      consent.appendChild(el('span', null,
        'I agree that Jeffrey Bowen may contact me by call, text and email about real estate services. Reply STOP at any time to opt out. Message and data rates may apply.'));
      zone.appendChild(consent);

      var hp = el('input', 'jb-hp');   // honeypot: people never see it, bots fill it
      hp.type = 'text'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
      zone.appendChild(hp);

      var btn = button('jb-send jb-wide', demo && !CONFIG.endpoint ? 'Send to Jeffrey (demo — nothing is sent)' : 'Send to Jeffrey');
      zone.appendChild(btn);

      var err = el('div', 'jb-err'); err.hidden = true; zone.appendChild(err);

      zone.appendChild(el('div', 'jb-fine',
        'Sending this doesn\'t create an agency relationship. Massachusetts requires a written agreement before anyone represents you.'));

      btn.addEventListener('click', function () {
        if (!box.checked) { err.textContent = 'Check the box above so Jeffrey can reply.'; err.hidden = false; return; }
        if (hp.value || Date.now() - opened < 4000) return finish();   // bot, or too fast to be a person
        err.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Sending…';
        send(payload()).then(function () {
          track('chat_lead_submit', { intent: answers.intent ? answers.intent.value : '' });
          finish();
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = 'Try again';
          var tel = CONFIG.phone.replace(/\D/g, '');
          err.innerHTML = 'That didn\'t go through. Call or text <a href="tel:+1' + tel + '">' + CONFIG.phone +
            '</a>, or email <a href="mailto:' + CONFIG.email + '">' + CONFIG.email + '</a>.';
          err.hidden = false;
        });
      });
      focusSoon(btn);
    }, 300);
  }

  function payload() {
    var out = { source: 'chat', summary: '' };
    if (pageListing) out.listing = pageListing;
    order.forEach(function (k) {
      out[k] = answers[k].value;
      out.summary += answers[k].label + ': ' + answers[k].value + '\n';
    });
    return out;
  }

  function finish() {
    clearZone();
    try { localStorage.setItem('jb-chat-sent', '1'); } catch (e) {}
    typing(function () {
      say('Sent. Jeffrey will follow up — usually the same day.');
      if (CONFIG.calendly) {
        var book = button('jb-send jb-wide', 'Schedule a meeting now');
        book.style.marginBottom = '8px';
        book.addEventListener('click', openCalendar);
        zone.appendChild(book);
      }
      closeButton(!CONFIG.calendly);
    }, 400);
  }

  function closeButton(primary) {
    var done = button(primary ? 'jb-send jb-wide' : 'jb-chip jb-wide', 'Close');
    done.addEventListener('click', close);
    zone.appendChild(done);
    focusSoon(zone.firstChild);
  }

  /* ---------------------------------------------------------------
     CALENDAR
     Calendly opens inside the panel, over the chat, and "Back to chat"
     returns to exactly where the visitor was. The iframe is only created on
     first use, so nobody who never books loads Calendly or its cookies.
  ----------------------------------------------------------------*/
  var frame = null;

  function calendarUrl() {
    var q = 'hide_gdpr_banner=1&utm_source=website&utm_content=chat';
    if (answers.name) q += '&name=' + encodeURIComponent(answers.name.value);
    if (answers.email) q += '&email=' + encodeURIComponent(answers.email.value);
    return CONFIG.calendly + (CONFIG.calendly.indexOf('?') > -1 ? '&' : '?') + q;
  }

  function openCalendar() {
    var url = calendarUrl();
    // embed_domain lets Calendly post calendly.event_scheduled back to the page
    var src = url + '&embed_type=Inline&embed_domain=' + encodeURIComponent(location.hostname);
    if (!frame || frame.dataset.src !== src) {   // rebuild once name/email are known
      if (frame) frame.remove();
      frame = document.createElement('iframe');
      frame.title = 'Book a time with Jeffrey Bowen';
      frame.src = frame.dataset.src = src;
      cal.appendChild(frame);
    }
    cal.querySelector('.jb-cal-new').href = url;
    panel.classList.add('jb-booking');
    track('booking_open', { booking_type: 'unspecified', booking_source: 'chat' });
    focusSoon(cal.querySelector('.jb-back'));
  }

  function closeCalendar() {
    panel.classList.remove('jb-booking');
    scroll();
  }

  if (CONFIG.calendly) sched.addEventListener('click', openCalendar);
  else sched.hidden = true;
  cal.querySelector('.jb-back').addEventListener('click', closeCalendar);

  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.event_scheduled') return;
    if (!panel.classList.contains('jb-booking')) return;
    closeCalendar();
    clearZone();
    say('Booked. Jeffrey will confirm by text beforehand.');
    closeButton(true);
    // The home page's booking script already reports booking_complete for
    // every Calendly embed; only count it here where that script is absent.
    if (!document.getElementById('book')) track('booking_complete', { booking_source: 'chat' });
  });

  /* ---------------------------------------------------------------
     OPEN / CLOSE
  ----------------------------------------------------------------*/
  function open() {
    panel.classList.add('jb-open');
    launch.hidden = true;
    launch.setAttribute('aria-expanded', 'true');
    if (!order.length && !log.children.length) {
      opened = Date.now();
      track('chat_open', {});
      greet();
    }
  }
  function close() {
    panel.classList.remove('jb-open');
    launch.hidden = false;
    launch.setAttribute('aria-expanded', 'false');
    launch.focus();
  }

  launch.addEventListener('click', open);
  root.querySelector('.jb-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !panel.classList.contains('jb-open')) return;
    if (panel.classList.contains('jb-booking')) closeCalendar(); else close();
  });

  // Any link to #chat on the page opens it instead of jumping.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#chat"]');
    if (a) { e.preventDefault(); open(); }
  });

  try {
    if (localStorage.getItem('jb-chat-sent')) root.querySelector('.jb-launch-label').textContent = 'Message Jeffrey';
  } catch (e) {}
})();
