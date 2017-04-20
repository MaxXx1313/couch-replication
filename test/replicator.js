/* jshint esversion: 6 */
const assert = require('assert');
const Replicator = require('../lib/replicator.js').Replicator;
const replacePrefix = require('../lib/replicator.js').replacePrefix;
const nano = require('../lib/nano-promise.js');


let dbList = [
  'my-test-1',
  'my-test-2',
  'my-nottest-3',
  'my-test-4',
  'my-nottest-5',
];


let host = 'http://admin:admin@172.16.16.84:5984';
before(function(){
  // create some dbs
  return Promise.all(dbList.map(dbName=>{
      return nano(host).db.create(dbName)
        .catch(err=>{
          if(err.statusCode != 412){
            throw err;
          }
        });
  }));
});

// after(function(){
//   let replicaList = [
//     'my-replica-1',
//     'my-replica-2',
//     'my-replica-4',
//   ];
//   // remove dbs
//   return Promise.all(replicaList.map(dbName=>{
//     return nano(host).db.destroy(dbName);
//   }));
// });

describe('Replicator', function(){

    it('dbList', function(){
      let r = new Replicator(host, 'my-test-');

      let expected = [
        'my-test-1',
        'my-test-2',
        'my-test-4',
      ];

      return r.dbList().then(list=>{
        assert.deepEqual(list, expected);
      });
    });


    describe('replicate all', function(){

      it('do stuff', function(){

        let r = new Replicator(host, 'my-test-');

        let expected = [
          'my-replica-1',
          'my-replica-2',
          'my-replica-4',
        ];


        let log = [];
        function logPush(str){
          log.push(str);
        }

        let logExpected = [
          "Fetch db list",    "Done",
          "Replicate my-test-1", "Success",
          "Replicate my-test-2", "Success",
          "Replicate my-test-4", "Success"
        ];


        r.on('opStart', logPush);
        // r.on('opProgress', logPush);
        r.on('opEnd', logPush);


        return r.replicate(host, host, {newprefix: 'my-replica-'})
          .then(()=>{

            r.off('opStart', logPush);
            // r.off('opProgress', logPush);
            r.off('opEnd', logPush);

            let r2 = new Replicator(host, 'my-replica-');
            return r2.dbList();
          }).then(list=>{
            assert.deepEqual(list, expected);
            assert.deepEqual(log, logExpected);
          });
      });

      // cleanup
      afterEach(function(){
        let replicaList = [
          'my-replica-1',
          'my-replica-2',
          'my-replica-4',
        ];
        // remove dbs
        return Promise.all(replicaList.map(dbName=>{
          return nano(host).db.destroy(dbName).catch(e=>e);
        }));
      });

    });


    it('_getProgress', function(){

      let from = 'http://admin:*****@172.16.16.84:5984/test_suite_db/';
      let to = 'http://admin:*****@172.16.16.84:5984/test_suite_replicated/';

      let r = new Replicator(host, 'test_');
      r._getProgress(from, to).then(progress=>{
        assert.equal(progress, 100); // replication is done
      });

    });

    describe('replicate resume #1', function(){

      it('do stuff', function(){

        let r = new Replicator(host, 'my-test-');

        let expected = [
          'my-replica-2',
          'my-replica-4',
        ];


        return r.replicate(host, host, {newprefix: 'my-replica-', after:'my-test-1'})
          .then(()=>{
            let r2 = new Replicator(host, 'my-replica-');
            return r2.dbList();
          }).then(list=>{
            assert.deepEqual(list, expected);
          });

      });

      // cleanup & test
      it('removeAll', function(){

        let log = [];
        function logPush(str){
          log.push(str);
        }

        let logExpected = [
          'Fetch db list',        'Done',
          'Remove my-replica-4',  'Removed',
          'Remove my-replica-2',  'Removed'
        ];



        let r = new Replicator(host, 'my-replica-');
        r.on('opStart', logPush);
        r.on('opEnd', logPush);

        return r.removeAll().then(()=>{

          r.off('opStart', logPush);
          r.off('opEnd', logPush);

          return r.dbList();
        }).then(list=>{
          assert.deepEqual(list, []);
          assert.deepEqual(log, logExpected);
        });

      });

      // afterEach(function(){
      //   let replicaList = [
      //     'my-replica-1',
      //     'my-replica-2',
      //     'my-replica-4',
      //   ];
      //   // remove dbs
      //   return Promise.all(replicaList.map(dbName=>{
      //     return nano(host).db.destroy(dbName).catch(e=>e);
      //   }));
      // });

    });


    describe('replicate resume #2', function(){

      it('do stuff', function(){

        let r = new Replicator(host, 'my-test-');

        let expected = [
          'my-replica-4',
        ];


        return r.replicate(host, host, {newprefix: 'my-replica-', after:'my-test-2'})
          .then(()=>{
            let r2 = new Replicator(host, 'my-replica-');
            return r2.dbList();
          }).then(list=>{
            assert.deepEqual(list, expected);
          });

      });

      // cleanup
      afterEach(function(){
        let replicaList = [
          'my-replica-1',
          'my-replica-2',
          'my-replica-4',
        ];
        // remove dbs
        return Promise.all(replicaList.map(dbName=>{
          return nano(host).db.destroy(dbName).catch(e=>e);
        }));
      });

    });


    // make sure to run after 'replicate continuous'
    it.skip('replicationList', function(){
      let r = new Replicator(host, 'my-test-');

      let expected = [
        'my-test-1',
        'my-test-2',
        'my-test-4',
      ];

      return r.replicationList().then(list=>{
        console.log('replicationList stub', list);

        // assert.deepEqual(list, expected);
        // TODO
      });
    });


    it('setDbUsers', function(){

      let data = {
        members: {
          names: [ 'test-user-1' ],
          roles: []
        }
      };

      let dbSample = 'my-test-1';

      return Replicator.setDbUsers(host, dbSample, data).then(data=>{
        // console.log(data)
        assert.ok(data.ok);
      });
    });


    it('getDbUsers', function(){

      let expected = {
        members: {
          names: [ 'test-user-1' ],
          roles: []
        }
      };

      let dbSample = 'my-test-1';

      return Replicator.getDbUsers(host, dbSample).then(data=>{
        assert.deepEqual(data, expected);
      });
    });


    it('getUser', function(){

      let expected = {
         "_id": "org.couchdb.user:bb85ab47997b55815aa79c093407629f",
         // "_rev": "1-32e02c1f671710e053329b4c1dff7be7",
         "password_scheme": "pbkdf2",
         "iterations": 10,
         "name": "bb85ab47997b55815aa79c093407629f",
         "roles": [
             "user"
         ],
         "status": "Approved",
         "email": [
             "user@irls"
         ],
         "type": "user",
         "external": [
         ],
         "derived_key": "e6a50389fcc25d819f88c24ae9f01173adf921f1",
         "salt": "2d50b70dbb1090506568f6b6e059383c"
      };

      let userSample = 'bb85ab47997b55815aa79c093407629f';

      return Replicator.getUser(host, userSample).then(data=>{
        // console.log(data);
        assert.ok(data._rev);
        delete data._rev;
        assert.deepEqual(data, expected);
      });
    });

    it('setUser', function(){

      let data = {
         "_id": "org.couchdb.user:bb85ab47997b55815aa79c093407629f",
         "_rev": "1-32e02c1f671710e053329b4c1dff7be7",
         "password_scheme": "pbkdf2",
         "iterations": 10,
         "name": "bb85ab47997b55815aa79c093407629f",
         "roles": [
             "user"
         ],
         "status": "Approved",
         "email": [
             "user@irls"
         ],
         "type": "user",
         "external": [
         ],
         "derived_key": "e6a50389fcc25d819f88c24ae9f01173adf921f1",
         "salt": "2d50b70dbb1090506568f6b6e059383c"
      };

      let userSample = 'bb85ab47997b55815aa79c093407629f';

      return Replicator.getUser(host, userSample)
        .then(user=>{
          data._rev = user._rev;
          return Replicator.setUser(host, userSample, data);
        })
        .then(data=>{
          // console.log(data);
          assert.ok(data.ok);
          assert.equal(data.id, 'org.couchdb.user:' + userSample);
          assert.ok(data.rev);
        });
    });


});

describe('replacePrefix', function(){

    // make sure to run after 'replicate continuous'
    it('simple', function(){
      assert.equal(replacePrefix('my-test-1', 'my-', 'me-'), 'me-test-1');

      assert.throws(function(){
        replacePrefix('my-test-1', 'y-', 'e-');
      });
    });

});

describe('__matchUrl', function(){

    // make sure to run after 'replicate continuous'
    it('simple', function(){

      let r = new Replicator(host, 'my-test-');

      let testData = [
        // 0 - scrubbed
        // 1 - normal
        // 2 - is the same (boolean)
        [
          'http://admin:*****@172.16.16.84:5984/current-develop_ffa_ext_task/',
          'http://admin:admin@172.16.16.84:5984/current-develop_ffa_ext_task',
          true
        ]
      ];
      testData.forEach(data=>{
        assert.equal(r.__matchUrl(data[0], data[1]), data[2]);
      });

    });

});