const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

const debug = false;
const log = (...msg) => {
    if (debug) {
        console.log("---------------------");
        console.log(...msg);
    }
}

class Promise {
    /**
     * 构造函数，立即执行fn
     * @param {(resolve, reject) => void} fn 执行函数
     */
    constructor(fn) {
        // 当前状态
        this.state = PENDING;
        // 终值
        this.value = null;
        // 拒因
        this.reason = null;
        
        // 以下两个队列用来 .then时本promise处于pending状态时，存着回调
        // 成功回调队列
        this.onFulfilledCallbacks = [];
        // 失败回调队列
        this.onRejectedCallbacks = [];


        // 成功参数
        const resolve = value => {
            // 使用macro-task机制(setTimeout),确保onFulfilled异步执行,且在 then 方法被调用的那一轮事件循环之后的新执行栈中执行。
            setTimeout(() => {
                log("resolve被调用:", value);
                if (this.state === PENDING) {
                    this.state = FULFILLED;
                    this.value = value;
                    // 回调队列调用
                    log(this.onFulfilledCallbacks);
                    this.onFulfilledCallbacks.forEach(cb => {
                        log("调用cb");
                        cb(this.value);
                    });
                }
            });
        };

        // 失败参数
        const reject = reason => {
            // 与resolve相似
            setTimeout(() => {
                if (this.state === PENDING) {
                    this.state = REJECTED;
                    this.reason = reason;
                    this.onRejectedCallbacks.map(cb => {
                        cb = cb(this.reason);
                    })
                }
            })
        }


        // 执行
        try {
            fn(resolve, reject);
        } catch(e) {
            reject(e);
        }
    }

    /**
     * 
     * @param {(res) => Promise} onFullfilled 成功回调
     * @param {(e) => Promise} onRejected 失败回调
     */
    then(onFullfilled, onRejected) {
        log(".then被调用");

        // 1.首先,then方法必须返回一个promise对象
        let newPromise;

        // 4.如果 onFulfilled 不是函数且 promise 成功执行， promise2 必须成功执行并返回相同的值
        onFullfilled = typeof onFullfilled === "function" ? onFullfilled : (value => value);
         // 5.如果 onRejected 不是函数且 promise 拒绝执行， promise2 必须拒绝执行并返回相同的据因。
        onRejected = typeof onRejected === "function" ? onRejected : (reason => {throw reason;});

        // 6.不论 当前promise 被 reject 还是被 resolve 时 promise2 都会被 resolve，只有出现异常时才会被 rejected。
        // 由于在接下来的解决过程中需要调用resolve,reject进行处理,处理我们在调用处理过程时,传入参数
        // 检查状态
        log(this.state);
        switch(this.state) {
            case FULFILLED:
                return (newPromise = new Promise((resolve, reject) => {
                    // 要确保为FULFILLED / REJECTED状态后 也要异步执行onFulfilled / onRejected ,这里使用setTimeout
                    setTimeout(() => {
                        try {
                            let x = onFullfilled(this.value);
                            resolveNewPromise(newPromise, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    });
                }));
            case REJECTED:
            // .catch.then
                return (newPromise = new Promise((resolve, reject) => {
                    setTimeout(() => {
                        try {
                            let x = onRejected(this.reason);
                            resolveNewPromise(newPromise, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    })
                }));
            case PENDING:   //  原promise还未执行完，那就把回调加入队列
                return (newPromise = new Promise((resolve, reject) => {
                    // 2.如果 onFulfilled 或者 onRejected 返回一个值 x ，则运行下面的 Promise 解决过程：[[Resolve]](promise2, x)
                    //  3.如果 onFulfilled 或者 onRejected 抛出一个异常 e ，则 promise2 必须拒绝执行，并返回拒因 e
                    this.onFulfilledCallbacks.push(value => {
                        try {
                            let x = onFullfilled(value);
                            resolveNewPromise(newPromise, x, resolve, reject); 
                        } catch (e) {
                            reject(e);
                        }
                    })
                    this.onRejectedCallbacks.push(reason => {
                        try {
                            let x = onRejected(reason);
                            resolveNewPromise(newPromise, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    })
                }));
            default:
                reject(new Error(`promise状态出错:${this.state}`));
        }
    }


    catch(onRejected) {
        this.then(null, onRejected);
    }
    
}

/**
 * 处理新返回的newPromise，将其与在then中得到的返回值进行操作
 * x 返回值可能是对象也可能是一个新的Promise，要区分对待，
 * 如果是promise，要等x被fulfilled之后才能去fulfill newPromise
 * @param {Promise} newPromise 
 * @param {*} x 返回值可能是对象也可能是一个新的Promise，要区分对待
 * @param {(res) => *} resolve newPromise的resolve
 * @param {(e) => *} reject newPromise的reject
 */
function resolveNewPromise(newPromise, x, resolve, reject) {
    log("x is:", x);
    if (newPromise === x) {
        reject(new TypeError("循环引用"));
    } else if (x instanceof Promise) {
        // 如果 x 为 Promise ，则使 newPromise 接受 x 的状态
        // 如果 x 处于等待态， newPromise 需保持为等待态直至 x 被执行或拒绝
        if (x.state === PENDING) {
            x.then(
                y => {
                    // 继续处理新promise与返回值
                    resolveNewPromise(newPromise, y, resolve, reject);
                },
                e => {
                    reject(e);
                }
            )
        } else {
            // 如果 x 处于执行态，用相同的值执行 promise
            // 如果 x 处于拒绝态，用相同的据因拒绝 promise
            x.then(resolve, reject);
        }
    } else if (x && (typeof x === "function" || typeof x === "object")) {
        // 防止多次调用
        let called = false;
        try {
            let then = x.then;
            if (typeof then === "function") {
                // 如果 then 是函数，将 x 作为函数的作用域 this 调用之。
                // 传递两个回调函数作为参数，第一个参数叫做 resolvePromise ，第二个参数叫做 rejectPromise
                // 如果 resolvePromise 和 rejectPromise 均被调用，或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
                then.call(
                    x,
                    res => {
                        if (called) return;
                        called = true;
                        resolveNewPromise(newPromise, res, resolve, reject);
                    },
                    e => {
                        if (called) return;
                        called = true;
                        reject(e);
                    }
                )
            } else {    // 如果then不是函数说明x不是thenable的，直接把x给resolve掉
                resolve(x);
            }
        } catch (e) {
            if (called) return;
            called = true;
            reject(e);
        }
    } else {
        // 如果 x 不为对象或者函数，以 x 为参数执行 promise resolve
        resolve(x);
    }
}

Promise.deferred = function() {
    // 延迟对象
    let defer = {};
    defer.promise = new Promise((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });
    return defer;
  };


module.exports = Promise;