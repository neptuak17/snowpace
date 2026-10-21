// The Snowpace guide's search. Runs entirely in the browser over
// /guide/search-index.json, which scripts/build-guide.mts writes from the
// pages; nothing is sent anywhere. Every form.g-search on a page (the guide,
// and the support page) gets it. On /guide/search/?q=… the query comes from
// the address, so the form also works as a plain link.
(function () {
  'use strict';
  var index = null;
  var loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch('/guide/search-index.json')
        .then(function (r) { return r.json(); })
        .then(function (d) { index = d; return d; });
    }
    return loading;
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // Words that say nothing about what someone is looking for.
  var STOP = ' a an and are at be can do does for from how i if in is it its me my of on or the to what when where which why with you your ';

  // A rough stem, so "deleting" finds "delete" and "webcams" finds "webcam".
  function stem(w) {
    var m = w.match(/^(.{4,}?)(ing|ed|es|s|e)$/);
    return m ? m[1] : w;
  }

  // The words of a query, lower case, without accents or filler, as stems.
  function words(s) {
    var all = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{2,}/g) || [];
    var useful = all.filter(function (w) { return STOP.indexOf(' ' + w + ' ') < 0; });
    return (useful.length ? useful : all).map(stem);
  }

  function fold(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // A query word matches the start of a word. A match in the title counts
  // most, then the headings and summary, then the text. With `all`, every
  // word must match somewhere; without it, any word will do.
  function score(page, terms, all) {
    var title = fold(page.t), heads = fold(page.h.join(' ') + ' ' + page.d), text = fold(page.x);
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var re = new RegExp('(^|[^a-z0-9])' + terms[i]);
      var s = (re.test(title) ? 6 : 0) + (re.test(heads) ? 3 : 0) + (re.test(text) ? 1 : 0);
      if (!s && all) return 0;
      total += s;
    }
    return total;
  }

  function rank(pages, terms, all) {
    return pages
      .map(function (p) { return { p: p, s: score(p, terms, all) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
  }

  function snippet(page, terms) {
    var text = page.x, low = fold(text), at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = low.search(new RegExp('(^|[^a-z0-9])' + terms[i]));
    if (at < 0) return esc(page.d);
    var start = Math.max(0, at - 60), end = Math.min(text.length, at + 120);
    var out = esc((start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''));
    for (var j = 0; j < terms.length; j++) {
      out = out.replace(new RegExp('(^|[^a-z0-9])(' + terms[j] + '[a-z0-9]*)', 'gi'), '$1<mark>$2</mark>');
    }
    return out;
  }

  function search(form) {
    var input = form.querySelector('input');
    var list = form.querySelector('.g-results');
    var q = input.value.trim();
    var terms = words(q);
    if (!terms.length) { list.innerHTML = ''; return; }
    load().then(function (pages) {
      if (input.value.trim() !== q) return;
      // Pages with every word first; if there are none, pages with any of them.
      var hits = rank(pages, terms, true);
      if (!hits.length) hits = rank(pages, terms, false);
      hits = hits.slice(0, 8);
      list.innerHTML = hits.length
        ? hits.map(function (h) {
            return '<li><a href="' + h.p.u + '"><small>' + esc(h.p.s || 'Guide') + '</small><b>' + esc(h.p.t) + '</b><span>' + snippet(h.p, terms) + '</span></a></li>';
          }).join('')
        : '<li class="g-none">Nothing in the guide matches that. Try another word, or the troubleshooter.</li>';
    }).catch(function () {
      list.innerHTML = '<li class="g-none">Search needs the guide to be online.</li>';
    });
  }

  function setup(form) {
    var input = form.querySelector('input');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { search(form); }, 120);
    });
    input.addEventListener('focus', function () { load().catch(function () {}); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; search(form); }
    });
    // Enter goes straight to the best match, when there is one.
    form.addEventListener('submit', function (e) {
      var first = form.querySelector('.g-results a');
      if (first) { e.preventDefault(); location.href = first.getAttribute('href'); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form.g-search');
    for (var i = 0; i < forms.length; i++) setup(forms[i]);
    var q = new URLSearchParams(location.search).get('q');
    var main = document.querySelector('form.g-search.big');
    if (q && main) {
      main.querySelector('input').value = q;
      search(main);
    }
  });
})();
