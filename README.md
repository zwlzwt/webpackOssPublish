### webpack打包传静态文件到oss

##### 加载模块
```javascript
const ossPluginPublish = require('webpackOssPublish');
```

##### 不包含文件
```javascript
var config = {
  plugins: [
    new OSSPlugin({
      // Exclude uploading of html
      exclude: /.*\.html$/,
      // ossOptions are required
      ossOptions: {
        accessKeyId: process.env.OSS_ACCESS_KEY,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        region: 'oss-cn-shanghai',
        bucket: process.env.OSS_BUCKET,
      },
      ossUploadOptions: {
      }
    })
  ]
}
```

##### 包含文件
```javascript
var config = {
  plugins: [
    new S3Plugin({
      // Only upload css and js
      include: /.*\.(css|js)/,
      // ossOptions are required
      ossOptions: {
        accessKeyId: process.env.OSS_ACCESS_KEY,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        region: 'oss-cn-shanghai',
        bucket: process.env.OSS_BUCKET,
      },
      ossUploadOptions: {
      }
    })
  ]
}
```

#####  example
```javascript
var config = {
  plugins: [
    new OSSPlugin({
      ossOptions: {
        accessKeyId: process.env.OSS_ACCESS_KEY,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        region: 'oss-cn-shanghai',
        bucket: process.env.OSS_BUCKET,
      },
      ossUploadOptions: {
        headers(fileName) {
          return {
            'Cache-Control': 'max-age=31536000'
          };
        },
      }
    })
  ]
}
```

### Options

- `exclude`: 正则表达式不包含文件
- `include`: 正则表达式包含文件
- `ossOptions`: 配置文件 [ossConfig](https://github.com/ali-sdk/ali-oss#ossoptions)
- `ossUploadOptions`: put方法 [put](https://github.com/ali-sdk/ali-oss#putname-file-options)
- `basePath`: oss路径配置
- `basePathTransform`: 可以配置一个文件夹名做为路径
