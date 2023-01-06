// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

var objectToString = Object.prototype.toString;
var isArray = Array.isArray || function isArrayPolyfill(object) {
    return objectToString.call(object) === '[object Array]';
};
function isFunction(object) {
    return typeof object === 'function';
}
function typeStr(obj) {
    return isArray(obj) ? 'array' : typeof obj;
}
function escapeRegExp(string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
}
function hasProperty(obj, propName) {
    return obj != null && typeof obj === 'object' && propName in obj;
}
function primitiveHasOwnProperty(primitive, propName) {
    return primitive != null && typeof primitive !== 'object' && primitive.hasOwnProperty && primitive.hasOwnProperty(propName);
}
var regExpTest = RegExp.prototype.test;
function testRegExp(re, string) {
    return regExpTest.call(re, string);
}
var nonSpaceRe = /\S/;
function isWhitespace(string) {
    return !testRegExp(nonSpaceRe, string);
}
var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};
function escapeHtml(string) {
    return String(string).replace(/[&<>"'`=\/]/g, function fromEntityMap(s) {
        return entityMap[s];
    });
}
var whiteRe = /\s*/;
var spaceRe = /\s+/;
var equalsRe = /\s*=/;
var curlyRe = /\s*\}/;
var tagRe = /#|\^|\/|>|\{|&|=|!/;
function parseTemplate(template, tags) {
    if (!template) return [];
    var lineHasNonSpace = false;
    var sections = [];
    var tokens = [];
    var spaces = [];
    var hasTag = false;
    var nonSpace = false;
    var indentation = '';
    var tagIndex = 0;
    function stripSpace() {
        if (hasTag && !nonSpace) {
            while(spaces.length)delete tokens[spaces.pop()];
        } else {
            spaces = [];
        }
        hasTag = false;
        nonSpace = false;
    }
    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags(tagsToCompile) {
        if (typeof tagsToCompile === 'string') tagsToCompile = tagsToCompile.split(spaceRe, 2);
        if (!isArray(tagsToCompile) || tagsToCompile.length !== 2) throw new Error('Invalid tags: ' + tagsToCompile);
        openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + '\\s*');
        closingTagRe = new RegExp('\\s*' + escapeRegExp(tagsToCompile[1]));
        closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tagsToCompile[1]));
    }
    compileTags(tags || mustache.tags);
    var scanner = new Scanner(template);
    var start, type, value, chr, token, openSection;
    while(!scanner.eos()){
        start = scanner.pos;
        value = scanner.scanUntil(openingTagRe);
        if (value) {
            for(var i = 0, valueLength = value.length; i < valueLength; ++i){
                chr = value.charAt(i);
                if (isWhitespace(chr)) {
                    spaces.push(tokens.length);
                    indentation += chr;
                } else {
                    nonSpace = true;
                    lineHasNonSpace = true;
                    indentation += ' ';
                }
                tokens.push([
                    'text',
                    chr,
                    start,
                    start + 1
                ]);
                start += 1;
                if (chr === '\n') {
                    stripSpace();
                    indentation = '';
                    tagIndex = 0;
                    lineHasNonSpace = false;
                }
            }
        }
        if (!scanner.scan(openingTagRe)) break;
        hasTag = true;
        type = scanner.scan(tagRe) || 'name';
        scanner.scan(whiteRe);
        if (type === '=') {
            value = scanner.scanUntil(equalsRe);
            scanner.scan(equalsRe);
            scanner.scanUntil(closingTagRe);
        } else if (type === '{') {
            value = scanner.scanUntil(closingCurlyRe);
            scanner.scan(curlyRe);
            scanner.scanUntil(closingTagRe);
            type = '&';
        } else {
            value = scanner.scanUntil(closingTagRe);
        }
        if (!scanner.scan(closingTagRe)) throw new Error('Unclosed tag at ' + scanner.pos);
        if (type == '>') {
            token = [
                type,
                value,
                start,
                scanner.pos,
                indentation,
                tagIndex,
                lineHasNonSpace
            ];
        } else {
            token = [
                type,
                value,
                start,
                scanner.pos
            ];
        }
        tagIndex++;
        tokens.push(token);
        if (type === '#' || type === '^') {
            sections.push(token);
        } else if (type === '/') {
            openSection = sections.pop();
            if (!openSection) throw new Error('Unopened section "' + value + '" at ' + start);
            if (openSection[1] !== value) throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
        } else if (type === 'name' || type === '{' || type === '&') {
            nonSpace = true;
        } else if (type === '=') {
            compileTags(value);
        }
    }
    stripSpace();
    openSection = sections.pop();
    if (openSection) throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);
    return nestTokens(squashTokens(tokens));
}
function squashTokens(tokens) {
    var squashedTokens = [];
    var token, lastToken;
    for(var i = 0, numTokens = tokens.length; i < numTokens; ++i){
        token = tokens[i];
        if (token) {
            if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
                lastToken[1] += token[1];
                lastToken[3] = token[3];
            } else {
                squashedTokens.push(token);
                lastToken = token;
            }
        }
    }
    return squashedTokens;
}
function nestTokens(tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];
    var token, section;
    for(var i = 0, numTokens = tokens.length; i < numTokens; ++i){
        token = tokens[i];
        switch(token[0]){
            case '#':
            case '^':
                collector.push(token);
                sections.push(token);
                collector = token[4] = [];
                break;
            case '/':
                section = sections.pop();
                section[5] = token[2];
                collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
                break;
            default:
                collector.push(token);
        }
    }
    return nestedTokens;
}
function Scanner(string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
}
Scanner.prototype.eos = function eos() {
    return this.tail === '';
};
Scanner.prototype.scan = function scan(re) {
    var match = this.tail.match(re);
    if (!match || match.index !== 0) return '';
    var string = match[0];
    this.tail = this.tail.substring(string.length);
    this.pos += string.length;
    return string;
};
Scanner.prototype.scanUntil = function scanUntil(re) {
    var index = this.tail.search(re), match;
    switch(index){
        case -1:
            match = this.tail;
            this.tail = '';
            break;
        case 0:
            match = '';
            break;
        default:
            match = this.tail.substring(0, index);
            this.tail = this.tail.substring(index);
    }
    this.pos += match.length;
    return match;
};
function Context(view, parentContext) {
    this.view = view;
    this.cache = {
        '.': this.view
    };
    this.parent = parentContext;
}
Context.prototype.push = function push(view) {
    return new Context(view, this);
};
Context.prototype.lookup = function lookup(name) {
    var cache1 = this.cache;
    var value;
    if (cache1.hasOwnProperty(name)) {
        value = cache1[name];
    } else {
        var context = this, intermediateValue, names, index, lookupHit = false;
        while(context){
            if (name.indexOf('.') > 0) {
                intermediateValue = context.view;
                names = name.split('.');
                index = 0;
                while(intermediateValue != null && index < names.length){
                    if (index === names.length - 1) lookupHit = hasProperty(intermediateValue, names[index]) || primitiveHasOwnProperty(intermediateValue, names[index]);
                    intermediateValue = intermediateValue[names[index++]];
                }
            } else {
                intermediateValue = context.view[name];
                lookupHit = hasProperty(context.view, name);
            }
            if (lookupHit) {
                value = intermediateValue;
                break;
            }
            context = context.parent;
        }
        cache1[name] = value;
    }
    if (isFunction(value)) value = value.call(this.view);
    return value;
};
function Writer() {
    this.templateCache = {
        _cache: {},
        set: function set(key, value) {
            this._cache[key] = value;
        },
        get: function get(key) {
            return this._cache[key];
        },
        clear: function clear() {
            this._cache = {};
        }
    };
}
Writer.prototype.clearCache = function clearCache() {
    if (typeof this.templateCache !== 'undefined') {
        this.templateCache.clear();
    }
};
Writer.prototype.parse = function parse(template, tags) {
    var cache1 = this.templateCache;
    var cacheKey = template + ':' + (tags || mustache.tags).join(':');
    var isCacheEnabled = typeof cache1 !== 'undefined';
    var tokens = isCacheEnabled ? cache1.get(cacheKey) : undefined;
    if (tokens == undefined) {
        tokens = parseTemplate(template, tags);
        isCacheEnabled && cache1.set(cacheKey, tokens);
    }
    return tokens;
};
Writer.prototype.render = function render(template, view, partials, tags) {
    var tokens = this.parse(template, tags);
    var context = view instanceof Context ? view : new Context(view, undefined);
    return this.renderTokens(tokens, context, partials, template, tags);
};
Writer.prototype.renderTokens = function renderTokens(tokens, context, partials, originalTemplate, tags) {
    var buffer = '';
    var token, symbol, value;
    for(var i = 0, numTokens = tokens.length; i < numTokens; ++i){
        value = undefined;
        token = tokens[i];
        symbol = token[0];
        if (symbol === '#') value = this.renderSection(token, context, partials, originalTemplate);
        else if (symbol === '^') value = this.renderInverted(token, context, partials, originalTemplate);
        else if (symbol === '>') value = this.renderPartial(token, context, partials, tags);
        else if (symbol === '&') value = this.unescapedValue(token, context);
        else if (symbol === 'name') value = this.escapedValue(token, context);
        else if (symbol === 'text') value = this.rawValue(token);
        if (value !== undefined) buffer += value;
    }
    return buffer;
};
Writer.prototype.renderSection = function renderSection(token, context, partials, originalTemplate) {
    var self1 = this;
    var buffer = '';
    var value = context.lookup(token[1]);
    function subRender(template) {
        return self1.render(template, context, partials);
    }
    if (!value) return;
    if (isArray(value)) {
        for(var j = 0, valueLength = value.length; j < valueLength; ++j){
            buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate);
        }
    } else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
        buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
    } else if (isFunction(value)) {
        if (typeof originalTemplate !== 'string') throw new Error('Cannot use higher-order sections without the original template');
        value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);
        if (value != null) buffer += value;
    } else {
        buffer += this.renderTokens(token[4], context, partials, originalTemplate);
    }
    return buffer;
};
Writer.prototype.renderInverted = function renderInverted(token, context, partials, originalTemplate) {
    var value = context.lookup(token[1]);
    if (!value || isArray(value) && value.length === 0) return this.renderTokens(token[4], context, partials, originalTemplate);
};
Writer.prototype.indentPartial = function indentPartial(partial, indentation, lineHasNonSpace) {
    var filteredIndentation = indentation.replace(/[^ \t]/g, '');
    var partialByNl = partial.split('\n');
    for(var i = 0; i < partialByNl.length; i++){
        if (partialByNl[i].length && (i > 0 || !lineHasNonSpace)) {
            partialByNl[i] = filteredIndentation + partialByNl[i];
        }
    }
    return partialByNl.join('\n');
};
Writer.prototype.renderPartial = function renderPartial(token, context, partials, tags) {
    if (!partials) return;
    var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
    if (value != null) {
        var lineHasNonSpace = token[6];
        var tagIndex = token[5];
        var indentation = token[4];
        var indentedValue = value;
        if (tagIndex == 0 && indentation) {
            indentedValue = this.indentPartial(value, indentation, lineHasNonSpace);
        }
        return this.renderTokens(this.parse(indentedValue, tags), context, partials, indentedValue, tags);
    }
};
Writer.prototype.unescapedValue = function unescapedValue(token, context) {
    var value = context.lookup(token[1]);
    if (value != null) return value;
};
Writer.prototype.escapedValue = function escapedValue(token, context) {
    var value = context.lookup(token[1]);
    if (value != null) return mustache.escape(value);
};
Writer.prototype.rawValue = function rawValue(token) {
    return token[1];
};
var mustache = {
    name: 'mustache.js',
    version: '4.0.1',
    tags: [
        '{{',
        '}}'
    ],
    clearCache: undefined,
    escape: undefined,
    parse: undefined,
    render: undefined,
    Scanner: undefined,
    Context: undefined,
    Writer: undefined,
    set templateCache (cache){
        defaultWriter.templateCache = cache;
    },
    get templateCache () {
        return defaultWriter.templateCache;
    }
};
var defaultWriter = new Writer();
mustache.clearCache = function clearCache() {
    return defaultWriter.clearCache();
};
mustache.parse = function parse(template, tags) {
    return defaultWriter.parse(template, tags);
};
mustache.render = function render(template, view, partials, tags) {
    if (typeof template !== 'string') {
        throw new TypeError('Invalid template! Template should be a "string" ' + 'but "' + typeStr(template) + '" was given as the first ' + 'argument for mustache#render(template, view, partials)');
    }
    return defaultWriter.render(template, view, partials, tags);
};
mustache.escape = escapeHtml;
mustache.Scanner = Scanner;
mustache.Context = Context;
mustache.Writer = Writer;
new TextDecoder();
function render(body, model) {
    return mustache.render(body, model);
}
var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for(var s, i = 1, n = arguments.length; i < n; i++){
            s = arguments[i];
            for(var p in s)if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
function createCommonjsModule(fn, module) {
    return module = {
        exports: {}
    }, fn(module, module.exports), module.exports;
}
var urlPattern = createCommonjsModule(function(module, exports) {
    var slice = [].slice;
    (function(root, factory) {
        if (exports !== null) {
            return module.exports = factory();
        } else {
            return root.UrlPattern = factory();
        }
    })(commonjsGlobal, function() {
        var P, UrlPattern, astNodeContainsSegmentsForProvidedParams, astNodeToNames, astNodeToRegexString, baseAstNodeToRegexString, concatMap, defaultOptions, escapeForRegex, getParam, keysAndValuesToObject, newParser, regexGroupCount, stringConcatMap, stringify;
        escapeForRegex = function(string) {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        };
        concatMap = function(array, f) {
            var i, length, results;
            results = [];
            i = -1;
            length = array.length;
            while(++i < length){
                results = results.concat(f(array[i]));
            }
            return results;
        };
        stringConcatMap = function(array, f) {
            var i, length, result;
            result = '';
            i = -1;
            length = array.length;
            while(++i < length){
                result += f(array[i]);
            }
            return result;
        };
        regexGroupCount = function(regex) {
            return new RegExp(regex.toString() + '|').exec('').length - 1;
        };
        keysAndValuesToObject = function(keys, values) {
            var i, key, length, object, value;
            object = {};
            i = -1;
            length = keys.length;
            while(++i < length){
                key = keys[i];
                value = values[i];
                if (value == null) {
                    continue;
                }
                if (object[key] != null) {
                    if (!Array.isArray(object[key])) {
                        object[key] = [
                            object[key]
                        ];
                    }
                    object[key].push(value);
                } else {
                    object[key] = value;
                }
            }
            return object;
        };
        P = {};
        P.Result = function(value, rest) {
            this.value = value;
            this.rest = rest;
        };
        P.Tagged = function(tag, value) {
            this.tag = tag;
            this.value = value;
        };
        P.tag = function(tag, parser) {
            return function(input) {
                var result, tagged;
                result = parser(input);
                if (result == null) {
                    return;
                }
                tagged = new P.Tagged(tag, result.value);
                return new P.Result(tagged, result.rest);
            };
        };
        P.regex = function(regex) {
            return function(input) {
                var matches, result;
                matches = regex.exec(input);
                if (matches == null) {
                    return;
                }
                result = matches[0];
                return new P.Result(result, input.slice(result.length));
            };
        };
        P.sequence = function() {
            var parsers;
            parsers = 1 <= arguments.length ? slice.call(arguments, 0) : [];
            return function(input) {
                var i, length, parser, rest, result, values;
                i = -1;
                length = parsers.length;
                values = [];
                rest = input;
                while(++i < length){
                    parser = parsers[i];
                    result = parser(rest);
                    if (result == null) {
                        return;
                    }
                    values.push(result.value);
                    rest = result.rest;
                }
                return new P.Result(values, rest);
            };
        };
        P.pick = function() {
            var indexes, parsers;
            indexes = arguments[0], parsers = 2 <= arguments.length ? slice.call(arguments, 1) : [];
            return function(input) {
                var array, result;
                result = P.sequence.apply(P, parsers)(input);
                if (result == null) {
                    return;
                }
                array = result.value;
                result.value = array[indexes];
                return result;
            };
        };
        P.string = function(string) {
            var length;
            length = string.length;
            return function(input) {
                if (input.slice(0, length) === string) {
                    return new P.Result(string, input.slice(length));
                }
            };
        };
        P.lazy = function(fn) {
            var cached;
            cached = null;
            return function(input) {
                if (cached == null) {
                    cached = fn();
                }
                return cached(input);
            };
        };
        P.baseMany = function(parser, end, stringResult, atLeastOneResultRequired, input) {
            var endResult, parserResult, rest, results;
            rest = input;
            results = stringResult ? '' : [];
            while(true){
                if (end != null) {
                    endResult = end(rest);
                    if (endResult != null) {
                        break;
                    }
                }
                parserResult = parser(rest);
                if (parserResult == null) {
                    break;
                }
                if (stringResult) {
                    results += parserResult.value;
                } else {
                    results.push(parserResult.value);
                }
                rest = parserResult.rest;
            }
            if (atLeastOneResultRequired && results.length === 0) {
                return;
            }
            return new P.Result(results, rest);
        };
        P.many1 = function(parser) {
            return function(input) {
                return P.baseMany(parser, null, false, true, input);
            };
        };
        P.concatMany1Till = function(parser, end) {
            return function(input) {
                return P.baseMany(parser, end, true, true, input);
            };
        };
        P.firstChoice = function() {
            var parsers;
            parsers = 1 <= arguments.length ? slice.call(arguments, 0) : [];
            return function(input) {
                var i, length, parser, result;
                i = -1;
                length = parsers.length;
                while(++i < length){
                    parser = parsers[i];
                    result = parser(input);
                    if (result != null) {
                        return result;
                    }
                }
            };
        };
        newParser = function(options) {
            var U;
            U = {};
            U.wildcard = P.tag('wildcard', P.string(options.wildcardChar));
            U.optional = P.tag('optional', P.pick(1, P.string(options.optionalSegmentStartChar), P.lazy(function() {
                return U.pattern;
            }), P.string(options.optionalSegmentEndChar)));
            U.name = P.regex(new RegExp("^[" + options.segmentNameCharset + "]+"));
            U.named = P.tag('named', P.pick(1, P.string(options.segmentNameStartChar), P.lazy(function() {
                return U.name;
            })));
            U.escapedChar = P.pick(1, P.string(options.escapeChar), P.regex(/^./));
            U["static"] = P.tag('static', P.concatMany1Till(P.firstChoice(P.lazy(function() {
                return U.escapedChar;
            }), P.regex(/^./)), P.firstChoice(P.string(options.segmentNameStartChar), P.string(options.optionalSegmentStartChar), P.string(options.optionalSegmentEndChar), U.wildcard)));
            U.token = P.lazy(function() {
                return P.firstChoice(U.wildcard, U.optional, U.named, U["static"]);
            });
            U.pattern = P.many1(P.lazy(function() {
                return U.token;
            }));
            return U;
        };
        defaultOptions = {
            escapeChar: '\\',
            segmentNameStartChar: ':',
            segmentValueCharset: 'a-zA-Z0-9-_~ %',
            segmentNameCharset: 'a-zA-Z0-9',
            optionalSegmentStartChar: '(',
            optionalSegmentEndChar: ')',
            wildcardChar: '*'
        };
        baseAstNodeToRegexString = function(astNode, segmentValueCharset) {
            if (Array.isArray(astNode)) {
                return stringConcatMap(astNode, function(node) {
                    return baseAstNodeToRegexString(node, segmentValueCharset);
                });
            }
            switch(astNode.tag){
                case 'wildcard':
                    return '(.*?)';
                case 'named':
                    return "([" + segmentValueCharset + "]+)";
                case 'static':
                    return escapeForRegex(astNode.value);
                case 'optional':
                    return '(?:' + baseAstNodeToRegexString(astNode.value, segmentValueCharset) + ')?';
            }
        };
        astNodeToRegexString = function(astNode, segmentValueCharset) {
            if (segmentValueCharset == null) {
                segmentValueCharset = defaultOptions.segmentValueCharset;
            }
            return '^' + baseAstNodeToRegexString(astNode, segmentValueCharset) + '$';
        };
        astNodeToNames = function(astNode) {
            if (Array.isArray(astNode)) {
                return concatMap(astNode, astNodeToNames);
            }
            switch(astNode.tag){
                case 'wildcard':
                    return [
                        '_'
                    ];
                case 'named':
                    return [
                        astNode.value
                    ];
                case 'static':
                    return [];
                case 'optional':
                    return astNodeToNames(astNode.value);
            }
        };
        getParam = function(params, key, nextIndexes, sideEffects) {
            var index, maxIndex, result, value;
            if (sideEffects == null) {
                sideEffects = false;
            }
            value = params[key];
            if (value == null) {
                if (sideEffects) {
                    throw new Error("no values provided for key `" + key + "`");
                } else {
                    return;
                }
            }
            index = nextIndexes[key] || 0;
            maxIndex = Array.isArray(value) ? value.length - 1 : 0;
            if (index > maxIndex) {
                if (sideEffects) {
                    throw new Error("too few values provided for key `" + key + "`");
                } else {
                    return;
                }
            }
            result = Array.isArray(value) ? value[index] : value;
            if (sideEffects) {
                nextIndexes[key] = index + 1;
            }
            return result;
        };
        astNodeContainsSegmentsForProvidedParams = function(astNode, params, nextIndexes) {
            var i, length;
            if (Array.isArray(astNode)) {
                i = -1;
                length = astNode.length;
                while(++i < length){
                    if (astNodeContainsSegmentsForProvidedParams(astNode[i], params, nextIndexes)) {
                        return true;
                    }
                }
                return false;
            }
            switch(astNode.tag){
                case 'wildcard':
                    return getParam(params, '_', nextIndexes, false) != null;
                case 'named':
                    return getParam(params, astNode.value, nextIndexes, false) != null;
                case 'static':
                    return false;
                case 'optional':
                    return astNodeContainsSegmentsForProvidedParams(astNode.value, params, nextIndexes);
            }
        };
        stringify = function(astNode, params, nextIndexes) {
            if (Array.isArray(astNode)) {
                return stringConcatMap(astNode, function(node) {
                    return stringify(node, params, nextIndexes);
                });
            }
            switch(astNode.tag){
                case 'wildcard':
                    return getParam(params, '_', nextIndexes, true);
                case 'named':
                    return getParam(params, astNode.value, nextIndexes, true);
                case 'static':
                    return astNode.value;
                case 'optional':
                    if (astNodeContainsSegmentsForProvidedParams(astNode.value, params, nextIndexes)) {
                        return stringify(astNode.value, params, nextIndexes);
                    } else {
                        return '';
                    }
            }
        };
        UrlPattern = function(arg1, arg2) {
            var groupCount, options, parsed, parser, withoutWhitespace;
            if (arg1 instanceof UrlPattern) {
                this.isRegex = arg1.isRegex;
                this.regex = arg1.regex;
                this.ast = arg1.ast;
                this.names = arg1.names;
                return;
            }
            this.isRegex = arg1 instanceof RegExp;
            if (!('string' === typeof arg1 || this.isRegex)) {
                throw new TypeError('argument must be a regex or a string');
            }
            if (this.isRegex) {
                this.regex = arg1;
                if (arg2 != null) {
                    if (!Array.isArray(arg2)) {
                        throw new Error('if first argument is a regex the second argument may be an array of group names but you provided something else');
                    }
                    groupCount = regexGroupCount(this.regex);
                    if (arg2.length !== groupCount) {
                        throw new Error("regex contains " + groupCount + " groups but array of group names contains " + arg2.length);
                    }
                    this.names = arg2;
                }
                return;
            }
            if (arg1 === '') {
                throw new Error('argument must not be the empty string');
            }
            withoutWhitespace = arg1.replace(/\s+/g, '');
            if (withoutWhitespace !== arg1) {
                throw new Error('argument must not contain whitespace');
            }
            options = {
                escapeChar: (arg2 != null ? arg2.escapeChar : void 0) || defaultOptions.escapeChar,
                segmentNameStartChar: (arg2 != null ? arg2.segmentNameStartChar : void 0) || defaultOptions.segmentNameStartChar,
                segmentNameCharset: (arg2 != null ? arg2.segmentNameCharset : void 0) || defaultOptions.segmentNameCharset,
                segmentValueCharset: (arg2 != null ? arg2.segmentValueCharset : void 0) || defaultOptions.segmentValueCharset,
                optionalSegmentStartChar: (arg2 != null ? arg2.optionalSegmentStartChar : void 0) || defaultOptions.optionalSegmentStartChar,
                optionalSegmentEndChar: (arg2 != null ? arg2.optionalSegmentEndChar : void 0) || defaultOptions.optionalSegmentEndChar,
                wildcardChar: (arg2 != null ? arg2.wildcardChar : void 0) || defaultOptions.wildcardChar
            };
            parser = newParser(options);
            parsed = parser.pattern(arg1);
            if (parsed == null) {
                throw new Error("couldn't parse pattern");
            }
            if (parsed.rest !== '') {
                throw new Error("could only partially parse pattern");
            }
            this.ast = parsed.value;
            this.regex = new RegExp(astNodeToRegexString(this.ast, options.segmentValueCharset));
            this.names = astNodeToNames(this.ast);
        };
        UrlPattern.prototype.match = function(url) {
            var groups, match;
            match = this.regex.exec(url);
            if (match == null) {
                return null;
            }
            groups = match.slice(1);
            if (this.names) {
                return keysAndValuesToObject(this.names, groups);
            } else {
                return groups;
            }
        };
        UrlPattern.prototype.stringify = function(params) {
            if (params == null) {
                params = {};
            }
            if (this.isRegex) {
                throw new Error("can't stringify patterns generated from a regex");
            }
            if (params !== Object(params)) {
                throw new Error("argument must be an object or undefined");
            }
            return stringify(this.ast, params, {});
        };
        UrlPattern.escapeForRegex = escapeForRegex;
        UrlPattern.concatMap = concatMap;
        UrlPattern.stringConcatMap = stringConcatMap;
        UrlPattern.regexGroupCount = regexGroupCount;
        UrlPattern.keysAndValuesToObject = keysAndValuesToObject;
        UrlPattern.P = P;
        UrlPattern.newParser = newParser;
        UrlPattern.defaultOptions = defaultOptions;
        UrlPattern.astNodeToRegexString = astNodeToRegexString;
        UrlPattern.astNodeToNames = astNodeToNames;
        UrlPattern.getParam = getParam;
        UrlPattern.astNodeContainsSegmentsForProvidedParams = astNodeContainsSegmentsForProvidedParams;
        UrlPattern.stringify = stringify;
        return UrlPattern;
    });
});
var patternOpts = {
    segmentNameCharset: 'a-zA-Z0-9_-',
    segmentValueCharset: 'a-zA-Z0-9@.+-_'
};
var Router = function() {
    function Router() {
        this.routes = [];
    }
    Router.prototype.all = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: ''
        }));
    };
    Router.prototype.get = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'GET'
        }));
    };
    Router.prototype.post = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'POST'
        }));
    };
    Router.prototype.put = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'PUT'
        }));
    };
    Router.prototype.patch = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'PATCH'
        }));
    };
    Router.prototype["delete"] = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'DELETE'
        }));
    };
    Router.prototype.head = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'HEAD'
        }));
    };
    Router.prototype.options = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this.addRoute(pattern, handler, __assign(__assign({}, options), {
            method: 'OPTIONS'
        }));
    };
    Router.prototype.addRoute = function(pattern, handler, options) {
        if (options === void 0) {
            options = {};
        }
        if (!(pattern instanceof urlPattern)) {
            pattern = new urlPattern(pattern, patternOpts);
        }
        this.routes.push({
            pattern: pattern,
            handler: handler,
            options: options
        });
        return this;
    };
    Router.prototype.match = function(url, method) {
        if (!(url instanceof URL)) {
            url = url.startsWith('/') ? new URL("http://domain" + url) : new URL(url);
        }
        for(var _i = 0, _a = this.routes; _i < _a.length; _i++){
            var route = _a[_i];
            var pattern = route.pattern, options = route.options, handler = route.handler;
            if (options.method && options.method !== method) continue;
            var params = pattern.match(options.matchUrl ? url.href : url.pathname);
            if (params) return {
                params: params,
                handler: handler,
                url: url,
                method: method,
                route: route,
                ctx: this.ctx
            };
        }
        return null;
    };
    Router.prototype.matchRequest = function(request) {
        return this.match(request.url, request.method);
    };
    Router.prototype.matchEvent = function(event) {
        return this.matchRequest(event.request);
    };
    Router.prototype.handle = function(url, method) {
        var match = this.match(url, method);
        if (!match) return null;
        var context = __assign({}, match);
        var handlerPromise = match.handler(context);
        return {
            handlerPromise: handlerPromise,
            match: context
        };
    };
    Router.prototype.handleRequest = function(request) {
        var match = this.matchRequest(request);
        if (!match) return null;
        var context = __assign(__assign({}, match), {
            request: request
        });
        var handlerPromise = match.handler(context);
        return {
            handlerPromise: handlerPromise,
            match: context
        };
    };
    Router.prototype.handleEvent = function(event) {
        var request = event.request;
        var match = this.matchRequest(request);
        if (!match) return null;
        var context = __assign(__assign({}, match), {
            request: request,
            event: event
        });
        var handlerPromise = match.handler(context);
        event.respondWith(handlerPromise);
        return {
            handlerPromise: handlerPromise,
            match: context
        };
    };
    Router.prototype.clear = function() {
        this.routes.length = 0;
    };
    return Router;
}();
const layout = `
<!DOCTYPE html>
<html lang="en-US">

<head>
  <meta charset="UTF-8">
  <title>Service Worker Test Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
  <div class="app">{{{app}}}</div>
  <script src="https://unpkg.com/htmx.org@1.8.4"
    integrity="sha384-wg5Y/JwF7VxGk4zLsJEcAojRtlVp1FKKdGy1qN+OMtdq72WRvX/EdRdqg/LOhYeV"
    crossorigin="anonymous"></script>
  <script>
    window.addEventListener('load', () => {
      // register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
          .then(function (registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(function (err) {
            console.log('ServiceWorker registration failed: ', err);
          });
      }
    });
  </script>
</body>

</html>
`;
const router = new Router();
router.get("/dest/test.html", (req)=>{
    console.log(req.request.url, Object.fromEntries(req.request.headers.entries()));
    const result = render(`<h1>{{title}}</h1>
    <button type="button" hx-target=".app" hx-get="{{url}}" hx-replace-url="{{pushUrl}}" hx-swap="innerHTML">
      {{linkText}}
    </button>`, {
        title: "Service Worker Page",
        url: "back.html",
        pushUrl: "index.html",
        linkText: "Zurück zur Startseite"
    });
    if (req.request.headers.get("hx-request") === "true") {
        return new Response(result, {
            headers: {
                "content-type": "text/html; charset=UTF-8"
            }
        });
    }
    const page = render(layout, {
        app: result
    });
    return new Response(page, {
        headers: {
            "content-type": "text/html; charset=UTF-8"
        }
    });
});
router.get("/dest/back.html", (req)=>{
    console.log(req.request.url, Object.fromEntries(req.request.headers.entries()));
    const result = render(`<h1>{{title}}</h1>
    <button type="button" hx-target=".app" hx-get="{{url}}" hx-push-url="true" hx-swap="innerHTML">
      {{linkText}}
    </button>`, {
        title: "Startseite",
        url: "test.html",
        linkText: "Zur Testseite"
    });
    const response = new Response(result, {
        headers: {
            "content-type": "text/html; charset=UTF-8"
        }
    });
    return response;
});
addEventListener("fetch", (event)=>{
    const result = router.handleRequest(event.request);
    if (result) {
        event.respondWith(result.handlerPromise);
    } else {
        console.log("No route matched.");
    }
});
