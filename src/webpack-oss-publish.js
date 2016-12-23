import http from 'http'
import https from 'https'
import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import oss from 'ali-oss'
import co from 'co'
import readDir from 'recursive-readdir'

// 忽略掉文件中.DS_Store
const uploadIgnores = [
  '.DS_Store'
]

const requiredOssOpts = ['region', 'accessKeyId', 'accessKeySecret', 'bucket']
const pathSep = path.sep
const ossPathSep = '/'
const DEFAULT_TRANSFORM = (item) => Promise.resolve(item)

const addTrailingOSSSep = fPath => {
  return fPath ? fPath.replace(/\/?(\?|#|$)/, '/$1') : fPath
}

const addSeperatorToPath = (fPath) => {
  if (!fPath) {
    return fPath
  }

  return _.endsWith(fPath, pathSep) ? fPath : fPath + pathSep
}

const translatePathFromFiles = (rootPath) => {
  return files => {
    return _.map(files, file => {
      return {
        path: file,
        name: file
          .replace(rootPath, '')
          .split(pathSep)
          .join(ossPathSep)
      }
    })
  }
}

const getDirectoryFilesRecursive = (dir, ignores = []) => {
  return new Promise((resolve, reject) => {
    readDir(dir, ignores, (err, files) => err ? reject(err) : resolve(files))
  })
    .then(translatePathFromFiles(dir))
}

http.globalAgent.maxSockets = https.globalAgent.maxSockets = 50

const compileError = (compilation, error) => {
  compilation.errors.push(new Error(error))
}

module.exports = class OSSPlugin {
  constructor(options = {}) {
    var {
      include,
      exclude,
      basePath,
      directory,
      basePathTransform = DEFAULT_TRANSFORM,
      ossOptions = {},
      ossUploadOptions = {},
    } = options

    this.uploadOptions = ossUploadOptions
    this.isConnected = false
    this.basePathTransform = basePathTransform
    basePath = basePath ? addTrailingOSSSep(basePath) : ''

    this.options = {
      directory,
      include,
      exclude,
      basePath,
    }

    this.clientConfig = ossOptions
  }

  apply(compiler) {
    const isDirectoryUpload = !!this.options.directory
    const hasRequiredOptions = _.every(requiredOssOpts, type => this.clientConfig[type])

    this.options.directory = this.options.directory ||
      compiler.options.output.path ||
      compiler.options.output.context ||
      '.'

    compiler.plugin('after-emit', (compilation, cb) => {
      var error

      if (!hasRequiredOptions) {
        error = `OSSPlugin: Must provide ${requiredOssOpts.join(', ')}`
      }

      if (error) {
        compileError(compilation, error)
        cb()
      }

      this.connect()

      if (isDirectoryUpload) {
        this.fs = fs

        let dPath = addSeperatorToPath(this.options.directory)

        this.getAllFilesRecursive(dPath)
          .then((files) => this.handleFiles(files, cb))
          .then(() => cb())
          .catch(e => this.handleErrors(e, compilation, cb))
      } else {
        this.fs = compiler.outputFileSystem.createReadStream ? compiler.outputFileSystem : fs

        this.getAssetFiles(compilation)
          .then((files) => this.handleFiles(files))
          .then(() => cb())
          .catch(e => this.handleErrors(e, compilation, cb))
      }
    })
  }

  handleFiles(files) {
    return Promise.resolve(files)
      .then((files) => this.filterAllowedFiles(files))
      .then((files) => this.uploadFiles(files))
  }

  handleErrors(error, compilation, cb) {
    compileError(compilation, `OSSPlugin: ${error}`)
    cb()
  }

  getAllFilesRecursive(fPath) {
    return getDirectoryFilesRecursive(fPath)
  }

  addPathToFiles(files, fPath) {
    return files.map(file => ({name: file, path: path.resolve(fPath, file)}))
  }

  getFileName(file = '') {
    if (_.includes(file, pathSep))
      return file.substring(_.lastIndexOf(file, pathSep) + 1)
    else
      return file
  }

  getAssetFiles({assets}) {
    const files = _.map(assets, (value, name) => ({name, path: value.existsAt}))
    return Promise.resolve(files)
  }

  filterAllowedFiles(files) {
    return files.reduce((res, file) => {
      if (this.isIncludeAndNotExclude(file.name) && !this.isIgnoredFile(file.name)) {
        res.push(file)
      }
      return res
    }, [])
  }

  isIgnoredFile(file) {
    return _.some(uploadIgnores, ignore => new RegExp(ignore).test(file))
  }

  isIncludeAndNotExclude(file) {
    var isExclude,
        isInclude,
        {include, exclude} = this.options
    isInclude = include ? include.test(file) : true
    isExclude = exclude ? exclude.test(file) : false

    return isInclude && !isExclude
  }

  connect() {
    if (this.isConnected) {
      return
    }

    this.client = oss(this.clientConfig)
    this.isConnected = true
  }

  transformBasePath() {
    return Promise.resolve(this.basePathTransform(this.options.basePath))
      .then(addTrailingOSSSep)
      .then(nPath => this.options.basePath = nPath)
  }

  uploadFiles(files = []) {
    return this.transformBasePath()
      .then(() => {
        return Promise.all(files.map(file => {
          return this.uploadFile(file.name, file.path)
            .then(() => {
              console.log(`${file.path} uploaded to ${file.name}`)
            })
        }))
      })
  }

  uploadFile(fileName, file) {
    const Key = this.options.basePath + fileName
    const ossParams = _.mapValues(this.uploadOptions, (optionConfig) => {
      return _.isFunction(optionConfig) ? optionConfig(fileName, file) : optionConfig
    })
    return co(this.client.putStream(Key, this.fs.createReadStream(file), ossParams))
  }
}
