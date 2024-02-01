const clientInfo = { // 模拟clientInfo
  uniPlatform: 'web',
  source: 'client', // 调用来源，不传时默认为 client
  clientIP: '127.0.0.1', // 客户端ip，不传时默认为 127.0.0.1
  userAgent: '', // 客户端ua，不传时默认为 HBuilderX
  uniIdToken: ''
}

getBasicData() // 调用login方法传入参数'name-demo'和'password-demo'