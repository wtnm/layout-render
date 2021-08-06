/** @jsx createElement */
import {createElement, isValidElement, useCallback, useRef, useState} from 'react';
import {isArray, isEqual, isFunction, isMergeable, isObject, isPromise, isString, isUndefined} from 'is-fns'
import {anyObject, getIn, objKeys, objSplit, setIn, string2path} from "objects-fns";
import {merge} from 'react-merge'
import memoize from 'memoizee'
import cxBind from "classnames/bind";
import cxBase from "classnames";
import {processFn} from "./pipeline";
import {getPathAndReplace, refsResolver} from "./refs-resolver";

export type ReactTagType = string | Function;

type MapArgs = any
export type MapFunction = { $: string | Function, args?: MapArgs };

export type FieldNameType = `%${string}`

export type LayoutFieldType = {
  $tag?: ReactTagType
  $maps?: { [key: string]: MapFunction | MapArgs }
  $refs?: string | { [key: string]: string }
  children?: ({ $order?: string[] } | { [key: string]: LayoutFieldType }) | LayoutFieldType[]
  [key: string]: any
} | string | null;

export type LayoutType = {
  $refs?: string | { [key: string]: string }
  $handler?: Function[]
  $layout?: Function | LayoutFieldType | LayoutFieldType[]
  $classnameBind?: anyObject
} | { [key: string]: LayoutFieldType }


const getCx = memoize(function ($classnameBind) {
  if (isObject($classnameBind)) return cxBind.bind($classnameBind);
  return cxBase;
})

function mergeTrack(track: any[], idx: any) {
  if (!track.length) return track;
  let res = track.slice(0, -1);
  res.push(track[track.length - 1] + `/${idx}`);
  return res;
}

function getOrderedKeys(obj: any = {}) {
  if (isArray(obj)) return objKeys(obj);
  let {$order = [], ...rest} = obj;
  let keys: string[] = [];
  let restKeys = new Set(objKeys(rest));
  $order = $order.flat(2);
  $order.forEach((k: any) => {
    if (!isUndefined(rest[k])) keys.push(k);
    restKeys.delete(k)
  });
  restKeys.forEach((k: any) => keys.push(k));
  return keys;
}

function isField(value: any) {
  return isString(value) && value[0] === '%';
}

const replaceLayout = memoize((layoutData: any, $layout: any) => ({...layoutData, $layout}));

function dataChanged(prev, current, map) {
  if (!map) return true
  let res = false
  objKeys(map).forEach((path: any) => {
    if (map[path]) {
      path = string2path(path);
      if (getIn(prev, path) !== getIn(current, path))
        res = true;
    }
  })
  return res;
}

const setCallbackArgs = memoize((mapFn) => {
  if (isObject(mapFn) && !mapFn.args) mapFn = {...mapFn, args: '{$0}'}
  return mapFn
})

const getCallbackFunction = memoize(($callback, getData, key) => (...args) =>
  processFn(setCallbackArgs($callback), {getData: getData(key), getCallbackArg: idx => args[idx]}))

function FieldRender(mainProps) {
  let [state, setState] = useState({});
  let {current} = useRef({req: {}, allReq: {}, props: null} as any);
  let {cx, data, layout, counter, children} = mainProps;
  let {$tag = 'div', $maps, $callbacks, ...props} = layout;

  const getData = useCallback((key) => (path) => {
    let pathKey = path.join('/')
    setIn(current.req, true, key, pathKey);
    current.allReq[pathKey] = true;
    return getIn(current.data, path)
  }, [current]);

  if (current.state && current.state !== state) { // promise update
    props = current.props;
    objKeys(state).forEach(k => {if (current.state[k] !== state[k]) props = merge(props, state[k], getPathAndReplace(k))})
  } else {
    if (current.result && isEqual(layout, current.layout) && isEqual(children, current.children)
      && isEqual(current.data, data) && current.counter === counter && current.cx === cx)
      return current.result;
    let onlyData = isEqual(layout, current.layout) && current.data !== data;
    if (onlyData && current.props && current.counter === counter && current.cx === cx) props = current.props;

    let dataRequired = !(onlyData && current.result && !dataChanged(current.data, data, current.allReq))
    if (!dataRequired && isEqual(children, current.children) && current.counter === counter && current.cx === cx)
      return current.result;

    let prevData = current.data;
    Object.assign(current, mainProps);
    if (!props.key) props.key = counter;

    if (dataRequired) {
      if ($maps) objKeys($maps).forEach(key => {
        if ((key === 'children' || key.startsWith('children/')) && $tag !== '')
          throw new Error('"children" is allowed in $maps only with $tag = ""');
        if (onlyData && !dataChanged(prevData, current.data, current.req[key])) return;
        let res = processFn($maps[key], {getData: getData(key)});
        if (isPromise(res)) {
          props = merge(props, state[key], getPathAndReplace(key));
          (async () => {
            let usedData = current.data;
            res = await res;
            if (!dataChanged(usedData, current.data, current.req[key]))
              setState((prev) => {
                if (prev[key] !== res) return {...prev, [key]: res};
                return prev;
              })
          })()
        } else props = merge(props, res, getPathAndReplace(key));
      })
      if ($callbacks) objKeys($callbacks).forEach(key => {
        if (key === 'children' || key.startsWith('children/'))
          throw new Error('"children" is not allowed in $callbacks');
        if ($maps[key]) console.warn(`Same key "${key}" used for callbacks and maps`)
        let res = getCallbackFunction($callbacks[key], getData, key);
        props = merge(props, res, getPathAndReplace(key));
      })
    }
  }

  current.state = state;
  current.props = props;
  if ($tag === '') return current.result = props.children ?? children ?? null;
  if (isMergeable(props.className)) props = merge(props, cx(props.classNames), {path: ['classNames']});
  return current.result = createElement($tag, props, children)
}

type LayoutProps = {
  schema: LayoutType, data, opts?:
    { isField?: Function, handlerName?: string, schemasMap?: { [key: string]: LayoutType } }
}

export function useLayoutRender(props: LayoutProps) {
  let {schema, data, opts = {}} = props;
  const cx = getCx(schema?.$classnameBind);
  const {current} = useRef({} as any);
  if (current.result && current.schema === schema && isEqual(current.data, data) && isEqual(current.opts, opts))
    return current.result
  Object.assign(current, props)

  let {isField: _isField = isField, handlerName = '$handler', schemasMap = {}} = opts;
  if (isFunction(schema.$layout)) {
    let $layout = schema.$layout(data, schema);
    schema = replaceLayout(schema, $layout);
  }
  schema = refsResolver(schema, schema, schemasMap);

  let [fields, restProps] = objSplit(schema, (k: string) => _isField(k) ? 0 : 1, true);
  let {$layout, [handlerName]: $handler} = restProps;
  if ($layout === null) return null;
  let counter = 0;
  if (!$layout) $layout = objKeys(fields || {});
  let fieldsCount = new Set(objKeys(fields || {}));
  let handlers = getOrderedKeys($handler).map(k => $handler[k]).filter(isFunction);
  let restFields: any = [];
  let restTrack: any;

  function recurseLayout(layout, track: any[] = ['#']) {
    if (_isField(layout)) {
      if (fieldsCount.has(layout)) {
        fieldsCount.delete(layout);
        if (isObject(fields[layout]))
          layout = {'data-field': layout, ...fields[layout]};
        else layout = fields[layout];
      } else return null;
    }
    if (layout == null) return null;
    if (layout === '...') {
      restTrack = track;
      return restFields;
    }
    if (isValidElement(layout) || !isMergeable(layout)) return layout;
    if (isArray(layout)) return layout.map((v, i) => recurseLayout(v, mergeTrack(track, i)));
    layout = refsResolver(layout, schema, schemasMap);
    layout = handlers.reduce((arg: any, fn: any) => fn(arg, schema, track) || arg, layout);

    let {children, ...restLayout} = layout;
    let keys: any = isMergeable(children) ? getOrderedKeys(children) : undefined;
    let processedChildren = keys && keys.map((key: any, i: number) => recurseLayout(children[key], track.concat(i)));

    return createElement(FieldRender, {cx, data, layout: restLayout, counter: counter++, key: counter}, processedChildren);
  }

  let result = recurseLayout($layout);
  if (restTrack)
    [...fieldsCount].forEach((v, i) => restFields.push(recurseLayout(v, mergeTrack(restTrack, i))));
  current.result = result;
  return result
}

export default function (props: LayoutProps) {
  return useLayoutRender(props);
}
