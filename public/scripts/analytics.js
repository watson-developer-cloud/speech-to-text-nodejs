/* global ga */
/* eslint no-underscore-dangle: off, no-var: off, vars-on-top: off */

function loadAnalytics() {
  var SERVICE_NAME = 'speech-to-text-demo';
  var GOOGLE_ANALYTICS = 'UA-59827755-13';

  window._analytics = { segment_key: 'P1YMMnwSrsufGrHpg6uUzgVhaQXaP921', coremetrics: false };
  var meta = document.createElement('meta');
  meta.setAttribute('name', 'segment');
  meta.setAttribute('property', 'Demo (Watson Platform)');
  meta.setAttribute('value', SERVICE_NAME);
  document.head.appendChild(meta);

  var bluemixAnalyticsScript = document.createElement('script');
  bluemixAnalyticsScript.src = 'https://console.bluemix.net/analytics/build/bluemix-analytics.min.js';
  document.head.appendChild(bluemixAnalyticsScript);

  // ibm.com Analytics
  window.digitalData = {
    page: {
      pageInfo: { ibm: { siteID: 'IBM_Watson' } },
      category: { primaryCategory: 'IBM_Watson_WatsonGroup_DeveloperCloud' },
    },
  };
  var idaScript = document.createElement('script');
  idaScript.src = '//www.ibm.com/common/stats/ida_stats.js';
  document.head.appendChild(idaScript);

  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
  ga('create', GOOGLE_ANALYTICS, 'auto');
  ga('send', 'pageview');
}


window.addEventListener('load', loadAnalytics);



