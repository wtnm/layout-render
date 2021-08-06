export default class ControlledPromise {
  done: boolean = false;
  vals: any[] = [{}, {}];
  resolve: Function;
  reject: Function;
  result: Function;
  isPending: Function;
  isResolved: Function;
  isRejected: Function;

  constructor() {
    let self = this;
    let promise: any = new Promise((resolve, reject) => {
      self.setFunction(0, resolve);
      self.setFunction(1, reject);
    });
    promise.resolve = self.execFunction.bind(self, 0);
    promise.reject = self.execFunction.bind(self, 1);
    promise.isPending = () => !self.done;
    promise.isResolved = () => self.vals[0]['done']; // return undefined if not done, true if resolved, false if rejected
    promise.isRejected = () => self.vals[1]['done'];
    promise.result = () => self.done && self.vals[self.vals[0]['done'] ? 0 : 1]['rest'];
    return promise;
  }

  setFunction(num: 0 | 1, func: any) {
    let vals = this.vals[num];
    vals['func'] = func;
    if (vals['done']) func(...vals['rest'])
  }

  execFunction(num: 0 | 1, ...rest: any[]) {
    if (!this.done) {
      this.done = true;
      let vals = this.vals[num];
      vals['rest'] = rest;
      vals['done'] = true;
      this.vals[1 - num]['done'] = false;
      if (vals['func']) vals['func'](...rest);
    }
  }
}
