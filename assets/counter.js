// Replaces the old WordPress Page Views Count AJAX widget on the static site.
(function () {
  "use strict";

  var config = window.NADFINK_COUNTER || {};
  var endpoint = String(config.endpoint || "").replace(/\/+$/, "");
  var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-counter-key]"));
  if (!nodes.length) return;

  function format(value) {
    var number = Number(value);
    return isFinite(number) ? number.toLocaleString("en-US") : "0";
  }

  function seedFor(node) {
    var seed = Number(node.getAttribute("data-seed"));
    return isFinite(seed) ? seed : 0;
  }

  function totalSeed() {
    var configured = Number(config.siteSeed);
    if (isFinite(configured) && configured > 0) return configured;
    return nodes.reduce(function (sum, node) {
      return sum + (node === siteNode ? 0 : seedFor(node));
    }, 0);
  }

  var siteNode = (function () {
    var existing = document.querySelector("[data-site-total]");
    if (existing) return existing;

    var wrapper = document.createElement("p");
    wrapper.className = "nadfink-site-total";
    var label = document.createElement("span");
    label.textContent = "Site views: ";
    var value = document.createElement("strong");
    value.setAttribute("data-site-total", "");
    wrapper.appendChild(label);
    wrapper.appendChild(value);

    var footer = document.querySelector("footer.site-footer") || document.body;
    footer.appendChild(wrapper);
    return value;
  })();

  function render(node, count, total) {
    node.textContent = format(count);
    if (total !== undefined && isFinite(Number(total))) {
      siteNode.textContent = format(total);
    }
  }

  // Show recovered WordPress totals immediately, even without JS networking.
  nodes.forEach(function (node) {
    render(node, seedFor(node));
  });
  siteNode.textContent = format(totalSeed());

  // The deploy URL has not been filled in yet: keep the seeded values only.
  if (!endpoint || /REPLACE-ME|example\.workers\.dev/i.test(endpoint)) return;

  function alreadyCounted(key) {
    var storageKey = "nadfink-counter:" + location.pathname + ":" + key;
    try {
      if (sessionStorage.getItem(storageKey)) return true;
      sessionStorage.setItem(storageKey, "1");
    } catch (error) {
      // Storage can be disabled; counting once per load is still acceptable.
    }
    return false;
  }

  nodes.forEach(function (node) {
    var key = node.getAttribute("data-counter-key");
    var path = alreadyCounted(key) ? "/get" : "/hit";

    fetch(endpoint + path + "?key=" + encodeURIComponent(key), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
    })
      .then(function (response) {
        if (!response.ok) throw new Error("counter request failed");
        return response.json();
      })
      .then(function (data) {
        render(node, data.count, data.total);
      })
      .catch(function () {
        // Keep the seeded / last-known value on network failure.
      });
  });
})();

// coded by Big Pickle
