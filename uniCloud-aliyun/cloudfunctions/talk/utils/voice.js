/**
 * @file voice 音色配置
 * @description 音色列表、版本号
 * @copyright 采黎
 * @author 小黎
 */

const manList = [
	/**
	 * 青年-正常
	 */
	{
		"id": "Bingjiao_zongcai_platform",
		"name": "霸道严主",
		"tag": [
			"男",
			"青年",
			"严主"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/霸道严主.wav",
		"cb": 1,
		"text": "跪好了，知道错了吗？"
	},
	{
		"id": "male-qn-badao-jingpin",
		"name": "温柔严主",
		"tag": [
			"男",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔严主.wav",
		"cb": 1,
		"text": "这个力度怎么样"
	},
	{
		"id": "audiobook_male_1",
		"name": "温柔男主",
		"tag": [
			"男",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔男主.wav",
		"cb": 1,
		"text": "下次还敢吗"
	},
	{
		"id": "male-qn-qingse",
		"name": "青涩学弟",
		"tag": [
			"男",
			"青年",
			"羞涩",
			"学弟"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/青涩学弟.wav",
		"cb": 1,
		"text": "学姐，我是新入学的大一新生。"
	},
	{
		"id": "male-qn-jingying",
		"name": "精英上司",
		"tag": [
			"男",
			"青年",
			"青涩"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/精英上司.wav",
		"cb": 1,
		"text": "一会来我办公室，我有事问你。"
	},
	{
		"id": "male-qn-badao",
		"name": "霸道主人",
		"tag": [
			"男",
			"青年",
			"霸道"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/霸道主人.wav",
		"cb": 1,
		"text": "跪好了，下次还敢吗？"
	},
	{
		"id": "male-qn-daxuesheng",
		"name": "大学男友",
		"tag": [
			"男",
			"青年",
			"男大"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/大学男友.wav",
		"cb": 1,
		"text": "宝宝，我想你了！"
	},
	{
		"id": "badao_zongcai",
		"name": "霸道总裁",
		"tag": [
			"男",
			"青年",
			"傲慢"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/霸道总裁.wav",
		"cb": 1,
		"text": "别忘了，你的一切都在我的掌控中。"
	},
	{
		"id": "bingjiao_gege",
		"name": "病娇哥哥",
		"tag": [
			"男",
			"青年",
			"病娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病娇哥哥.wav",
		"cb": 1,
		"text": "妹妹，哥哥只有你了！"
	},
	{
		"id": "bingjiao_huangdi",
		"name": "病娇皇帝",
		"tag": [
			"男",
			"青年",
			"病娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病娇皇帝.wav",
		"cb": 1,
		"text": "你只能是朕的，知道吗？"
	},
	{
		"id": "bingjiao_zongcai",
		"name": "病娇总裁",
		"tag": [
			"男",
			"青年",
			"病娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病娇总裁.wav",
		"cb": 1,
		"text": "我盯上你了，你跑不掉的！"
	},
	{
		"id": "bingruo_gongzi",
		"name": "病弱公子",
		"tag": [
			"男",
			"青年",
			"病娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病弱公子.wav",
		"cb": 1,
		"text": "我...我对你有种特别的感觉。"
	},
	{
		"id": "bingjiao_didi",
		"name": "病娇弟弟",
		"tag": [
			"男",
			"青年",
			"傲娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病娇弟弟.wav",
		"cb": 1,
		"text": "姐姐，别丢下我一个人！"
	},
	{
		"id": "zhinen_naigou",
		"name": "稚嫩奶狗",
		"tag": [
			"男",
			"青年",
			"懵懂"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/稚嫩奶狗.wav",
		"cb": 1,
		"text": "你好呀，我们能做朋友吗？"
	},
	{
		"id": "dongman_baobao",
		"name": "海绵宝宝",
		"tag": [
			"男",
			"青年",
			"可爱"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/海绵宝宝.wav",
		"cb": 1,
		"text": "嘿嘿，你想一起玩耍吗？"
	},
	{
		"id": "zhichang_jingli",
		"name": "职场经理",
		"tag": [
			"男",
			"青年",
			"成熟"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/职场经理.wav",
		"cb": 1,
		"text": "女士让我们谈谈工作计划吧。"
	},
	{
		"id": "wenshun_didi",
		"name": "温顺弟弟",
		"tag": [
			"男",
			"青年",
			"青涩"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温顺弟弟.wav",
		"cb": 1,
		"text": "姐姐，我可以帮你吗？"
	},
	{
		"id": "zhinen_xuesheng",
		"name": "稚嫩学生",
		"tag": [
			"男",
			"青年",
			"单纯"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/稚嫩学生.wav",
		"cb": 1,
		"text": "老师，我有个问题请教您。"
	},
	{
		"id": "qiongyao_nanzhu",
		"name": "琼瑶男主",
		"tag": [
			"男",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/琼瑶男主.wav",
		"cb": 1,
		"text": "我愿为你倾尽所有温柔。"
	},
	{
		"id": "huoli_gege",
		"name": "活力哥哥",
		"tag": [
			"男",
			"青年",
			"朝气"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/活力哥哥.wav",
		"cb": 1,
		"text": "来呀，一起做点有趣的事！"
	},
	{
		"id": "xueba_tongzhuo",
		"name": "学霸同桌",
		"tag": [
			"男",
			"青年",
			"自信"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/学霸同桌.wav",
		"cb": 1,
		"text": "笨蛋，这道题应该这么解！"
	},
	{
		"id": "tiexin_nanyou",
		"name": "贴心男友",
		"tag": [
			"男",
			"青年",
			"磁性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/贴心男友.wav",
		"cb": 1,
		"text": "宝宝，没弄疼你吧。"
	},
	{
		"id": "xiaoyao_jianxian",
		"name": "逍遥剑仙",
		"tag": [
			"男",
			"青年",
			"悠哉"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/逍遥剑仙.wav",
		"cb": 1,
		"text": "无忧无虑，且看我随风而行。"
	},
	{
		"id": "guao_gongzi",
		"name": "孤傲公子",
		"tag": [
			"男",
			"青年",
			"清高"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/孤傲公子.wav",
		"cb": 1,
		"text": "我的世界，容不下他人的目光。"
	},
	{
		"id": "ruya_zongcai",
		"name": "儒雅总裁",
		"tag": [
			"男",
			"青年",
			"斯文"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/儒雅总裁.wav",
		"cb": 1,
		"text": "别怕，我就是你最坚实的依靠。"
	},
	{
		"id": "Male_botong_platform",
		"name": "儒雅先生",
		"tag": [
			"男",
			"青年",
			"儒雅"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/儒雅先生.wav",
		"cb": 1,
		"text": "你相信我吗"
	},
	{
		"id": "Boyan_new_platform",
		"name": "暖男学长",
		"tag": [
			"男",
			"青年",
			"暖男"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/暖男学长.wav",
		"cb": 1,
		"text": "需要我教你吗"
	},
	{
		"id": "Xiaoyi_mix_platform",
		"name": "精英男主",
		"tag": [
			"男",
			"青年",
			"精英"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/精英男主.wav",
		"cb": 1,
		"text": "你的事就是我的事"
	},
	{
		"id": "Male_kongchen_platform",
		"name": "贴心哥哥",
		"tag": [
			"男",
			"青年",
			"贴心"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/贴心哥哥.wav",
		"cb": 1,
		"text": "我给你买了小蛋糕"
	},
	{
		"id": "Male_zeyang_platform",
		"name": "精英学长",
		"tag": [
			"男",
			"青年",
			"学长"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/精英学长.wav",
		"cb": 1,
		"text": "站在原地乖乖等我"
	},
	{
		"id": "Male_zhaoyi_platform",
		"name": "开朗学弟",
		"tag": [
			"男",
			"青年",
			"开朗"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/开朗学弟.wav",
		"cb": 1,
		"text": "你有什么烦心事吗"
	},
	{
		"id": "male-qn-qingse-jingpin",
		"name": "青涩书生",
		"tag": [
			"男",
			"青年",
			"青涩"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/青涩书生.wav",
		"cb": 1,
		"text": "你...可以帮我个忙吗"
	},
	{
		"id": "male-qn-jingying-jingpin",
		"name": "空降上司",
		"tag": [
			"男",
			"青年",
			"精英"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/空降上司.wav",
		"cb": 1,
		"text": "我是你们新的领导"
	},
	{
		"id": "male-qn-daxuesheng-jingpin",
		"name": "青涩男大",
		"tag": [
			"男",
			"青年",
			"青涩"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/青涩男大.wav",
		"cb": 1,
		"text": "我们一起去自习吧"
	},
	{
		"id": "wenrou_yisheng",
		"name": "温柔医生",
		"tag": [
			"男",
			"青年",
			"随和"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔医生.wav",
		"cb": 1,
		"text": "放心，我会温柔地照顾你。"
	},
	{
		"id": "badao_shangsi",
		"name": "冷峻上司",
		"tag": [
			"男",
			"青年",
			"冷漠"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/冷峻上司.wav",
		"cb": 1,
		"text": "工作效率是我唯一关心的事。"
	},
	{
		"id": "chongni_nanyou",
		"name": "宠溺男友",
		"tag": [
			"男",
			"青年",
			"体贴"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/宠溺男友.wav",
		"cb": 1,
		"text": "我会为你做一切你想要的事。"
	},
	{
		"id": "aojiao_nanyou",
		"name": "傲娇男友",
		"tag": [
			"男",
			"青年",
			"磁性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/傲娇男友.wav",
		"cb": 1,
		"text": "哼，我才不会向你道歉"
	},
	{
		"id": "cujing_nanyou",
		"name": "醋精男友",
		"tag": [
			"男",
			"青年",
			"清高"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/醋精男友.wav",
		"cb": 1,
		"text": "你是不是对其他人也那么好？"
	},
	{
		"id": "tiyuxi_xuedi",
		"name": "体育系学弟",
		"tag": [
			"男",
			"青年",
			"花心"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/体育系学弟.wav",
		"cb": 1,
		"text": "我有6块腹肌，你想摸摸吗？"
	},
	{
		"id": "mensao_nanyou",
		"name": "闷骚男友",
		"tag": [
			"男",
			"青年",
			"内向"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/闷骚男友.wav",
		"cb": 1,
		"text": "虽然话不多，但我在乎你。"
	},
	{
		"id": "wenrou_tongzhuo",
		"name": "温柔同桌",
		"tag": [
			"男",
			"青年",
			"随和"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔同桌.wav",
		"cb": 1,
		"text": "我会一直一直陪着你！"
	},
	{
		"id": "rouyou_bangzhu",
		"name": "优柔帮主",
		"tag": [
			"男",
			"青年",
			"寡断"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/优柔帮主.wav",
		"cb": 1,
		"text": "对你的每个决定，我都会支持。"
	},
	{
		"id": "badao_shaoye",
		"name": "霸道少爷",
		"tag": [
			"男",
			"青年",
			"强势"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/霸道少爷.wav",
		"cb": 1,
		"text": "少爷我说的话你也不听吗？"
	},
	{
		"id": "chunzhen_xuedi",
		"name": "纯真学弟",
		"tag": [
			"男",
			"青年",
			"青涩"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/纯真学弟.wav",
		"cb": 1,
		"text": "学姐，我等你下课哦~"
	},
	{
		"id": "junlang_nanyou",
		"name": "俊朗男友",
		"tag": [
			"男",
			"青年",
			"阳光"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/俊朗男友.wav",
		"cb": 1,
		"text": "宝宝，我没来晚吧！"
	},

	/**
	 * 中年
	 */
	{
		"id": "audiobook_male_1",
		"name": "成熟上司",
		"tag": [
			"男",
			"中年",
			"成熟"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/成熟上司.wav",
		"cb": 1,
		"text": "今天先到这里吧"
	},
	{
		"id": "lengdan_xiongzhang",
		"name": "冷淡兄长",
		"tag": [
			"男",
			"中年",
			"沉稳"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/冷淡兄长.wav",
		"cb": 1,
		"text": "没事了，这件事交给我吧。"
	},
	{
		"id": "xuanhuan_jianke",
		"name": "玄幻剑客",
		"tag": [
			"男",
			"中年",
			"神秘"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/玄幻剑客.wav",
		"cb": 1,
		"text": "我的剑和心都只为守护你。"
	},
	{
		"id": "youmo_shushu",
		"name": "幽默叔叔",
		"tag": [
			"男",
			"中年",
			"逗趣"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/幽默叔叔.wav",
		"cb": 1,
		"text": "年轻人，来聊聊吧，我有很多有趣的故事呢！"
	},
	{
		"id": "guiyi_fashi",
		"name": "诡异法师",
		"tag": [
			"男",
			"中年",
			"怪诞"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/诡异法师.wav",
		"cb": 1,
		"text": "黑暗中，真相会显现。"
	},
	{
		"id": "jixie_zhanjia",
		"name": "机械战甲",
		"tag": [
			"男",
			"中年",
			"战斗"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/机械战甲.wav",
		"cb": 1,
		"text": "快，躲今进我怀里！"
	},

	/**
	 * 幼年
	 */
	{
		"id": "cute_boy",
		"name": "可爱男童",
		"tag": [
			"男",
			"少年",
			"可爱"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/可爱男童.wav",
		"cb": 1,
		"text": "姐姐，你可以带我出去玩吗？"
	},

	/**
	 * 老年
	 */
	{
		"id": "gaoxiao_daye",
		"name": "搞笑大爷",
		"tag": [
			"男",
			"中老年",
			"幽默"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/搞笑大爷.wav",
		"cb": 1,
		"text": "年轻人，大爷我宝刀未老呢！"
	},
	{
		"id": "hutong_daye",
		"name": "胡同大爷",
		"tag": [
			"男",
			"中老年",
			"诙谐"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/胡同大爷.wav",
		"cb": 1,
		"text": "年轻人，来听我讲讲老故事吧。"
	},

	/**
	 * 效果差的
	 */
	{
		"id": "daimeng_qingnian",
		"name": "呆萌青年",
		"tag": [
			"男",
			"青年",
			"木讷"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/呆萌青年.wav",
		"cb": 1,
		"text": "啊…你说什么？我刚没听清。"
	},
]

const womanList = [
	/**
	 * 青年-正常
	 */
	{
		"id": "meili_nvyou",
		"name": "魅力女友",
		"tag": [
			"女",
			"青年",
			"魅力"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/魅力女友.wav",
		"cb": 1,
		"text": "亲爱的，我今晚好看吗！"
	},
	{
		"id": "wuzhao_test_4",
		"name": "撒娇女友",
		"tag": [
			"女",
			"青年",
			"撒娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/撒娇女友.wav",
		"cb": 1,
		"text": "宝宝， 人家求你了！"
	},
	{
		"id": "wuzhao_test_2",
		"name": "萝莉女友",
		"tag": [
			"女",
			"青年",
			"萝莉"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/萝莉女友.wav",
		"cb": 1,
		"text": "求求你，你就给我嘛"
	},
	{
		"id": "guimi0220_hificloneck14",
		"name": "初恋女友",
		"tag": [
			"女",
			"青年",
			"初恋"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/初恋女友.wav",
		"cb": 1,
		"text": "我超级超级喜欢你"
	},
	{
		"id": "female-shaonv",
		"name": "清纯少女",
		"tag": [
			"女",
			"青年",
			"清纯"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/清纯少女.wav",
		"cb": 1,
		"text": "哥哥，你终于回来啦！"
	},
	{
		"id": "female-yujie",
		"name": "性感御姐",
		"tag": [
			"女",
			"青年",
			"性感"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/性感御姐.wav",
		"cb": 1,
		"text": "傻瓜，姐姐怎么会怪你呢！"
	},
	{
		"id": "female-tianmei",
		"name": "甜美学妹",
		"tag": [
			"女",
			"青年",
			"甜美"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/甜美学妹.wav",
		"cb": 1,
		"text": "学长，我...我喜欢你很久了！"
	},
	{
		"id": "bingruo_shaonv",
		"name": "病弱少女",
		"tag": [
			"女",
			"青年",
			"忧郁"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病弱少女.wav",
		"cb": 1,
		"text": "我...我身体有点不舒服。"
	},
	{
		"id": "bingjiao_jiejie",
		"name": "病娇姐姐",
		"tag": [
			"女",
			"青年",
			"病娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/病娇姐姐.wav",
		"cb": 1,
		"text": "别离开我，求求你了~"
	},
	{
		"id": "wumei_yujie",
		"name": "妩媚御姐",
		"tag": [
			"女",
			"青年",
			"感性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/妩媚御姐.wav",
		"cb": 1,
		"text": "宝宝，你拿什么抵抗我呢~"
	},
	{
		"id": "jiaoxiu_nvyou",
		"name": "娇羞女友",
		"tag": [
			"女",
			"青年",
			"甜美"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/娇羞女友.wav",
		"cb": 1,
		"text": "大坏蛋，羞死人家了~"
	},
	{
		"id": "Podcast_girl_platform",
		"name": "温柔姐姐",
		"tag": [
			"女",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔姐姐.wav",
		"cb": 1,
		"text": "你...有在想我嘛"
	},
	{
		"id": "Female_shaonv_platform",
		"name": "活泼学妹",
		"tag": [
			"女",
			"青年",
			"活泼"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/活泼学妹.wav",
		"cb": 1,
		"text": "小哥哥，你在想什么呢~"
	},
	{
		"id": "Female_xiaomo_platform",
		"name": "女友闺蜜",
		"tag": [
			"女",
			"青年",
			"闺蜜"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/女友闺蜜.wav",
		"cb": 1,
		"text": "嗨，好久不见"
	},
	{
		"id": "Female_yaoyao_platform",
		"name": "可爱瑶瑶",
		"tag": [
			"女",
			"青年",
			"可爱"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/可爱瑶瑶.wav",
		"cb": 1,
		"text": "你真是个大笨蛋啦"
	},
	{
		"id": "Female_murong_platform",
		"name": "知性学姐",
		"tag": [
			"女",
			"青年",
			"知性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/知性学姐.wav",
		"cb": 1,
		"text": "下次再来找你玩哦"
	},
	{
		"id": "Female_ shangshen_platform",
		"name": "甜美女友",
		"tag": [
			"女",
			"青年",
			"甜美"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/甜美女友.wav",
		"cb": 1,
		"text": "你什么时候带我去出去玩呀"
	},
	{
		"id": "guimi0220_hificloneck15",
		"name": "妩媚学姐",
		"tag": [
			"女",
			"青年",
			"妩媚"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/妩媚学姐.wav",
		"cb": 1,
		"text": "哎呀，你好坏呀"
	},
	{
		"id": "guimi0220_hificloneck20",
		"name": "魅惑少女",
		"tag": [
			"女",
			"青年",
			"魅惑"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/魅惑少女.wav",
		"cb": 1,
		"text": "你确定...要来找我嘛"
	},
	{
		"id": "wuzhao_test_1",
		"name": "活泼妹妹",
		"tag": [
			"女",
			"青年",
			"活泼"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/活泼妹妹.wav",
		"cb": 1,
		"text": "我来我找你玩啦"
	},
	{
		"id": "wuzhao_test_3",
		"name": "呆萌学妹",
		"tag": [
			"女",
			"青年",
			"活泼"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/呆萌学妹.wav",
		"cb": 1,
		"text": "你...你在干嘛呢"
	},
	{
		"id": "wuzhao_test_5",
		"name": "温柔御姐",
		"tag": [
			"女",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/温柔御姐.wav",
		"cb": 1,
		"text": "我正想去找你呢"
	},
	{
		"id": "audiobook_female_1",
		"name": "少女小鱼",
		"tag": [
			"女",
			"青年",
			"少女"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/少女小鱼.wav",
		"cb": 1,
		"text": "我叫小鱼，鱼儿的鱼"
	},
	{
		"id": "female-shaonv-jingpin",
		"name": "少萝学妹",
		"tag": [
			"女",
			"青年",
			"少萝"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/少萝学妹.wav",
		"cb": 1,
		"text": "你能来接我放学吗"
	},
	{
		"id": "female-yujie-jingpin",
		"name": "御姐小诗",
		"tag": [
			"女",
			"青年",
			"御姐"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/御姐小诗.wav",
		"cb": 1,
		"text": "我在楼下等你哦"
	},
	{
		"id": "female-tianmei-jingpin",
		"name": "娇羞少女",
		"tag": [
			"女",
			"青年",
			"少女"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/娇羞少女.wav",
		"cb": 1,
		"text": "我可以和你做朋友吗"
	},
	{
		"id": "wenya_nvyou",
		"name": "文雅女友",
		"tag": [
			"女",
			"青年",
			"内向"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/文雅女友.wav",
		"cb": 1,
		"text": "希望能和你能一起度过这安静地时光。"
	},
	{
		"id": "xianjing_xuejie",
		"name": "娴静学姐",
		"tag": [
			"女",
			"青年",
			"安静"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/娴静学姐.wav",
		"cb": 1,
		"text": "你愿意陪我看日落嘛~"
	},
	{
		"id": "wanyue_nvyou",
		"name": "婉约女友",
		"tag": [
			"女",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/婉约女友.wav",
		"cb": 1,
		"text": "我们会一直一直在一起呢！"
	},
	{
		"id": "danya_xuejie",
		"name": "淡雅学姐",
		"tag": [
			"女",
			"青年",
			"妩媚"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/淡雅学姐.wav",
		"cb": 1,
		"text": "今天天气不错，我们去公园散散步吧！"
	},
	{
		"id": "tianmei_shaonv",
		"name": "甜美少女",
		"tag": [
			"女",
			"青年",
			"知性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/甜美少女.wav",
		"cb": 1,
		"text": "我猜~你一定喜欢我！"
	},
	{
		"id": "xinggan_yujie",
		"name": "冷艳御姐",
		"tag": [
			"女",
			"青年",
			"冷艳"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/冷艳御姐.wav",
		"cb": 1,
		"text": "宝宝，你不乖哦!"
	},
	{
		"id": "roumei_nvyou",
		"name": "柔美女友",
		"tag": [
			"女",
			"青年",
			"娇媚"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/柔美女友.wav",
		"cb": 1,
		"text": "在我身边，你会感到无比温柔。"
	},
	{
		"id": "mensao_nvyou",
		"name": "闷骚女友",
		"tag": [
			"女",
			"青年",
			"傲娇"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/闷骚女友.wav",
		"cb": 1,
		"text": "其实，我一直都在关注你呢！"
	},
	{
		"id": "zhixing_laoshi",
		"name": "知性老师",
		"tag": [
			"女",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/知性老师.wav",
		"cb": 1,
		"text": "下课来办公室，老师单独给你辅导！"
	},
	{
		"id": "nuanxin_xuejie",
		"name": "暖心学姐",
		"tag": [
			"女",
			"青年",
			"温柔"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/暖心学姐.wav",
		"cb": 1,
		"text": "弟弟，你身体不舒服吗？"
	},
	{
		"id": "huopo_nvyou",
		"name": "活泼女友",
		"tag": [
			"女",
			"青年",
			"热情"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/活泼女友.wav",
		"cb": 1,
		"text": "今天想和我聊什么呀！"
	},
	{
		"id": "tianxin_xiaoling",
		"name": "甜心小玲",
		"tag": [
			"女",
			"青年",
			"清新"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/甜心小玲.wav",
		"cb": 1,
		"text": "你的小甜心来啦！"
	},
	{
		"id": "nv_shangsi",
		"name": "女上司",
		"tag": [
			"女",
			"青年",
			"严厉"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/女上司.wav",
		"cb": 1,
		"text": "看什么看？工作做完了吗？"
	},
	{
		"id": "jia_xiaozi",
		"name": "假小子",
		"tag": [
			"女",
			"青年",
			"中性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/假小子.wav",
		"cb": 1,
		"text": "嗨，你好！想一起踢球吗？"
	},
	{
		"id": "nv_banzhang",
		"name": "女班长",
		"tag": [
			"女",
			"青年",
			"文艺"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/女班长.wav",
		"cb": 1,
		"text": "今天有好多有趣的事情等你哦。"
	},


	/**
	 * 中年
	 */
	{
		"id": "female-chengshu-jingpin",
		"name": "房东静姐",
		"tag": [
			"女",
			"中年",
			"成熟"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/房东静姐.wav",
		"cb": 1,
		"text": "明天该交房租了。"
	},
	{
		"id": "lengdan_nvwang",
		"name": "冷淡女王",
		"tag": [
			"女",
			"中年",
			"高冷"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/冷淡女王.wav",
		"cb": 1,
		"text": "小子，离本王远一点！"
	},
	{
		"id": "audiobook_female_2",
		"name": "上司姐姐",
		"tag": [
			"女",
			"中年",
			"上司"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/上司姐姐.wav",
		"cb": 1,
		"text": "上午工作做完了吗"
	},
	{
		"id": "nv_bangzhu",
		"name": "女帮主",
		"tag": [
			"女",
			"中年",
			"果断"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/女帮主.wav",
		"cb": 1,
		"text": "别怕，有我在呢。"
	},
	{
		"id": "female-chengshu",
		"name": "成熟白领",
		"tag": [
			"女",
			"中年",
			"成熟"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/成熟白领.wav",
		"cb": 1,
		"text": "晚上要一起喝一杯嘛！"
	},
	{
		"id": "linju_ayi",
		"name": "邻居阿姨",
		"tag": [
			"女",
			"中年",
			"稳重"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/邻居阿姨.wav",
		"cb": 1,
		"text": "小伙子，和阿姨聊聊。"
	},
	{
		"id": "chengshu_jiejie",
		"name": "成熟姐姐",
		"tag": [
			"女",
			"中年",
			"知性"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/成熟姐姐.wav",
		"cb": 1,
		"text": "有烦心事可以说给姐姐听~"
	},

	/**
	 * 幼年
	 */
	{
		"id": "tiaopi_gongzhu",
		"name": "调皮公主",
		"tag": [
			"女",
			"少年",
			"淘气"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/调皮公主.wav",
		"cb": 1,
		"text": "猜猜我今天会做什么小恶作剧？"
	},
	{
		"id": "female-tianmei",
		"name": "呆萌女童",
		"tag": [
			"女",
			"少年",
			"呆萌"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/呆萌女童.wav",
		"cb": 1,
		"text": "大哥哥，你可以给我买棒棒糖吃吗？"
	},
	{
		"id": "keai_nvsheng",
		"name": "可爱女生",
		"tag": [
			"女",
			"少年",
			"俏皮"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/可爱女生.wav",
		"cb": 1,
		"text": "嘿！今天我有好多新奇的想法！"
	},

	/**
	 * 老年
	 */
	{
		"id": "huajia_nainai",
		"name": "花甲奶奶",
		"tag": [
			"女",
			"中老年",
			"慈祥"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/花甲奶奶.wav",
		"cb": 1,
		"text": "孩子，让奶奶好好看看你。"
	},

	/**
	 * 效果差的
	 */
	{
		"id": "huopo_nvhai",
		"name": "活泼女孩",
		"tag": [
			"女",
			"青年",
			"开朗"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/活泼女孩.wav",
		"cb": 1,
		"text": "你好呀！今天去哪里玩呢？"
	},

	{
		"id": "tianzhen_nvhai",
		"name": "天真女孩",
		"tag": [
			"女",
			"青年",
			"单纯"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/天真女孩.wav",
		"cb": 1,
		"text": "你好呀！我可以和你说会话嘛？"
	},
	{
		"id": "lingdong_nvhai",
		"name": "灵动女孩",
		"tag": [
			"女",
			"青年",
			"天真"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/灵动女孩.wav",
		"cb": 1,
		"text": "我可以和你一起去探索世界嘛？"
	},
	{
		"id": "diadia_xuemei",
		"name": "嗲嗲学妹",
		"tag": [
			"女",
			"青年",
			"娇俏"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/嗲嗲学妹.wav",
		"cb": 1,
		"text": "你会喜欢我这样的小娇俏吗？"
	},

	{
		"id": "qiaopi_mengmei",
		"name": "俏皮萌妹",
		"tag": [
			"女",
			"青年",
			"灵动"
		],
		"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/俏皮萌妹.wav",
		"cb": 1,
		"text": "来跟我一起玩耍吧！"
	},
]

const list = [...manList, ...womanList]

const genderList = [
	'全部性别',
	'男',
	'女'
]

const ageList = [
	'全部年龄',
	"少年",
	'青年',
	'中年',
	'中老年'
]

module.exports = {
	list,
	genderList,
	ageList,
	version: 1.1
}
