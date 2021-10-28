// noinspection JSUnusedLocalSymbols

import {getIn, objKeys, push2array, setIn, string2path, intoArray} from "objects-fns";
import {isArray, isMergeable, isObject, isPromise, isString, isUndefined} from "is-fns";
import memoize from 'memoizee'

const isMapFn = (arg: any) => isObject(arg) && arg.$;

const normalizeFn = memoize(function (mapFn) {
  function recurseNormalizeArgs(args, track: any[] = []) {
    let single = !isMergeable(args) || !!isMapFn(args);
    if (!isObject(args) || isMapFn(args)) args = intoArray(args)
    let res = isArray(args) ? [] : {};
    let argFns: any[] = [];
    objKeys(args).forEach(k => {
      let arg = args[k];
      let curTrack = track.concat(k)
      if (isString(arg)) {
        arg = arg.replace(/(^|^!)(!!)+@\//i, '$1$2@/');
        if (arg.match(/^{\$\d+}$/))
          argFns.push({type: 'getCallbackArg', num: arg.replace('{$', '').replace('}', ''), track: single ? track : curTrack})
        else if (arg.startsWith('@/'))
          argFns.push({type: 'get', path: string2path(arg.substr(2)), track: single ? track : curTrack})
        else if (arg.startsWith('!@/') || arg.startsWith('!!!@/'))
          argFns.push({type: 'get', not: 1, path: string2path(arg.substr(3)), track: single ? track : curTrack})
        else if (arg.startsWith('!!@/'))
          argFns.push({type: 'get', not: 2, path: string2path(arg.substr(4)), track: single ? track : curTrack})
        res[k] = arg;
      } else if (isMapFn(arg)) {
        Object.assign(arg, recurseNormalizeArgs(arg.args, curTrack))
        argFns.push({type: 'fn', mapFn: arg, path: curTrack, track: single ? track : curTrack});
        res[k] = arg.args;
      } else single ? res = arg : res[k] = arg;
    })
    push2array(normFn.argFns, argFns);
    return {args: res};
  }

  let normFn: any = !isObject(mapFn) ? {args: mapFn} : {...mapFn};
  normFn.argFns = [];
  if (normFn.args) Object.assign(normFn, recurseNormalizeArgs(normFn.args))
  // normFn.argFns.reverse();
  return normFn;
})

function calcArgs(args: any, argFns: any[], opts: any = {}) {
  let res = isUndefined(args) ? args : JSON.parse(JSON.stringify(args));
  let promise;
  let {getData, getCallbackArg, ctx} = opts;
  let pFns = argFns.map(fn => {
    if (fn.type === 'getCallbackArg') {
      let val = getCallbackArg(fn.num);
      res = setIn(res, val, fn.track);
    } else if (fn.type === 'get') {
      let val = getData(fn.path);
      if (fn.not === 1) val = !val;
      if (fn.not === 2) val = !!val;
      res = setIn(res, val, fn.track);
    } else if (fn.type === 'fn') {
      let val = calcFn(fn.mapFn.$, getIn(res, fn.path), opts)
      if (isPromise(val)) {
        if (!promise) promise = true;
        return (async () => {
          val = await val;
          res = setIn(res, val, fn.track);
        })()
      } else {
        res = setIn(res, val, fn.track);
      }
    }
  })
  if (promise) {
    return (async () => {
      await Promise.all(pFns);
      return res;
    })()
  }
  return res;
}

const hasReturn = new RegExp(/(\s|^|;|\(|\)|{|}|\+|-)return(\s|$|;|\(|\)|{|}|\+|-)/, 'g');

function evalStringFn(args, ctx) {
  if (~this.search(hasReturn))
    return eval("()=>{" + this + "}")();
  return eval(this);
}

function calcFn(fns: any, args, opts) {
  let {getData, ctx} = opts;
  fns = intoArray(fns || []);
  let res = args;
  for (let i = 0; i < fns.length; i++) {
    let fn = fns[i];
    if (isString(fn) && fn[0] === '@') fn = getData(string2path(fn));
    let val = fn ? (isString(fn) ? evalStringFn.call(fn, res, ctx) : fn(res, ctx)) : res;
    if (isPromise(val)) {
      return (async () => {
        res = await val;
        for (let j = i + 1; j < fns.length; j++)
          res = await fns[j](res, ctx);
        return res;
      })()
    } else res = val;
  }
  return res;
}

export function processFn(mapFn: any, opts: any = {}) {
  let normMapFn = normalizeFn(mapFn);
  let args = calcArgs(normMapFn.args, normMapFn.argFns, opts);
  if (isPromise(args)) {
    return (async () => {
      args = await args;
      return await calcFn(normMapFn.$, args, opts);
    })()
  }
  return calcFn(normMapFn.$, args, opts);
}
