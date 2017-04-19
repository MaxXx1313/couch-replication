/* jshint esversion: 6 */
var nano = require('nano');

module.exports = nano;


nano.replicator = ReplicatorModule;


function ReplicatorModule(replicatorHost){
  return new Replicator(replicatorHost);
}


function Replicator(replicatorHost){
  this._replicatorHost = getServerUrl(replicatorHost);
  if(!this._replicatorHost){
    console.error('Cannot parse replicator host');
    return;
  }
  this._nano = nano(this._replicatorHost);
  return this;
}

// copied from nano
Replicator.prototype.replicate = function(source, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  opts.source = _serializeAsUrl(source);
  opts.target = _serializeAsUrl(target);

  return this._nano.request({
    db: '_replicate',
    body: opts,
    method: 'POST'
  }, callback);
};



// http://172.16.16.84:5984/_active_tasks
Replicator.prototype.list = function(callback){
  return this._nano.request({
    db: '_active_tasks',
    body: {},
    method: 'GET'
  }, function(err, data){
    if(!err){
      data = (data || []).filter(task=>task.type == 'replication');
    }
    callback(err, data);
  });
};




// copied from nano
function _serializeAsUrl(db) {
  if (typeof db === 'object' && db.config && db.config.url && db.config.db) {
    return urlResolveFix(db.config.url, encodeURIComponent(db.config.db));
  } else {
    return db;
  }
}

ReplicatorModule.getServerUrl = getServerUrl;

//
function getServerUrl(dbUrl){
  return (dbUrl.match(/^(\w+:\/\/[\w:@\.]+)/) || [])[1];
}