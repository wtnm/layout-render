// set env variable to the `tsconfig.json` path before loading mocha (default: './tsconfig.json')

process.env.TS_NODE_PROJECT = './tsconfig.json';

require('ts-mocha');
const {getIn} = require('objects-fns');
const {expect, assert} = require('chai');
const {refsResolver} = require('../src/refs-resolver');
const {merge} = require('react-merge');

describe('test refs-resolver', function () {
  const baseSchema = {
    $id: 'baseSchema',
    defs: {
      boolean: true,
      number: 1,
      string: 'def string',
      object: {value: 'def object'},
      array: ['some', 'values'],
      objArr: {2: 'more'}
    }
  }
  const schemaMaps = {baseSchema};

  it('tests string $refs value', function () {
    let schema = merge(baseSchema, {$refs: "#/defs/object"});
    let result = refsResolver(schema, schema);
    expect(result.$id).to.be.equal('baseSchema');
    expect(result.value).to.be.equal('def object');
  })

  it('tests object $refs value', function () {
    let schema = merge(baseSchema, {$refs: {one: "#/defs/string"}});
    let result = refsResolver(schema, schema);
    expect(result.$id).to.be.equal('baseSchema');
    expect(result.one).to.be.equal('def string');
  })

  it('tests object $refs value with path props', function () {
    let schema = merge(baseSchema, {$refs: {'two/one': "#/defs/number"}});
    let result = refsResolver(schema, schema);
    expect(result.$id).to.be.equal('baseSchema');
    expect(result.two.one).to.be.equal(1);
  })

  it('tests $refs with schemaMaps', function () {
    let schema = {$refs: {one: "baseSchema#/defs/string"}};
    let result = refsResolver(schema, schema, schemaMaps);
    expect(result.$id).to.be.equal(undefined);
    expect(result.one).to.be.equal('def string');
  })

  it('tests object $refs value with empty prop', function () {
    let schema = merge(baseSchema, {$refs: {"":"#/defs/object"}});
    let result = refsResolver(schema, schema);
    expect(result.$id).to.be.equal(undefined);
    expect(result).to.be.eql({value:'def object'});
  })

  it('tests object $refs value with empty prop', function () {
    let schema = merge(baseSchema, {$refs: {"...":"#/defs/object"}});
    let result = refsResolver(schema, schema);
    expect(result.$id).to.be.equal('baseSchema');
    expect(result.value).to.be.equal('def object');
  })

  it('tests object $refs value with several path props', function () {
    let schema = {$refs: {'one': "baseSchema#/defs/array", 'one/...2': "baseSchema#/defs/objArr"}};
    let result = refsResolver(schema, schema, schemaMaps);
    expect(result.one).to.be.eql(['some', 'values', 'more']);
  })

  it('tests object $refs value with several path props in another order', function () {
    let schema = {$refs: {'one/...3': "baseSchema#/defs/objArr", 'one/...2': "baseSchema#/defs/array"}};
    let result = refsResolver(schema, schema, schemaMaps);
    expect(result.one).to.be.eql({0: 'some', 1: 'values', 2: 'more'});
  })

  it('tests error for $refs that leads to undefined', function () {
    let schema = {$refs: {some: "baseSchema#/notExists"}};
    assert.throw(() => refsResolver(schema, schema, schemaMaps), Error, 'reference "baseSchema#/notExists" leads to undefined value')
  })
})
