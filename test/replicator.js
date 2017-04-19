/* jshint esversion: 6 */
const assert = require('assert');
const Replicator = require('../lib/replicator.js').Replicator;
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


    it('replicationList', function(){
      let r = new Replicator(host, 'my-test-');

      let expected = [
        'my-test-1',
        'my-test-2',
        'my-test-4',
      ];

      return r.replicationList().then(list=>{
        console.log(list);

        // assert.deepEqual(list, expected);
        // TODO
      });
    });

    it('replicate shot', function(){

      let from = host + '/test_suite_db';
      let to = host + '/test_suite_replicated';

      let r = new Replicator(host, 'my-test-');

      return r.replicate(from, to, {create_target:true})
        .then(result=>{
          assert.equal(result[0].ok, true);
        });

    });


    it('replicate continuous', function(){
      let from = host + '/test_suite_db';
      let to = host + '/test_suite_replicated';

      let r = new Replicator(host, 'my-test-');
      r.replicate(from, to, {create_target:true, continuous:true})
        .then(result=>{
          // console.log(err, result);
          assert.equal(result[0].ok, true);
          assert.equal(!!result[0]._local_id, true);
        });

    });

});