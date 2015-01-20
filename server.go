package main

import (
  "os"
  "fmt"
  "net/http"
)

type MyMux struct {}

func sayHi(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "hello world")
}

func (p *MyMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  //路由规则
  if r.URL.Path == "/" {
    sayHi(w, r)
    return
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