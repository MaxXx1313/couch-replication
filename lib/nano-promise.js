
const nano = require('nano');
const prom = require('nano-promises');


module.exports = function(/*arguments*/){
 return prom( nano.apply(null, arguments) );
};