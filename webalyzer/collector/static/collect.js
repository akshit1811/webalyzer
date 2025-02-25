!setTimeout(function() {

  var domain, script = document.querySelector('script[data-webalyzer]');
  if (script === null || (script !== null && !script.dataset.webalyzer)) {
    console.warn(
      "You have not set up your webalyzer collector " +
      "correctly. It needs to have the domain in the script tag. " +
      "For example: <script data-webalyzer=\"example.com\">"
    );
  } else {
    domain = script.dataset.webalyzer;
  }

  var request = function() {
    if (window.XMLHttpRequest) {
        return new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        return new ActiveXObject("Microsoft.XMLHTTP");
    } else {
      throw "Unable to XHR at all";
    }
  }

  function _post(data, cb) {
    var req = request();
    req.open('POST', 'http://127.0.0.1:8000/collector/');
    req.onreadystatechange = function (response) {
      if (req.readyState === 4) {
        cb(req.status);
      }
    };
    req.send(data);
  }

  function _getCSS(url, cb) {
    var req = request();
    req.open('GET', url);
    req.onreadystatechange = function(response) {
      if (req.readyState === 4) {
        cb(req.status, req.response);
      }
    };
    req.send();
  }
  function postCSS(url, callback) {
    _getCSS(url, function(status, response) {
      if (status === 200) {
        var req = request();
        var data = new FormData();
        data.append('url', url);
        data.append('domain', domain);
        data.append('css', response);
        _post(data, function(status) {
          if (status === 200) {
            console.log("We have already collected this CSS");
            if (callback) callback(url, false);
          } else if (status === 201) {
            console.log("Yum! Collected another chunk of CSS");
            if (callback) callback(url, true);
          } else {
            console.warn("Failed to collect the CSS of this page");
          }
        });
      }
    });
  }

  function postHTML(html, callback) {
    var data = new FormData();
    data.append('url', document.location.href);
    data.append('domain', domain);
    data.append('html', html);
    _post(data, function(status) {
      if (status === 200) {
        console.log("We have already collected this HTML");
        if (callback) callback(false);
      } else if (status === 201) {
        console.log("Yum! Collected another chunk of HTML");
        if (callback) callback(true);
      } else {
        console.warn("Failed to collect the HTML of this page");
      }
    });
  }

  function collect(callback) {
    // send the HTML
    postHTML(document.documentElement.outerHTML, callback);

    // send the stylesheets
    var collected = JSON.parse(
      sessionStorage.getItem('webalyzedcss' + domain) || '[]'
    );
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i=0, L=links.length; i < L; i++) {
      var url = links[i].href;
      if (collected.indexOf(url) === -1) {
        postCSS(url, function(url) {
          if (collected.length === 0) {
            console.log(
              "Webalyzer will use sessionStorage to remember which " +
              "stylesheets it has collected. To reset this run: \n\n\t" +
              "sessionStorage.removeItem('webalyzedcss" + domain +"')\n"
            );
          }
          collected.push(url)
          sessionStorage.setItem(
            'webalyzedcss' + domain,
            JSON.stringify(collected)
          );
        });
      }
    }
  }

  var interval = 3;
  var timer;
  function loop() {
    collect(function(newhtml) {
      interval *= newhtml && .5 || 2;
      if (!MutationObserver) {
        timer = setTimeout(loop, interval * 1000);
      }
    });
  }
  loop();

  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
  if (MutationObserver) {
    var locked = null;
    function lock(cb) {
      locked = setTimeout(function() {
        locked = null;
      }, 3 * 1000);
      cb();
    }
    // create an observer instance
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (!locked && mutation.type === 'childList') {
          lock(collect);
        }
      });
    });

    // configuration of the observer:
    var config = { attributes: true, childList: true, characterData: true, subtree: true };

    // pass in the target node, as well as the observer options
    // observer.observe(document.body, config);
    observer.observe(document.body, config);
  }

}, 1.0 * 1000);
