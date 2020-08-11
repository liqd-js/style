'use strict';

const fs = require('fs');
const Parser = require('@liqd-js/parser');
const StyleParser = new Parser( __dirname + '/syntax/style.syntax' );

const VARIABLE_RE = /\$[a-zA-Z_][a-zA-Z0-9_\-]*/g;
const SELECTOR_DELIMITER = /\s*,\s*/;
const SELECTOR_RE = /^\s*(&{0,1})\s*(.*?)\s*(&{0,1})\s*$/;

class StyleCompiler
{
    static scope( scope, extend = {} )
    {
        return { ...scope, variables: { ...scope.variables }, generators: { ...scope.generators }, ...extend }
    }

    //current selector flush

    static compile( style, scope )
    {
        let css = '';

        for( let entry of style )
        {
            if( entry.assignment )
            {
                scope.variables[ entry.assignment.variable ] = StyleCompiler.resolve_value( entry.assignment.value, scope.variables );
            }
            else if( entry.generator )
            {
                scope.generators[ entry.generator.name ] = entry.generator;
            }
            else if( entry.selector )
            {
                css += StyleCompiler.compile( entry.style, StyleCompiler.scope( scope, { selector: StyleCompiler.resolve_selector( entry.selector, scope.selector )}));
            }
            else if( entry.property )
            {
                css += scope.selector + '{' + entry.property + ':' + StyleCompiler.resolve_value( entry.value, scope.variables ) + ';}\n'
            }
            else if( entry.generate )
            {
                let generator = scope.generators[ entry.generate.generator ], args = {};

                if( generator.arguments )
                {
                    for( let i = 0; i < generator.arguments.length; ++i )
                    {
                        args[ generator.arguments[i].variable ] = entry.generate.arguments[i] || generator.arguments[i].default;
                    }
                }

                css += StyleCompiler.compile( generator.style, StyleCompiler.scope( scope, { variables: { ...scope.variables, ...args }}));
            }
        }

        return css;
    }

    static resolve_value( value, variables )
    {
        return value.replace( VARIABLE_RE, variable => variables[ variable ]);
    }

    static resolve_selector( selector, current_selector )
    {
        let current_selectors = current_selector.split( SELECTOR_DELIMITER );

        return selector.split( SELECTOR_DELIMITER ).reduce(( selectors, selector ) =>
		{
			let reverse = false, glue = ' '; selector = selector.replace( SELECTOR_RE, ( _, append, selector, prepend ) =>
			{
				if( append ){ glue = ''; } else
				if( prepend ){ reverse = true; }

				return selector;
            });
            
            for( let current_selector of current_selectors )
            {
                selectors += ( selectors ? ',' : '' ) + (( reverse ? selector : current_selector ) + glue + ( reverse ? current_selector : selector )).trim();
            }

			return selectors;
		},
		'' );
    }
}

module.exports = class Style
{
    static compile( source, options )
    {
        const style = StyleParser.parse( fs.readFileSync( source, 'utf8' ));

        console.log( style )

        let compiled = StyleCompiler.compile( style, { selector: '', variables: {}, generators: {} });

        return compiled;
    }
}