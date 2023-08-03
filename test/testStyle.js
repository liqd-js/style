const Style = require( '../lib/style.js' );

console.log( Style.compile( require('fs').readFileSync( __dirname + '/test.style', 'utf8' )));