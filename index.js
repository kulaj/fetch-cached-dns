const A = 1;
const AAAA = 28;

import { isIP } from 'net'
import { format, parse } from 'url'
const memoize = await import('promise-memoize');

module.exports = setup

const isRedirect = v => ((v / 100) | 0) === 3

function getResolveURL(hostname) {
  return 'https://dns.google/resolve?name=' + hostname;
}

function setup(fetch) {
  if (!fetch) {
    fetch = require('node-fetch')
  }
  const { Headers } = fetch
  
  async function _resolve(hostname) {
    response = await fetch(getResolveURL(hostname))
    jsonData = await response.json()
    if (jsonData.Status != 0) {
      throw "invalid DNS Lookup"
    }
    for (var i = 0; i < jsonData.Answer.length; i++) {
      var answer = jsonData.Answer[i];
      if (answer["type"] === A || answer["type"] === AAAA) {
        return answer["data"];
      }
    }
  }
  const resolve = memoize(_resolve);

  async function fetchCachedDns(url, opts) {
    const parsed = parse(url)
    const ip = isIP(parsed.hostname)
    if (ip === 0) {
      if (!opts) opts = {}
      opts.headers = new Headers(opts.headers)
      if (!opts.headers.has('Host')) {
        opts.headers.set('Host', parsed.host)
      }
      opts.redirect = 'manual'
      parsed.host = null;
      parsed.hostname = await resolve(parsed.hostname)
      url = format(parsed)
    }
    const res = await fetch(url, opts)
    if (isRedirect(res.status)) {
      const redirectOpts = Object.assign({}, opts)
      redirectOpts.headers = new Headers(opts.headers)

      // per fetch spec, for POST request with 301/302 response, or any request with 303 response, use GET when following redirect
      if (
        res.status === 303 ||
        ((res.status === 301 || res.status === 302) && opts.method === 'POST')
      ) {
        redirectOpts.method = 'GET'
        redirectOpts.body = null
        redirectOpts.headers.delete('content-length')
      }

      const location = res.headers.get('Location')
      redirectOpts.headers.set('Host', parse(location).host)

      if (opts.onRedirect) {
        opts.onRedirect(res, redirectOpts)
      }

      return fetchCachedDns(location, redirectOpts)
    } else {
      return res
    }
  }

  for (const key of Object.keys(fetch)) {
    fetchCachedDns[key] = fetch[key]
  }

  fetchCachedDns.default = fetchCachedDns

  return fetchCachedDns
}
