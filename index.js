/*
 * index.js: Top-level include for fgnpmr module.
 *
 * (C) 2013 Charlie Robbins.
 *
 */

var async = require('async'),
    request = require('request');

//
// Set of know design documents to replicate.
//
var designDocs = [
  '_design/app',
  '_design/ghost',
  '_design/scratch'
];

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
module.exports = function (opts) {
  var registry = opts.registry,
      replica = opts.replica,
      proxy = opts.proxy,
      log = opts.log,
      errs = [],
      npm;

  //
  // MVP CouchDB client for npm that works behind a proxy
  //
  npm = {
    get: function (db, id, next) {
      request({
        method: 'GET',
        uri: db + '/' + id,
        proxy: opts.proxy,
        json: true
      }, function (err, res, body) {
        return next(err, body);
      });
    },
    destroy: function (db, id, rev, next) {
      request({
        method: 'DELETE',
        uri: db + '/' + id + '?rev=' + rev,
        proxy: opts.proxy,
        json: true
      }, function (err, res, body) {
        return next(err, body);
      });
    },
    insert: function (db, id, doc, next) {
      request({
        method: 'PUT',
        uri: db + '/' + id,
        proxy: opts.proxy,
        json: true,
        body: doc
      }, function (err, res, body) {
        return next(err, body);
      });
    },
    getAttachment: function (db, id, name) {
      return request({
        method: 'GET',
        uri: db + '/' + id + '/' + name,
        proxy: opts.proxy
      });
    },
    saveAttachment: function (db, id, rev, name, contentType, next) {
      return request({
        method: 'PUT',
        uri: db + '/' + id + '/' + name + '?rev=' + rev,
        proxy: opts.proxy,
        headers: {
          'content-type': contentType
        }
      }, next);
    }
  };

  //
  // Force deletes a given document id.
  //
  function forceDelete(id, next) {
    npm.get(replica, id, function (err, doc) {
      if (err || !doc._rev) {
        return next();
      }

      npm.destroy(replica, id, doc._rev, next);
    });
  }

  //
  // Helper function that replicates a single attachment.
  //
  function copyAttachment(id, filename, info, next) {
    npm.get(replica, id, function (err, doc) {
      if (err) {
        return next(err);
      }

      var save = npm.saveAttachment(
        replica, id, doc._rev, 
        filename, info.content_type, 
        next
      );

      save.on('pipe', function () {
        delete save.headers.authorization;
      });

      npm.getAttachment(registry, id, filename)
        .pipe(save);
    })
  }

  //
  // Helper function that replicates a single document.
  //
  function replicateId(id, done) {
    if (log) { log.info('Replicating ' + id) }
    forceDelete(id, function () {
      npm.get(registry, id, function (err, body) {
        if (err) {
          errs.push({ error: err, id: id, body: body });
          return done();
        }

        var attachments = body._attachments || {},
            names = Object.keys(attachments);

        delete body._rev;
        delete body._attachments;
        npm.insert(replica, id, body, function (err) {
          if (err) {
            errs.push({ error: err, id: id, body: body });
            return done();
          }

          if (names.length) {
            if (log) { log.info('Replicating attachments: ' + names.join(' ')) }
            return async.forEachSeries(names, function (name, next) {
              copyAttachment(id, name, attachments[name], next);
            }, done);
          }

          done();
        });
      });
    });
  }

  async.series([
    //
    // 1. Delete the design documents if they are present
    //
    function deleteDesignDocs(done) {
      async.forEach(designDocs, forceDelete, done);
    },
    //
    // 2. Replicate all documents and attachments
    //
    function pushModules(next) {
      async.forEachLimit(opts.docs, 5, replicateId, next);
    },
    //
    // 3. Reinsert the design documents.
    //
    function pushDesignDocs(next) {
      async.forEachLimit(designDocs, 5, replicateId, next);
    }
  ], function () {
    return errs.length
      ? callback(errs)
      : callback();
  });
};