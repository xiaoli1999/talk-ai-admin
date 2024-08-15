const getTalkTextRealValue = (text) => {
	if (!text) return ''

	// 正则表达式匹配中英文括号及其内容（不处理嵌套）
	const regex = /\([^()]*\)|（[^（）]*）/g;
	return text.replace(regex, '');
}

/* 将hex字符串转换为Uint8Array */
const hexToUint8Array = (hex) => {
	let bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
	}
	return bytes;
}

const hexToAudioFile = (hex, name= 'text', type = 'mp3') => {
	// 将Uint8Array转换为Blob
	let byteArray = hexToUint8Array(hex);
	let blob = new Blob([byteArray], { type: `audio/${type}` });

	return new File([blob], `${ name }.${ type }`,  { type: `audio/${type}` })
}

module.exports = {
	getTalkTextRealValue,
	hexToAudioFile
}
