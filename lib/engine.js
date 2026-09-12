const crypto = require('crypto');

const COLOR_MAP = [
  ['紫', '紫色'], ['白', '白色'], ['粉', '粉色'], ['红', '红色'], ['蓝', '蓝色'], ['黄', '黄色'],
  ['橙', '橙色'], ['绿', '绿色'], ['黑', '黑色'], ['奶油', '奶油色'], ['香槟', '香槟色']
];

const STYLE_WORDS = ['温柔','高级','自然','法式','韩式','日式','复古','奶油','清冷','热烈','可爱','梦幻','怪诞','艺术','极简','松弛','野趣'];

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function midpoint(range = [0,0]) { return Math.round((Number(range[0]||0) + Number(range[1]||0)) / 2); }
function textOf(input) {
  return [input.prompt,input.type,input.occasion,input.style,input.preferred,input.avoid,input.existing,input.petContext,input.venue]
    .filter(Boolean).join(' ');
}
function wantsNoPlants(input) {
  const t=`${input.prompt||''} ${input.avoid||''}`;
  return /(?:不要|不用|不放|排除|完全不要|完全不用|无)(?:任何)?(?:鲜花|花材|植物|绿植)|纯(?:娃娃|零食|礼物|食物)/.test(t);
}
function colorNegated(key,input){
  const a=String(input.avoid||''); const p=String(input.prompt||'');
  if(a.includes(key)) return true;
  const esc=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?:不要|不想要|避免|排除|别用|不用)[^，。；,;]{0,6}${esc}`).test(p);
}
function unique(arr) { return [...new Set(arr.filter(Boolean))]; }
function choosePalette(input) {
  const text = [input.prompt,input.type,input.occasion,input.style,input.preferred,input.existing,input.petContext,input.venue].filter(Boolean).join(' ');
  const found = [];
  for (const c of input.aiSuggestions?.palette || []) found.push(c.endsWith('色') ? c : `${c}色`);
  for (const [key,label] of COLOR_MAP) if (text.includes(key) && !colorNegated(key,input)) found.push(label);
  for (const c of input.colors || []) { const raw=String(c).replace('色',''); if(!colorNegated(raw,input)) found.push(c.endsWith('色') ? c : `${c}色`); }
  if (found.length) return unique(found).slice(0,4);
  if (input.mode === 'creative') return ['粉色','奶油色','白色'];
  return ['紫色','白色','灰绿色'];
}
function includesName(text, item) {
  return [item.name, ...(item.aliases || [])].some(n => n && text.includes(n));
}
function parseQty(text, names) {
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const patterns = [
      new RegExp(`(\\d{1,3})\\s*(?:枝|支|朵|头|个|颗|包|份|罐|张|米|套|根|条|块|卷)?\\s*[^，。；,;\\d]{0,4}${esc}`),
      new RegExp(`${esc}\\s*[x×*]?\\s*(\\d{1,3})\\s*(?:枝|支|朵|头|个|颗|包|份|罐|张|米|套|根|条|块|卷)?`)
    ];
    for (const re of patterns) {
      const m = text.match(re); if (m) return Number(m[1]);
    }
  }
  return null;
}
function flowerByName(catalog, name) { return catalog.flowers.find(f => f.name === name); }
function itemByName(catalog, name) { return catalog.creative.find(f => f.name === name); }
function colorFor(item, palette, fallback='白') {
  const keys = palette.map(x => x.replace('色',''));
  return item.colors?.find(c => keys.some(k => c.includes(k) || k.includes(c))) || item.colors?.[0] || fallback;
}
function makeFlower(catalog, name, qty, role, palette) {
  const ref = flowerByName(catalog, name);
  if (!ref) return null;
  const unit = midpoint(ref.price);
  return {
    id: ref.id, name: ref.name, color: colorFor(ref,palette), quantity: qty, unit:'枝', role,
    unit_price: unit, subtotal: unit * qty, catalog: {
      availability:ref.availability, season:ref.season, water_need:ref.water_need, weight:ref.weight,
      fragility:ref.fragility, beginner:ref.beginner, foam_fit:ref.foam_fit, vase_fit:ref.vase_fit,
      peak_months:ref.peak_months||[], market_tier:ref.market_tier||'', substitutes:ref.substitutes||[], pet_risk:ref.pet_risk||'', evidence:ref.evidence||[],
      notes:ref.notes
    }
  };
}
function makeCreative(catalog, name, qty, fixIndex=0) {
  const ref = itemByName(catalog,name);
  if (!ref) return null;
  const unit = midpoint(ref.price);
  return { id:ref.id,name:ref.name,category:ref.category,quantity:qty,unit:name.includes('草莓')?'颗':name.includes('零食')?'包':'个',unit_price:unit,price:unit*qty,fix:ref.fix[fixIndex]||ref.fix[0],catalog:{weight_g:ref.weight_g,wet_safe:ref.wet_safe,food:ref.food,notes:ref.notes} };
}
function baseFlowerSet(catalog, input, palette) {
  if (wantsNoPlants(input) && input.mode==='creative' && !Array.isArray(input.lockedFlowers)) return [];
  if (Array.isArray(input.lockedFlowers) && input.lockedFlowers.length) {
    return input.lockedFlowers.map(src=>{
      const f=makeFlower(catalog,src.name,Number(src.quantity||1),src.role||'锁定花材',palette);
      if(!f) return null;
      f.locked=true;
      f.existing_quantity=Number(src.existing_quantity||0);
      f.from_existing=Boolean(src.from_existing);
      if(f.from_existing) f.subtotal=Math.max(0,f.quantity-f.existing_quantity)*f.unit_price;
      return f;
    }).filter(Boolean);
  }
  const purple = palette.some(c=>c.includes('紫'));
  const pink = palette.some(c=>c.includes('粉'));
  const text = textOf(input);
  const minimalJapanese = /日式|极简|线条/.test(text);
  const set = minimalJapanese ? [
    ['马蹄莲',2,'线条'],['洋桔梗',3,'主花'],['尤加利',2,'叶材']
  ] : purple ? [
    ['玫瑰',8,'主花'],['洋桔梗',5,'过渡'],['绣球',1,'体块'],['蝴蝶兰',1,'焦点'],['尤加利',4,'叶材'],['补血草',3,'填充']
  ] : pink ? [
    ['玫瑰',9,'主花'],['洋桔梗',5,'过渡'],['康乃馨',5,'填充'],['松虫草',3,'点缀'],['尤加利',4,'叶材']
  ] : [
    ['玫瑰',7,'主花'],['洋桔梗',5,'过渡'],['飞燕草',3,'线条'],['康乃馨',4,'填充'],['尤加利',5,'叶材']
  ];
  // AI may suggest only catalog-backed materials; the deterministic engine still owns quantities and validation.
  for (const name of input.aiSuggestions?.flowers || []) {
    const f = catalog.flowers.find(x => x.name === name);
    if (f && !set.some(x=>x[0]===f.name)) set.unshift([f.name,2,'AI建议']);
  }
  // Explicitly requested real flowers get priority and are added if not in template.
  for (const f of catalog.flowers) {
    if (includesName(`${input.preferred||''} ${input.prompt||''}`, f) && !set.some(x=>x[0]===f.name)) set.unshift([f.name,3,'指定花材']);
  }
  const factor=input.size==='small'?0.78:input.size==='large'?1.3:1;
  const scaled=set.map(([name,qty,role])=>[name,Math.max(1,Math.round(qty*factor)),role]);
  return scaled.map(x=>makeFlower(catalog,...x,palette)).filter(Boolean);
}
function applyAvoid(flowers, catalog, input) {
  const avoid = String(input.avoid||'');
  if (!avoid) return flowers;
  return flowers.filter(f => {
    const ref = flowerByName(catalog,f.name);
    return !includesName(avoid, ref || {name:f.name});
  });
}
function applyExisting(flowers, catalog, input, palette) {
  const existing = String(input.existing||'');
  if (!existing) return flowers;
  const onlyExisting = input.existingPolicy === 'only';
  const out = onlyExisting ? [] : flowers.map(x=>({...x}));
  for (const ref of catalog.flowers) {
    if (!includesName(existing,ref)) continue;
    const qty = parseQty(existing,[ref.name,...(ref.aliases||[])]) || 1;
    const current = out.find(x=>x.name===ref.name);
    if (current) {
      current.existing_quantity = qty;
      current.quantity = Math.max(current.quantity, qty);
      current.subtotal = Math.max(0,current.quantity-qty) * current.unit_price;
      current.from_existing = true;
    } else {
      const f=makeFlower(catalog,ref.name,qty,'已有花材',palette);
      f.existing_quantity=qty; f.subtotal=0; f.from_existing=true; out.push(f);
    }
  }
  return out;
}
function creativeSet(catalog,input) {
  if (input.mode !== 'creative') return [];
  if (Array.isArray(input.lockedCreative)) {
    return input.lockedCreative.map(src=>{
      const c=makeCreative(catalog,src.name,Number(src.quantity||1));
      if(!c) return null;
      c.locked=true; c.existing_quantity=Number(src.existing_quantity||0); c.from_existing=Boolean(src.from_existing);
      if(c.from_existing) c.price=Math.max(0,c.quantity-c.existing_quantity)*c.unit_price;
      return c;
    }).filter(Boolean);
  }
  const text = textOf(input);
  const out=[];
  const onlyExisting=input.existingPolicy==='only';
  const push=(name,qty)=>{ if(!out.some(x=>x.name===name)){const v=makeCreative(catalog,name,qty); if(v)out.push(v);} };
  if(!onlyExisting){
    if (/娃娃|玩偶|小熊|毛绒/.test(text)) push('毛绒娃娃',1);
    if (/草莓|水果|甜品|蛋糕/.test(text)) push('草莓',6);
    if (/零食|薯片|饼干|糖果/.test(text)) push('小包装零食',5);
    if (/饮料|可乐|汽水|罐/.test(text)) push('罐装饮料',1);
    if (/照片|拍立得|相片/.test(text)) push('照片卡',3);
    if (/灯|灯串|发光/.test(text)) push('低压电池灯串',1);
    if (/积木|乐高/.test(text)) push('积木小摆件',2);
    if (/亚克力|主题牌|插牌|文字牌/.test(text)) push('亚克力主题牌',1);
    for (const name of input.aiSuggestions?.creative || []) push(name, name==='草莓'?6:1);
  }

  const existing=String(input.existing||'');
  for (const ref of catalog.creative) {
    if (!includesName(existing,ref)) continue;
    const qty=parseQty(existing,[ref.name,...(ref.aliases||[])])||1;
    const current=out.find(x=>x.name===ref.name);
    if(current){ current.existing_quantity=qty; current.quantity=Math.max(current.quantity,qty); current.price=Math.max(0,current.quantity-qty)*current.unit_price; current.from_existing=true; }
    else { const v=makeCreative(catalog,ref.name,qty); v.existing_quantity=qty; v.price=0; v.from_existing=true; out.push(v); }
  }
  if(!onlyExisting && !out.length) { push('毛绒娃娃',1); push('亚克力主题牌',1); }
  return out;
}
function minimumQty(f,input) {
  if(f.locked) return f.quantity;
  const pref=`${input.preferred||''} ${input.prompt||''}`;
  if (pref.includes(f.name)) return 1;
  if (f.role === '主花') return Math.min(4,f.quantity);
  if (f.role === '叶材') return Math.min(2,f.quantity);
  if (f.role === '线条') return Math.min(1,f.quantity);
  if (f.role === '过渡') return Math.min(2,f.quantity);
  return 0;
}
function adjustBudget(flowers, creative, fixedCost, input) {
  const hasBudget=Number(input.budget)>0;
  const budget=hasBudget?Number(input.budget):0;
  const hard=hasBudget && input.budgetPriority !== 'effect';
  const cloneF=flowers.map(f=>({...f}));
  const cloneC=creative.map(c=>({...c}));
  const flowerCost=()=>cloneF.reduce((s,f)=>s+Number(f.subtotal||0),0);
  const creativeCost=()=>cloneC.reduce((s,c)=>s+Number(c.price||0),0);
  const total=()=>flowerCost()+creativeCost()+fixedCost;
  if(hard){
    let guard=500;
    while(total()>budget && guard--){
      const f=cloneF.filter(x=>x.quantity>minimumQty(x,input) && !x.from_existing).sort((a,b)=>b.unit_price-a.unit_price)[0];
      if(f){f.quantity--;f.subtotal=f.quantity*f.unit_price;continue;}
      const c=cloneC.filter(x=>x.quantity>1 && !x.from_existing && !x.locked && !(`${input.preferred||''} ${input.prompt||''}`).includes(x.name)).sort((a,b)=>b.unit_price-a.unit_price)[0];
      if(c){c.quantity--;c.price=c.quantity*c.unit_price;continue;}
      break;
    }
  }
  const minFeasible=total();
  return {flowers:cloneF.filter(x=>x.quantity>0),creative:cloneC.filter(x=>x.quantity>0),flowerCost:flowerCost(),creativeCost:creativeCost(),total:minFeasible,budget:hasBudget?budget:0,hasBudget,conflict:hard && minFeasible>budget,effectOver:!hard && hasBudget && minFeasible>budget};
}
function chooseMechanics(catalog,input,flowers,creative) {
  const type=input.type || (input.mode==='creative'?'创意花束':'瓶插');
  const hydrangea=flowers.some(f=>f.name==='绣球');
  const heavy=flowers.some(f=>f.catalog?.weight==='heavy') || creative.some(c=>(c.catalog?.weight_g?.[1]||0)>300);
  const isBouquet=/花束|礼盒|创意/.test(type) || input.mode==='creative';
  const pref=String(input.mechanicPreference||'');
  if(!isBouquet && /花泥|泡沫/.test(pref)) return {type:'鲜花泥固定',items:['稳定防水花器','鲜花泥 1 块（按花器裁切）','防水胶带固定花泥','必要时鸡笼网包覆花泥'],why:'按花艺师指定使用鲜花泥。高需水或重花材需要更频繁补水与额外固定。',evidence:['teamflower-mechanics','floralife-hydrangea']};
  if(!isBouquet && /剑山|花插/.test(pref)) return {type:'清水瓶插 + 剑山/花插',items:['稳定花器','剑山/花插 1 个','花泥胶/固定泥','清水'],why:'按花艺师指定使用剑山/花插进行精准角度控制。',evidence:['teamflower-mechanics']};
  if(!isBouquet && /鸡笼网|网格/.test(pref)) return {type:'清水瓶插 + 鸡笼网/胶带网格',items:['稳定花器','鸡笼网或防水胶带网格','清水'],why:'按花艺师指定使用网格类机械结构，保留自然茎秆运动空间。',evidence:['teamflower-mechanics']};
  if(isBouquet){
    const arr=['包装束扎点/内骨架','包装纸 4–6 张','雪梨纸 1–2 张','丝带约 2m'];
    if(flowers.length) arr.splice(1,0,'鲜花根部使用独立保水袋/水管');
    if(creative.length) arr.push('长竹签/玻纤杆 8–14 根','扎带 8–12 条','花艺胶带');
    if(creative.some(c=>c.catalog?.food)) arr.push('食品级独立包装/托杯，与花泥和花材水隔离');
    if(heavy) arr.push('重物独立承重骨架，重心靠下且靠近束扎点');
    return {type:'束扎 + 独立骨架',items:arr,why:'花束采用束扎点承担鲜花结构；创意物件另设支撑，避免把花泥当承重底座。'};
  }
  if(hydrangea) return {type:'清水瓶插 + 鸡笼网/胶带网格',items:['稳定低重心花器','清水持续水源','鸡笼网或井字胶带网格','必要时局部铁丝支撑'],why:'绣球需水量高，优先持续水源；网格负责角度控制而不是让高需水花材离开水源。',evidence:['floralife-hydrangea','teamflower-mechanics']};
  if(/日式|线条|极简/.test(textOf(input))) return {type:'清水瓶插 + 剑山/花插',items:['稳定花器','剑山/花插','花泥胶/固定泥','清水'],why:'线条型少量枝材需要精准方向控制，剑山适合低枝量的角度固定。',evidence:['teamflower-mechanics']};
  return {type:'鸡笼网/网格瓶插',items:['稳定低重心花器','鸡笼网或防水胶带网格','清水','花艺剪','必要时花艺铁丝'],why:'网格提供方向控制并保留较自然的茎秆运动空间。',evidence:['teamflower-mechanics']};
}
function buildSupplies(input,mechanics,creative,palette,flowers=[]) {
  const rows=[];
  const existing=String(input.existing||'');
  const add=(name,quantity,unit,unit_price,purpose,color='')=>{
    const aliases=[name,name.replace('雾面',''),name.replace('鲜花','')];
    const owned=aliases.some(n=>n && existing.includes(n));
    const ownedQty=owned ? (parseQty(existing,aliases)||quantity) : 0;
    rows.push({name,quantity,unit,unit_price,color,purpose,existing_quantity:ownedQty,subtotal:Math.max(0,quantity-ownedQty)*unit_price,from_existing:owned});
  };
  const bouquet=/束扎/.test(mechanics.type) || input.mode==='creative' || /花束|礼盒|创意/.test(input.type||'');
  const wrapColor=(palette||[]).slice(0,2).join(' / ') || '低饱和中性色';
  if(bouquet){
    add('雾面包装纸',5,'张',4,'外层定型与配色',wrapColor);
    add('雪梨纸',2,'张',2,'内层柔化轮廓','半透明白');
    add('丝带',2,'米',3,'束口与收尾',wrapColor);
    add('花艺胶带',1,'份',4,'固定竹签/铁丝','绿色');
    if(flowers.length) add('鲜花保水袋/水管',1,'套',8,'短途运输时维持鲜花根部水分','透明');
    if(creative.length){ add('长竹签/玻纤杆',10,'根',0.8,'创意物件独立支撑','自然色'); add('扎带',10,'条',0.3,'连接物件与支撑杆','透明/白'); }
    if(creative.some(c=>c.catalog?.food)) add('食品级独立包装袋/托杯',Math.max(4,creative.filter(c=>c.catalog?.food).reduce((s,c)=>s+c.quantity,0)),'个',0.8,'隔离食物与花材水/湿花泥','透明');
  } else {
    add('防水花艺胶带',1,'份',5,'固定网格/机械结构','绿色');
    if(/鸡笼网|网格/.test(mechanics.type)) add('鸡笼网/花艺网',0.5,'平方米',12,'控制茎秆角度','金属原色/绿色');
    if(/鲜花泥/.test(mechanics.type)) add('鲜花泥',1,'块',12,'精确固定花茎并供水','绿色');
    if(/剑山|花插/.test(mechanics.type)){ add('剑山/花插',1,'个',28,'精准固定枝条角度','金属'); add('花泥胶/固定泥',1,'份',5,'把剑山固定在花器底部','灰色'); }
    add('花艺剪耗材',1,'份',3,'基础修剪与清洁耗材','');
  }
  return rows;
}
function supplyCost(rows){ return rows.reduce((s,x)=>s+Number(x.subtotal||0),0); }
function buildRuleChecks(catalog,input,flowers,creative,mechanics,cost) {
  const checks=[];
  const add=(id,label,status,detail,source)=>checks.push({id,label,status,detail,source});
  add('real-materials','材料真实性','pass','核心花材与创意物料均来自本地可验证材料库。');
  if(!cost.hasBudget){}
  else if(cost.conflict) add('budget','预算约束','block',`指定条件下最低粗估约 ¥${cost.total}，高于预算 ¥${cost.budget}。建议提高预算、减少指定材料或缩小尺寸。`);
  else if(cost.effectOver) add('budget','预算约束','warn',`你选择了“效果优先”，方案粗估 ¥${cost.total}，高于参考预算 ¥${cost.budget}；系统没有伪装成预算内。`);
  else add('budget','预算约束','pass',`方案粗估 ¥${cost.total}，未超过设定预算 ¥${cost.budget}。`);
  const hyd=flowers.find(f=>f.name==='绣球');
  if(hyd){
    const good=/清水/.test(mechanics.type);
    add('hydrangea-water','绣球供水',good?'pass':'warn',good?'已采用持续清水供水，并提醒充分醒花。':'绣球需水量高，当前结构需要更稳定的持续水源。','floralife-hydrangea');
  }
  const heavyCreative=creative.filter(c=>(c.catalog?.weight_g?.[1]||0)>300 || c.name.includes('娃娃') || c.name.includes('饮料'));
  if(heavyCreative.length) add('heavy-object','重物承重','pass',`${heavyCreative.map(x=>x.name).join('、')}采用独立支撑/托架思路，重心放低，不依赖单点花泥承重。`);
  const food=creative.filter(c=>c.catalog?.food);
  if(food.length) add('food-isolation','食品隔离','pass',`${food.map(x=>x.name).join('、')}保留包装或使用食品级独立包装，与花材水和湿花泥隔离。`);
  if(flowers.some(f=>f.name==='百合') && /猫|宠物猫/.test(textOf(input))) add('pet-lily','宠物环境','block','检测到猫环境与百合同时出现，建议移除百合并替换为非百合花材。');
  const fragile=flowers.filter(f=>f.catalog?.fragility==='high');
  if(fragile.length) add('fragility','易损花材','warn',`${fragile.map(x=>x.name).join('、')}较娇嫩，运输/外伸造型需减少碰撞并设置局部支撑。`);
  const month=Number(input.designMonth||0);
  const seasonal=flowers.filter(f=>!/全年/.test(f.catalog?.season||''));
  const offSeason=month?seasonal.filter(f=>Array.isArray(f.catalog?.peak_months)&&f.catalog.peak_months.length&&!f.catalog.peak_months.includes(month)):seasonal;
  if(offSeason.length) add('seasonality','季节采购','warn',`${offSeason.map(x=>`${x.name}（${x.catalog.season}）`).join('、')}${month?`在 ${month} 月不处于主要优势窗口，`: '存在季节性，'}采购时建议准备替代花材。`);
  if(input.region) add('regional-price','地区价格','warn',`已记录采购地区“${String(input.region).slice(0,40)}”，但 V3 静态价格库不是该地区实时花市价，最终采购前需要二次核价。`);
  const stems=flowers.reduce((n,f)=>n+Number(f.quantity||0),0);
  if(input.size==='large' && flowers.length && stems<24) add('size-density','尺寸与材料密度','warn',`当前目标为大尺寸，但预算压缩后仅保留约 ${stems} 枝鲜花；若要保持约70cm+的饱满体量，建议增加预算或明确接受更轻盈、留白更多的轮廓。`);
  if(wantsNoPlants(input) && flowers.length===0) add('plant-free','无植物创意','pass','已按要求生成不含鲜花/植物的创意结构，未偷偷加入默认花材。');
  return checks;
}
function scoreFromChecks(checks,input,creative) {
  let feasibility=96, stability=94, beginner=88;
  for(const c of checks){
    if(c.status==='block'){ feasibility-=18; stability-=c.id==='heavy-object'?18:4; beginner-=8; }
    if(c.status==='warn'){ feasibility-=5; beginner-=4; }
  }
  if(input.mode==='creative'){ stability-=5; beginner-=8; }
  const creativity=input.mode==='creative' ? 72 + Number(input.creativity||4)*5 : 65 + Math.min(12,Number(input.creativity||2)*3);
  return {feasibility:clamp(feasibility,45,98),creativity:clamp(creativity,50,98),beginner:clamp(beginner,45,96),stability:clamp(stability,55,98)};
}
function buildStructure(input,flowers,creative) {
  const type=input.type || (input.mode==='creative'?'创意花束':'瓶插');
  return {
    silhouette:/花束|创意/.test(type)?'上部舒展、束扎点收窄，整体略不对称':'低重心横向自然伸展，中心密、外围疏',
    focal:'主花与主题物集中在中心略偏下，不把所有花头压在同一平面。',
    mass:'体块花靠近结构中心；大花头不安排在细长悬挑端。',
    line:'线条花向后上方及一侧延伸，最高点和最远点不做完全镜像。',
    balance:creative.length?'娃娃、饮料等较重物件置于中心/低位并独立支撑，轻质材料再向外延展。':'花头重量大的材料靠近花器中心，外围使用轻质线条花与叶材。',
    top_view:'俯视保持中心有组织、外围有呼吸空间；左右体量不必相等，但重心需落在底座范围内。'
  };
}
function buildMetrics(input,flowers,creative,isBouquet) {
  const stemWeight={light:24,medium:42,heavy:78};
  const flowerG=flowers.reduce((s,f)=>s+(stemWeight[f.catalog?.weight]||38)*Number(f.quantity||0),0);
  const creativeG=creative.reduce((s,c)=>{const r=c.catalog?.weight_g||[20,80];return s+((Number(r[0])+Number(r[1]))/2)*Number(c.quantity||0)},0);
  const vesselAndWater=isBouquet?220:1900; // rough combined vessel + working water allowance
  const totalG=Math.round(flowerG+creativeG+vesselAndWater);
  const stems=flowers.reduce((s,f)=>s+Number(f.quantity||0),0);
  const objects=creative.reduce((s,c)=>s+Number(c.quantity||0),0);
  const base=20+stems*1.6+objects*4+(input.mode==='creative'?18:0);
  const minutes=[Math.max(30,Math.round(base*.8/5)*5),Math.max(45,Math.round(base*1.25/5)*5)];
  const complexity=stems+objects*2+(input.mode==='creative'?10:0);
  const difficulty=complexity>42?'偏难':complexity>26?'中等':'入门';
  const stars=difficulty==='偏难'?4:difficulty==='中等'?3:2;
  return {estimated_weight_kg:Number((totalG/1000).toFixed(1)),estimated_minutes:minutes,difficulty,difficulty_stars:stars,weight_note:'重量为结构规划粗估，实际取决于花器、含水量、包装和材料规格。'};
}
function buildViewSpec(flowers,creative,structure,vessel) {
  const anchors=[...flowers.slice(0,5).map((f,i)=>`${f.name}${f.color}×${f.quantity}(${f.role})`),...creative.slice(0,3).map(c=>`${c.name}×${c.quantity}`)];
  return {
    identity: crypto.createHash('sha1').update(JSON.stringify({anchors,structure,vessel})).digest('hex').slice(0,12),
    locked: anchors,
    camera_order:['front','left','back','right','top'],
    strategy:'progressive-reference',
    instruction:'每一视图必须保持同一件实体作品：材料种类、数量感、包装/花器、焦点物、轮廓比例和关键位置保持一致，只改变观察角度。按相邻角度渐进生成，并给后续视图提供主图与上一相邻视图作为参考。'
  };
}
function localPlan(catalog,input={}) {
  const normalized={...input, mode:input.mode==='creative'?'creative':'floral'};
  if(normalized.idea&&!normalized.prompt)normalized.prompt=normalized.idea;
  if(normalized.lockedStructure){
    normalized.type=normalized.lockedStructure.type||normalized.type;
    normalized.height=normalized.lockedStructure.dimensions?.height||normalized.height;
    normalized.width=normalized.lockedStructure.dimensions?.width||normalized.width;
    normalized.mechanicPreference=normalized.lockedStructure.mechanics?.type||normalized.mechanicPreference;
  }
  const palette=choosePalette(normalized);
  let flowers=baseFlowerSet(catalog,normalized,palette);
  flowers=applyAvoid(flowers,catalog,normalized);
  flowers=applyExisting(flowers,catalog,normalized,palette);
  let creative=creativeSet(catalog,normalized);
  const isBouquet=normalized.mode==='creative' || /花束|礼盒|创意/.test(normalized.type||'');
  const vesselCost=isBouquet?0:42;
  const mechanics=chooseMechanics(catalog,normalized,flowers,creative);
  const supplies=buildSupplies(normalized,mechanics,creative,palette,flowers);
  const suppliesCost=supplyCost(supplies);
  const adjusted=adjustBudget(flowers,creative,vesselCost+suppliesCost,normalized);
  flowers=adjusted.flowers; creative=adjusted.creative;
  const checks=buildRuleChecks(catalog,normalized,flowers,creative,mechanics,adjusted);
  const scores=scoreFromChecks(checks,normalized,creative);
  const structure=buildStructure(normalized,flowers,creative);
  const purple=palette.some(c=>c.includes('紫'));
  const title=normalized.aiSuggestions?.title || (normalized.mode==='creative' ? (purple?'Violet Playground · 紫雾奇想':'Playful Bloom · 奇想花礼') : (purple?'Lavender Whisper · 紫雾低语':'Soft Garden · 柔光花园'));
  const size=normalized.size||'medium';
  const baseDims=size==='small'?{height:38,width:38,depth:28}:size==='large'?{height:72,width:78,depth:52}:{height:56,width:62,depth:42};
  const dims={...baseDims};
  if(Number(normalized.lockedStructure?.dimensions?.depth)>0) dims.depth=Number(normalized.lockedStructure.dimensions.depth);
  if(Number(normalized.height)>0) dims.height=clamp(Number(normalized.height),20,160);
  if(Number(normalized.width)>0) dims.width=clamp(Number(normalized.width),20,180);
  const vessel=isBouquet?{name:'束扎包装结构',color:`${palette.slice(0,2).join(' / ')}的低饱和包装`,size:`展开宽约 ${dims.width}cm`,base:'束扎点 + 包装内骨架'}:{name:'低重心陶瓷花器',color:purple?'奶白 / 灰紫':'奶白',size:'高18–22cm，口径11–14cm，底部建议≥16cm',base:'稳定宽底'};
  const total=adjusted.total;
  const metrics=buildMetrics(normalized,flowers,creative,isBouquet);
  const warnings=checks.filter(x=>x.status!=='pass').map(x=>x.detail);
  const steps=[
    '花材预处理：清洁花器/工具；去除水线以下叶片，重新斜剪并充分补水。高需水花材优先处理。',
    `建立机械结构：${mechanics.type}。${mechanics.why}`,
    '先定最高点、左右边界和前后深度，用线条花/叶材建立不对称轮廓。',
    '加入体块花和主花：焦点保持在中心略偏下，花头前后错层，避免“贴墙式”同一平面。',
    normalized.mode==='creative'?'安装创意物件：先做独立支撑，再放入作品；食品不刺穿原包装，并与花材水/湿花泥隔离。':'加入过渡花与点缀花，补足层次但保留负空间。',
    '完成五面检查：从正、左、后、右、上依次检查空洞、重心、悬挑长度与焦点位置；必要时修剪而不是盲目加花。'
  ];
  return {
    id:crypto.randomUUID(), source:'local-rules', engineVersion:'0.3.0', title, request:{...normalized, aiSuggestions:undefined},
    subtitle:normalized.aiSuggestions?.concept || (normalized.mode==='creative'?'创意优先，但结构和固定方式按现实制作约束':'自然舒展、可采购、可复刻的现实花艺方案'),
    mode:normalized.mode, type:normalized.type || (normalized.mode==='creative'?'创意花束':'瓶插'), occasion:normalized.occasion||'日常赠礼',
    style:normalized.style || STYLE_WORDS.filter(w=>textOf(normalized).includes(w)).join('、') || (normalized.mode==='creative'?'梦幻、有趣':'温柔、自然'),
    palette, dimensions:dims, flowers, creative, vessel, mechanics, supplies,
    cost:{flowers:adjusted.flowerCost,creative:adjusted.creativeCost,vessel:vesselCost,supplies:suppliesCost,total,range:[Math.round(total*.9),Math.round(total*1.15)],budget:adjusted.budget,status:!adjusted.hasBudget?'unbounded':adjusted.conflict?'conflict':adjusted.effectOver?'effect-over':'within',note:catalog.meta.price_note},
    metrics, scores, checks, warnings, structure, steps,
    purchaseContext:{region:normalized.region||'',designMonth:Number(normalized.designMonth||0)||null,priceMode:'static-estimate'},
    substitutionOptions:flowers.filter(f=>f.catalog?.substitutes?.length).map(f=>({for:f.name,options:f.catalog.substitutes.slice(0,3)})),
    locksApplied:{materials:Boolean(normalized.lockedFlowers||normalized.lockedCreative),structure:Boolean(normalized.lockedStructure),palette:Boolean(normalized.paletteLocked),budget:Boolean(normalized.budgetLocked)},
    viewSpec:buildViewSpec(flowers,creative,structure,vessel),
    provenance:{catalog:'内置现实材料库 v0.3',price:'静态示例估算价，不是实时花市价',evidence:unique(checks.map(c=>c.source))}
  };
}
function validatePlan(plan,catalog,input={}) {
  const names=new Set(catalog.flowers.map(x=>x.name));
  const creativeNames=new Set(catalog.creative.map(x=>x.name));
  const errors=[];
  for(const f of plan.flowers||[]) if(!names.has(f.name)) errors.push(`未知花材: ${f.name}`);
  for(const c of plan.creative||[]) if(!creativeNames.has(c.name)) errors.push(`未知创意物料: ${c.name}`);
  if(!plan.viewSpec?.camera_order?.length) errors.push('缺少五视图相机顺序');
  if(!plan.checks?.length) errors.push('缺少现实规则校验');
  if(!Array.isArray(plan.supplies)) errors.push('缺少辅材清单');
  if(Number(plan.cost?.total||0)<0) errors.push('成本异常');
  return {ok:errors.length===0,errors};
}
module.exports={localPlan,validatePlan,choosePalette,parseQty,buildViewSpec};