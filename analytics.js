(function(){
  var id=(window.SITE_CONFIG||{}).gaMeasurementId;
  if(!id)return;
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());window.gtag('config',id);
  var script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(script);
  document.addEventListener('click',function(event){var a=event.target.closest('a[href]');if(!a)return;if(a.protocol==='tel:')window.gtag('event','call_click',{});if(a.protocol==='mailto:')window.gtag('event','email_click',{});});
})();
