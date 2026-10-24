export type StyleId = 'nordic' | 'japanese' | 'wabisabi' | 'minimal' | 'industrial' | 'luxury' | 'cream' | 'country' | 'chinese' | 'mediterranean';
export type StyleDesign = {
  seating: 'scandi' | 'platform' | 'organic' | 'slim' | 'pipe' | 'tufted' | 'cloud' | 'shaker' | 'lattice' | 'woven';
  cabinetry: 'flat' | 'slatted' | 'shaker' | 'fluted' | 'lattice';
  tables: 'tapered' | 'trestle' | 'drum' | 'metal' | 'pedestal';
  upholstery: 'linen' | 'boucle' | 'leather' | 'velvet';
  lighting: 'paper' | 'dome' | 'cage' | 'globe';
  rug: 'woven' | 'plain' | 'pattern';
};
export type InteriorStyle = { id: StyleId; name: string; english: string; description: string; wall: string; floor: string; wood: string; fabric: string; accent: string; metal: string; background: string; light: string; floorFinish: 'wood' | 'concrete' | 'marble' | 'tile'; lowFurniture: boolean; rounded: boolean; design: StyleDesign; materialSummary: string[]; features: string[] };
const palettes: Omit<InteriorStyle, 'design' | 'materialSummary' | 'features'>[] = [
  { id: 'nordic', name: '北歐風', english: 'SCANDINAVIAN', description: '淺橡木、米白織品與溫暖自然光', wall: '#f5f1e8', floor: '#e6d4b6', wood: '#d2b58c', fabric: '#e6dfd0', accent: '#b49b7a', metal: '#77766c', background: '#f0ece4', light: '#fff0da', floorFinish: 'wood', lowFurniture: false, rounded: true },
  { id: 'japanese', name: '日系風', english: 'JAPANESE', description: '低重心家具、原木、亞麻與留白', wall: '#efeddf', floor: '#ceb98c', wood: '#ba975e', fabric: '#dfdcc6', accent: '#8b9775', metal: '#4d5040', background: '#eeece3', light: '#fff4de', floorFinish: 'wood', lowFurniture: true, rounded: false },
  { id: 'wabisabi', name: '侘寂風', english: 'WABI-SABI', description: '灰泥、陶土、柔和輪廓與大地色', wall: '#cfc5b4', floor: '#b7aa96', wood: '#9b8162', fabric: '#c9bba3', accent: '#916e55', metal: '#625a4e', background: '#e3dbcf', light: '#ffe7cc', floorFinish: 'concrete', lowFurniture: true, rounded: true },
  { id: 'minimal', name: '現代簡約', english: 'MODERN MINIMAL', description: '俐落直線、黑白灰與低彩度材質', wall: '#f3f3ef', floor: '#d2d2ca', wood: '#b0aaa0', fabric: '#c4c5c0', accent: '#646b6a', metal: '#323a3a', background: '#ebedeb', light: '#f7f9ff', floorFinish: 'concrete', lowFurniture: false, rounded: false },
  { id: 'industrial', name: '工業風', english: 'INDUSTRIAL', description: '清水模、深木色、黑鐵與棕皮革', wall: '#9b9c95', floor: '#898b84', wood: '#79563b', fabric: '#996343', accent: '#9b6446', metal: '#2d3332', background: '#d9dad5', light: '#ffd8aa', floorFinish: 'concrete', lowFurniture: false, rounded: false },
  { id: 'luxury', name: '現代輕奢', english: 'CONTEMPORARY LUXE', description: '淺色石材、胡桃木、黃銅與絨布', wall: '#e9e1d5', floor: '#e0d8c8', wood: '#745a42', fabric: '#cabaa0', accent: '#9a7b57', metal: '#b29555', background: '#ebe5dc', light: '#ffe1af', floorFinish: 'marble', lowFurniture: false, rounded: true },
  { id: 'cream', name: '奶油風', english: 'SOFT CREAM', description: '奶油白、圓弧家具與柔和暖光', wall: '#f6eedd', floor: '#e4d5bb', wood: '#dac6a3', fabric: '#f0e4cd', accent: '#ceb092', metal: '#b6a382', background: '#f3ecdf', light: '#ffebca', floorFinish: 'wood', lowFurniture: false, rounded: true },
  { id: 'country', name: '鄉村風', english: 'MODERN FARMHOUSE', description: '米白木作、鼠尾草綠與自然植栽', wall: '#f0ecdf', floor: '#c3a176', wood: '#b9986c', fabric: '#d2d8c4', accent: '#83916e', metal: '#82785d', background: '#eeece1', light: '#ffefd4', floorFinish: 'wood', lowFurniture: false, rounded: true },
  { id: 'chinese', name: '現代中式', english: 'MODERN CHINESE', description: '深胡桃木、米色布面與墨色金屬', wall: '#e8e2d3', floor: '#b79773', wood: '#69472d', fabric: '#d4c5ab', accent: '#865243', metal: '#302e29', background: '#e7e0d2', light: '#ffe5bf', floorFinish: 'wood', lowFurniture: false, rounded: false },
  { id: 'mediterranean', name: '地中海風', english: 'MEDITERRANEAN', description: '白色灰泥、藍色織品與陶磚', wall: '#f6f3e8', floor: '#d7c5a3', wood: '#b39468', fabric: '#7295b0', accent: '#346b91', metal: '#536c71', background: '#e9eee9', light: '#fff4df', floorFinish: 'tile', lowFurniture: false, rounded: true },
];
const details: Record<StyleId, Pick<InteriorStyle, 'design' | 'materialSummary' | 'features'>> = {
  nordic: { design: { seating: 'scandi', cabinetry: 'flat', tables: 'tapered', upholstery: 'linen', lighting: 'dome', rug: 'woven' }, materialSummary: ['淺橡木紋', '亞麻織布', '霧面烤漆'], features: ['斜腳木框沙發', '輕盈錐形桌腳', '開放層板與柔和暖光'] },
  japanese: { design: { seating: 'platform', cabinetry: 'slatted', tables: 'trestle', upholstery: 'linen', lighting: 'paper', rug: 'woven' }, materialSummary: ['原木細紋', '亞麻', '紙感燈罩'], features: ['低座平台家具', '細木格柵櫃門', '低桌與紙燈'] },
  wabisabi: { design: { seating: 'organic', cabinetry: 'flat', tables: 'drum', upholstery: 'boucle', lighting: 'paper', rug: 'plain' }, materialSummary: ['手抹灰泥', '圈圈絨布', '霧面洞石'], features: ['低矮圓弧量體', '厚實石質桌座', '低對比自然肌理'] },
  minimal: { design: { seating: 'slim', cabinetry: 'flat', tables: 'metal', upholstery: 'linen', lighting: 'globe', rug: 'plain' }, materialSummary: ['微水泥', '細織布', '霧黑金屬'], features: ['纖薄扶手與桌板', '俐落無框櫃面', '細金屬腳與留白'] },
  industrial: { design: { seating: 'pipe', cabinetry: 'flat', tables: 'metal', upholstery: 'leather', lighting: 'cage', rug: 'plain' }, materialSummary: ['棕色皮革', '粗木紋', '黑鐵與清水模'], features: ['外露黑鐵框架', '皮革坐墊與車縫', '管架家具與籠罩燈'] },
  luxury: { design: { seating: 'tufted', cabinetry: 'fluted', tables: 'pedestal', upholstery: 'velvet', lighting: 'globe', rug: 'pattern' }, materialSummary: ['絨布', '紋理石材', '拉絲黃銅'], features: ['絎縫靠背', '直向溝槽櫃門', '石材桌面與金屬細節'] },
  cream: { design: { seating: 'cloud', cabinetry: 'fluted', tables: 'drum', upholstery: 'boucle', lighting: 'dome', rug: 'plain' }, materialSummary: ['奶油圈圈絨', '淺木', '霧面陶質'], features: ['蓬鬆雲朵扶手', '圓弧鼓形桌座', '柔和圓角櫃體'] },
  country: { design: { seating: 'shaker', cabinetry: 'shaker', tables: 'trestle', upholstery: 'linen', lighting: 'dome', rug: 'woven' }, materialSummary: ['刷紋木作', '自然亞麻', '鼠尾草綠烤漆'], features: ['框線門片', '實木橫撐桌腳', '木框沙發與編織地毯'] },
  chinese: { design: { seating: 'lattice', cabinetry: 'lattice', tables: 'trestle', upholstery: 'linen', lighting: 'paper', rug: 'pattern' }, materialSummary: ['深胡桃木', '米色織布', '墨色金屬'], features: ['深木格柵框架', '橫向實木扶手', '回紋層次與端景陳設'] },
  mediterranean: { design: { seating: 'woven', cabinetry: 'slatted', tables: 'pedestal', upholstery: 'linen', lighting: 'dome', rug: 'pattern' }, materialSummary: ['白色灰泥', '藍色織布', '陶磚與藤編'], features: ['編織靠背', '陶磚拼紋', '圓弧桌座與藍白配色'] },
};
export const interiorStyles: InteriorStyle[] = palettes.map(style => ({ ...style, ...details[style.id] }));
export const getInteriorStyle = (id?: StyleId) => interiorStyles.find(s => s.id === id) || interiorStyles[0];
