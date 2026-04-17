(function () {
  'use strict';

  function showWelcome() {
    var name = dbk.sessionInfo().userFullName;

    var banner = document.createElement('div');
    banner.id = 'welcome-banner';
    banner.textContent = 'Welcome back, ' + name + '!';
    banner.style.cssText =
      'background-color:#e8f5e9;color:#2e7d32;' +
      'text-align:center;padding:10px 20px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'font-size:14px;';

    document.body.insertBefore(banner, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWelcome);
  } else {
    showWelcome();
  }
})();
