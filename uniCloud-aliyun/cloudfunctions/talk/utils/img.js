/**
 * @file img 图片画风
 * @description 图片预设风格列表
 * @copyright 采黎
 * @author 小黎
 */

/* todo 携带风格参数 */
const list = [
	/* 新画风 */
	{
		id: 'l-dm',
		type: 'liblib',
		name: '经典动漫',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/dm.png',
		new: true,
		cb: 8,
		style: '',
		top: true,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "bd065cff3a854af2b28659ed0f6d289d", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "1个男孩，一个女孩，面对面，男孩帅气，清纯，穿粉色衬衫，锁骨，女孩绝美，穿白色低胸裙，大胸，敞开的颈线，露出锁骨，皮肤白皙光滑，微笑， 中景，唯美，质感，摄影，面向镜头", // 选填
				"negativePrompt": "(worst quality, low quality),deformed,distorted,disfigured,doll,poorly drawn,bad anatomy,wrong anatomy,EasyNegative,nsfw,right face",
				"sampler": 15, // 采样方法
				"steps": 27, // 采样步数
				"cfgScale": 8, // 提示词引导系数
				"width": 720, // 宽
				"height": 1280, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// additionalNetwork: [],
				// Lora添加，最多5个
				"additionalNetwork": [
					{
						"modelId": "644629084f83410dad0ddfe4475e961d", //LoRA的模型版本versionuuid
						"weight": 0.3 // LoRA权重
					}
				]
			}
		}
	},
	{
		id: 'l-gfmh',
		type: 'liblib',
		name: '古风漫画',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/gfmh.png',
		new: true,
		cb: 8,
		style: '',
		top: false,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "e7e886a13eff410db9f9603b0c7c613b", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "flower,hanfu,night,long hair,hair ornament,lantern,1girl,chinese clothes,bouquet,black hair,holding,sky,hair bun,architecture,long sleeves,looking at another,hair flower,east asian architecture,1boy,night sky,multiple boys,outdoors,wide sleeves,blush,hetero,holding bouquet,couple,blurry,single hair bun,paper lantern,white flower,upper body,", // 选填
				"negativePrompt": "(worst quality, low quality:2),bad anatomy,bad hand,extra hands,extra fingers,too many fingers,fused fingers,bad arm,distorted arm,extra arms,fused arms,extra legs,missing leg,disembodied leg,extra,detached arm,liquid hand,inverted hand,disembodied limb,oversized head,extra body,completely ,(EasyNegativeV2:1.2),(bad and mutated hands:1.3),bad_prompt,(bad hands),(missing fingers),multiple limbs,bad anatomy,(interlocked fingers:1.2),Ugly Fingers,(extra digit and hands and fingers and legs and arms:1.4),(long fingers:1.2),bad-artist,bad hand,extra legs,(ng_deepnegative_v1_75t)", //选填
				"sampler": 15, // 采样方法
				"steps": 27, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 512, // 宽
				"height": 910, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// 高分辨率修复
				"hiResFixInfo": {
					"hiresSteps": 20, // 高分辨率修复的重绘步数
					"hiresDenoisingStrength": 0.4, // 高分辨率修复的重绘幅度
					"upscaler": 10, // 放大算法模型枚举
					"resizedWidth": 720,  // 放大后的宽度
					"resizedHeight": 1280  // 放大后的高度
				}
			}
		}
	},
	{
		id: 'l-gfnz',
		type: 'liblib',
		name: '国风男主',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/gfnz.png',
		new: true,
		cb: 8,
		style: '',
		gender: [1],
		top: true,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "98ded8b178b44b8c9a98556b05cf29f9", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "一个男人，金发碧眼，高冷，长发，金色发箍，中国古代汉服，华丽服装配饰，短裙，中景，脸部特写", // 选填
				"negativePrompt": "ng_deepnegative_v1_75t,(badhandv4:1.2),EasyNegative,(worst quality:2),NSFW,logo,text,worstquality,signature,blurry,low quality,watermark,cropped,bad anatomy,bad proportions,out of focus,lowres,normal quality,username,Multiple people,cross-eyed,malformed hands,missing limb,malformed limbs,bad hands,mutated hands and fingers,floating limbs,missing fingers,disconnected limbs,disfigured,poorly drawn face,long body,bad body,extra limb,fused fingers,too many fingers,extra arms,skin blemishes,(fat:1.2),extra legs,mutated hands,skin spots,deformed,acnes,poorly drawn hands,bad feet,long neck,(fat:1.2),ugly,Bybadartist,bad-hands-5,FastNegativeV2,BadNegAnatomyV1-neg,easynegative,", //选填
				"sampler": 15, // 采样方法
				"steps": 30, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 512, // 宽
				"height": 910, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// Lora添加，最多5个
				"additionalNetwork": [
					{
						"modelId": "0343ad36face4117853a949ef8c761d8", //LoRA的模型版本versionuuid
						"weight": 0.8 // LoRA权重
					}
				],

				// 高分辨率修复
				"hiResFixInfo": {
					"hiresSteps": 20, // 高分辨率修复的重绘步数
					"hiresDenoisingStrength": 0.4, // 高分辨率修复的重绘幅度
					"upscaler": 10, // 放大算法模型枚举
					"resizedWidth": 720,  // 放大后的宽度
					"resizedHeight": 1280  // 放大后的高度
				}
			}
		}
	},
	{
		id: 'l-qcnz',
		type: 'liblib',
		name: '清纯女主',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/qcnz.png',
		new: true,
		cb: 8,
		style: '',
		gender: [2],
		top: false,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "940230c741d84462916c69158e65400c", // 底模 modelVersionUUID 00680e9c066b425ead8edb794cb3d225
				"prompt": "", // 选填
				// "prompt": "一个女孩，紫色蕾丝旗袍，紫色头饰，（包臀超短裙），身材迷人，前凸后翘，半身，妩媚，（大胸），双马尾，正面， 面向镜头，摄像风格，双腿修长，中景，人物特写，坐在床前，温馨房间", // 选填
				"negativePrompt": "missing toes,EasyNegative,blood on face,injury on face,long neck,bright,(monochrome:1.3),(oversaturated:1.3),bad hands,lowers,3d render,cartoon,long body,((blurry)),duplicate,((duplicate body parts)),(disfigured),(poorly drawn),(extra limbs),fused fingers,extra fingers,(twisted),contorted,conjoined,((missing limbs)),logo,signature,text,words,low res,boring,mutated,artifacts,bad art,gross,ugly,poor quality,low quality,nsfw,(EasyNegative:1.2),ng_deepnegative_v1_75t,paintings,sketches,(worst quality:2),(low quality:2),(normal quality:2),lowres,normal quality,((monochrome)),((grayscale)),bad anatomy,(long hair:1.4),DeepNegative,(fat:1.2),facing away,looking away,tilted head,lowres,bad anatomy,bad hands,text,error,missing fingers,extra digit,fewer digits,cropped,worstquality,low quality,normal quality,jpegartifacts,signature,watermark,username,blurry,bad feet,cropped,poorly drawn hands,poorly drawn face,mutation,deformed,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,extra fingers,fewer digits,extra limbs,extra arms,extra legs,malformed limbs,fused fingers,too many fingers,long neck,cross-eyed,mutated hands,polar lowres,bad body,bad proportions,gross proportions,text,error,missing fingers,missing arms,missing legs,extra digi,", //选填
				"sampler": 15, // 采样方法
				"steps": 30, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 512, // 宽
				"height": 910, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// Lora添加，最多5个
				"additionalNetwork": [
					{
						"modelId": "4e6889fb062244a78a2659241362bed4", //LoRA的模型版本versionuuid
						"weight": 0.6 // LoRA权重
					},
					{
						"modelId": "525dca0cc11a4a2d844c17054a5a9b32", // 古风
						"weight": 0.8 // LoRA权重
					},
					{
						"modelId": "969cec30a7de440b8cb58b8743f6764d", //
						"weight": 0.4 // LoRA权重
					}
				],

				// 高分辨率修复
				"hiResFixInfo": {
					"hiresSteps": 20, // 高分辨率修复的重绘步数
					"hiresDenoisingStrength": 0.4, // 高分辨率修复的重绘幅度
					"upscaler": 10, // 放大算法模型枚举
					"resizedWidth": 720,  // 放大后的宽度
					"resizedHeight": 1280  // 放大后的高度
				}
			}
		}
	},
	{
		id: 'l-cyhm',
		type: 'liblib',
		name: '纯欲韩漫',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/cyhm.png',
		new: true,
		cb: 8,
		style: '(best quality), ((masterpiece)), (highres),original, extremely detailed.',
		top: true,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "51c9665415ee43a6a7f808d57bcffc0a", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "(best quality), ((masterpiece)), (highres),original, extremely detailed, 1男孩，男性焦点，衬衫，独奏，蒙眼睛，白衬衫，黑发，躺在床上，有领衬衫，袖子卷起，嘴唇分开，短发，全身，俯视角", // 选填
				"negativePrompt": "sketches, (worst quality:2), (low quality:2), (normal quality:2), lowers, normal quality, ((monochrome)), ((grayscale)), skin spots, acnes, skin blemishes, bad anatomy,DeepNegative,(fat:1.2),facing away, looking away,tilted head, bad anatomy,bad hands, text, error, missing fingers,extra digit, fewer digits, cropped, worst quality, low quality, normal quality,jpeg artifacts,signature, watermark, username,blurry,bad feet,cropped,poorly drawn hands,poorly drawn face,mutation,deformed,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,extra fingers,fewer digits,extra limbs,extra arms,extra legs,malformed limbs,fused fingers,too many fingers,long neck,cross-eyed,mutated hands,bad body,bad proportions,gross proportions,text,error,missing fingers,missing arms,missing legs,extra digit, extra arms, extra leg, extra foot", //选填
				"sampler": 0, // 采样方法
				"steps": 27, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 720, // 宽
				"height": 1280, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启
			}
		}
	},
	{
		id: 'l-ecy',
		type: 'liblib',
		name: '二次元',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/ecy.png',
		new: true,
		cb: 8,
		style: '',
		top: false,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "2f32e43f45134387833cb87fa4122df5", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "1个女孩，短发，猫耳朵，可爱，看向镜头，正面，脸部特写，俯视角", // 选填
				"negativePrompt": "(worst quality, low quality:1.4), (nsfw:1.4), (nsfw:1.4), negative_hand Negative Embedding,verybadimagenegative_v1.3, bad anatomy, bad hands, cropped, missing fingers,too many fingers, missing arms, long neck, Humpbacked, deformed, disfigured, poorly drawn face, distorted face, mutation, mutated, extra limb, ugly, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, out of focus, long body, missing toes, too many toes，monochrome, symbol, text, logo, door frame, window frame, mirror frame", //选填
				"sampler": 29, // 采样方法
				"steps": 25, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 512, // 宽
				"height": 910, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// Lora添加，最多5个
				"additionalNetwork": [
					// {
					// 	"modelId": "fdf09788684a4884b0dbc1d12f0b946e", // 比较暴露
					// 	"weight": 0.4 // LoRA权重
					// },
					{
						"modelId": "33160508bc554fafa175f44dcff44245", //LoRA的模型版本versionuuid
						"weight": 0.6 // LoRA权重
					},
					{
						"modelId": "005de1a15a05489789344bf294a89163", //LoRA的模型版本versionuuid
						"weight": 0.4 // LoRA权重
					}
				],

				// 高分辨率修复
				"hiResFixInfo": {
					"hiresSteps": 20, // 高分辨率修复的重绘步数
					"hiresDenoisingStrength": 0.3, // 高分辨率修复的重绘幅度
					"upscaler": 10, // 放大算法模型枚举
					"resizedWidth": 720,  // 放大后的宽度
					"resizedHeight": 1280  // 放大后的高度
				}
			}
		}
	},
	{
		id: 'l-dsyq',
		type: 'liblib',
		name: '都市言情',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/liblib/dsyq.png',
		new: true,
		cb: 8,
		style: 'on the lawn, HDR,UHD,8K,best quality,masterpiece,Highly detailed,Studio lighting,ultra-fine painting,sharp focus,physically-based rendering, extreme detail description,Professional, masterpiece,best quality,delicate,beautiful.',
		top: true,
		config: {
			"templateUuid": "e10adc3949ba59abbe56e057f20f883e",
			"generateParams": {
				"checkPointId": "4f6a8325a3f0479aadc3fa97ce1cbd6f", // 底模 modelVersionUUID
				"prompt": "", // 选填
				// "prompt": "1个男人，一个女人，躺在沙发上，一脸享受，俯视角。on the lawn, HDR,UHD,8K,best quality,masterpiece,Highly detailed,Studio lighting,ultra-fine painting,sharp focus,physically-based rendering, extreme detail description,Professional, masterpiece,best quality,delicate,beautiful", // 选填
				"negativePrompt": "bad anatomy,(worst quality, low quality:1.4),(depth of field, blur:1.2),(greyscale, monochrome:1.1),3D face,cropped,lowres,text,(worst quality:2),(low quality:2),(normal quality:2),normal quality,((grayscale)),skin spots,acnes,skin blemishes,age spot,(ugly:1.331),(duplicate:1.331),(morbid:1.21),(mutilated:1.21),(tranny:1.331),mutated hands,(poor draw hands:1.5),blur,(bad anatomy:1.21),(bad proportions:1.331),extra limbs,(disfigured:1.331),(missing arms:1.331):1.331),(fused fingers:1.61051),(too many fingers:1.61051),(unclear eyes:1.331),lower,bad hands.missing fingers,extra digit,badbands,missing fingers,(((extra arms and legs))),nsfw,,nsfw", //选填
				"sampler": 0, // 采样方法
				"steps": 30, // 采样步数
				"cfgScale": 7, // 提示词引导系数
				"width": 512, // 宽
				"height": 910, // 高
				"imgCount": 1, // 图片数量
				"randnSource": 0,  // 随机种子生成器 0 cpu，1 Gpu
				"seed": -1, // 随机种子值，-1表示随机
				"restoreFaces": 0,  // 面部修复，0关闭，1开启

				// Lora添加，最多5个
				"additionalNetwork": [
					{
						"modelId": "4e25fd4d979c46be92257100d32367d7", //LoRA的模型版本versionuuid
						"weight": 0.6 // LoRA权重
					},
				],

				// 高分辨率修复
				"hiResFixInfo": {
					"hiresSteps": 20, // 高分辨率修复的重绘步数
					"hiresDenoisingStrength": 0.4, // 高分辨率修复的重绘幅度
					"upscaler": 11, // 放大算法模型枚举
					"resizedWidth": 720,  // 放大后的宽度
					"resizedHeight": 1280  // 放大后的高度
				}
			}
		}
	},

	/* 旧画风 */
	{
		id: 'c-dm',
		type: 'coze',
		name: '动漫',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-dm.png',
		new: false,
		cb: 5,
		style: 'anime style.',
		top: false,
	},
	{
		id: 'c-gf',
		type: 'coze',
		name: '国风',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-gf.png',
		new: false,
		cb: 5,
		style: 'anime,ancient Chinese.',
		top: true,
	},
	{
		id: 'c-sm',
		type: 'coze',
		name: '水墨',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-sm.png',
		new: false,
		cb: 5,
		style: '2d anime,Chinese ink brush.',
		top: false,
	},
	{
		id: 'c-mc',
		type: 'coze',
		name: '萌宠',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-mc.png',
		new: false,
		cb: 5,
		style: 'anime,pet animal.',
		top: true,
	},
	{
		id: 'c-tyrx',
		type: 'coze',
		name: '摄影人像',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-tyrx.png',
		new: false,
		cb: 5,
		style: '',
		top: false,
	},
	{
		id: 'c-sbpk',
		type: 'coze',
		name: '赛博朋克',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-sbpk.png',
		new: false,
		cb: 5,
		style: 'cyberpunk style,anime.',
		top: true,
	},
	{
		id: 'c-jjwl',
		type: 'coze',
		name: '机甲未来',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-jjwl.png',
		new: false,
		cb: 5,
		style: 'Cyberpunk,Mecha, Future,anime.',
		top: false,
	},

]

const imgList = JSON.parse(JSON.stringify(list)).map(item => {
	delete item.type
	delete item.style
	delete item.config

	return item
})

// 将list数组转换为对象，id为数组的key,写在前面
const imgData = list.reduce((obj, current) => ({ ...obj, [current.id]: current }), {})

module.exports = {
	imgList,
	imgData
}
