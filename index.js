const Nightmare = require('nightmare')
const log4js = require('log4js')
const fs = require('fs')
const path = require('path')
const nightmare = Nightmare({ show: false })
const utils = require('./utils')

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const basePath = path.resolve(__dirname, 'bean')
const dataPath = path.resolve(basePath, 'data')
const dbPath = path.resolve(dataPath, 'product.json')
const logPath = path.resolve(basePath, 'log')

log4js.configure(utils.logConfig(logPath, utils.logName))
const logger = log4js.getLogger('LOG')

const createFolder = async () => {
  return await new Promise(resolve => {
    const folders = [basePath, dataPath, logPath]
    for (let folder of folders) {
      if (!fs.existsSync(folder)) {
        logger.info('CREATE FOLDER: ', folder)
        fs.mkdirSync(folder)
      }
    }
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '{"data": []}')
    }
    resolve()
  })
}
const getJsonData = () => {
  const rawdata = fs.readFileSync(dbPath)
  return JSON.parse(rawdata)
}
const saveJsonData = (data) => {
  const dataStr = JSON.stringify(data)
  fs.writeFileSync(dbPath, dataStr)
}
const getStoreList = async () => {
  return await nightmare
    .goto('https://www.smzdm.com/p/31504456/')
    .inject('js', 'plugin/jquery-3.6.0.min.js')
    .wait('.txt-detail')
    .evaluate(() => {
      const trs = $('tbody tr')
      const length = trs.length
      const trArray = []
      if (length > 1) {
        const leftPad = (str, len = 2, charStr = '0') => {
          str = str.toString()
          return new Array(len - str.length + 1).join(charStr,  '') + str
        }
        for (let i = 1; i < trs.length; i++) {
          const tr = $(`tbody tr:eq(${i})`)
          const a = tr.find(`a`)
          const name = a.text()
          const link = a.attr('href')
          const count = tr.find(`td:eq(1)`).text()
          let time = tr.find(`td:eq(2)`).text()
          if (time.length <= 5) {
            const month = leftPad(new Date().getMonth() + 1)
            const day = leftPad(new Date().getDate())
            time = `${month}-${day} ${time}`
          }
          trArray.push({
            name,
            count: !!count ? parseInt(count) : 0,
            link,
            time,
            programAddTime: new Date().getTime()
          })
        }
      }
      return trArray
    })
    .end()
}
const start = async () => {
  await createFolder()
  const list = await getStoreList()
  const savedList = getJsonData()
  const { data } = savedList
  const savedProductssLinks = data.map(p => p.link)
  const newProductssLinks = list.map(p => p.link)
  const willAddProductsLinks = newProductssLinks.filter(l => !savedProductssLinks.includes(l))
  const willAddProducts = list.filter(p => willAddProductsLinks.includes(p.link))
  logger.info('Add new products: ', willAddProducts)
  const notExpiredProducts = data.filter(p => p.programAddTime > utils.newTime() - 1000 * 3600 * 48)
  logger.info('remove expired products: ', data.filter(p => p.programAddTime <= utils.newTime() - 1000 * 3600 * 48))
  saveJsonData({ data: notExpiredProducts.concat(willAddProducts) })
}

start()
