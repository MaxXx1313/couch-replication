/* jshint esversion: 6 */
const assert = require('assert');
const nano = require('../lib/nano-replicator.js');


let host = 'http://admin:admin@172.16.16.84:5984';
describe('nano-replicator', function(){

    it('replicate shot', function(done){
      let from = host + '/test_suite_db';
      let to = host + '/test_suite_replicated';

      nano.replicator(from).replicate(from, to, {create_target:true}, function(err, result){
        // console.log(err, result);
        assert.equal(err, null);
        assert.equal(result.ok, true);
        done();
      });

    });

    it('replicate continuous', function(done){
      let from = host + '/test_suite_db';
      let to = host + '/test_suite_replicated';

      nano.replicator(from).replicate(from, to, {create_target:true, continuous:true}, function(err, result){
        // console.log(err, result);
        assert.equal(err, null);
        assert.equal(result.ok, true);
        assert.equal(!!result._local_id, true);
        done();
      });

    });

     it('list', function(done){
      let from = host + '/test_suite_db';
      nano.replicator(from).list(function(err, result){
        // console.log(err, result);
        assert.equal(err, null);
        assert.equal(!!result[0].replication_id, true);
        done();
      });

    });


    /**
     *
     */
    describe('private', function(){


      it('getServerUrl', function(){

        var tests = [
          [
            'http://admin:admin@172.16.16.84:5984/test_suite_db',
            'http://admin:admin@172.16.16.84:5984'
          ],
          [
            'http://admin:admin@172.16.16.84:5984',
            'http://admin:admin@172.16.16.84:5984'
          ],
          [
            'http://admin:admin@172.16.16.84:5984/',
            'http://admin:admin@172.16.16.84:5984'
          ]
        ];

        tests.forEach(test=>{
          assert.equal(nano.replicator.getServerUrl(test[0]), test[1]);
        });

      });

    });

});