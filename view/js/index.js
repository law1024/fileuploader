(function($) {

  var infoList = [
    '或将照片拖到这里，单次最多可选300张',
    '选中1张图片，共<span class="total-size"></span>'
  ];

  var $wrap = $("#upload-wrap");
  
  //可上传的状态
  var status = false;
  
  //达到可上传状态
  function addReadyState() {
    if ($wrap.hasClass("ready")) {
      return;
    }
    $wrap.addClass("ready");
    $wrap.find(".add-button").text("继续添加");
    $wrap.find(".upload-info").html(infoList[1]);
    //修改可上传状态
    status = true;
  }

  function removeReadyState() {
    if (!$wrap.hasClass("ready")) {
      return;
    }
    $wrap.removeClass("ready");
    $wrap.find(".add-button").text("点击选择图片");
    $wrap.find(".upload-info").html(infoList[0]);
  }

  var uploader = new Uploader({
    server: "/fileuploader/upload/"
  });

  uploader.register($(".add-button")[0]);

  uploader.on("add", function() {
    addReadyState();
  });

  //绑定上传事件
  $(".upload-button").on("click", function() {
    if (!status) {
      //没达到状态这个按钮也不会显示
      return;
    }
    uploader.upload();
  });

})(jQuery);