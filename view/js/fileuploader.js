(function() {

  var root = this;
  // 配置
  var options = {
    //块大小
    chunkSize: 1 << 20,
    //并发个数，貌似取3效果最好
    concurrence: 3,
    //最多可上传文件数
    maxFiles: undefined,
    //最少文件个数
    minFiles: 1,
    //最小文件大小
    minFileSize: undefined,
    //最大文件大小
    maxFileSize: undefined,
    //支持的文件类型
    fileType: [],
    //产生文件的主键
    getIdentifier: null,
    //上传地址
    server: "",
    //上传前检查，即实现秒传功能
    checkBeforeUpload: false
  };

  var _$ = {

    each: function(o, callback) {
      if (typeof o.length !== "undefined") {
        var l = o.length,
            i;
        for (i = 0; i < l; i++) {
          if (callback(i, o[i]) === false) {
            return;
          }
        }
      } else {
        for (idx in o) {
          if (!o.hasOwnProperty(idx)) {
            continue;
          }
          if (callback(idx, o[idx]) === false) {
            return;
          }
        }
      }
    },
    // 接收不定参数
    extend: function() {
      var res = arguments[0],
          l   = arguments.length,
          i;

      for (i = 1; i < l; i ++) {
        this.each(arguments[i], function(idx, value) {
          res[idx] = value;
        });
      }
      return res;
    },

    // 查找数组中是否包含某一项
    contains: function(arr, item) {
      var res = false;
      each(arr, function(idx, value) {
        if (value === item) {
          res = true;
          // 相当于break
          return false;
        }

      });
      return res;
    },

    // 不对类数组进行处理
    toArray: function(prop) {
      //最靠谱的检查方法
      if (Array.isArray && !Array.isArray(prop)) {
        return [prop];
      }
      if (!(prop instanceof Array)) {
        return [prop];
      }

      return prop;
    },

    // 设置元素属性
    setAttribute: function(domNode, attrs) {
      for (var idx in attrs) {
        if (!attrs.hasOwnProperty(idx)) {
          continue;
        }
        if (idx !== "styles") {
          // 直接设置属性
          domNode.setAttribute(idx, attrs[idx]);
          continue;
        }
        // 解析style属性
        var s_arr = attrs.split(";"),
            pair, l, i;

        for (i = 0, l = s_arr.length; i < l; i ++) {

          pair = s_arr[i].split(":");
          domNode.style[pair[0]] = pair[1];
        }
      }
    },

    //删除元素属性
    removeAttribute: function(domNode, attrs) {
      attrs = this.toArray(attrs);

      this.each(attrs, function(i, attr) {
        domNode.removeAttribute(attr);
      });
    },

    //一个简单的将对象转换成查询字符串的方法
    getQueryUri: function(data) {
      var queryUri = [];
      this.each(data, function(k, v) {
        queryUri.push(k + "=" + v + "&");
      });
      queryUri = queryUri.join("");
      //去掉最后的&
      return queryUri.substring(0, queryUri.length - 1);
    }
  };


  var eventList = [];
  //绑定事件
  function on(eventName, callback) {
    eventList.push({
      name  : eventName,
      handle: callback
    });
  }

  function trigger() {
    var args = Array.prototype.slice.apply(arguments),
        name = args.shift();
  
    _$.each(eventList, function(i, e) {
      // 该事件被注册了
      if (e.name == name) {
        e.handle.apply(root, args);
      }
    });
  }
  //所有的操作都对应底层的块
  function Chunker(opts) {
    //xhr
    this.xhr   = null;
    this.query = opts;
    //重传次数
    this.retryCount = 0;
    //该块是否已经上传成功
    this.success = 0;
  }

  Chunker.prototype = {
    //获取上传的数据
    getUploadData: function() {
      
      var formData = new FormData();
      //遍历query
      _$.each(this.query, function(k, v) {
        formData.append(k, v);
      });

      return formData;
    },

    //判断是不是永久错误
    isPermError: function(status) {
      if ((status >= 500 && status < 600) || status === 404) {
        return true;
      }
      return false;
    },
    //upload
    upload: function(callback) {

      var self = this,
          xhr  = this.xhr;

      xhr = new XMLHttpRequest();
      //事件监听
      xhr.addEventListener("load", function() {
        var status = xhr.status;
        if (status == 200) {
          //当前片上传成功了, 上传下一块
          //之后考虑自定义的错误返回值
          callback();
        } else {
          //判断是否重传
          if (!self.isPermError(status)) {
            self.retry(callback);
          }
        }
      }, false);
      //发生错误，重传
      xhr.addEventListener("error", function() {
        // 直接触发重传吧
        self.retry(callback);
      }, false);

      xhr.upload.addEventListener("process", function() {
        //正在上传
        console.log("uploading");
      }, false);

      xhr.open("post", options.server);
      //构造上传数据
      var formData = this.getUploadData();
      //send
      console.log("上传中");
      xhr.send(formData);
    },
    //重试
    retry: function(callback) {
      if (this.retryCount < 3) {
        this.retryCount++;
        this.upload(callback);
      }
      // 如果重试了3次都没有成功，就直接上传下一块
      callback();
    },
    //取消
    abort: function() {
      if (this.xhr) {
        this.xhr.abort();
      }
    }
  };
  //filer
  function Filer(file) {

    this.file = file;
    this.name = file.fileName || file.name;
    this.size = file.size;
    this.identifier = this.getIdentifier();
    //文件的片
    this.chunks = [];
    //文件状态 0初始状态，1分块完成，2正在上传，3上传完成
    this.status = 0;
  }

  Filer.prototype = {

    constructor: Filer,
    // 分块
    partition: function() {

      console.info("开始分块");
      var chunkSize = options.chunkSize;
      var chunkCount = Math.ceil(this.size / chunkSize);

      var startByte = 0,
          endByte   = 0;

      for (var i = 0; i < chunkCount; i ++) {
        
        startByte = i * chunkSize;
        endByte = Math.min((i + 1) * chunkSize, this.size);

        this.chunks.push(new Chunker(
          {
            size            : this.size,
            file            : this.file.slice(startByte, endByte), // chunk
            name            : this.file.name,
            type            : this.file.type,
            fileIdentifier  : this.identifier,
            chunkCount      : chunkCount,
            chunkIndex      : i,
            lastModifiedDate: this.file.lastModifiedDate
          }
        ));
      }
      //分块完成，修改状态
      if (this.status === 0) {
        this.status = 1;
      }
      /*if (options.checkBeforeUpload) {
        this.checkSended();
      }*/
    },

    //获得唯一键
    getIdentifier: function() {
      var file = this.file;
      var customFunc = options.getIdentifier;
      if (!!customFunc) {
        return customFunc(file);
      }
      //默认的参数主键方式
      var relativePath = file.webkitRelativePath || file.fileName || file.name,
          fileSize     = file.size;
      //过滤特殊符号
      var patten = /[^0-9a-zA-Z_-]/img;
      return "id" + fileSize + "-" + relativePath.replace(patten, '');
    }

  };

  function Uploader(opts) {
    if (!(this instanceof Uploader)) {
      return new Uploader(opts);
    }

    this.opts = options = _$.extend({}, options, opts);
    this.files = [];
    //所有待上传块
    this.chunkList = [];
  }

  Uploader.prototype = {

    constructor: Uploader,
    //注册选择文件按钮
    register: function(domNodes, isDirectory) {
      var self = this;
      domNodes = _$.toArray(domNodes);
      // 遍历
      _$.each(domNodes, function(idx, domNode) {
        var input;
        // 本身就是一个input控件
        if (domNode.tagName.toLowerCase() === "input" && domNode.type === "file") {
          input = domNode;
        } else {
          input = document.createElement("input");
          // 设置属性
          _$.setAttribute(input, {
            type : "file",
            style: "display:none;opacity:0"
          });
          // 点击domNode，触发input点击事件
          domNode.addEventListener("click", function() {
            _$.setAttribute(input, {
              style: "display:block"
            });

            input.focus();
            input.click();

            _$.setAttribute(input, {
              style: "display:none;"
            });
          }, false);

          domNode.appendChild(input);
        }

        var maxFiles = options.maxFiles;

        if (maxFiles === "undefined" || maxFiles != 1) {
          // 支持多文件上传
          _$.setAttribute(input, {
            multiple: "multiple"
          });
        } else {
          // 单文件上传
          _$.removeAttribute(input, "multiple");
        }
        // 如果是一个文件夹
        if (isDirectory) {
          // 设置支持文件夹上传
          _$.setAttribute(input, {
            webkitdirectory: "webkitdirectory"
          });
        } else {
          _$.removeAttribute(input, "webkitdirectory");
        }
        input.addEventListener("change", function(e) {
          // 添加文件
          //接下来是对文件进行过滤
          self.addFiles(e.target.files);
          
        }, false);

      });
    },

    //  将文件添加到待上传文件列表
    addFiles: function(fileList) {
      var self = this;
      // 可以不对按钮进行注册而直接使用该方法
      var opts = this.opts;
      // 先进行文件过滤
      if (opts.maxFiles !== "undefined") {
        
      }
      // 遍历
      _$.each(fileList, function(idx, file) {

        var pair = file.name.split('.');
        var fileName = pair[0],
            fileType = pair[0];
        if (opts.fileType.length > 0 && !_$.contains(opts.fileType, fileType)) {
          //不是一个合法的类型
          //暂时先打个断点吧
          debugger;
        }
        if (opts.minFileSize !== "undefined" && file.size < opts.minFileSize) {
          //文件过小
          debugger;
        }
        if (opts.maxFileSize !== "undefined" && file.size > opts.maxFileSize) {
          debugger;
        }
        //触发添加事件
        trigger("add");
        var f = new Filer(file);
        //如果文件已经存在，则直接跳过
        if (!self.isFileExist(f)) {
          //这个时候说明文件可以被添加到文件列表中
          self.files.push(f);
          
          setTimeout(function() {
            //对文件进行分块
            f.partition();
            _$.each(f.chunks, function(i, chunk) {
              self.chunkList.push(chunk);
            });
          });
        }
      });
    },
    //获取分块
    isFileExist: function(f) {
      var identifier = f.getIdentifier(),
          result     = false;

      _$.each(this.files, function(i, file) {
        if (file.identifier === identifier) {
          result = true;
          //return false;
        }
      });
      return result;
    },

    //处理秒传
    /*checkBeforeUpload: function() {
      
      var chunkList = this.chunkList;
      var data = {
        name            : "",
        identifier      : "",
        type            : "",
        lastModifiedDate: ""
      };
      
      _$.each(this.files, function(idx, file) {
        data.name             += file.name + ",";
        data.type             += file.file.type + ",";
        data.identifier       += file.identifier + ",";
        data.lastModifiedDate += file.file.lastModifiedDate + ",";
      });

      //添加load事件
      var xhr  = new XMLHttpRequest();
      var self = this;

      xhr.addEventListener("load", function() {
        if (xhr.status == 200) {
          //得到一个该文件已经上传了的块编号
          var res = xhr.responseText;
          var sendedData = res.sendedData;
          
          _$.each(this.files, function(idx, file) {

            for (var ) {

            }
            this.chunkList.push();

          });
        }
        
      }, false);

      xhr.open("get", options.server + "?" + _$.getQueryUri(data));
      //发送
      xhr.send(null);
    },*/
    /*checkSended: function() {
      //服务器检查是否有部分文件已经上传了，返回该文件对应已经上传的块
      var self = this;
      var chunkList = this.chunkList;
      //统计出一共有多少片
      var getTotalChunks = function(file, idx) {
        var l = file.chunks.length,
            i;
        for (i = 0; i < l; i ++) {
          if (file.chunks[i].success == 0) {
            chunkList.push(file.chunks[i]);
          }
        }
        if (idx == this.files.length - 1) {
          return 1;
        }
        return 0;
      };

      _$.each(this.files, function(idx, file) {
        //进行合并
        if (options.checkBeforeUpload) {
          // 对每个文件进行一次检查
          file.checkSended(function() {
            if (getTotalChunks(file)) {
              self.trigger("ready");
            }
            // trigger
          });
        } else {
          if (getTotalChunks(file)) {
            self.trigger("ready");
          }
        }
      });
    },*/
    //上传
    upload: function() {
      //按文件依次上传
      if (!options.server) {
        console.warn("server 配置项不能为空");
        return;
      }

      console.info("开始上传");

      var chunkList = this.chunkList;
      //统计出一共有多少片

      var totalCount   = chunkList.length;
      var concurrence  = Math.min(options.concurrence, totalCount);
      var currentChunk = 0;
      // 并发发送
      var sendNextChunk = function() {
        if (currentChunk < totalCount - 1) {

          chunkList[++currentChunk].upload(sendNextChunk);
        }
      }

      console.log(concurrence);
      for (var i = 0; i < concurrence; i ++) {
        currentChunk = i;
        chunkList[i].upload(sendNextChunk);
      }
    },

    //自定义事件
    on: on,
    trigger: trigger
  };

  root.Uploader = Uploader;


}.call(this));