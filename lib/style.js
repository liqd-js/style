'use strict';

const fs = require('fs');
const Parser = require('@liqd-js/parser');
const ObjectMerge = require('@liqd-js/alg-object-merge');
const StyleParser = new Parser( __dirname + '/syntax/style.syntax' );

const VARIABLE_RE = /\$[a-zA-Z_][a-zA-Z0-9_\-]*/g;
const SELECTOR_DELIMITER = /\s*,\s*/;
const SELECTOR_RE = /^\s*(&{0,1})\s*(.*?)\s*(&{0,1})\s*$/;

const DEFAULT_OPTIONS =
{
	media:
	{
        'xs'        : 'not (min-width: 576px)',
        'sm'        : '(min-width: 576px)',
        'md'        : '(min-width: 768px)',
        'lg'        : '(min-width: 992px)',
        'xl'        : '(min-width: 1200px)',
        'xxl'       : '(min-width: 1400px)',
        'phone'     : '(min-width: 768px)',
        '!phone'    : 'not (min-width: 768px)'
	}
}

module.exports = class Style
{
    static #scope( scope, extend = {})
    {
        return { ...scope, variables: { ...scope.variables }, generators: { ...scope.generators }, ...extend }
    }

    static #flush_properties( scope )
    {
        if( scope.buffer.properties.length )
        {
            if( scope.rule !== scope.buffer.rule || scope.selector !== scope.buffer.selector )
            {
                scope.buffer.source += 
                    ( scope.buffer.rule && scope.buffer.rule !== scope.buffer.current_rule ? scope.buffer.rule + '{\n' : '' ) +
                    ( scope.buffer.selector ? scope.buffer.selector + '{' : '' ) + scope.buffer.properties.join(';') + ( scope.buffer.selector ? '}\n' : '' ) +
                    ( scope.buffer.rule && scope.rule !== scope.buffer.rule ? '}\n' : '' );

                scope.buffer.current_rule = scope.buffer.rule;
                scope.buffer.properties = [];
            }
        }
    }

    static #write_properties( scope, properties )
    {
        Style.#flush_properties( scope );
        
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
                if( entry.rule.identifier === '@media' && scope.options?.media[ entry.rule.selector ])
                {
                    entry.rule.selector = scope.options?.media[ entry.rule.selector ];
                }

                Style.#resolve_style(  Style.#scope( scope, { rule: entry.rule.identifier + ( entry.rule.selector ? ' ' + entry.rule.selector : '' )}), entry.rule.style, true );

                if( entry.rule.identifier !== '@media' ) // TODO check: it is Experimental
                {
                    Style.#flush_properties( scope );

                    scope.buffer.current_rule = '';
                }
            }
        }
        
        if( !recursive )
        {
            Style.#flush_properties( scope );

            return scope.buffer.source;
        }
    }

    static compile( source, options = {})
    {
        let style;

        options = ObjectMerge({}, options, DEFAULT_OPTIONS );

        try
        {
            style = StyleParser.parse( source.includes('\n') ? source : fs.readFileSync( source, 'utf8' ));
        }
        catch(e)
        {
            style = StyleParser.parse( source );
        }

        let compiled = Style.#resolve_style({ options, selector: '', rule: '', variables: {}, generators: {}, buffer: { properties: [], source: '' }}, style );

        return compiled;
    }
}