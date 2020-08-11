'use strict';

const assert = require('assert');
const Style = require('../../lib/style');

it( 'Should parse CSV', () =>
{
    const output = Style.compile( __dirname + '/../datasets/css.input.txt' );

    console.log( output );

    //assert.deepStrictEqual( output, require( __dirname + '/../datasets/csv.output.json' ));
});