/* --------------------------------------------------------------------------
   Lead inbox for jeffreybowen.com — Google Apps Script web app.

   Receives every lead from the site (the chat widget and both contact forms),
   appends it as a row to a Google Sheet, and emails Jeffrey with Reply-To set
   to the visitor, so hitting Reply answers them directly.

   SETUP (about ten minutes, free):
     1. Signed in as Jeffrey's Google account, create a Sheet — e.g.
        "Website leads". Leave it empty; the header row writes itself.
     2. Extensions -> Apps Script. Replace the editor's contents with this
        file. Save.
     3. Check NOTIFY_EMAIL and SHARED_TOKEN below. The token must equal
        CONFIG.token in chat.js.
     4. Deploy -> New deployment -> type "Web app".
          Execute as:     Me
          Who has access: Anyone
        Authorise when asked (Google warns because the script is unverified —
        Advanced -> Go to project). Copy the /exec URL.
     5. Paste that URL into CONFIG.endpoint in chat.js and push. The chat
        appears and both contact forms switch from mail drafts to sending.
     6. Test: send one lead through the chat with ?chat=demo removed. A row
        and an email should both arrive within a few seconds.

   CHANGING THIS FILE LATER: Deploy -> Manage deployments -> edit (pencil) ->
   Version: New version. Saving alone does not update the live URL, and a
   *new* deployment gets a *new* URL that the site does not know about.

   The token is not a secret — it sits in public JavaScript. It only stops
   drive-by POSTs from bots that find the URL. The honeypot and the
   too-fast check in chat.js do the rest.
   -------------------------------------------------------------------------- */

var NOTIFY_EMAIL = 'jeff@jeffreybowen.com';
var SHARED_TOKEN = '2864ed508901358755a8bc54';
var SHEET_NAME   = 'Leads';

// Columns that lead the sheet in this order; anything else is appended to
// the right the first time it appears, so a new chat question never breaks it.
var BASE_COLUMNS = ['submittedAt', 'source', 'name', 'email', 'phone', 'contact_by', 'intent', 'interest'];

var MAX_FIELDS = 40;
var MAX_LENGTH = 2000;

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad json' });
  }
  if (!data || data.token !== SHARED_TOKEN) return reply({ ok: false, error: 'bad token' });
  if (!data.name || !data.email) return reply({ ok: false, error: 'missing name or email' });

  delete data.token;
  var clean = {};
  Object.keys(data).slice(0, MAX_FIELDS).forEach(function (k) {
    clean[String(k).slice(0, 60)] = String(data[k] == null ? '' : data[k]).slice(0, MAX_LENGTH);
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendRow(clean);
  } finally {
    lock.releaseLock();
  }

  // A failed email should not lose the lead: the row is already written.
  try {
    notify(clean);
  } catch (err) {
    console.error('notify failed: ' + err);
  }
  return reply({ ok: true });
}

// Visiting the /exec URL in a browser shows this, which confirms the
// deployment is live without writing anything.
function doGet() {
  return reply({ ok: true, service: 'jeffreybowen.com leads' });
}

function appendRow(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var header = sheet.getLastRow() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  if (!header.length) {
    header = BASE_COLUMNS.slice();
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var added = Object.keys(data).filter(function (k) { return header.indexOf(k) === -1; });
  if (added.length) {
    sheet.getRange(1, header.length + 1, 1, added.length).setValues([added]).setFontWeight('bold');
    header = header.concat(added);
  }

  var row = header.map(function (k) { return k in data ? safe(data[k]) : ''; });
  sheet.appendRow(row);
}

// A value starting with = + - @ would be run as a formula when the sheet is
// opened. Prefix it with an apostrophe so it stays text.
function safe(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function notify(d) {
  var what = d.intent || d.interest || 'Website enquiry';
  var where = d.buy_area || d.sell_address || d.listing || '';
  var subject = 'New lead: ' + what + ' — ' + d.name + (where ? ' (' + where + ')' : '');

  var lines = [];
  if (d.summary) {
    lines.push(d.summary.trim());
  } else {
    Object.keys(d).forEach(function (k) {
      if (k === 'page' || k === 'submittedAt' || k === 'source') return;
      if (d[k]) lines.push(k + ': ' + d[k]);
    });
  }
  lines.push('');
  lines.push('Came in via ' + (d.source || 'website') + ' on ' + (d.page || 'the site'));
  lines.push('Every lead is also in the "' + SHEET_NAME + '" sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: d.email,
    subject: subject.slice(0, 250),
    body: lines.join('\n'),
    name: 'jeffreybowen.com'
  });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
