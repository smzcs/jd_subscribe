  const path = require('path')
  const utils = {
    logName: new Date( +new Date() + 8 * 3600 * 1000 ).toJSON().substr(0,19).replace("T"," ").replace(/\s/g, '-').replace(/:/g, '-') + '.log',
    newTime: () => new Date().getTime(),
    logConfig: (logPath, name) => {
      return {
        appenders: {
          file: {
            type: 'file',
            filename: path.resolve(logPath, name),
            maxLogSize: 10 * 1024 * 1024,
            backups: 5,
            compress: true,
            encoding: 'utf-8',
            mode: 0o0640,
            flags: 'w+'
          },
          out: {
            type: 'stdout'
          }
        },
        categories: {
          default: { appenders: ['file', 'out'], level: 'info' },
          LOG: { appenders: ['file', 'out'], level: 'info' }
        }
      }
    }
  }
  
  module.exports = utils