var testCase = require('nodeunit').testCase,
    tags = require('../lib/tags'),
    parser = require('../lib/parser');

exports.Tags = testCase({
    'undefined tag throws error': function (test) {
        test.throws(function () {
            parser.parse('{% foobar %}', {});
        }, Error);
        test.done();
    },

    'basic tag': function (test) {
        var output = parser.parse('{% blah %}', { blah: {} });
        test.deepEqual([{ type: parser.TOKEN_TYPES.LOGIC, line: 1, name: 'blah', args: [], compile: {}, parent: [] }], output);

        output = parser.parse('{% blah "foobar" %}', { blah: {} });
        test.deepEqual([{ type: parser.TOKEN_TYPES.LOGIC, line: 1, name: 'blah', args: ['"foobar"'], compile: {}, parent: [] }], output, 'args appended');

        output = parser.parse('{% blah "foobar" barfoo %}', { blah: {} });
        test.deepEqual([{ type: parser.TOKEN_TYPES.LOGIC, line: 1, name: 'blah', args: ['"foobar"', 'barfoo'], compile: {}, parent: [] }], output, 'multiple args appended');

        test.done();
    },

    'basic tag with ends': function (test) {
        var output = parser.parse('{% blah %}{% endblah %}', { blah: { ends: true } });
        test.deepEqual([{ type: parser.TOKEN_TYPES.LOGIC, line: 1, name: 'blah', args: [], compile: { ends: true }, tokens: [], parent: [] }], output);
        test.done();
    },

    'line number included in token': function (test) {
        var output = parser.parse('hi!\n\n\n{% blah %}{% endblah %}', { blah: { ends: true } });
        test.deepEqual({ type: parser.TOKEN_TYPES.LOGIC, line: 4, name: 'blah', args: [], compile: { ends: true }, tokens: [], parent: [] }, output[1]);
        test.done();
    },

    'throws if requires end but no end found': function (test) {
        test.throws(function () {
            parser.parse('{% blah %}', { blah: { ends: true }});
        }, Error);
        test.done();
    },

    'throws if not end but end found': function (test) {
        test.throws(function () {
            parser.parse('{% blah %}{% endblah %}', { blah: {}});
        }, Error);
        test.done();
    },

    'throws on unbalanced end tag': function (test) {
        test.throws(function () {
            parser.parse('{% blah %}{% endfoo %}', { blah: { ends: true }, foo: { ends: true }});
        }, Error);
        test.done();
    },

    'tag with contents': function (test) {
        var output = parser.parse('{% blah %}hello{% endblah %}', { blah: { ends: true } });
        test.deepEqual([{ type: parser.TOKEN_TYPES.LOGIC, line: 1, name: 'blah', args: [], compile: { ends: true }, tokens: ['hello'], parent: [] }], output);
        test.done();
    },

    'arguments': function (test) {
        var output = parser.parse('{% foo "hi" %}', { foo: {} });
        test.deepEqual(output[0].args, ['"hi"'], 'string');

        output = parser.parse('{% foo "hi mom" %}', { foo: {} });
        test.deepEqual(output[0].args, ['"hi mom"'], 'string with space');

        output = parser.parse('{% foo "{" "[" & ^ ; * , a "]" "}" %}', { foo: {} });
        test.deepEqual(output[0].args, ['"{"', '"["', '&', '^', ';', '*', ',', 'a', '"]"', '"}"'], 'random chars');

        output = parser.parse('{% foo "hi,mom" %}', { foo: {} });
        test.deepEqual(output[0].args, ['"hi,mom"'], 'string with comma');

        output = parser.parse('{% foo "hi\", \"mom" %}', { foo: {} });
        test.deepEqual(output[0].args, ['"hi\", \"mom"'], 'double-quote string with comma');

        output = parser.parse("{% foo 'hi\', \'mom' %}", { foo: {} });
        test.deepEqual(output[0].args, ['\'hi\', \'mom\''], 'single-quote string with comma');

        output = parser.parse("{% foo [] %}", { foo: {} });
        test.deepEqual(output[0].args, ['[]'], 'empty array');

        output = parser.parse("{% foo {} %}", { foo: {} });
        test.deepEqual(output[0].args, ['{}'], 'empty object');

        output = parser.parse("{% foo ['hi', 'your', 'mom'] %}", { foo: {} });
        test.deepEqual(output[0].args, ['[\'hi\', \'your\', \'mom\']'], 'array');

        output = parser.parse("{% foo { 'foo': 1, 'bar': true } %}", { foo: {} });
        test.deepEqual(output[0].args, ['{ \'foo\': 1, \'bar\': true }'], 'object');

        output = parser.parse("{% foo { 'bar': true } 'foo' [] %}", { foo: {} });
        test.deepEqual(output[0].args, ['{ \'bar\': true }', "'foo'", '[]'], 'combo');

        test.done();
    },

    'bad string arguments throws': function (test) {
        test.throws(function () {
            parser.parse('{% foo "blah is foo %}', { foo: {} });
        });
        test.done();
    }
});

exports.Comments = testCase({
    'empty strings are ignored': function (test) {
        var output = parser.parse('');
        test.deepEqual([], output);

        output = parser.parse(' ');
        test.deepEqual([], output);

        output = parser.parse(' \n');
        test.deepEqual([], output);

        test.done();
    },

    'comments are ignored': function (test) {
        var output = parser.parse('{# foobar #}');
        test.deepEqual([], output);
        test.done();
    }
});

exports.Variable = testCase({
    'basic variable': function (test) {
        var output = parser.parse('{{ foobar }}');
        test.deepEqual([{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', filters: [], escape: false, args: null }], output, 'with spaces');

        output = parser.parse('{{foobar}}');
        test.deepEqual([{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', filters: [], escape: false, args: null }], output, 'without spaces');

        test.done();
    },

    'dot-notation variable': function (test) {
        var output = parser.parse('{{ foo.bar }}');
        test.deepEqual([{ type: parser.TOKEN_TYPES.VAR, name: 'foo.bar', filters: [], escape: false, args: null }], output);
        test.done();
    },

    'variable with filter': function (test) {
        var output = parser.parse('{{ foobar|awesome }}');
        test.deepEqual(output, [{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', escape: false, args: null, filters: [{ name: 'awesome', args: '' }] }], 'filter by name');

        output = parser.parse('{{ foobar|awesome("param", ctxvar, 2) }}');
        test.deepEqual(output, [{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', escape: false, args: null, filters: [{ name: 'awesome', args: '"param", ctxvar, 2' }] }], 'filter with params');

        test.done();
    },

    'multiple filters': function (test) {
        var output = parser.parse('{{ foobar|baz(1)|rad|awesome("param", 2) }}');
        test.deepEqual([{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', escape: false, args: null, filters: [
            { name: 'baz', args: '1' },
            { name: 'rad', args: '' },
            { name: 'awesome', args: '"param", 2' }
        ] }], output);

        test.done();
    },

    'filters do not carry over': function (test) {
        var output = parser.parse('{{ foo|baz }}{{ bar }}');
        test.deepEqual([
            { type: parser.TOKEN_TYPES.VAR, name: 'foo', filters: [{ name: 'baz', args: '' }], escape: false, args: null },
            { type: parser.TOKEN_TYPES.VAR, name: 'bar', filters: [], escape: false, args: null }
        ], output);
        test.done();
    },

    'filters with all kinds of characters in params': function (test) {
        var output = parser.parse("{{ foo|blah('01a|\"\\',;?./¨œ∑´®†][{}]') }}");
        test.deepEqual(output[0].filters, [{ name: 'blah', args: "\'01a|\"\\\\\',;?./¨œ∑´®†][{}]\'" }]);

        test.deepEqual(parser.parse("{{ foo|blah('01a') }}")[0].filters, [{ name: 'blah', args: "'01a'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('|') }}")[0].filters, [{ name: 'blah', args: "'|'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('\"') }}")[0].filters, [{ name: 'blah', args: "'\"'" }]);
        test.deepEqual(parser.parse('{{ foo|blah("\'") }}')[0].filters, [{ name: 'blah', args: '"\'"' }]); // FIXME: WHAT?
        test.deepEqual(parser.parse("{{ foo|blah(',') }}")[0].filters, [{ name: 'blah', args: "','" }]);
        test.deepEqual(parser.parse("{{ foo|blah(';') }}")[0].filters, [{ name: 'blah', args: "';'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('?./¨œ∑´®†') }}")[0].filters, [{ name: 'blah', args: "'?./¨œ∑´®†'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('[]') }}")[0].filters, [{ name: 'blah', args: "'[]'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('[') }}")[0].filters, [{ name: 'blah', args: "'['" }]);
        test.deepEqual(parser.parse("{{ foo|blah(']') }}")[0].filters, [{ name: 'blah', args: "']'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('{}') }}")[0].filters, [{ name: 'blah', args: "'{}'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('{') }}")[0].filters, [{ name: 'blah', args: "'{'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('}') }}")[0].filters, [{ name: 'blah', args: "'}'" }]);

        // Edge cases
        test.deepEqual(parser.parse("{{ foo|blah('a\", \"b') }}")[0].filters, [{ name: 'blah', args: "'a\", \"b'" }]);
        test.deepEqual(parser.parse("{{ foo|blah('a\",\"b') }}")[0].filters, [{ name: 'blah', args: "'a\",\"b'" }]);
        test.deepEqual(parser.parse('{{ foo|blah("a\', \'b") }}')[0].filters, [{ name: 'blah', args: '"a\', \'b"' }]);
        test.deepEqual(parser.parse('{{ foo|blah("a\',\'b") }}')[0].filters, [{ name: 'blah', args: '"a\',\'b"' }]);

        test.done();
    },

    'escapements carry over in filter args': function (test) {
        var output = parser.parse('{{ foo|blah("\\s") }}');
        test.deepEqual([
            { type: parser.TOKEN_TYPES.VAR, name: 'foo', filters: [{ name: 'blah', args: '"\\\\s"' }], escape: false, args: null }
        ], output);
        test.done();
    }
});

exports.Compiling = testCase({
    basic: function (test) {
        var template = { tokens: [{ type: parser.TOKEN_TYPES.VAR, name: 'foobar', filters: [], escape: false, args: null }] };
        test.doesNotThrow(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'broken compilation will throw (from template object)');

        template = { tokens: parser.parse('{% if foo %}blah{% endif %}', tags) };

        test.doesNotThrow(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'broken compilation will throw (fromt parsed string)');

        test.done();
    },

    'throws if bad extends': function (test) {
        var template = { tokens: parser.parse('{% extends foobar %}', tags) };
        test.throws(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'extend must throw if given variable argument');

        template = { tokens: parser.parse('{% extends "foo" "bar" %}', tags) };
        test.throws(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'extend must throw if given multiple arguments');

        test.done();
    },

    'throws if extends is not first token': function (test) {
        var template = { tokens: parser.parse('blah!{% extends foobar %}', tags) };
        test.throws(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'extend must throw if it is not first token');
        test.done();
    },

    'block name requirements': function (test) {
        var template = { tokens: parser.parse('{% block foobar %}{% endblock %}', tags), type: parser.TEMPLATE };
        test.doesNotThrow(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'block name must be alpha');

        template = { tokens: parser.parse('{% block 123 %}{% endblock %}', tags), type: parser.TEMPLATE };
        test.throws(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'block must throw if its name is not alpha');
        test.done();
    },

    'block nesting': function (test) {
        var template = { tokens: parser.parse('{% block foobar %}{% block barfoo %}{% endblock %}{% endblock %}', tags) };
        test.throws(function () {
            eval('var __output = "";' + parser.compile.call(template, ''));
        }, 'block should throw if nested');
        test.done();
    }
});
