const Nightmare = require('nightmare')
const log4js = require('log4js')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const basePath = path.resolve(__dirname, 'bean')
const dataPath = path.resolve(basePath, 'data')
const dbPath = path.resolve(dataPath, 'product.json')
const logPath = path.resolve(basePath, 'log')
const cookiePath = path.resolve(__dirname, 'cookies.js')

log4js.configure(utils.logConfig(logPath, utils.logName))
const logger = log4js.getLogger('LOG')
const nightmareSettings = {
  show: false,
  waitTimeout: 30000,
  gotoTimeout: 30000,
  loadTimeout: 30000,
  executionTimeout: 30000
}
const sleep = time => new Promise((resolve) => setTimeout(resolve, time))
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
    if (!fs.existsSync(cookiePath)) {
      fs.writeFileSync(cookiePath, '')
    }
    resolve()
  })
}
const getProductData = () => {
  const rawdata = fs.readFileSync(dbPath)
  return JSON.parse(rawdata)
}
const saveProductData = (data) => {
  const dataStr = JSON.stringify(data)
  fs.writeFileSync(dbPath, dataStr)
}
const getStoreList = async () => {
  return await new Nightmare(nightmareSettings)
    .goto('https://www.smzdm.com/p/31504456/')
    .useragent(require('./utils/USER_AGENTS').USER_AGENT)
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
            programAddTime: new Date().getTime(),
            subscribers: []
          })
        }
      }
      return trArray
    })
    .end()
}
const getProductId = async () => {
  const savedList = getProductData()
  const { data } = savedList
  const productsWithoutId = data.filter(d => !d.shopId)
  logger.info('Products with shopId count: ' + productsWithoutId.length)

  const getId = async (product, isAgain = false) => {
    const url = 'https://search.jd.com/Search?keyword=' + product.name
    if (!isAgain) {
      return await new Nightmare(nightmareSettings)
      .goto(url)
      .useragent(require('./utils/USER_AGENTS').USER_AGENT)
      .inject('js', 'plugin/jquery-3.6.0.min.js')
      .wait('.shop-name')
      .evaluate(() => {
        const link = $('.shop-name a').attr('href')
        return parseInt(link.match(/index-(.+?).html/)[1])
      })
      .end()
    }
    return await new Nightmare(nightmareSettings)
      .goto(url)
      .useragent(require('./utils/USER_AGENTS').USER_AGENT)
      .inject('js', 'plugin/jquery-3.6.0.min.js')
      .wait('.curr-shop.hd-shopname')
      .evaluate(() => {
        const link = $('.J_im_icon:eq(0) a').attr('href')
        return parseInt(link.match(/index-(.+?).html/)[1])
      })
      .end()
  }
  for (let i = 0; i < productsWithoutId.length; i++) {
    const setShopId = (i, id) => {
      productsWithoutId[i].shopId = id
      logger.info(i + 1, '. ', productsWithoutId[i].name, ' shopId: ', productsWithoutId[i].shopId)
    }
    try {
      const id = await getId(productsWithoutId[i])
      setShopId(i, id)
    } catch(e){
      logger.error(e)
      try {
        const id = await getId(productsWithoutId[i], true)
        setShopId(i, id)
      } catch(e){
        logger.error(e)
        continue
      }
      continue
    }
    await sleep(parseInt(Math.random() * (60 + 1), 10))
  }
  saveProductData({ data })
}
const pullProducts = async () => {
  await createFolder()
  const list = await getStoreList()
  const savedList = getProductData()
  const { data } = savedList
  const savedProductssLinks = data.map(p => p.link)
  const newProductssLinks = list.map(p => p.link)
  const willAddProductsLinks = newProductssLinks.filter(l => !savedProductssLinks.includes(l))
  const willAddProducts = list.filter(p => willAddProductsLinks.includes(p.link))
  logger.info('Add new products: ', willAddProducts)
  const notExpiredProducts = data.filter(p => p.programAddTime > utils.newTime() - 1000 * 3600 * 48)
  logger.info('Remove expired products: ', data.filter(p => p.programAddTime <= utils.newTime() - 1000 * 3600 * 48))
  saveProductData({ data: notExpiredProducts.concat(willAddProducts) })
  await getProductId()
}

const getCookies = () => {
  // const cookiesString = fs.readFileSync(cookiePath)
  // const cookiePureInfo = cookiesString.replaceAll('&', '')
  // const cookieLines = cookiePureInfo.split('\n')
  // const cookies = cookieLines.map(ck => {
  //   const pt_pin = ck.match(/pt_pin=(.+?);/)[1]
  //   const pt_key = ck.match(/pt_key=(.+?);/)[1]
  //   return {
  //     pt_pin,
  //     pt_key
  //   }
  // })
  // return cookies
}
const startSubscription = async () => {
  // const cookies = getCookies()
  // const savedList = getProductData()
  // const { data } = savedList
  // for (const cookie of cookies) {
  //   const cookieObject = cookie
  //   for (const product of data) {
  //     const {
  //       name,
  //       count,
  //       link,
  //       time,
  //       programAddTime,
  //       subscribers
  //     } = product
  //     await nightmare
  //     .goto('https://www.smzdm.com/p/31504456/')
  //     .cookies.set([{
  //       name: 'pt_pin',
  //       value: cookie.pt_pin
  //     },{
  //       name: 'pt_key',
  //       value: cookie.pt_key
  //     }])
  //     .inject('js', 'plugin/jquery-3.6.0.min.js')
  //     .wait('.txt-detail')
  
  //   }
  // }
}


pullProducts()
