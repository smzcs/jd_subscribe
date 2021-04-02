const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: false })

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const getStoreList = () => {
  nightmare
    .goto('https://www.smzdm.com/p/31504456/')
    .inject('js', 'plugin/jquery-3.6.0.min.js')
    .wait('.txt-detail')
    .evaluate(() => {
      const trs = $('tbody tr')
      const length = trs.length
      const trArray = []
      if (length > 1) {
        for (let i = 1; i < trs.length; i++) {
          const tr = $(`tbody tr:eq(${i})`)
          const a = tr.find(`a`)
          const name = a.text()
          const link = a.attr('href')
          const count = tr.find(`td:eq(1)`).text()
          const time = tr.find(`td:eq(2)`).text()
          trArray.push({
            name,
            count: !!count ? parseInt(count) : 0,
            link,
            time
          })
        }
      }
      return trArray
    })
    .end()
    .then(trArray => {
      console.log(trArray)
    })
    .catch(error => {
      console.error('Search failed:', error)
    })
}

getStoreList()
