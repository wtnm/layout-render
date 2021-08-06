import {anyObject, getIn, objKeys, string2path} from "objects-fns";
import {isObject, isString, isUndefined} from "is-fns";
import {merge} from "react-merge";
import memoize from 'memoizee'

const ERR_MESSAGE = 'Only "string" or "{[key:string]: string}" types are allowed for "$refs"';

export const refsResolver = memoize(function (schemaPart, schemaFull, schemasMap: anyObject = {}) {
  if (!schemaPart.$refs) return schemaPart;
  let {$refs, ...result} = schemaPart;
  if (isString($refs)) result = result = merge(result, resolveSingleRef($refs, schemaFull, schemasMap))
  else if (isObject($refs)) objKeys($refs).forEach(key => {
    if (!isString($refs[key])) throw new Error(ERR_MESSAGE);
    let res = resolveSingleRef($refs[key], schemaFull, schemasMap);
    result = merge(result, res, getPathAndReplace(key))
  });
  else throw new Error(ERR_MESSAGE);
  return result;
})


function resolveSingleRef(ref, schemaFull, schemasMap) {
  let refs = ref.split(':');
  let obj2merge = refs.map(ref => {
    let [id, path] = ref.split('#');
    let schema2search = id ? schemasMap[id] : schemaFull;
    if (!schema2search) throw new Error(`schema "${id}" not found`);
    let schema = getIn(schema2search, string2path(path));
    if (isObject(schema))
      schema = refsResolver(schema, schema2search, schemasMap);
    if (isUndefined(schema)) throw new Error(`reference "${ref}" leads to undefined value`)
    return schema;
  })
  return obj2merge.length === 1 ? obj2merge[0] : merge.all(null, obj2merge);
}

export function getPathAndReplace(key) {
  let path: any[] = string2path(key);
  let replace = true
  if (path.length && path[path.length - 1].substr(0, 3) === '...') {
    path.pop();
    replace = false;
  }
  return {path, replace};
}
