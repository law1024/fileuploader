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
    checkBeforeUpload: true,
    //最大重传次数
    maxRetryCount: 3
  };

  //创建3个构造函数
  /*
  * Chunker 块对象
  * Filer 文件对象
  * Uploader 上传组件
  */
  var _ = {
    eventList: [],

    //绑定事件
    on: function(eventName, handle) {
      this.eventList.push({
        name: eventName,
        handle: handle
      });
    },

    //触发事件
    trigger: function() {
      var args = Array.prototype.slice.apply(arguments),
          name = args.shift(),
          res  = true;
      //遍历eventList，如果找到，就执行该eventhandle
      this.each(this.eventList, function(i, item) {
        if (item.name === name) {
          //这就是为什么回调函数的作用域是全局的？
          res = item.handle.apply(root, args);
          return false;
        }
      });
      return res;
    },
    //遍历数组或对象
    each: function(o, callback) {
      if (typeof o.length !== "undefined") {
        for (var i = 0, l = o.length; i < l; i ++) {
          if (callback(i, o[i]) === false) {
            return;
          }
        }
      } else {
        for (var idx in o) {
          if (!o.hasOwnProperty(idx)) {
            continue;
          }
          if (callback(idx, o[idx]) === false) {
            return;
          }
        }
      }
    },

    //将单一的元素转换成数组
    toArray: function(prop) {
      if (Array.isArray && !Array.isArray(prop)) {
        return [prop];
      }
      if (!(prop instanceof Array)) {
        return [prop];
      }
      return prop;
    },
  };

  function Chunker(data) {
    this.data = data;
    this.retryCount = 0;

    var formData = new FormData();

    _.each(data, function(idx, value) {
      formData.append(idx, value);
    });

    this.formData = formData;
  }
  Chunker.prototype = {

    constructor: Chunker,

    //是否是永久性错误
    isPermError: function(status) {
      if ((status >= 500 && status < 600) || status === 404) {
        return true;
      }
      return false;
    },
    //这个地方的callback有点不协调，考虑怎么改
    upload: function(callback) {
      //实质上上是调用了块的上传功能
      var xhr  = new XMLHttpRequest();
      var self = this;
      xhr.addEventListener("error", function() {
        //直接重传
        self.retry(callback);
      }, false);

      xhr.addEventListener("load", function() {

        var status = xhr.status;
        var resp   = xhr.responseText;
        if (status === 200 && _.trigger("checkAccept", resp)) {
          //此处需要支持自定义错误判断
          callback();
        } else {
          //如果不是永久性错误，就重传
          if (!self.isPermError(status)) {
            //重传成功后任需传下一片
            self.retry(callback);
          } else {
            _.trigger("error");
          }
        }
      }, false);

      xhr.upload.addEventListener("process", function() {
        //正在上传
        _.trigger("process");
      }, false);

      xhr.open("post", options.server);
      xhr.send(this.formData);
    },
    //重传
    retry: function(callback) {
      if (this.retryCount < options.maxRetryCount) {
        this.retryCount ++;
        this.upload(callback);
      } else {
        //触发错误
        _.trigger("error");
      }
    }
  };

  function Filer() {

    this.file = file;
    this.name = file.fileName || file.name;
    this.size = file.size;
    this.identifier = this.getIdentifier();
    //文件的片
    this.chunks = [];
  }

  Filer.prototype = {
    constructor: Filer,
    //分块方法
    piecemeal: function() {
      var chunkSize  = options.chunkSize,
          chunkCount = Math.ceil(this.size / chunkSize);

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
          fileSize = file.size;
      //过滤特殊符号
      var patten = /[^0-9a-zA-Z_-]/img;
      return "id" + fileSize + "-" + relativePath.replace(patten, '');
    }
    //文件的upload方法
    upload: function() {

    }  
  };

  function Uploader(opts) {
    if (!(this instanceof Uploader)) {
      return new Uploader(opts);
    }

    this.opts = options = $.extend({}, options, opts);
    this.files = [];
  }

  Uploader.prototype = {

    constructor: Uploader,
    //将一个按钮注册为文件上传按钮
    register: function(domNodes, isDirectory) {

    },
    on: _.on,
    trigger: _.trigger

  };

}.call(this));