/* EvrythingPDF ad manager — every AdSense placement on the site is configured here.
   Pages carry inert placeholders (<div class="ad-slot" data-ad="tool-top"></div>);
   this file turns them into real units. A placement whose slot ID is still blank is
   removed from the DOM, so an unconfigured or unapproved account shows empty space
   rather than a collapsed grey frame. */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-7338860226113687';

  /* Paste the 10-digit slot IDs from AdSense → Ads → By ad unit → (create unit) → copy
     the data-ad-slot value. Leave a value as '' to keep that placement switched off. */
  var SLOTS = {
    'tool-top':    '', // responsive banner under the tool hero
    'tool-bottom': '', // responsive banner above the footer on tool pages
    'home-mid':    '', // homepage, between the tool grid and "Why Choose"
    'article':     ''  // in-article unit on blog posts
  };

  /* Per-placement ad format. 'auto' lets Google pick the size within the space we
     reserve in CSS; 'fluid' suits in-article units. */
  var FORMAT = {
    'article': 'fluid'
  };

  function render(host) {
    var name = host.getAttribute('data-ad');
    var slot = SLOTS[name];

    if (!slot) { host.remove(); return; }

    var label = document.createElement('span');
    label.className = 'ad-label';
    label.textContent = 'Advertisement';

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', FORMAT[name] || 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    host.appendChild(label);
    host.appendChild(ins);
    host.classList.add('is-live');

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      /* Blocked or offline — leave the reserved space empty rather than throwing. */
    }
  }

  function init() {
    var hosts = document.querySelectorAll('.ad-slot[data-ad]');
    for (var i = 0; i < hosts.length; i++) render(hosts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
