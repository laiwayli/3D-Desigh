export type FurnitureSpec = { name: string; w: number; d: number; h: number; group: string };

/** Dimensions are metres; names and defaults stay compatible with saved projects. */
export const catalog = {
  sofa: { name: '三人沙發', w: 2.6, d: .95, h: .82, group: '客廳' },
  chair: { name: '單人椅', w: .8, d: .8, h: .82, group: '客廳' },
  table: { name: '餐桌', w: 1.65, d: .9, h: .75, group: '餐廳' },
  bed: { name: '雙人床', w: 1.8, d: 2.1, h: .95, group: '臥室' },
  bunkBed: { name: '上下舖', w: 1.05, d: 2.1, h: 1.85, group: '臥室' },
  doubleDesk: { name: '雙人工作桌', w: 2, d: .65, h: .75, group: '書房' },
  kitchen: { name: '廚房檯面', w: 2.8, d: .65, h: .9, group: '廚房' },
  plant: { name: '植栽', w: .55, d: .55, h: 1.1, group: '軟裝' },
  desk: { name: '工作桌', w: 1.5, d: .65, h: .75, group: '書房' },
  toilet: { name: '馬桶', w: .65, d: .85, h: .75, group: '衛浴' },
  shower: { name: '淋浴間', w: 1.1, d: 1.1, h: 2.1, group: '衛浴' },
  wardrobe: { name: '收納櫃', w: 2, d: .6, h: 2.2, group: '收納' },
  tv: { name: '電視與矮櫃', w: 1.8, d: .38, h: 1.3, group: '客廳' },
  sectionalSofa: { name: 'L 型沙發', w: 2.9, d: 1.8, h: .82, group: '客廳' },
  loveseat: { name: '雙人沙發', w: 1.7, d: .88, h: .82, group: '客廳' },
  armchair: { name: '扶手休閒椅', w: .88, d: .9, h: .9, group: '客廳' },
  ottoman: { name: '腳凳', w: .6, d: .45, h: .4, group: '客廳' },
  roundTable: { name: '圓餐桌', w: 1.2, d: 1.2, h: .75, group: '餐廳' },
  coffeeTable: { name: '茶几', w: 1.1, d: .55, h: .38, group: '客廳' },
  sideTable: { name: '邊几', w: .5, d: .5, h: .52, group: '客廳' },
  bench: { name: '長凳', w: 1.2, d: .4, h: .45, group: '餐廳' },
  diningChair: { name: '餐椅', w: .48, d: .52, h: .82, group: '餐廳' },
  barStool: { name: '吧檯椅', w: .42, d: .42, h: .68, group: '餐廳' },
  officeChair: { name: '辦公椅', w: .65, d: .65, h: 1.05, group: '書房' },
  singleBed: { name: '單人床', w: 1.05, d: 2.05, h: .85, group: '臥室' },
  crib: { name: '嬰兒床', w: .75, d: 1.3, h: .95, group: '臥室' },
  nightstand: { name: '床頭櫃', w: .5, d: .4, h: .5, group: '臥室' },
  dresser: { name: '抽屜斗櫃', w: 1.2, d: .45, h: .85, group: '收納' },
  bookshelf: { name: '書櫃', w: 1.2, d: .32, h: 2, group: '書房' },
  shoeCabinet: { name: '鞋櫃', w: 1.2, d: .35, h: 1.1, group: '收納' },
  sideboard: { name: '餐邊櫃', w: 1.5, d: .45, h: .85, group: '收納' },
  fridge: { name: '冰箱', w: .75, d: .7, h: 1.85, group: '廚房' },
  oven: { name: '烤箱櫃', w: .6, d: .6, h: .9, group: '廚房' },
  dishwasher: { name: '洗碗機', w: .6, d: .6, h: .85, group: '廚房' },
  kitchenIsland: { name: '中島', w: 1.8, d: .9, h: .9, group: '廚房' },
  vanity: { name: '浴室洗手台', w: .8, d: .5, h: .85, group: '衛浴' },
  bathtub: { name: '浴缸', w: 1.7, d: .75, h: .6, group: '衛浴' },
  washingMachine: { name: '洗衣機', w: .6, d: .65, h: .85, group: '衛浴' },
  pendant: { name: '吊燈', w: .55, d: .55, h: .4, group: '燈飾' },
  floorLamp: { name: '立燈', w: .45, d: .45, h: 1.65, group: '燈飾' },
  rug: { name: '地毯', w: 2.4, d: 1.6, h: .02, group: '軟裝' },
  curtain: { name: '窗簾', w: 2.4, d: .12, h: 2.6, group: '軟裝' },
  screen: { name: '屏風', w: 1.5, d: .12, h: 1.8, group: '軟裝' },
} satisfies Record<string, FurnitureSpec>;

export type FurnitureKind = keyof typeof catalog;
export type FurnitureVariant = { id: string; kind: FurnitureKind; name: string; w: number; d: number; h: number; tags?: string[] };
type VariantDimensions = [id: string, name: string, w: number, d: number, h: number, tags?: string[]];

function variants(kind: FurnitureKind, dimensions: VariantDimensions[]): FurnitureVariant[] {
  return dimensions.map(([id, name, w, d, h, tags]) => ({ id: `${kind}-${id}`, kind, name, w, d, h, ...(tags ? { tags } : {}) }));
}

/** Useful physical sizes, rather than duplicate entries named after material colours. */
export const furnitureVariants: FurnitureVariant[] = [
  ...variants('sofa', [['standard', '標準三人', 2.6, .95, .82], ['compact', '小宅三人', 2.2, .88, .8, ['小宅']], ['wide', '寬座三人', 2.9, 1.05, .86]]),
  ...variants('chair', [['standard', '標準單椅', .8, .8, .82], ['compact', '輕巧單椅', .65, .7, .8, ['小宅']]]),
  ...variants('table', [['four', '四人桌', 1.35, .8, .75], ['six', '六人桌', 1.65, .9, .75], ['eight', '八人長桌', 2.1, .95, .75]]),
  ...variants('bed', [['queen', '標準雙人 150', 1.5, 2, .95], ['king', '加大雙人 180', 1.8, 2.1, .95], ['super-king', '特大雙人 200', 2, 2.1, 1]]),
  ...variants('bunkBed', [['single', '單人上下舖', 1.05, 2.1, 1.85, ['兒童', '上下床']], ['wide', '加寬上下舖', 1.2, 2.15, 1.9, ['兒童']]]),
  ...variants('doubleDesk', [['standard', '雙工作位 200', 2, .65, .75, ['WFH', '雙人']], ['wide', '雙工作位 240', 2.4, .7, .75, ['WFH', '雙人']]]),
  ...variants('kitchen', [['standard', '一字型 280', 2.8, .65, .9, ['流理台']], ['compact', '一字型 180', 1.8, .6, .9, ['小宅', '流理台']], ['long', '一字型 360', 3.6, .65, .9, ['流理台']]]),
  ...variants('plant', [['medium', '中型盆栽', .55, .55, 1.1], ['small', '小型盆栽', .3, .3, .5, ['小宅']], ['tall', '大型落地盆栽', .8, .8, 1.8]]),
  ...variants('desk', [['standard', '標準工作桌', 1.5, .65, .75, ['WFH']], ['compact', '小宅工作桌', 1.1, .55, .75, ['WFH', '小宅']]]),
  ...variants('toilet', [['standard', '標準馬桶', .65, .85, .75], ['compact', '短版馬桶', .56, .7, .72, ['小宅']]]),
  ...variants('shower', [['standard', '方形淋浴 110', 1.1, 1.1, 2.1, ['乾濕分離']], ['compact', '方形淋浴 90', .9, .9, 2.1, ['乾濕分離', '小宅']], ['wide', '長形淋浴 140', 1.4, .9, 2.1, ['乾濕分離']]]),
  ...variants('wardrobe', [['standard', '衣櫃 200', 2, .6, 2.2, ['衣櫃']], ['compact', '衣櫃 120', 1.2, .6, 2.2, ['衣櫃', '小宅']], ['wide', '衣櫃 300', 3, .6, 2.4, ['衣櫃']]]),
  ...variants('tv', [['standard', '電視矮櫃 180', 1.8, .38, 1.3], ['compact', '電視矮櫃 120', 1.2, .35, 1.1, ['小宅']], ['wide', '電視矮櫃 240', 2.4, .4, 1.3]]),
  ...variants('sectionalSofa', [['standard', 'L 型 290', 2.9, 1.8, .82, ['貴妃椅']], ['compact', '小宅 L 型 250', 2.5, 1.6, .8, ['貴妃椅', '小宅']], ['wide', '寬座 L 型 330', 3.3, 2, .86, ['貴妃椅']]]),
  ...variants('loveseat', [['standard', '標準雙人', 1.7, .88, .82], ['compact', '小宅雙人', 1.4, .78, .8, ['小宅']]]),
  ...variants('armchair', [['standard', '標準扶手椅', .88, .9, .9], ['wide', '寬座閱讀椅', 1, 1, 1, ['閱讀']]]),
  ...variants('ottoman', [['standard', '長形腳凳', .6, .45, .4], ['square', '方形腳凳', .75, .75, .4]]),
  ...variants('roundTable', [['four', '圓桌直徑 120', 1.2, 1.2, .75], ['compact', '圓桌直徑 90', .9, .9, .75, ['小宅']], ['six', '圓桌直徑 150', 1.5, 1.5, .75]]),
  ...variants('coffeeTable', [['standard', '長形茶几', 1.1, .55, .38], ['compact', '小型茶几', .8, .45, .35, ['小宅']]]),
  ...variants('sideTable', [['standard', '標準邊几', .5, .5, .52], ['compact', '窄型邊几', .35, .4, .55, ['小宅']]]),
  ...variants('bench', [['standard', '雙人長凳', 1.2, .4, .45], ['long', '三人長凳', 1.6, .42, .45]]),
  ...variants('diningChair', [['standard', '標準餐椅', .48, .52, .82], ['arm', '寬座餐椅', .58, .6, .84]]),
  ...variants('barStool', [['counter', '中島椅高 68', .42, .42, .68], ['bar', '高吧椅高 78', .45, .45, .78]]),
  ...variants('officeChair', [['standard', '標準辦公椅', .65, .65, 1.05, ['WFH']], ['compact', '小型辦公椅', .58, .58, .95, ['WFH', '小宅']]]),
  ...variants('singleBed', [['standard', '單人 105', 1.05, 2.05, .85], ['wide', '加大單人 120', 1.2, 2.05, .85]]),
  ...variants('crib', [['standard', '標準嬰兒床', .75, 1.3, .95, ['兒童']], ['compact', '小型嬰兒床', .65, 1.1, .9, ['兒童', '小宅']]]),
  ...variants('nightstand', [['standard', '標準床頭櫃', .5, .4, .5], ['compact', '窄型床頭櫃', .35, .35, .5, ['小宅']]]),
  ...variants('dresser', [['standard', '三層斗櫃', 1.2, .45, .85], ['tall', '窄高斗櫃', .75, .45, 1.15]]),
  ...variants('bookshelf', [['standard', '高書櫃 120', 1.2, .32, 2, ['閱讀']], ['compact', '窄書櫃 60', .6, .3, 1.8, ['閱讀', '小宅']]]),
  ...variants('shoeCabinet', [['standard', '鞋櫃 120', 1.2, .35, 1.1, ['玄關']], ['compact', '窄鞋櫃 80', .8, .3, 1.1, ['玄關', '小宅']]]),
  ...variants('sideboard', [['standard', '餐邊櫃 150', 1.5, .45, .85], ['compact', '餐邊櫃 100', 1, .4, .85, ['小宅']]]),
  ...variants('fridge', [['standard', '雙門冰箱', .75, .7, 1.85], ['wide', '寬版冰箱 91', .91, .75, 1.8]]),
  ...variants('oven', [['standard', '單烤箱櫃', .6, .6, .9], ['tall', '高身烤箱櫃', .6, .65, 2.1]]),
  ...variants('dishwasher', [['standard', '標準洗碗機', .6, .6, .85], ['slim', '窄型洗碗機', .45, .6, .85, ['小宅']]]),
  ...variants('kitchenIsland', [['standard', '中島 180', 1.8, .9, .9], ['compact', '小型中島 120', 1.2, .75, .9, ['小宅']], ['wide', '寬中島 240', 2.4, 1, .9]]),
  ...variants('vanity', [['standard', '單盆洗手台', .8, .5, .85], ['double', '加寬洗手台 150', 1.5, .55, .85]]),
  ...variants('bathtub', [['standard', '標準浴缸', 1.7, .75, .6], ['compact', '小型浴缸', 1.4, .7, .6, ['小宅']]]),
  ...variants('washingMachine', [['standard', '滾筒洗衣機', .6, .65, .85], ['tall', '加高洗衣機 105', .6, .62, 1.05]]),
  ...variants('pendant', [['standard', '吊燈直徑 55', .55, .55, .4], ['compact', '吊燈直徑 35', .35, .35, .3]]),
  ...variants('floorLamp', [['standard', '標準立燈', .45, .45, 1.65], ['slim', '細身立燈', .3, .3, 1.5, ['小宅']]]),
  ...variants('rug', [['standard', '客廳地毯 240', 2.4, 1.6, .02], ['compact', '小型地毯 160', 1.6, 1.1, .02, ['小宅']], ['wide', '大地毯 300', 3, 2, .02]]),
  ...variants('curtain', [['standard', '窗簾寬 240', 2.4, .12, 2.6], ['compact', '窗簾寬 150', 1.5, .12, 2.4]]),
  ...variants('screen', [['standard', '三折屏風', 1.5, .12, 1.8], ['wide', '寬版屏風 200', 2, .14, 1.8]]),
];

export const furnitureGroups = [...new Set(Object.values(catalog).map(item => item.group))];

export function searchFurniture(query: string, group = '全部'): FurnitureKind[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (Object.keys(catalog) as FurnitureKind[]).filter(kind => {
    const entry = catalog[kind];
    if (group !== '全部' && entry.group !== group) return false;
    const text = [kind, entry.name, entry.group, ...furnitureVariants.filter(v => v.kind === kind).flatMap(v => [v.name, ...(v.tags || [])])].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
