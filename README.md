fgnpmr
======

For those special times when replicating npm just won't cut it:

``` js
  //
  // ### function fgnpmr (opts)
  // #### @opts {Object} Options to fgnpmr
  // ####   @opts.registry {string} Existing npm registry URL
  // ####   @opts.replica  {string} Registry replica URL
  // ####   @opts.docs     {Array}  Set of docs to replicate.
  // ####   @opts.proxy    {string} **Optional** Proxy URL
  // ####   @opts.log      {Object} **Optional** Logger
  // Replicates `opts.docs` from `opts.registry` to
  // `opts.replica` BY SHEER FORCE OF WILL. 
  //
```

#### Author: [Charlie Robbins](https://github.com/indexzero)
#### License: MIT