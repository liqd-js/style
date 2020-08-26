'use strict';

const fs = require('fs');
const Parser = require('@liqd-js/parser');
const { isRegExp } = require('util');
const StyleParser = new Parser( __dirname + '/syntax/style.syntax' );

const VARIABLE_RE = /\$[a-zA-Z_][a-zA-Z0-9_\-]*/g;
const SELECTOR_DELIMITER = /\s*,\s*/;
const SELECTOR_RE = /^\s*(&{0,1})\s*(.*?)\s*(&{0,1})\s*$/;

module.exports = class Style
{
    static #scope( scope, extend = {})
    {
        return { ...scope, variables: { ...scope.variables }, generators: { ...scope.generators }, ...extend }
    }

    static #write_properties( scope, properties )
    {
        if( scope.buffer.properties.length )
        {
            if( scope.rule !== scope.buffer.rule || scope.selector !== scope.buffer.selector )
            {
                if( scope.buffer.rule !== scope.buffer.current_role )
                {
                    scope.buffer.source += ( scope.buffer.current_role ? '}\n' : '' ) + ( scope.buffer.rule ? scope.buffer.rule + '{\n' : '' );
                    scope.buffer.current_role = scope.buffer.rule;
                }

                scope.buffer.source += scope.buffer.selector + '{' + scope.buffer.properties.join(';') + '}\n';
                scope.buffer.properties = [];
            }
        }
        
        scope.buffer.rule = scope.rule;
        scope.buffer.selector = scope.selector;
        scope.buffer.properties.push( properties );
    }

    static #resolve_value( scope, value )
    {
        return value.replace( VARIABLE_RE, variable => scope.variables[ variable ]);
    }

    static #resolve_selector( scope, selector )
    {
        let current_selectors = scope.selector.split( SELECTOR_DELIMITER );

        return selector.split( SELECTOR_DELIMITER ).reduce(( selectors, selector ) =>
		{
			let reverse = false, glue = ' '; selector = selector.replace( SELECTOR_RE, ( _, append, selector, prepend ) =>
			{
				if( append ){ glue = '' } else if( prepend ){ reverse = true }

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

    static #resolve_style( scope, style, recursive = false )
    {
        for( let entry of style )
        {
            if( entry.assignment )
            {
                scope.variables[ entry.assignment.variable ] = Style.#resolve_value( scope, entry.assignment.value );
            }
            else if( entry.generator )
            {
                scope.generators[ entry.generator.name ] = entry.generator;
            }
            else if( entry.selector )
            {
                Style.#resolve_style( Style.#scope( scope, { selector: Style.#resolve_selector( scope, entry.selector )}), entry.style, true );
            }
            else if( entry.property )
            {
                let value = Style.#resolve_value( scope, entry.value );

                value !== 'undefined' && Style.#write_properties( scope, entry.property + ':' + value );
            }
            else if( entry.generate )
            {
                let generator = scope.generators[ entry.generate.generator ], args = {};

                for( let i = 0; i < generator.arguments?.length; ++i )
                {
                    args[ generator.arguments[i].variable ] = entry.generate.arguments[i] || generator.arguments[i].default;
                }

                Style.#resolve_style( Style.#scope( scope, { variables: { ...scope.variables, ...args }}), generator.style, true );
            }
            else if( entry.rule )
            {
                Style.#resolve_style(  Style.#scope( scope, { rule: entry.rule.identifier + ( entry.rule.selector ? ' ' + entry.rule.selector : '' )}), entry.rule.style, true );
            }
        }
        
        if( !recursive )
        {
            if( scope.buffer.properties.length )
            {
                scope.buffer.source += scope.buffer.selector + '{' + scope.buffer.properties.join(';') + '}\n';
            }

            return scope.buffer.source;
        }
    }

    static compile( source, options )
    {
        const style = StyleParser.parse( source.includes('\n') ? source : fs.readFileSync( source, 'utf8' ));

        let compiled = Style.#resolve_style({ selector: '', rule: '', variables: {}, generators: {}, buffer: { properties: [], source: '' }}, style );

        return compiled;
    }
}