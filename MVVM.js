const CompileUtil = {
    // 根据表达式取到对应的数据
    getVal(vm, expr) {
        let value = expr.split('.').reduce((data, current) => {
            return data[current];
        }, vm.$data)
        return value;
    },
    setValue(vm, expr, value) {
        let newValue = expr.split('.').reduce((data, current, index, arr) => {
            if(index == arr.length-1) {
                return data[current] = value;
            }
            return data[current];
        }, vm.$data)
        return newValue;
    },
    on(node, expr, vm, eventName) {
        node.addEventListener(eventName, () => {
            vm[expr].call(vm);
        })
    },
    // 解析v-model这个指令
    model(node, expr, vm) {// node是节点 expr是表达式 vm是当前实例
        // 给输入框富裕value属性 node.value = xxx 
        let fn = this.updater['modelUpdater'];
        new Watcher(vm, expr, (newVal) => { // 给输入框加一个观察者，如果稍后数据更新了触发此方法，会拿新值给输入框赋值
            fn(node, newVal);
        })
        node.addEventListener('input', (e) => {
            let value = e.target.value; // 获取用户输入的内容
            this.setValue(vm, expr, value);
        })
        let value = this.getVal(vm, expr)
        fn(node, value);
    },
    html(node, expr, vm) {
        // node.innerHTML = xxx
        let fn = this.updater['htmlUpdater'];
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal)
        });
        let value = this.getVal(vm, expr);
        fn(node, value);
    },
    getContentValue(vm, expr) {
        // 遍历表达式将内容重新特换成一个完整的内容，返回回去
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1]);
        })
    },
    text(node, expr, vm) {
        // this.$el 
        let fn = this.updater['textUpdata'];
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            // 给表达式每个{{}}都加上观察者
            new Watcher(vm, args[1], newVal => {
                fn(node, this.getContentValue(vm, expr)); // 返回了一个全的字符串
            })
            return this.getVal(vm, args[1]);
        });
        fn(node, content);
    },
    updater: {
        // 把数据插入到节点中
        modelUpdater(node, value) {
            node.value = value;
        },
        htmlUpdater(node, value) {
            node.innerHTML = value;
        },
        // 处理文本节点
        textUpdata(node, value) {
            node.textContent = value;
        }
    }
}



// 观察者 （发布订阅）需要把被观察者放啊到观察中去
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 默认先存放一个老值
        this.oldValue = this.get();
    }
    get() {
        Dep.target = this; // 先把自己放在this上
        // 取值 把这个观察者把数据关联起来
        let value = CompileUtil.getVal(this.vm, this.expr);
        Dep.target = null; // 不取消，任何值取值都会添加watcher
        return value;
    }
    // 更新操作或 数据变化后 会调用观察者的updata方法
    update() {
        let newVal = CompileUtil.getVal(this.vm, this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}
// vm.$watch(vm, 'school.name', (newVal) => {

// })
// 订阅发布
class Dep {
    constructor() {
        this.subs = []; // 存放所有的watcher
    }
    // 订阅
    addSub(watcher) { // 添加watcher
        this.subs.push(watcher);
    }
    // 发布
    notify() {
        this.subs.forEach(watcher => watcher.update());
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
            // 如果是对象
            for (let key in data) {
                this.defineReactive(data, key, data[key]);
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value);
        let dep = new Dep(); // 给每个属性都加上一个具有发布订阅的功能
        Object.defineProperty(obj, key, {
            get() {
                // 创建watcher时会取到对应的内容，并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set: (newVal) => {
                if (newVal != value) {
                    this.observer(newVal)
                    value = newVal;
                    dep.notify(); 
                }
            }
        })
    }
}


class Compiler {
    constructor(el, vm) {
        // 判断el属性是不是一个属性，如果不是元素，那就获取它
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // 把当前节点中的元素获取到放到内存中
        let fragment = this.node2fragement(this.el);
        // 把节点中的内容进行替换

        // 编译模板 用数据编译
        this.compile(fragment);
        // 把内容再塞到页面中
        this.el.appendChild(fragment);
    }
    isElementNode(node) { // 判断是不是元素节点
        return node.nodeType === 1;
    }
    // 判断是不是指令
    isDirective(attrName) {
        return attrName.startsWith('v-');
    }
    // 编译元素的
    compilerElement(node) {
        let attributes = node.attributes; // 类数组
        [...attributes].forEach(attr => { // type = "text" v-model = "school.name"
            let {name, value:expr} = attr;
            if(this.isDirective(name)) {
                let [,directive] = name.split('-');
                let [directiveName, eventName] = directive.split(':');
                // 需要根据调用不同的指令来处理
                CompileUtil[directiveName](node, expr, this.vm, eventName);
            }
        })
    }
    // 编译文本的
    compileText(node) { // 当前文本节点中的内容是否包含{{}}
        let content = node.textContent;
         // 判断是不是属性
        if (/\{\{(.+?)\}\}/.test(content)) { // v-model v-html v-bind
            // 文本节点
            CompileUtil['text'](node, content, this.vm); // {{}}
        }
    }
    // 核心的编译方法
    compile(node) { // 用来编译内存中的dom节点
        let childNodes = node.childNodes;
        [...childNodes].forEach(child => { // 类数组转化成数组
            if (this.isElementNode(child)) {
                this.compilerElement(child);
                // 如果是元素的话，需要把自己传进去，再去遍历子节点
                this.compile(child);
            } else {
                this.compileText(child);
            }
        })
    }
    node2fragement(node) {
        // 创建一个文档碎片
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = node.firstChild) {
            // appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
}


// 基类 调度
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;
        // 这个根元素存在 编译模板
        if (this.$el) {
            // 数据劫持 把数据全部转化用Object.defineProperty来定义
            new Observer(this.$data);
            
            for(let key in computed) {  // 有依赖关系 数据
                Object.defineProperty(this.$data, key, {
                    get: () => {
                        return computed[key].call(this.$data);
                    }
                })
            }

            for(let key in methods) {
                Object.defineProperty(this, key, {
                    get() {
                        return methods[key];
                    }
                })
            }
            // 把数据获取操作vm上的取值都代理到vm.$data
            this.proxyVm(this.$data);
            // 编译模板
            new Compiler(this.$el, this);
        } 
    }
    proxyVm(data) {
        // console.log(data)
        for(let key in data) {
            Object.defineProperty(this, key, { 
                get() {
                    return data[key]; // 进行了转化操作
                }
            })
        }
    }
}