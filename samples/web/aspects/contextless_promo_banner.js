(function () {
  'use strict';

  var BANNER_CONFIG = {
    message: 'Welcome! Check out our new savings rates.',
    backgroundColor: '#1a73e8',
    textColor: '#ffffff',
  };

  function injectBanner() {
    var banner = document.createElement('div');
    banner.id = 'promo-banner';
    banner.textContent = BANNER_CONFIG.message;
    banner.style.cssText =
      'background-color:' +
      BANNER_CONFIG.backgroundColor +
      ';' +
      'color:' +
      BANNER_CONFIG.textColor +
      ';' +
      'text-align:center;padding:12px 20px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'font-size:14px;position:relative;z-index:9999;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText =
      'background:none;border:none;color:' +
      BANNER_CONFIG.textColor +
      ';' +
      'font-size:20px;cursor:pointer;position:absolute;' +
      'right:16px;top:50%;transform:translateY(-50%);';
    closeBtn.addEventListener('click', function () {
      banner.remove();
    });
    banner.appendChild(closeBtn);

    document.body.insertBefore(banner, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
