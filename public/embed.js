/**
 * DRepScore Embed Script Loader
 *
 * Usage:
 *   <script src="https://drepscore.io/embed.js" data-type="drep" data-id="drep1..." data-theme="dark"></script>
 *   <script src="https://drepscore.io/embed.js" data-type="ghi" data-theme="dark"></script>
 *   <script src="https://drepscore.io/embed.js" data-type="cross-chain" data-theme="dark"></script>
 */
(function () {
  var BASE = 'https://drepscore.io';
  var scripts = document.querySelectorAll('script[src*="embed.js"]');

  scripts.forEach(function (script) {
    var type = script.getAttribute('data-type') || 'drep';
    var id = script.getAttribute('data-id') || '';
    var theme = script.getAttribute('data-theme') || 'dark';
    var width = script.getAttribute('data-width') || '320';
    var height = script.getAttribute('data-height') || '200';

    var src;
    switch (type) {
      case 'drep':
        src = BASE + '/embed/drep/' + encodeURIComponent(id) + '?theme=' + theme;
        break;
      case 'ghi':
        src = BASE + '/embed/ghi?theme=' + theme;
        height = '160';
        width = '280';
        break;
      case 'cross-chain':
        src = BASE + '/embed/cross-chain?theme=' + theme;
        height = '220';
        width = '360';
        break;
      default:
        return;
    }

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = width;
    iframe.height = height;
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'DRepScore ' + type + ' widget');

    script.parentNode.insertBefore(iframe, script.nextSibling);
  });
})();
