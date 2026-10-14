// 帮助中心内容：按登录角色配置操作说明，配图为系统真实截图（frontend/public/help/*.png）

const IMG = (name) => `${import.meta.env.BASE_URL}help/${name}`;

const M = {
  dashboard: {
    key: 'dashboard',
    title: '经营概览',
    img: 'dashboard.png',
    desc: '登录后的首页看板，汇总在途采购金额、库存箱数与净重、待审批事项、未处理冷链告警，并提供采购状态分布、库存温区结构、近 6 个月采购金额趋势、货运节点分布与临期批次预警。',
    points: [
      '顶部四张指标卡可快速判断当前资金占用、库存水位、审批积压与冷链风险。',
      '「临期批次预警」列出 20 天内到期的批次，剩余天数用颜色区分（≤7 天红色、≤20 天橙色）。',
      '点击右上角「刷新」重新拉取最新统计。',
    ],
  },
  ai: {
    key: 'ai-assistant',
    title: '智能助手（智能问答 / 智能问数）',
    img: 'ai-assistant.png',
    desc: '基于大模型（cosmo-mind）的智能助手，支持自然语言业务问答与自然语言查询系统数据。助手会按需自动生成只读 SQL 并给出结论，所有查询均为只读，不会修改系统数据。',
    points: [
      '智能问答：像聊天一样提问业务问题，助手会自动查询系统数据后用自然语言回答；可展开查看本次执行的 SQL。',
      '智能问数：输入统计需求（如「近6个月每月采购金额」），自动转换为 SQL 并返回汇总说明与结果表。',
      '结果表为两列数值时会自动生成柱状图；支持「复制 SQL」与「导出 CSV」。',
      '入口：左侧菜单「智能助手」，或任意页面右下角的悬浮按钮。',
      '若提示未配置大模型，请在 backend/.env 中设置 LLM_API_KEY。',
    ],
  },
  suppliers: {
    key: 'suppliers',
    title: '供应商管理',
    img: 'suppliers.png',
    desc: '维护境外供应商档案与信用额度，采购下单时可按供应商校验可用额度。',
    points: [
      '使用顶部关键字框按名称/原产国检索，点击「查询」。',
      '点击「新建供应商」填写名称、原产国、联系方式、信用额度与已占用额度。',
      '列表「可用额度」= 信用额度 − 已占用额度，绿色代表充足、红色代表透支。',
      '「编辑」修改档案；「删除」为软删除，若该供应商存在进行中的采购订单会被拦截。',
    ],
  },
  purchaseList: {
    key: 'purchase-list',
    title: '采购订单列表',
    img: 'purchase-list.png',
    desc: '采购订单的查询与状态流转入口，覆盖草稿、待审批、已确认、运输中、已完成等状态。',
    points: [
      '按状态与关键字筛选订单；采购员仅能看到本人创建的订单（数据范围隔离）。',
      '状态流转按钮按权限显示：提交、审批通过/驳回、发货、结案、取消、删除。',
      '「导出 CSV」导出当前全部采购订单（含原币金额与折合 CNY）。',
      '发货后系统自动生成国际货运批次，可跳转运控控制台。',
    ],
  },
  purchaseCreate: {
    key: 'purchase-create',
    title: '新建 / 编辑采购订单',
    img: 'purchase-create.png',
    desc: '录入采购订单基础信息与明细，支持多币种锁汇、双单位联动与合同附件上传。',
    points: [
      '选择供应商后自动展示可用信用额度，超额度时给出预警提示。',
      '选择非 CNY 币种可点「取实时汇率」拉取中间价，也支持手动锁汇。',
      '明细行输入箱数与单箱净重自动计算总净重；切换「按箱/按 kg」计价自动换算小计。',
      '必须上传电子版采购合同后才能提交审批。',
      '草稿或被驳回的订单可再次编辑保存。',
    ],
  },
  purchaseDetail: {
    key: 'purchase-detail',
    title: '采购订单详情',
    img: 'purchase-detail.png',
    desc: '查看订单全貌：基础信息、采购明细、附件、关联货运批次、落地成本与已生成库存批次。',
    points: [
      '顶部按权限显示提交、审批、驳回、发货、结案、编辑、删除操作。',
      '「采购合同附件」支持上传、下载与删除。',
      '可跳转货运批次控制台、落地成本核算页。',
      '底部「已生成库存批次」显示入库批次、温区与销售锁定状态。',
    ],
  },
  shipmentList: {
    key: 'shipment-list',
    title: '货运批次列表',
    img: 'shipment-list.png',
    desc: '国际货运批次总览，展示船名航次、柜号、起运/目的港与单证进度；点击「定位」可查看该批次的 3D 海图轨迹。',
    points: [
      '「单证进度」显示已上传必需单证数 / 必需单证总数，未齐时显示橙色。',
      '点击「控制台」进入批次详情进行节点推进与单证核销。',
      '点击「定位」打开该批次的 3D 海图，查看航线、当前位置与节点时间线。',
      '有删除权限时可删除未生成库存的批次。',
    ],
  },
  globalShipment: {
    key: 'global-shipment',
    title: '全球货运态势',
    img: 'global-overview.png',
    desc: '「国际货运」子菜单页面，以真实 3D 地球（国境线、国家、城市）展示全部货运批次：按状态着色的航线与货物当前位置，并统计各状态批次数量。',
    points: [
      '顶部 6 张卡片按状态统计批次数量：离港 / 海运空运中 / 到港 / 报关清关中 / 放行 / 已入库。',
      '地球标注国境线与国家（悬停显示名称）、主要城市；航线「已航行」段为实线，「剩余」段为动画虚线。',
      '悬停货物位置可查看批次号、状态、航行进度与起运/目的港。',
      '支持拖动旋转、滚轮缩放与慢速自转。',
    ],
  },
  shipmentDetail: {
    key: 'shipment-detail',
    title: '批次与单证控制台',
    img: 'shipment-detail.png',
    desc: '以状态看板驱动货运节点流转，并通过单证核销矩阵管理提单、原产地证、植物检疫证、报关单等。',
    points: [
      '状态看板：离港 → 海运/空运中 → 到港 → 报关清关中 → 放行 → 已入库。',
      '推进「运输中」前，系统校验必需单证是否齐全，缺失会阻断。',
      '单证矩阵支持真实文件上传、替换与下载，并提取关键字段（提单号、柜号、封号等）。',
      '「编辑货运信息」维护船名、柜号、封号、提单号、ETD/ETA 等。',
      '推进到「已入库」后，关联采购订单自动结案。',
    ],
  },
  wmsInbound: {
    key: 'wms-inbound',
    title: '入库理算',
    img: 'wms-inbound.png',
    desc: '按实际到货数据执行重公差校验并生成可追溯库存批次。',
    points: [
      '选择已确认的采购订单与入库仓库，系统带出合同明细。',
      '录入实际箱数、实际毛/净重、原产国、厂号、生产日期与保质期后点「执行理算」。',
      '净重偏差 = |实际净重 − 合同净重| / 合同净重；超出公差将阻断入库并生成「磅差理赔单」二次审批。',
      '校验通过后点「确认入库并生成库存批次」，批次号含国家+厂号+日期，到期日按生产日期+保质期生成。',
    ],
  },
  wmsInventory: {
    key: 'wms-inventory',
    title: '库存批次',
    img: 'wms-inventory.png',
    desc: '库存批次台账，默认按到期日升序（FEFO 先到期先出），支持温控记录、流水与盘点调整。',
    points: [
      '按 SKU、温区、销售状态筛选；「剩余天数」颜色标识临期风险。',
      '「温控记录」查看该批次温度曲线与超限线。',
      '「库存流水」查看入库、出库、盘点、报废、调拨等变动明细。',
      '「盘点调整」支持库存盘点增减、报废、调拨仓库，需填写原因。',
      '销售锁定批次会显示锁定原因，禁止出库。',
    ],
  },
  financeLandcost: {
    key: 'finance-landcost',
    title: '落地成本核算',
    img: 'finance-landcost.png',
    desc: '把海运费、关税、港杂费等附加费用按重量/货值/件数分摊到单品，得到每公斤、每箱落地成本。',
    points: [
      '选择采购订单，添加费用项并选择分摊方式（按重量/按货值/按件数）。',
      '点击「计算分摊」得到货物基础成本、附加费用合计与完税后落地总成本。',
      '结果表展示每个 SKU 的分摊成本、每公斤成本与每箱成本。',
      '「落地成本记录」查看历史核算并支持重新核算或清除。',
    ],
  },
  financeCustoms: {
    key: 'finance-customs',
    title: '关税 / 增值税倒算',
    img: 'finance-customs.png',
    desc: '按 HS Code 自动带出关税税率与增值税率，计算完税价格并生成财务预付应付凭证。',
    points: [
      '选择采购订单与 HS Code（如 0810.10.00 鲜樱桃）。',
      '系统按 CIF 价格计算关税、增值税与应缴合计。',
      '右侧饼图展示 CIF 货值、关税、增值税构成。',
      '下方「历史报关记录」可查询并删除。',
    ],
  },
  salesOrders: {
    key: 'sales-orders',
    title: '销售出库（FEFO）',
    img: 'sales-orders.png',
    desc: '销售出库按先到期先出自动分配批次；强制选择临期批次会触发品质主管二次审批。',
    points: [
      '「新建出库单」填写客户与出库明细；不指定批次时系统按到期日自动分配。',
      '可手动指定批次，但被锁定批次不可选；剩余保质期 < 20% 的批次需审批。',
      '展开订单可查看每个出库批次及剩余保质期比例。',
      '支持编辑客户/备注；「作废」会回滚库存并生成退库流水。',
    ],
  },
  monitor: {
    key: 'monitor-temperature',
    title: '冷链温控监控',
    img: 'monitor-temperature.png',
    desc: '对接 IoT 温度上报，连续超温自动生成高优先级告警并锁定批次销售。',
    points: [
      '顶部可模拟传感器上报温度（选择批次 + 温度）。',
      '冷藏区连续 3 次超过 4°C 触发告警并锁定批次销售。',
      '「处理并解锁」由品质主管确认后解除锁定；「删除」移除告警记录。',
    ],
  },
  approvals: {
    key: 'approvals',
    title: '审批中心',
    img: 'approvals.png',
    desc: '集中处理采购订单审批、磅差理赔单与临期批次强制出库等审批事项。',
    points: [
      '按状态筛选待处理 / 已通过 / 已驳回。',
      '「通过」「驳回」处理审批；驳回/审批都记录处理人与时间。',
      '临期批次强制出库通过后自动解除对应批次锁定。',
    ],
  },
  users: {
    key: 'users',
    title: '用户与角色',
    img: 'users.png',
    desc: '维护系统用户及其角色，查看角色权限矩阵。',
    points: [
      '「新建用户」设置账号、姓名、初始密码与角色。',
      '「编辑」修改姓名、角色、状态，可重置密码（留空则不修改）。',
      '「停用」为软删除，内置管理员不可停用或降级。',
      '「角色权限说明」查看每个角色的权限项清单。',
    ],
  },
  audit: {
    key: 'audit-logs',
    title: '操作日志',
    img: 'audit-logs.png',
    desc: '记录所有写操作（新增/修改/删除）的操作人、接口路径、结果与时间，便于审计追溯。',
    points: [
      '按时间倒序展示最近的操作记录。',
      '动作类型用颜色区分：POST 绿色、PUT 橙色、DELETE 红色。',
      '显示请求结果（成功 / 失败及状态码）。',
    ],
  },
  profile: {
    key: 'profile',
    title: '我的权限',
    img: 'profile.png',
    desc: '查看当前登录账号的角色与已授权功能清单。',
    points: ['展示账号、姓名、角色与权限数量。', '列出当前角色全部已授权功能项。'],
  },
};

const ROLES = {
  admin: {
    label: '系统管理员',
    summary: '拥有全部功能权限，负责系统基础数据、用户与角色、以及全流程的监督与运维。',
    modules: [M.dashboard, M.ai, M.users, M.audit, M.suppliers, M.purchaseList, M.purchaseDetail, M.shipmentList, M.globalShipment, M.shipmentDetail, M.wmsInbound, M.wmsInventory, M.financeLandcost, M.financeCustoms, M.salesOrders, M.monitor, M.approvals, M.profile],
  },
  manager: {
    label: '采购经理',
    summary: '负责采购订单的审批与全流程管控、供应商维护、货运与库存监督，并可查看经营与财务数据。',
    modules: [M.dashboard, M.ai, M.suppliers, M.purchaseList, M.purchaseCreate, M.purchaseDetail, M.approvals, M.shipmentList, M.globalShipment, M.shipmentDetail, M.wmsInbound, M.wmsInventory, M.financeLandcost, M.financeCustoms, M.salesOrders, M.monitor, M.audit, M.profile],
  },
  purchase: {
    label: '采购员',
    summary: '负责采购订单的创建、编辑与提交，跟进国际货运，并可创建销售出库单。仅能查看本人创建的采购订单。',
    modules: [M.dashboard, M.ai, M.suppliers, M.purchaseList, M.purchaseCreate, M.purchaseDetail, M.shipmentList, M.globalShipment, M.shipmentDetail, M.salesOrders, M.profile],
  },
  warehouse: {
    label: '仓储主管',
    summary: '负责到货入库理算、库存批次管理、盘点调整与调拨，以及货运节点与单证维护。',
    modules: [M.dashboard, M.ai, M.purchaseList, M.shipmentList, M.globalShipment, M.shipmentDetail, M.wmsInbound, M.wmsInventory, M.salesOrders, M.monitor, M.profile],
  },
  finance: {
    label: '财务专员',
    summary: '负责落地成本分摊与关税/增值税倒算，生成财务应付凭证，并可导出采购订单、查看操作日志。',
    modules: [M.dashboard, M.ai, M.purchaseList, M.purchaseDetail, M.financeLandcost, M.financeCustoms, M.shipmentList, M.globalShipment, M.wmsInventory, M.audit, M.profile],
  },
  quality: {
    label: '生鲜品质主管',
    summary: '负责冷链温控监控与温度告警处理，参与磅差理赔、临期批次强制出库与采购审批。',
    modules: [M.dashboard, M.ai, M.monitor, M.approvals, M.purchaseList, M.shipmentList, M.globalShipment, M.wmsInventory, M.profile],
  },
};

export function getHelpByRole(role) {
  return ROLES[role] || ROLES.purchase;
}

export default ROLES;
