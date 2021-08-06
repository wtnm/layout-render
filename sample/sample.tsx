import * as React from 'react';
import './tacit.min.css'
import {render} from 'react-dom';
import {LayoutType, useLayoutRender} from '../src';
import {useCallback, useState} from "react";
import sleep from "sleep-promise";

const add = ({name = 'a', setState, delta = 1}) => () => {
  setState((state) => ({...state, [name]: (state[name] || 0) + delta}))
}

let schema: LayoutType = {
  $layout: {
    'data-prop': 'test',
    children: [
      {
        children: [
          {$tag: '', $maps: {value: {$: '@/getA'}}}
        ]
      },
      'text',
      '%field',
      {
        $tag: 'button',
        children: ['-'],
        $maps: {onClick: {$: add, args: {setState: '@/setState', name: 'a', delta: -1}}}
      },
      '%more',
      {
        $tag: 'button',
        children: ['+'],
        $maps: {onClick: {$: add, args: {setState: '@/setState', name: 'a'}}}
      },
      {
        children: ['delayed: ', '%delayed']
      }
    ]
  },
  '%field': {
    children: ['value'],
    $maps: {
      'data-mapped': {args: '@/props/value'}
    }
  },
  '%more': {
    $tag: '',
    $maps: {
      'children': {args: '@/state/a'}
    }
  },
  '%delayed': {
    $tag: '',
    children: ["initial"],
    $maps: {
      'children': {
        $: async (v) => {
          await sleep(1000);
          return v * 10
        }, args: '@/state/a'
      }
    }
  }
}

function LayoutRender(props) {
  let [state, setState] = useState({a: 1} as any)
  let getA = useCallback(() => state.a, [state.a]);

  return useLayoutRender({schema, data: {props, state, setState, getA}})
}


if (typeof window != 'undefined') {
  render(<div style={{margin: '1em'}}>
    <LayoutRender value={"prop_1"} more={'more212'}/>
  </div>, document.querySelector('#root'));
}
