package upload

import (
  "fmt"
  "os"
  "io"
  "net/http"
  "io/ioutil"
  "strconv"
  "strings"
  "text/template"
)

func GetResource(w http.ResponseWriter, r *http.Request) {
  path := r.URL.Path
  http.ServeFile(w, r, ".." + path)
}

func GetIndex(w http.ResponseWriter, r *http.Request) {
  temp, err := template.ParseFiles("./view/index.html")
  if err != nil {
    fmt.Println("get index err: ", err)
    http.NotFound(w, r)
    return
  }
  temp.Execute(w, nil)
}

//上传接口
func DoUpload(w http.ResponseWriter, r *http.Request) {
  //拿到上传的图片
  r.ParseMultipartForm(10 << 20)
  file, _, err := r.FormFile("file")
  if err != nil {
    fmt.Println(err)
    fmt.Fprintf(w, `{"res": 1, "mesg": "error"}`)
    return
  }
  defer file.Close()
  //写入临时文件
  tempName  := strings.Join(r.Form["fileIdentifier"], "")
  tempPath  := "./files/temp/" + tempName
  tempIndex := strings.Join(r.Form["chunkIndex"], "")
  tempCount := strings.Join(r.Form["chunkCount"], "")


  err = os.Mkdir(tempPath, 0666)

  if err != nil {
    fmt.Println(err)
    fmt.Fprintf(w, `{"res": 2, "mesg": "error"}`)
    return
  }

  tempType := strings.Join(r.Form["type"], "")
  if tempType == "image/jpeg" {
    tempType = ".jpg"
  } else if tempType == "image/png" {
    tempType = ".png"
  }

  tempFile, err := os.Create(tempPath + "/" + tempIndex + tempName)
  if err != nil {
    fmt.Println(err)
    fmt.Fprintf(w, `{"res": 3, "mesg": "error"}`)
    return
  }
  defer tempFile.Close()
  io.Copy(tempFile, file)


  count, _ := strconv.Atoi(tempCount)
  index, _ := strconv.Atoi(tempIndex)

  if index + 1 == count {
    //最后一块, 读取该文件夹下的所有文件

    //uploadFile, err := os.Create("./files/temp/" + tempName + tempType)

    tempDir, err := os.Open(tempPath)
    if err != nil {
      fmt.Println(err)
      fmt.Fprintf(w, `{"res": 4, "mesg": "error"}`)
      return
    }
    defer tempDir.Close()

    files, err := tempDir.Readdir(0)
    if err != nil {
      fmt.Println(err)
      fmt.Fprintf(w, `{"res": 5, "mesg": "error"}`)
      return
    }
    for _, fi := range files {
      if fi.IsDir() {
        continue
      }
      content, err := ioutil.ReadFile(tempDir.Name() + "/" + fi.Name())
      if err != nil {
        fmt.Println(err)
        fmt.Fprintf(w, `{"res": 6, "mesg": "error"}`)
        return
      }

      err = ioutil.WriteFile("./files/temp/" + tempName + tempType, content, 0666)
      if err != nil {
        fmt.Println(err)
        fmt.Fprintf(w, `{"res": 7, "mesg": "error"}`)
        return
      }
    }
    
  }
  fmt.Fprintf(w, `{"res": 0, "mesg": "ok"}`)

}