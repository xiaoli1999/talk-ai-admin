const jwt = require("jsonwebtoken");
const { AppSecret }  = require('../config.js')
	
/**
 * @function createToken 创建token
 * @param { Object } data 需要被加密的内容
 * @param { Object } expiresIn 过期时间
 * @returns { String } token 生成token
 */
const createToken = (data, expiresIn = '30d') => jwt.sign(data, AppSecret, { expiresIn });


/**
 * @function verifyToken 校验token
 * @param { String } token 用户token
 * @returns { String } decode 解密的值
 */
const verifyToken = (token) => jwt.verify(token, AppSecret, (err, decode) => decode || {})

module.exports = {
	createToken,
	verifyToken
}