# Source: https://www.electronjs.org/docs/latest/api/structures/referrer

* `url` string - HTTP Referrer URL.
* `policy` string - Can be `default`, `unsafe-url`,
`no-referrer-when-downgrade`, `no-referrer`, `origin`,
`strict-origin-when-cross-origin`, `same-origin` or `strict-origin`.
See the [Referrer-Policy spec](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) for more details on the
meaning of these values.