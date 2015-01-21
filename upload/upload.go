package upload

import (
  "fmt"
  "net/http"
  "text/template"
)

func GetResource(w http.ResponseWriter, r *http.Request) {
  path := r.URL.Path
  http.ServeFile(w, r, ".." + path)
}

func GetIndex(w http.ResponseWriter, r *http.Request) {
  temp, err := template.ParseFiles("../fileuploader/view/index.html")
  if err != nil {
    fmt.Println("get index err: ", err)
    http.NotFound(w, r)
    return
  }
  temp.Execute(w, nil)
}

//上传接口
func DoUpload(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "good")
}