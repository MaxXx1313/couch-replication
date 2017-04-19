/* jshint esversion: 6 */
var nano = require('./nano-promise');


// http://docs.couchdb.org/en/master/api/server/common.html#replicate
class Replicator {

  constructor(host, prefix){
    this._host = host;
    this._prefix = prefix;

    this._nano = nano(host);
  }

  dbList(){
    let self = this;
    return this._nano.db.list().then(list=>{
      // console.log(list);
      return list[0].filter(item=>item.startsWith(self._prefix));
    });
  }


  // http://172.16.16.84:5984/_active_tasks
  replicationList(){

      return this._nano.request({
        db: '_active_tasks',
        // body: {},
        method: 'GET'
      }).then(function(data){
        return (data || []).filter(task=>task.type == 'replication');
      });
  }



  // copied from nano
  replicate(source, target, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    opts.source = this._serializeAsUrl(source);
    opts.target = this._serializeAsUrl(target);

    return this._nano.request({
      db: '_replicate',
      body: opts,
      method: 'POST'
    });
  }


  // copied from nano
  _serializeAsUrl(db) {
    if (typeof db === 'object' && db.config && db.config.url && db.config.db) {
      return urlResolveFix(db.config.url, encodeURIComponent(db.config.db));
    } else {
      return db;
    }
  }


}


module.exports.Replicator = Replicator;

