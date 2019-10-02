# MVVM
手写一个简单的vue实现双向数据绑定
### 手写一个简单的vue实现mvvm
**1. 准备两个文件index.html和mvvm.js**
index.html内容如下：

```javascript
<body>
    <div id="app">
        <input type="text" v-model="person.name">
        {{person.name}}
        <div>
            <span>我是{{person.name}}</span>
        </div>
        <div>就是那么任性</div>
        <div>年龄:{{person.age}}</div>
    </div>
</body>
<script src="MVVM.js"></script>
<script>
    let vm = new Vue({
        el: "#app",
        data: {
            person: {
                name: 'jinhong姐',
                age: '保密'
            }
        }
    });
</script>
```
mvvm.js内容如下：

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
    }
}
```
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190930172508764.png)
**2. 实现编译模板部分（解析器） Compiler**
编译模板的主要功能是找出html中的 <b>v-</b> 开头的指令和文本中的 <b>{{}}</b> 然后将其替换成data里面相应的数据。
(1) 在MVVM.js中新建一个class **Compiler**，接收**el**和**Vue实例本身（this）**
(2) 判断基类Vue中el是否存在，存在的话 new 一个Compiler。
**MVVM.js**
```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
}

// 编译工具
const CompilerUtil = {
    // 根据表达式取到对应的数据
    getVal(vm, expr) {
        let value = expr.split('.').reduce((data, current) => {
            return data[current];
        }, vm.$data);
        return value;
    },
    setValue(vm, expr, value) {
        let newValue = expr.split('.').reduce((data, current, index, arr) => {
            if (index == arr.length - 1) {
                return data[current] = value;
            }
            return data[current];
        }, vm.$data)
        return newValue;
    },
    text(node, expr, vm) {
        let fn = this.updater['textUpdater'];
        // 给表达时中的每个{{}}都替换成文本
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1]);
        });
        fn(node, content);
    },
    model(node, expr, vm) {
        let fn = this.updater['modelUpdater'];
        let value = this.getVal(vm, expr);
        node.addEventListener('input', (e) => {
            // 获取用户输入的内容
            let value = e.target.value; 
            this.setValue(vm, expr, value);
        });
        fn(node, value);
    },
    updater: {
        // 处理文本节点
        textUpdater(node, value) {
            node.textContent = value;
        },
        modelUpdater(node, value) {
            node.value = value;
        }
    }
}

class Compiler {
    constructor(el, vm) {
        // 判断el属性是不是一个属性，如果不是元素，那就获取它
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // 把当前节点中的元素获取放到内存中
        let fragment = this.nodefragment(this.el);
        // 把节点中的内容进行替换
        this.compiler(fragment);
        // 把内容从内存再塞到页面中
        this.el.appendChild(fragment);
    }
    // 判断是不是元素节点
    isElementNode(node) {
        return node.nodeType === 1;
    }
    // 将节点放入内存当中
    nodefragment(node) {
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = node.firstChild) {
            // appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    // 编译数据
    compiler(node) {
        // 用来编译内存中的dom节点
        let childNodes = node.childNodes;
        // 类数组转化成数组
        [...childNodes].forEach(child => {
            // 判断是不是元素节点
            if (this.isElementNode(child)) {
                this.compilerElement(child);
                // 如果是元素的话还需要把自己传进去，再去遍历子节点
                this.compiler(child);
            } else {
                this.compilerText(child);
            }
        })
    }
    // 编译元素
    compilerElement(node) {
        let attributes = node.attributes; // 类数组
        [...attributes].forEach(attr => {
            let {name, value:expr} = attr;
            if(this.isDirective(name)) {
                let [, directive] = name.split('-');
                let [directiveName, eventName] = directive.split(':'); // v-model v-bind:xxx
                // 需要根据调用不同的指令来处理
                CompilerUtil[directiveName](node, expr, this.vm, eventName);
            }
        })
    }
    // 判断是不是指令
    isDirective(attrName) {
        return attrName.startsWith('v-');
    }
    // 编译文本
    compilerText(node) {
        let content = node.textContent;
        // 判断当前文本节点是否包含{{}}
        if(/\{\{(.+?)\}\}/.test(content)) {
            CompilerUtil['text'](node, content, this.vm);
        } 
    }
}
```

![在这里插入图片描述](https://img-blog.csdnimg.cn/20190930231826166.png)
**3. 数据劫持（监听器） Observer**
vue的数据劫持是通过Object的defineProperty方法劫持set和get实现的，defineProperty详情可以查看[MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)。

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
}
// 编译工具
const CompilerUtil = {
   ...
}

class Compiler {
    ...
}

// 实现数据劫持的功能
class Observer {
    constructor(data) {
        this.observer(data);
    }
    observer(data) {
        // 如果是对象才观察
        if(data && typeof data == 'object') {
            for (let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value);
        Object.defineProperty(obj, key, {
            get() {
                console.log("get",value)
                return value;
            },
            set: (newVal) => {
                console.log("set",newVal)
                if (newVal != value) {
                    this.observer(newVal);
                    value = newVal;
                }
            }
        })
    }
}

```
![在这里插入图片描述](https://img-blog.csdnimg.cn/201910011602528.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3FxXzM3NDczNjQ1,size_16,color_FFFFFF,t_70)
现在我们已经能对数据的获取和赋值进行监听，我们即将要做的是就是实现视图上的数据发生变化的时候，data里的数据跟着变，和data上的数据变化时，视图上的跟着一起变。
**4. 观察者 Watcher**
Watcher是Observe和Compiler之间的通信桥梁，观察者需要被放入被观察者当中，当数据发生变化的时候，会执行相应观察者中的更新函数和对应Compile中的回调函数。
**MVVM.js**

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
}

// 编译工具
const CompilerUtil = {
    // 根据表达式取到对应的数据
    getVal(vm, expr) {
        ...
    },
    setValue(vm, expr, value) {
        ...
    },
    getContentValue(vm, expr) {
        // 遍历表达式将内容重新特换成一个完整的内容，返回回去
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1]);
        })
    },
    text(node, expr, vm) {
        let fn = this.updater['textUpdater'];
        // 给表达时中的每个{{}}都替换成文本
        // let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        //     return this.getVal(vm, args[1]);
        // });
        // 给表达式每个{{}}都加上观察者
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            new Watcher(vm, args[1], newVal => {
                // 返回了一个全的字符串
                fn(node, this.getContentValue(vm, expr));
            })
            return this.getVal(vm, args[1]);
        })
        fn(node, content);
    },
    model(node, expr, vm) {
        let fn = this.updater['modelUpdater'];
        // 给输入框加一个观察者，如果稍后数据更新了触发此方法，会拿新值给输入框赋值
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal);
        });
        node.addEventListener('input', (e) => {
            // 获取用户输入的内容
            let value = e.target.value; 
            this.setValue(vm, expr, value);
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    updater: {
        ...
    }
}

class Compiler {
    ...
}

// 实现数据劫持的功能
class Observer {
    ...
}

// 观察者 vm是当前实例 exper是数据 cb是回调函数
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 默认先存放一个老值
        this.oldValue = this.get();
    }
    get() {
        let value = CompilerUtil.getVal(this.vm, this.expr);
        return value;
    }
    // 更新操作或数据变化后，会调用观察这的updata方法
    update() {
        let newVal = CompilerUtil.getVal(this.vm, this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}
```

那么观察者 Watcher是怎样知道数据发生了变化呢？这时候就是要靠我们的发布者和订阅者了。
**5. 订阅器 Dep**
订阅器采用发布-订阅设计模式，用来收集观察者Watcher，对Observer和Watcher进行统一管理。

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
}

// 编译工具
const CompilerUtil = {
   ...
}

class Compiler {
   ...
}

// 实现数据劫持的功能
class Observer {
    constructor(data) {
        ...
    }
    observer(data) {
        ...
    }
    defineReactive(obj, key, value) {
        this.observer(value);
        // 给每个属性都加上一个具有发布订阅的功能
        let dep = new Dep();
        Object.defineProperty(obj, key, {
            get() {
                // 创建watcher时会取到对应的内容，并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set: (newVal) => {
                if (newVal != value) {
                    this.observer(newVal);
                    value = newVal;
                    dep.notify();// 通知相应的节点更新
                }
            }
        })
    }
}

// 观察者 vm是当前实例 exper是数据 cb是回调函数
class Watcher {
    constructor(vm, expr, cb) {
        ...
    }
    get() {
        Dep.target = this; // 取值 把这个观察者和数据关联起来
        let value = CompilerUtil.getVal(this.vm, this.expr);
        Dep.target = null; // 不取消，任何值取值都会添加watcher
        return value;
    }
    // 更新操作或数据变化后，会调用观察这的updata方法
    update() {
        ...
    }
}

// 订阅器
class Dep {
    constructor() {
        // 存放所有的watcher
        this.subs = []; 
    }
    // 订阅
    addSub(watcher) {
        // 添加watcher
        this.subs.push(watcher);
    }
    // 发布
    notify() {
        this.subs.forEach(watcher => watcher.update())
    }
}
```

![在这里插入图片描述](https://img-blog.csdnimg.cn/2019100215152289.png)
**6. 代理**
将vm.$data.person.name代理成 vm.person.name的方式

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            // 把数据获取操作vm上的取值都代理到vm.$data
            this.proxyVm(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
    proxyVm(data) {
        for (let key in data) {
            Object.defineProperty(this, key, {
                get() {
                    return data[key]; // 进行了转化操作
                }
            })
        }
    }
}

// 编译工具
const CompilerUtil = {
    ...
}

class Compiler {
    ...
}

// 实现数据劫持的功能
class Observer {
    ...
}

// 观察者 vm是当前实例 exper是数据 cb是回调函数
class Watcher {
    ...
}

// 订阅器
class Dep {
    ...
}

```
![在这里插入图片描述](https://img-blog.csdnimg.cn/20191002152705926.png)
**7. 总结**
实现Vue的双向数据绑定大致可以分为这四个部分。
(1)首先实现一个Compiler解析器，找到dom中的{{}}和v-指令，分别替换成相应的数据。
(2)创建监听器Observer ，使用Object中defineProperty实现数据劫持,监听数据的获取和赋值。
(3)创建观察者Watcher，Watcher有三个参数（vue实例本身，表达式[如：person.name]，相应节点的更新回调函数），在Compiler解析器的v-model，{{}}等获取数据的地方加上观察者Watcher。
(4)创建订阅器，订阅器采用了订阅-发布的设计模式，里面用一个数组来保存所有的观察者，为Observer中的所有数据的设置一个订阅器，当获取数据的时候添加观察者Watcher在数组中，当更改数据时遍历数组中的Watcher通知更新函数更新。
**8. 完整代码**
index.html

```javascript
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>MVVM</title>
</head>
<body>
    <div id="app">
        <input type="text" v-model="person.name">
        {{person.name}}
        <div>
            <span>我是{{person.name}}</span>
        </div>
        <div>就是那么任性</div>
        <div>年龄:{{person.age}}</div>
    </div>
</body>
<script src="MVVM.js"></script>
<script>
    let vm = new Vue({
        el: "#app",
        data: {
            person: {
                name: 'jinhong姐',
                age: '保密'
            }
        }
    });
</script>
</html>
```
MVVM.js

```javascript
// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        // 判断根元素是否存在
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            // 把数据获取操作vm上的取值都代理到vm.$data
            this.proxyVm(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        }
    }
    proxyVm(data) {
        for (let key in data) {
            Object.defineProperty(this, key, {
                get() {
                    return data[key]; // 进行了转化操作
                }
            })
        }
    }
}

// 编译工具
const CompilerUtil = {
    // 根据表达式取到对应的数据
    getVal(vm, expr) {
        let value = expr.split('.').reduce((data, current) => {
            return data[current];
        }, vm.$data);
        return value;
    },
    setValue(vm, expr, value) {
        let newValue = expr.split('.').reduce((data, current, index, arr) => {
            if (index == arr.length - 1) {
                return data[current] = value;
            }
            return data[current];
        }, vm.$data)
        return newValue;
    },
    getContentValue(vm, expr) {
        // 遍历表达式将内容重新特换成一个完整的内容，返回回去
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1]);
        })
    },
    text(node, expr, vm) {
        let fn = this.updater['textUpdater'];
        // 给表达时中的每个{{}}都替换成文本
        // let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        //     return this.getVal(vm, args[1]);
        // });
        // 给表达式每个{{}}都加上观察者
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            new Watcher(vm, args[1], newVal => {
                // 返回了一个全的字符串
                fn(node, this.getContentValue(vm, expr));
            })
            return this.getVal(vm, args[1]);
        })
        fn(node, content);
    },
    model(node, expr, vm) {
        let fn = this.updater['modelUpdater'];
        // 给输入框加一个观察者，如果稍后数据更新了触发此方法，会拿新值给输入框赋值
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal);
        });
        node.addEventListener('input', (e) => {
            // 获取用户输入的内容
            let value = e.target.value; 
            this.setValue(vm, expr, value);
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    updater: {
        // 处理文本节点
        textUpdater(node, value) {
            node.textContent = value;
        },
        modelUpdater(node, value) {
            node.value = value;
        }
    }
}

class Compiler {
    constructor(el, vm) {
        // 判断el属性是不是一个属性，如果不是元素，那就获取它
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // 把当前节点中的元素获取放到内存中
        let fragment = this.nodefragment(this.el);
        // 把节点中的内容进行替换
        this.compiler(fragment);
        // 把内容从内存再塞到页面中
        this.el.appendChild(fragment);
    }
    // 判断是不是元素节点
    isElementNode(node) {
        return node.nodeType === 1;
    }
    // 将节点放入内存当中
    nodefragment(node) {
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = node.firstChild) {
            // appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    // 编译数据
    compiler(node) {
        // 用来编译内存中的dom节点
        let childNodes = node.childNodes;
        // 类数组转化成数组
        [...childNodes].forEach(child => {
            // 判断是不是元素节点
            if (this.isElementNode(child)) {
                this.compilerElement(child);
                // 如果是元素的话还需要把自己传进去，再去遍历子节点
                this.compiler(child);
            } else {
                this.compilerText(child);
            }
        })
    }
    // 编译元素
    compilerElement(node) {
        let attributes = node.attributes; // 类数组
        [...attributes].forEach(attr => {
            let {name, value:expr} = attr;
            if(this.isDirective(name)) {
                let [, directive] = name.split('-');
                let [directiveName, eventName] = directive.split(':'); // v-model v-bind:xxx
                // 需要根据调用不同的指令来处理
                CompilerUtil[directiveName](node, expr, this.vm, eventName);
            }
        })
    }
    // 判断是不是指令
    isDirective(attrName) {
        return attrName.startsWith('v-');
    }
    // 编译文本
    compilerText(node) {
        let content = node.textContent;
        // 判断当前文本节点是否包含{{}}
        if(/\{\{(.+?)\}\}/.test(content)) {
            CompilerUtil['text'](node, content, this.vm);
        } 
    }
}

// 实现数据劫持的功能
class Observer {
    constructor(data) {
        this.observer(data);
    }
    observer(data) {
        // 如果是对象才观察
        if(data && typeof data == 'object') {
            for (let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value);
        // 给每个属性都加上一个具有发布订阅的功能
        let dep = new Dep();
        Object.defineProperty(obj, key, {
            get() {
                // 创建watcher时会取到对应的内容，并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set: (newVal) => {
                if (newVal != value) {
                    this.observer(newVal);
                    value = newVal;
                    dep.notify();// 通知相应的节点更新
                }
            }
        })
    }
}

// 观察者 vm是当前实例 exper是数据 cb是回调函数
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 默认先存放一个老值
        this.oldValue = this.get();
    }
    get() {
        Dep.target = this; // 取值 把这个观察者和数据关联起来
        let value = CompilerUtil.getVal(this.vm, this.expr);
        Dep.target = null; // 不取消，任何值取值都会添加watcher
        return value;
    }
    // 更新操作或数据变化后，会调用观察这的updata方法
    update() {
        let newVal = CompilerUtil.getVal(this.vm, this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}

// 订阅器
class Dep {
    constructor() {
        // 存放所有的watcher
        this.subs = []; 
    }
    // 订阅
    addSub(watcher) {
        // 添加watcher
        this.subs.push(watcher);
    }
    // 发布
    notify() {
        this.subs.forEach(watcher => watcher.update())
    }
}

```
