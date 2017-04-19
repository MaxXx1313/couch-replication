/* jshint esversion: 6 */
const assert = require('assert');
const Replicator = require('../lib/replicator.js').Replicator;
const replacePrefix = require('../lib/replicator.js').replacePrefix;
const nano = require('nano');


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
  return Promise.all(dbList.map(dbName=>
    new Promise((resolve, reject)=>{
      nano(host).db.create(dbName, function(err, data){
        if(err && err.statusCode != 412){
          // 412 - already exist
          console.log(err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    })
  ));
});

// after(function(){
//   // remove dbs
//   return Promise.all(dbList.map(dbName=>
//     new Promise((resolve, reject)=>{
//       nano(host).db.destroy(dbName, function(err, data){
//         if(err){
//           reject(err);
//         } else {
//           resolve(data);
//         }
//       });
//     })
//   ));
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


    it('replicate', function(){

      let r = new Replicator(host, 'my-test-', 'my-replica-');

      let expected = [
        'my-replica-1',
        'my-replica-2',
        'my-replica-4',
      ];


      return r.replicate(host, host)
        .then(()=>{
          let r2 = new Replicator(host, 'my-replica-');
          return r2.dbList();
        }).then(list=>{
          assert.deepEqual(list, expected);
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