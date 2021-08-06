// set env variable to the `tsconfig.json` path before loading mocha (default: './tsconfig.json')

process.env.TS_NODE_PROJECT = './tsconfig.json';

require('ts-mocha');
const {getIn} = require('objects-fns');
const {expect} = require('chai');
const sleep = require('sleep-promise');
const {processFn} = require('../src/pipeline');

describe('test processFn', function () {
  it('tests single function with simple args', function () {
    let mapFn = {$: (value) => value + 2, args: 5}
    let res = processFn(mapFn);
    expect(res).to.be.equal(7);
  })

  it('tests single text with return function with simple args', function () {
    let mapFn = {$: "args++; return args + 2;", args: 5}
    let res = processFn(mapFn);
    expect(res).to.be.equal(8);
  })

  it('tests single text without return function with simple args', function () {
    let mapFn = {$: "args++; args + 2;", args: 5}
    let res = processFn(mapFn);
    expect(res).to.be.equal(8);
  })

  it('tests 2 functions with simple args', function () {
    let mapFn = {$: [(value) => ({value: value + 3}), ({value}) => value + 2], args: 5}

    let res = processFn(mapFn);
    expect(res).to.be.equal(10);
  })

  it('tests single function with array args', function () {
    let mapFn = {$: (value) => value[0] + value[1], args: [5, 3]}
    let res = processFn(mapFn);
    expect(res).to.be.equal(8);
  })
  it('tests 2 functions function with object args', function () {
    let mapFn = {$: [(value) => ({value: value.a + value.b, ...value}), (value) => value.value + value.c], args: {a: 5, b: 2, c: 4}}
    let res = processFn(mapFn);
    expect(res).to.be.equal(11);
  })

  it('tests single function with requested args', function () {
    let mapFn = {$: (value) => value + 3, args: '@/d'}
    let dataObj = {d: 3}
    let res = processFn(mapFn, {getData: (path) => getIn(dataObj, path)});
    expect(res).to.be.equal(6);
  })

  it('tests single function with requested object args', function () {
    let mapFn = {$: (value) => value.a + 2, args: {a: '@/d'}}
    let dataObj = {d: 3}
    let res = processFn(mapFn, {getData: (path) => getIn(dataObj, path)});
    expect(res).to.be.equal(5);
  })

  it('tests single function with calculated object args', function () {
    let mapFn = {$: (value) => value + 4, args: {$: (v) => v + 1, args: '@/d'}}
    let dataObj = {d: 3}
    let res = processFn(mapFn, {getData: (path) => getIn(dataObj, path)});
    expect(res).to.be.equal(8);
  })


  it('tests single promise function with simple args', async function () {
    let mapFn = {
      $: async (value) => {
        await sleep(10);
        return value + 2
      }, args: 5
    }
    let res = await processFn(mapFn);
    expect(res).to.be.equal(7);
  })

  it('tests 2 promise functions with simple args', async function () {
    let mapFn = {
      $: [async (value) => {
        await sleep(10);
        return value + 2
      }, async (value) => {
        await sleep(10);
        return value + 3
      }], args: 5
    }
    let res = await processFn(mapFn);
    expect(res).to.be.equal(10);
  })

  it('tests single function with calculated promise object args', async function () {
    let mapFn = {$: (value) => value + 4, args: {$: async (v) => v + 1, args: '@/d'}}
    let dataObj = {d: 3}
    let res = await processFn(mapFn, {getData: (path) => getIn(dataObj, path)});
    expect(res).to.be.equal(8);
  })

  it('tests single promise function with calculated promise object args', async function () {
    let mapFn = {$: async (value) => value + 4, args: {$: async (v) => v + 1, args: '@/d'}}
    let dataObj = {d: 3}
    let res = await processFn(mapFn, {getData: (path) => getIn(dataObj, path)});
    expect(res).to.be.equal(8);
  })

})
