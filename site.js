(function () {
  'use strict';
  var c = window.SITE_CONFIG || {};
  function track(event, values) { if (typeof window.gtag === 'function') window.gtag('event', event, values || {}); }
  document.querySelectorAll('[data-google]').forEach(function (link) {
    var url = link.dataset.google === 'review' ? c.googleReviewUrl : c.googleBusinessProfileUrl;
    if (!url) return;
    link.href = url; link.hidden = false;
    link.addEventListener('click', function () { track('google_profile_click', {action:link.dataset.google}); });
  });
  document.querySelectorAll('[data-interest]').forEach(function (link) {
    link.addEventListener('click', function () { var select = document.getElementById('in'); if (select) select.value = link.dataset.interest; });
  });
  var form = document.getElementById('lead');
  if (!form) return;
  var button = document.getElementById('lead-submit'), message = document.getElementById('fm');
  if (c.formspreeEndpoint) {
    button.textContent = 'Send inquiry to Jeffrey';
    document.getElementById('delivery-note').textContent = 'Your inquiry will be sent securely through Formspree. Please do not include financial documents or sensitive information.';
  }
  var busy = false;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    var fields = form.elements;
    if (!fields.namedItem('name').value.trim()) { message.textContent = 'Please enter your name.'; return; }
    var data = new FormData(form);
    // Store campaign labels with the inquiry, not personal details in analytics.
    var query = new URLSearchParams(location.search);
    ['utm_source','utm_medium','utm_campaign','utm_content'].forEach(function (key) { var value=query.get(key); if(value) data.set(key,value.slice(0,200)); });
    data.set('page',location.pathname); data.set('inquiry_permission','Requested reply to this inquiry; no ongoing marketing subscription.');
    if (!c.formspreeEndpoint) {
      var body = ['Name: '+data.get('name'),'Email: '+data.get('email'),'Phone: '+data.get('phone'),'Interest: '+data.get('interest'),'',data.get('message')].join('\n');
      var mail = 'mailto:'+c.contactEmail+'?subject='+encodeURIComponent('Website inquiry')+'&body='+encodeURIComponent(body);
      message.textContent = 'Your inquiry has not been sent. Send the draft in your email app, or call 781-201-9488.';
      track('email_draft_open',{}); window.location.href=mail; return;
    }
    busy = true; button.disabled = true; message.textContent = 'Sending your inquiry…';
    var controller = new AbortController(); var timeout = setTimeout(function(){controller.abort();},15000);
    try {
      var response = await fetch(c.formspreeEndpoint,{method:'POST',body:data,headers:{Accept:'application/json'},signal:controller.signal});
      var result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Unconfirmed submission');
      message.textContent = 'Thank you. Your inquiry was accepted. Jeffrey will follow up using the details you provided.';
      track('generate_lead',{interest:data.get('interest')}); form.reset();
    } catch (error) {
      message.textContent = 'We could not confirm delivery. Your details are still here. Please try again or call 781-201-9488.';
    } finally { clearTimeout(timeout); busy=false; button.disabled=false; }
  });
})();
