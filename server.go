package main

import (
  "os"
  "net/http"
  "strings"
  "./upload"
)

type MyMux struct {}


func (p *MyMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  //路由规则
  path := r.URL.Path

  if path == "/" {
    upload.GetIndex(w, r)
    return
  } else if strings.Index(path, "/view/") > 0 {
    upload.GetResource(w, r)
  } else if path == "/fileuploader/upload/" {
    upload.DoUpload(w, r)
  }
}

func main() {
  var port string

  if len(os.Args) > 1 {
    port = os.Args[1]
  } else {
    port = "8088"
  }
  mux := &MyMux{}
  http.ListenAndServe(":" + port, mux)
}