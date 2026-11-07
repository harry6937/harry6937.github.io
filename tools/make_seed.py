import json
from pathlib import Path
base='https://harry6937.github.io/'
rows=[
('ocr','手机标签 OCR','phone-label-ocr','phone-label-ocr/','手机业务','scan','识别型号、容量与 IMEI，导出 Excel','网页',True),
('imei-desk','IMEI 领取工作台','harry6937.github.io','imei/','手机业务','phone','按机型领取号码，记录使用状态','需 Google 登录',True),
('shipping','运费计算器','M2-China-calculator','M2-China-calculator/','计算工具','truck','计算运输费用与采购成本','网页',True),
('store','门店管理','bangkok','bangkok/','门店管理','store','要货、采购、发货、库存和提醒','网页',True),
('exchange','汇率计算器','harry6937.github.io','','计算工具','exchange','快速换算，核对交易金额','网页',False),
('ceir','CEIR 税单记录','M2_CEIR_Tools','M2_CEIR_Tools/','手机业务','file','录入和管理手机税单信息','Google 服务',False),
('scan-imei','IMEI 扫码记录','mobileIMEI','mobileIMEI/mobileimei.HTML','手机业务','scan','扫描条形码、复制和导出记录','网页',False),
('cost','手机成本与利润','M2-China-calculator','M2-China-calculator/desktop.html','计算工具','calculator','手机采购成本与利润计算','独立页面',False),
('cost-tax','含税计算 · Google 版','M2-China-calculator','M2-China-calculator/含税google版.html','计算工具','calculator','同仓库中的含税 Google 版本','独立页面',False),
('rent','分期租赁计算器','m2-rent-calculator','m2-rent-calculator/','计算工具','calculator','首付比例和分期期限计算','网页',False),
('gold','黄金计算器','M2-Gold-Calculator','M2-Gold-Calculator/M2-Gold-Calculator.html','计算工具','gold','金价换算与交易金额计算','网页',False),
('arbitrage','汇率套利计算器','saomarmb','saomarmb/m_2_汇率套利计算器_web_app.html','计算工具','exchange','资产、交易与每日统计','网页',False),
('arbitrage-local','汇率套利 · 单机版','saomarmb','saomarmb/单机版.html','计算工具','exchange','同仓库中的单机版本','独立页面',False),
('finance','当铺与往来账','dangpu','dangpu/','门店管理','wallet','当铺账、往来账、利息和统计','网页',False),
('store-alt','店用系统 · bangkokm2','bangkokm2','bangkokm2/购买东西记录.html','门店管理','store','另一版要货、采购、发货与库存','另一版本',False),
('leave','请假管理 · m2leave','m2leave','m2leave/leave.html','门店管理','calendar','员工请假管理','网页',False),
('leave-alt','请假管理 · 12345','12345','12345/','门店管理','calendar','另一个请假管理版本','另一版本',False),
('qr','二维码生成','m2-qr-code','m2-qr-code/','日常工具','qr','把文本或链接生成二维码','网页',False),
('bkk-red','曼谷红包活动','m2bkkhongbao','m2bkkhongbao/m2bkkhonbao.html','营销活动','gift','M2 Mobile 红包抽奖页面','活动',False),
('mdy-red','曼德勒红包活动','m2mobilemdyhongbao','m2mobilemdyhongbao/mdyhongbao.html','营销活动','gift','M2 Mobile 红包抽奖页面','活动',False),
('pdf','PDF 转换助手','M2_PDF_Converter_Web',None,'日常工具','file','图片、PDF、Word 和 Excel 转换项目','项目源码',False),
('sale','双十一活动素材','11.11-m2',None,'营销活动','gift','活动图片与项目文件','素材仓库',False),
('exchange-src','汇率计算器 · 源码','m2-exchange-calculator',None,'其他项目','code','独立源码仓库，网页入口曾返回 404','项目源码',False),
('erp','M2 ERP · 起始版','mobilepos','mobilepos/','其他项目','store','目前只有 ERP 起始页面','未完成',False),
('empty-dash','未命名项目 · -','-',None,'其他项目','folder','GitHub 上的空仓库，按要求一并收录','空仓库',False),
('chatgpt','ChatGPT 项目','ChatGPT',None,'其他项目','folder','GitHub 上的空仓库，按要求一并收录','空仓库',False),
]
items=[]
for i,(id,name,repo,url,category,icon,description,status,favorite) in enumerate(rows):
 repository='https://github.com/harry6937/'+repo
 items.append(dict(id=id,name=name,url=repository if url is None else base+url,category=category,icon=icon,description=description,status=status,favorite=favorite,repository=repository,hidden=False,deleted=False,order=i))
data=dict(schema=1,categories=['手机业务','计算工具','门店管理','日常工具','营销活动','其他项目'],tools=items)
Path('m2-tools/seed.js').write_text('window.M2_SEED = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
print(f'{len(items)} entries / {len(set(x[2] for x in rows))} repositories')
