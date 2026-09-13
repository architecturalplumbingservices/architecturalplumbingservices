const VAT_DEFAULT = 15;
const MATERIAL_MARKUP = 45;
let selectedSupplier = 'plumblink';
const currency = value => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(value) || 0);
const $ = id => document.getElementById(id);
let materials = [];
let services = [];
let sitePhotos = [];
let loadedQuoteIndex = null;
let isAmended = false;
const defaultLabourItems = () => [
    { description: 'Call-out fee', unit: 'Each', quantity: 1, rate: 650, type: 'callout' },
    { description: 'Inspection & evaluation', unit: 'Day', quantity: 0, rate: 500, type: 'labour' },
    { description: 'Additional labour', unit: 'Day', quantity: 0, rate: 500, type: 'labour' }
];
let labourItems = defaultLabourItems();
let importedServiceRates = {};
let settings = JSON.parse(localStorage.getItem('pipewise-settings') || '{}');
settings.name ||= 'APS Architectural Plumbing Services';
settings.preparedBy ||= 'Cheyenne';
settings.phone ||= '076 705 8718';
settings.email ||= 'architecturalplumbingservices@gmail.com';
settings.taxNumber ||= '105 976 616';
let quotes = JSON.parse(localStorage.getItem('pipewise-quotes') || '[]');
const plumbingCatalogue = {
    Pipes: {
        'PVC pressure pipe': { sizes: { '15mm x 6m': 120, '22mm x 6m': 180, '28mm x 6m': 260, '50mm x 6m': 205, '110mm x 6m': 349 }, markup: MATERIAL_MARKUP },
        'Copper pipe': { sizes: { '15mm x 5.5m': 450, '22mm x 5.5m': 680 }, markup: MATERIAL_MARKUP },
        'PEX pipe': { sizes: { '16mm x 100m': 1800, '20mm x 100m': 2500 }, markup: 30 },
        'HDPE drainage pipe': { sizes: { '110mm x 5m': 985.94 }, markup: MATERIAL_MARKUP },
    },
    Fittings: {
        'PVC elbow': { sizes: { '15mm': 35, '22mm': 45, '28mm': 65 }, markup: 30 },
        'PVC tee': { sizes: { '15mm': 45, '22mm': 60, '28mm': 85 }, markup: 30 },
        'PVC coupling': { sizes: { '15mm': 30, '22mm': 40, '28mm': 55, '110mm': 150 }, markup: 30 },
        'Copper repair coupling': { sizes: { '15mm': 97.62, '22mm': 124.26 }, markup: MATERIAL_MARKUP },
        'Copper elbow': { sizes: { '15mm': 6 }, markup: MATERIAL_MARKUP },
        'Copper tee': { sizes: { '15mm': 13 }, markup: MATERIAL_MARKUP },
        'HDPE bend': { sizes: { '40mm 90deg': 42.61 }, markup: MATERIAL_MARKUP }
    },
    Valves: {
        'Ball valve': { sizes: { '15mm': 350, '22mm': 450 }, markup: 30 },
        'Stopcock': { sizes: { '15mm': 220, '22mm': 280 }, markup: 30 },
        'Tank float valve kit': { sizes: { '20mm': 296.01 }, markup: 30 },
        'Geyser safety valve': { sizes: { '15mm': 350, '22mm': 450 }, markup: 30 }
    },
    'Sanitary ware': {
        Tap: { sizes: { Standard: 850 }, markup: MATERIAL_MARKUP },
        'Mixer tap': { sizes: { Standard: 1200 }, markup: MATERIAL_MARKUP },
        Basin: { sizes: { Standard: 950 }, markup: MATERIAL_MARKUP },
        Toilet: { sizes: { Standard: 1800 }, markup: MATERIAL_MARKUP },
        'Shower screen': { sizes: { '900 x 2000mm': 2295 }, markup: MATERIAL_MARKUP },
        'Vanity cabinet': { sizes: { '600mm': 3195 }, markup: MATERIAL_MARKUP }
    },
    'Brass tapware': {
        'Basin mixer': { sizes: { '15mm': 1372.26 }, markup: MATERIAL_MARKUP },
        'Bath/shower mixer': { sizes: { '15mm': 1372.26 }, markup: MATERIAL_MARKUP },
        'Pillar tap': { sizes: { '15mm': 650 }, markup: MATERIAL_MARKUP },
        'Sink mixer': { sizes: { '15mm': 950 }, markup: MATERIAL_MARKUP }
    },
    'Waste & traps': {
        'P-trap': { sizes: { '40mm': 140, '50mm': 180 }, markup: MATERIAL_MARKUP },
        'Bottle trap': { sizes: { '32mm': 190, '40mm': 220 }, markup: MATERIAL_MARKUP },
        'Floor drain': { sizes: { '50mm 100x100mm': 221.27 }, markup: MATERIAL_MARKUP },
        'Waste fitting': { sizes: { '40mm': 120, '50mm': 150 }, markup: MATERIAL_MARKUP }
    },
    'Water heating': {
        Geyser: { sizes: { '100L': 4799, '150L': 6200, '200L': 7800 }, markup: MATERIAL_MARKUP },
        'Geyser element': { sizes: { '2kW': 550, '3kW': 650 }, markup: MATERIAL_MARKUP },
        'Geyser thermostat': { sizes: { Standard: 350 }, markup: MATERIAL_MARKUP }
    },
    'Solar water heating': {
        'Solar geyser system': { sizes: { '150L': 12000, '200L': 15000 }, markup: MATERIAL_MARKUP },
        'Solar controller kit': { sizes: { Standard: 3979 }, markup: MATERIAL_MARKUP },
        'Solar collector': { sizes: { Standard: 4500 }, markup: MATERIAL_MARKUP }
    },
    'Storage tanks & pumps': {
        'Water storage tank': { sizes: { '500L': 3500, '1000L': 6200, '2500L': 13500 }, markup: MATERIAL_MARKUP },
        'Pressure pump': { sizes: { '0.75kW': 3200, '1.1kW': 4800 }, markup: MATERIAL_MARKUP },
        'Booster pump': { sizes: { Standard: 2800 }, markup: MATERIAL_MARKUP },
        'Float valve': { sizes: { '20mm': 296.01 }, markup: MATERIAL_MARKUP }
    },
    'HDPE drainage & water supply': {
        'HDPE drainage pipe': { sizes: { '110mm x 5m': 985.94 }, markup: MATERIAL_MARKUP },
        'HDPE bend': { sizes: { '40mm 90deg': 42.61 }, markup: MATERIAL_MARKUP },
        'HDPE coupling': { sizes: { '40mm': 85, '50mm': 110 }, markup: MATERIAL_MARKUP },
        'HDPE water pipe': { sizes: { '25mm x 100m': 1800, '32mm x 100m': 2600 }, markup: MATERIAL_MARKUP }
    },
    'Water supply': {
        'Multilayer pipe': { sizes: { '16mm x 100m': 1800, '20mm x 100m': 2500, '25mm x 100m': 3200 }, markup: MATERIAL_MARKUP },
        'Poly pipe': { sizes: { '20mm x 100m': 950, '25mm x 100m': 1400, '32mm x 100m': 2200 }, markup: MATERIAL_MARKUP },
        'Galvanised pipe': { sizes: { '15mm x 6m': 350, '22mm x 6m': 500, '28mm x 6m': 700 }, markup: MATERIAL_MARKUP },
        'Compression fitting': { sizes: { '15mm': 45, '22mm': 65, '28mm': 90 }, markup: MATERIAL_MARKUP }
    },
    'Drainage & sewer': {
        'Underground PVC pipe': { sizes: { '50mm x 6m': 205, '110mm x 6m': 349, '160mm x 6m': 850 }, markup: MATERIAL_MARKUP },
        'Waste pipe': { sizes: { '40mm x 3m': 95, '50mm x 3m': 120 }, markup: MATERIAL_MARKUP },
        'Sewer bend': { sizes: { '110mm 45deg': 75, '110mm 87.5deg': 95, '160mm 45deg': 180 }, markup: MATERIAL_MARKUP },
        'Inspection eye': { sizes: { '110mm': 85, '160mm': 190 }, markup: MATERIAL_MARKUP },
        'Gully trap': { sizes: { '110mm': 220, '160mm': 380 }, markup: MATERIAL_MARKUP },
        'Pan connector': { sizes: { '110mm': 180 }, markup: MATERIAL_MARKUP }
    },
    Guttering: {
        'Gutter length': { sizes: { '100mm x 3m': 180, '125mm x 3m': 240 }, markup: MATERIAL_MARKUP },
        'Downpipe': { sizes: { '75mm x 3m': 150, '110mm x 3m': 220 }, markup: MATERIAL_MARKUP },
        'Gutter outlet': { sizes: { '75mm': 80, '110mm': 110 }, markup: MATERIAL_MARKUP },
        'Gutter bracket': { sizes: { '100mm': 19, '125mm': 25 }, markup: MATERIAL_MARKUP },
        'Gutter end cap': { sizes: { '100mm': 35, '125mm': 45 }, markup: MATERIAL_MARKUP }
    },
    'Geyser accessories': {
        'Vacuum breaker': { sizes: { '20mm': 105 }, markup: MATERIAL_MARKUP },
        'Geyser tray': { sizes: { '100L': 450, '150L': 550, '200L': 650 }, markup: MATERIAL_MARKUP },
        'Geyser drip tray': { sizes: { '580mm': 450, '660mm': 550 }, markup: MATERIAL_MARKUP },
        'Geyser overflow pipe': { sizes: { '22mm x 3m': 90 }, markup: MATERIAL_MARKUP },
        'Geyser installation kit': { sizes: { Standard: 950 }, markup: MATERIAL_MARKUP }
    },
    'Bathroom accessories': {
        'Shower rail': { sizes: { '600mm': 350, '900mm': 550 }, markup: MATERIAL_MARKUP },
        'Towel rail': { sizes: { '600mm': 450, '800mm': 650 }, markup: MATERIAL_MARKUP },
        'Toilet roll holder': { sizes: { Standard: 250 }, markup: MATERIAL_MARKUP },
        'Robe hook': { sizes: { Standard: 180 }, markup: MATERIAL_MARKUP },
        'Bathroom mirror': { sizes: { '600 x 600mm': 650, '1000 x 460mm': 1450 }, markup: MATERIAL_MARKUP }
    },
    Kitchen: {
        'Kitchen sink': { sizes: { '1 bowl': 1200, '1.5 bowl': 1800, '2 bowl': 2400 }, markup: MATERIAL_MARKUP },
        'Sink mixer': { sizes: { Standard: 950 }, markup: MATERIAL_MARKUP },
        'Sink waste': { sizes: { '90mm': 180 }, markup: MATERIAL_MARKUP },
        'Waste disposal connector': { sizes: { Standard: 350 }, markup: MATERIAL_MARKUP }
    },
    'Consumables & tools': {
        'PTFE thread tape': { sizes: { '12mm x 12m': 18, '19mm x 15m': 28 }, markup: MATERIAL_MARKUP },
        'Pipe jointing compound': { sizes: { '100g': 55, '250g': 95 }, markup: MATERIAL_MARKUP },
        'Silicone sealant': { sizes: { '280ml': 95 }, markup: MATERIAL_MARKUP },
        'Pipe insulation': { sizes: { '15mm x 1m': 35, '22mm x 1m': 45 }, markup: MATERIAL_MARKUP },
        'Pipe clips': { sizes: { '15mm': 8, '22mm': 10, '28mm': 12 }, markup: MATERIAL_MARKUP }
    },
    'Other': {
        'Solvent cement': { sizes: { '250ml': 85 }, markup: 30 },
        'Flexible connector': { sizes: { Standard: 90 }, markup: 30 },
        'Pipe clips': { sizes: { Standard: 8 }, markup: 30 }
    }
};
const catalogueCategories = Object.keys(plumbingCatalogue);
const serviceCatalogue = {
    'Plumbing work': ['Repair leaking pipes', 'Install new water pipes', 'Replace damaged pipes', 'Repair or replace taps', 'Install toilet, basin, bath or shower', 'Install geyser', 'Repair geyser', 'Install pressure valve or water meter', 'Install drainage or sewer pipes', 'Unblock drain or sewer line', 'Repair burst pipe', 'Leak detection'],
    'Excavation & ground work': ['Dig trench for water or sewer pipe', 'Excavate to access underground pipe', 'Remove soil and rubble', 'Backfill trench', 'Compact or stamp ground', 'Level ground'],
    'Breaking & access': ['Break and remove concrete', 'Remove paving', 'Cut trench through paving or concrete', 'Core drill through wall', 'Chase wall for new pipe'],
    'Restoration': ['Replace paving', 'Relay paving', 'Repair concrete', 'Fill and cement hole', 'Plaster wall', 'Repair tiles', 'Reinstall cupboard or panel', 'Make good damaged area'],
    'Additional labour': ['Sift soil and remove rubble', 'Move soil', 'Remove building rubble', 'Load or unload materials', 'Clean work area', 'Install sleeves and pipe protection'],
    Equipment: ['Jackhammer hire', 'Ground compactor hire', 'Excavator hire', 'Core drill hire']
};
serviceCatalogue['Plumbing work'].push('Call-out and inspection', 'Locate leak', 'Protect surrounding area', 'Mark affected area', 'Isolate water', 'Disconnect old toilet', 'Remove old toilet', 'Supply toilet', 'Install new toilet', 'Connect water supply', 'Connect waste pipe', 'Seal toilet', 'Test flushing', 'Check for leaks', 'Site inspection', 'Measure location', 'Mark pipe positions', 'Install toilet', 'Connect water', 'Seal installation', 'Disconnect water', 'Disconnect waste pipe', 'Remove old basin', 'Supply basin', 'Install basin', 'Install taps', 'Install waste fitting', 'Connect waste', 'Seal basin', 'Remove old bath', 'Supply new bath', 'Install bath', 'Connect taps', 'Test drainage', 'Seal bath', 'Remove shower enclosure', 'Remove old shower tray', 'Repair plumbing', 'Supply new shower', 'Install shower tray', 'Install mixer', 'Install shower enclosure', 'Seal shower', 'Test water pressure', 'Inspect toilet', 'Attempt manual blockage removal', 'Use drain rods', 'Use drain machine', 'Remove blockage', 'Flush toilet', 'Inspect sewer line', 'Open inspection point', 'Locate blockage', 'High-pressure jetting', 'CCTV inspection', 'Test sewer flow', 'Close inspection point', 'Locate damaged section', 'Remove damaged pipe', 'Supply new pipe', 'Install sewer pipe', 'Install fittings', 'Check pipe gradient', 'Test water flow', 'Shut off main water', 'Locate existing pipe', 'Remove old pipe', 'Install new pipe', 'Install shut-off valve', 'Connect to municipal supply', 'Pressure test', 'Flush pipe', 'Inspect installation point', 'Install pipe', 'Drill through wall', 'Install isolation valve', 'Record meter reading', 'Inspect geyser', 'Isolate electricity', 'Drain geyser', 'Replace valve', 'Replace pipe', 'Replace fittings', 'Refill geyser', 'Restore electricity', 'Test operation', 'Remove old element', 'Supply new element', 'Install new element', 'Replace gasket', 'Test geyser', 'Prepare installation area', 'Supply pump', 'Install pump', 'Install inlet pipe', 'Install outlet pipe', 'Connect electrical supply', 'Prime pump', 'Test water pressure');
serviceCatalogue['Excavation & ground work'].push('Excavate trench', 'Excavate soil', 'Sift soil', 'Remove excess soil', 'Load rubble', 'Carefully remove paving', 'Store paving for reuse', 'Prepare concrete area', 'Pour new concrete', 'Finish concrete');
serviceCatalogue['Breaking & access'].push('Remove tiles', 'Open or chase wall', 'Expose pipe', 'Cut damaged pipe', 'Break concrete or floor', 'Remove concrete rubble');
serviceCatalogue.Restoration.push('Close wall', 'Plaster wall', 'Replace tiles', 'Paint touch-up', 'Reinstate paving or concrete', 'Reinstall paving', 'Level paving');
serviceCatalogue['Additional labour'].push('Mark excavation area', 'Protect surrounding area', 'Remove old toilet', 'Remove rubble', 'Clean area', 'Seal wall opening', 'Restore water supply');
const serviceRates = { 'Repair leaking pipes': 450, 'Install new water pipes': 650, 'Dig trench for water or sewer pipe': 550, 'Backfill trench': 400, 'Compact or stamp ground': 350, 'Remove paving': 450, 'Repair concrete': 550, 'Repair tiles': 450, 'Clean work area': 250, 'Jackhammer hire': 750, 'Ground compactor hire': 650, 'Excavator hire': 1800 };
const storedServiceRates = JSON.parse(localStorage.getItem('pipewise-service-rates') || '{}');
Object.assign(serviceRates, storedServiceRates);
const serviceUnits = JSON.parse(localStorage.getItem('pipewise-service-units') || '{}');
const scenarios = {
    'underground-pipe': { services: [{ category: 'Plumbing work', task: 'Replace damaged pipes', quantity: 1, rate: 650 }, { category: 'Excavation & ground work', task: 'Dig trench for water or sewer pipe', quantity: 1, rate: 550 }, { category: 'Excavation & ground work', task: 'Backfill trench', quantity: 1, rate: 400 }, { category: 'Restoration', task: 'Make good damaged area', quantity: 1, rate: 550 }], materials: [{ category: 'Pipes', type: 'PVC pressure pipe', size: '110mm x 6m', quantity: 1, description: 'PVC pressure pipe - 110mm x 6m', cost: 349, markup: MATERIAL_MARKUP }, { category: 'Fittings', type: 'PVC coupling', size: '110mm', quantity: 2, description: 'PVC coupling - 110mm', cost: 0, markup: MATERIAL_MARKUP }] },
    'blocked-drain': { services: [{ category: 'Plumbing work', task: 'Unblock drain or sewer line', quantity: 1, rate: 650 }, { category: 'Additional labour', task: 'Clean work area', quantity: 1, rate: 250 }], materials: [{ category: 'Waste & traps', type: 'Waste fitting', size: '110mm', quantity: 1, description: 'Waste fitting - 110mm', cost: 150, markup: MATERIAL_MARKUP }] },
    'geyser-install': { services: [{ category: 'Plumbing work', task: 'Install geyser', quantity: 1, rate: 1200 }], materials: [{ category: 'Water heating', type: 'Geyser', size: '100L', quantity: 1, description: 'Geyser - 100L', cost: 4799, markup: MATERIAL_MARKUP }, { category: 'Geyser accessories', type: 'Geyser installation kit', size: 'Standard', quantity: 1, description: 'Geyser installation kit - Standard', cost: 950, markup: MATERIAL_MARKUP }] },
    'bathroom-install': { services: [{ category: 'Plumbing work', task: 'Install toilet, basin, bath or shower', quantity: 1, rate: 950 }, { category: 'Restoration', task: 'Make good damaged area', quantity: 1, rate: 550 }], materials: [{ category: 'Sanitary ware', type: 'Toilet', size: 'Standard', quantity: 1, description: 'Toilet - Standard', cost: 1800, markup: MATERIAL_MARKUP }, { category: 'Sanitary ware', type: 'Basin', size: 'Standard', quantity: 1, description: 'Basin - Standard', cost: 950, markup: MATERIAL_MARKUP }] },
    'leak-repair': { services: [{ category: 'Plumbing work', task: 'Repair leaking pipes', quantity: 1, rate: 450 }, { category: 'Plumbing work', task: 'Leak detection', quantity: 1, rate: 350 }], materials: [{ category: 'Consumables & tools', type: 'PTFE thread tape', size: '12mm x 12m', quantity: 1, description: 'PTFE thread tape - 12mm x 12m', cost: 18, markup: MATERIAL_MARKUP }] }
};
const scenarioEntries = {
    'wall-leak': [['Plumbing work', 'Call-out and inspection'], ['Plumbing work', 'Locate leak'], ['Plumbing work', 'Protect surrounding area'], ['Breaking & access', 'Remove tiles'], ['Breaking & access', 'Open or chase wall'], ['Plumbing work', 'Expose pipe'], ['Plumbing work', 'Repair burst pipe'], ['Plumbing work', 'Pressure test'], ['Restoration', 'Close wall'], ['Restoration', 'Plaster wall'], ['Restoration', 'Replace tiles'], ['Additional labour', 'Remove rubble'], ['Additional labour', 'Clean work area']],
    'floor-leak': [['Plumbing work', 'Call-out and inspection'], ['Plumbing work', 'Leak detection'], ['Plumbing work', 'Mark affected area'], ['Additional labour', 'Remove paving'], ['Breaking & access', 'Break concrete or floor'], ['Excavation & ground work', 'Excavate soil'], ['Plumbing work', 'Expose pipe'], ['Plumbing work', 'Repair burst pipe'], ['Plumbing work', 'Install fittings'], ['Plumbing work', 'Pressure test'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Repair concrete'], ['Restoration', 'Replace tiles'], ['Additional labour', 'Remove rubble'], ['Additional labour', 'Clean area']],
    'replace-toilet': [['Plumbing work', 'Call-out and inspection'], ['Plumbing work', 'Isolate water'], ['Plumbing work', 'Disconnect old toilet'], ['Plumbing work', 'Remove old toilet'], ['Plumbing work', 'Supply toilet'], ['Plumbing work', 'Install new toilet'], ['Plumbing work', 'Connect water supply'], ['Plumbing work', 'Connect waste pipe'], ['Plumbing work', 'Seal toilet'], ['Plumbing work', 'Test flushing'], ['Plumbing work', 'Check for leaks'], ['Additional labour', 'Clean work area']],
    'install-toilet': [['Plumbing work', 'Site inspection'], ['Plumbing work', 'Measure location'], ['Plumbing work', 'Mark pipe positions'], ['Plumbing work', 'Install water supply'], ['Plumbing work', 'Install waste pipe'], ['Plumbing work', 'Install toilet'], ['Plumbing work', 'Connect water'], ['Plumbing work', 'Test flushing'], ['Plumbing work', 'Seal installation'], ['Additional labour', 'Clean work area']],
    'replace-basin': [['Plumbing work', 'Disconnect water'], ['Plumbing work', 'Disconnect waste pipe'], ['Plumbing work', 'Remove old basin'], ['Plumbing work', 'Supply basin'], ['Plumbing work', 'Install basin'], ['Plumbing work', 'Install taps'], ['Plumbing work', 'Install waste fitting'], ['Plumbing work', 'Connect water'], ['Plumbing work', 'Connect waste'], ['Plumbing work', 'Seal basin'], ['Plumbing work', 'Check for leaks'], ['Additional labour', 'Remove rubble'], ['Additional labour', 'Clean area']],
    'replace-bath': [['Plumbing work', 'Disconnect water'], ['Plumbing work', 'Disconnect waste pipe'], ['Breaking & access', 'Remove tiles'], ['Plumbing work', 'Remove old bath'], ['Plumbing work', 'Supply new bath'], ['Plumbing work', 'Install bath'], ['Plumbing work', 'Connect taps'], ['Plumbing work', 'Connect waste pipe'], ['Plumbing work', 'Test drainage'], ['Plumbing work', 'Seal bath'], ['Restoration', 'Replace tiles'], ['Additional labour', 'Remove rubble'], ['Additional labour', 'Clean area']],
    'replace-shower': [['Plumbing work', 'Disconnect water'], ['Plumbing work', 'Remove shower enclosure'], ['Plumbing work', 'Remove old shower tray'], ['Breaking & access', 'Remove tiles'], ['Plumbing work', 'Repair plumbing'], ['Plumbing work', 'Supply new shower'], ['Plumbing work', 'Install shower tray'], ['Plumbing work', 'Install mixer'], ['Plumbing work', 'Install shower enclosure'], ['Plumbing work', 'Seal shower'], ['Plumbing work', 'Test drainage'], ['Plumbing work', 'Test water pressure'], ['Additional labour', 'Clean work area']],
    'unblock-toilet': [['Plumbing work', 'Call-out and inspection'], ['Plumbing work', 'Inspect toilet'], ['Plumbing work', 'Attempt manual blockage removal'], ['Plumbing work', 'Use drain rods'], ['Equipment', 'Use drain machine'], ['Plumbing work', 'Remove blockage'], ['Plumbing work', 'Flush toilet'], ['Plumbing work', 'Test drainage'], ['Additional labour', 'Clean area']],
    'unblock-sewer': [['Plumbing work', 'Call-out and inspection'], ['Plumbing work', 'Inspect sewer line'], ['Plumbing work', 'Open inspection point'], ['Plumbing work', 'Locate blockage'], ['Plumbing work', 'Use drain rods'], ['Equipment', 'Use drain machine'], ['Plumbing work', 'High-pressure jetting'], ['Plumbing work', 'CCTV inspection'], ['Plumbing work', 'Test sewer flow'], ['Plumbing work', 'Close inspection point'], ['Additional labour', 'Clean work area']],
    'collapsed-sewer': [['Plumbing work', 'Site inspection'], ['Plumbing work', 'CCTV inspection'], ['Plumbing work', 'Locate damaged section'], ['Breaking & access', 'Remove paving'], ['Breaking & access', 'Break concrete or floor'], ['Excavation & ground work', 'Excavate trench'], ['Plumbing work', 'Expose pipe'], ['Plumbing work', 'Remove damaged pipe'], ['Plumbing work', 'Supply new pipe'], ['Plumbing work', 'Install sewer pipe'], ['Plumbing work', 'Install fittings'], ['Plumbing work', 'Check pipe gradient'], ['Plumbing work', 'Test water flow'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Reinstate paving or concrete'], ['Additional labour', 'Remove rubble'], ['Additional labour', 'Clean site']],
    'main-water-pipe': [['Plumbing work', 'Site inspection'], ['Plumbing work', 'Shut off main water'], ['Plumbing work', 'Locate existing pipe'], ['Breaking & access', 'Remove paving'], ['Excavation & ground work', 'Dig trench for water or sewer pipe'], ['Plumbing work', 'Remove old pipe'], ['Plumbing work', 'Supply new pipe'], ['Plumbing work', 'Install new pipe'], ['Plumbing work', 'Install fittings'], ['Plumbing work', 'Install shut-off valve'], ['Plumbing work', 'Connect to municipal supply'], ['Plumbing work', 'Pressure test'], ['Plumbing work', 'Flush pipe'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Reinstall paving'], ['Additional labour', 'Clean area']],
    'outside-tap': [['Plumbing work', 'Inspect installation point'], ['Plumbing work', 'Install pipe'], ['Breaking & access', 'Chase wall for new pipe'], ['Plumbing work', 'Drill through wall'], ['Plumbing work', 'Install tap'], ['Plumbing work', 'Install isolation valve'], ['Plumbing work', 'Connect to water supply'], ['Plumbing work', 'Test water flow'], ['Plumbing work', 'Check for leaks'], ['Additional labour', 'Seal wall opening'], ['Additional labour', 'Clean work area']],
    'water-meter': [['Plumbing work', 'Shut off main water'], ['Plumbing work', 'Remove old pipe'], ['Plumbing work', 'Supply new meter'], ['Plumbing work', 'Install new meter'], ['Plumbing work', 'Install fittings'], ['Plumbing work', 'Check for leaks'], ['Plumbing work', 'Restore water supply'], ['Plumbing work', 'Record meter reading']],
    'geyser-leak': [['Plumbing work', 'Inspect geyser'], ['Plumbing work', 'Isolate water'], ['Plumbing work', 'Isolate electricity'], ['Plumbing work', 'Locate leak'], ['Plumbing work', 'Drain geyser'], ['Plumbing work', 'Replace valve'], ['Plumbing work', 'Replace pipe'], ['Plumbing work', 'Replace fittings'], ['Plumbing work', 'Refill geyser'], ['Plumbing work', 'Check for leaks'], ['Plumbing work', 'Restore electricity'], ['Plumbing work', 'Test operation']],
    'geyser-element': [['Plumbing work', 'Isolate electricity'], ['Plumbing work', 'Isolate water'], ['Plumbing work', 'Drain geyser'], ['Plumbing work', 'Remove old element'], ['Plumbing work', 'Supply new element'], ['Plumbing work', 'Install new element'], ['Plumbing work', 'Replace gasket'], ['Plumbing work', 'Refill geyser'], ['Plumbing work', 'Check for leaks'], ['Plumbing work', 'Restore electricity'], ['Plumbing work', 'Test geyser']],
    'pressure-pump': [['Plumbing work', 'Site inspection'], ['Plumbing work', 'Prepare installation area'], ['Plumbing work', 'Supply pump'], ['Plumbing work', 'Install pump'], ['Plumbing work', 'Install inlet pipe'], ['Plumbing work', 'Install outlet pipe'], ['Plumbing work', 'Install valves'], ['Plumbing work', 'Connect electrical supply'], ['Plumbing work', 'Prime pump'], ['Plumbing work', 'Test water pressure'], ['Plumbing work', 'Check for leaks'], ['Additional labour', 'Clean work area']],
    'excavation-only': [['Excavation & ground work', 'Mark excavation area'], ['Breaking & access', 'Remove paving'], ['Breaking & access', 'Break concrete'], ['Excavation & ground work', 'Dig trench for water or sewer pipe'], ['Excavation & ground work', 'Excavate soil'], ['Excavation & ground work', 'Sift soil'], ['Excavation & ground work', 'Remove excess soil'], ['Excavation & ground work', 'Load rubble'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Reinstate paving or concrete'], ['Additional labour', 'Clean work area']],
    'paving-access': [['Excavation & ground work', 'Mark excavation area'], ['Excavation & ground work', 'Carefully remove paving'], ['Excavation & ground work', 'Store paving for reuse'], ['Excavation & ground work', 'Dig trench for water or sewer pipe'], ['Plumbing work', 'Expose pipe'], ['Plumbing work', 'Repair plumbing'], ['Plumbing work', 'Pressure test'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Reinstall paving'], ['Restoration', 'Level paving'], ['Additional labour', 'Clean area']],
    'concrete-access': [['Breaking & access', 'Cut concrete'], ['Breaking & access', 'Break concrete'], ['Breaking & access', 'Remove concrete rubble'], ['Excavation & ground work', 'Excavate soil'], ['Plumbing work', 'Expose pipe'], ['Plumbing work', 'Repair plumbing'], ['Plumbing work', 'Pressure test'], ['Excavation & ground work', 'Backfill trench'], ['Excavation & ground work', 'Compact or stamp ground'], ['Restoration', 'Prepare concrete area'], ['Restoration', 'Pour new concrete'], ['Restoration', 'Finish concrete'], ['Additional labour', 'Clean area']]
};
Object.entries(scenarioEntries).forEach(([id, entries]) => { scenarios[id] = { services: entries.map(([category, task]) => ({ category, task, quantity: 1, rate: serviceRates[task] || 350 })), materials: [] }; });
const masterScenarioLibrary = [
    ['Leak Detection & Investigation', 'Suspected water leak', 'Call-out and inspection|Leak detection|Acoustic leak detection|Pressure test|Water meter monitoring|Thermal imaging inspection|Moisture meter inspection|Trace water pipe route|Locate underground leak|Locate concealed pipe leak|Mark leak location|Repair leaking pipe|Replace damaged section|Pressure test after repair|Final inspection'],
    ['Water Supply & Pipe Repairs', 'Burst underground water pipe', 'Site inspection|Leak detection|Locate pipe|Mark excavation area|Protect work area|Excavate soil|Hand excavation around services|Expose damaged pipe|Cut out damaged section|Supply replacement pipe|Supply couplings|Install new pipe|Connect to existing pipe|Pressure test|Flush pipe|Backfill excavation|Compact soil|Remove excess soil|Reinstate surface'],
    ['Water Supply & Pipe Repairs', 'Underground pipe replacement', 'Site inspection|Determine pipe route|Leak detection if required|Excavation|Trenching|Temporary water isolation|Remove existing pipe|Dispose of old pipe|Supply replacement pipe|Pipe fittings|Valves|Pipe bedding|Install new pipe|Connect existing services|Pressure test|Flush system|Backfill|Compact trench|Surface reinstatement'],
    ['Water Supply & Pipe Repairs', 'Water main / supply line replacement', 'Site inspection|Locate main water supply|Shut-off isolation|Excavation|Remove existing main|Supply new main pipe|Install isolation valve|Install pressure reducing valve|Install fittings|Connect to municipal supply|Pressure test|Flush system|Backfill|Compact|Reinstate surface'],
    ['Water Supply & Pipe Repairs', 'Burst pipe inside building', 'Emergency call-out|Locate leak|Isolate water supply|Break open wall floor or ceiling|Remove damaged pipe|Supply replacement pipe|Supply fittings|Install new section|Pressure test|Restore water supply|Leak inspection|Close opening|Plaster repair|Tile replacement|Paint touch-up|Remove rubble'],
    ['Leak Detection & Investigation', 'Bathroom pipe leak', 'Inspection|Leak detection|Isolate water|Remove access tiles|Remove damaged pipe|Supply pipe|Supply fittings|Repair pipework|Pressure test|Replace insulation|Replace tiles|Grouting|Silicone sealing|Clean work area'],
    ['Leak Detection & Investigation', 'Kitchen pipe leak', 'Inspection|Leak detection|Isolate water|Remove cabinet or access panel|Repair water pipe|Replace flexible hose|Replace isolation valve|Replace fittings|Pressure test|Cabinet reinstatement|Clean area'],
    ['Sanitaryware', 'Toilet leak', 'Toilet inspection|Leak detection|Replace inlet valve|Replace flush valve|Replace cistern washer|Replace flush button|Replace toilet connector|Replace isolation valve|Replace pan connector|Replace toilet seal|Repair water supply|Repair waste connection|Remove and reinstall toilet|Silicone seal|Test toilet'],
    ['Sanitaryware', 'Toilet replacement', 'Remove existing toilet|Disconnect water supply|Disconnect waste|Dispose of old toilet|Supply new toilet|Supply toilet seat|Supply cistern fittings|Install toilet|Connect water supply|Connect waste|Level toilet|Seal toilet|Test flush|Clean area'],
    ['Sanitaryware', 'Basin replacement', 'Remove existing basin|Disconnect water|Disconnect waste|Remove taps|Supply basin|Supply basin mixer or taps|Supply waste|Supply bottle trap|Supply flexible connectors|Install basin|Install taps|Connect waste|Connect water|Silicone seal|Test'],
    ['Sanitaryware', 'Shower installation or replacement', 'Remove existing shower fittings|Remove shower mixer|Install shower mixer|Install shower head|Install shower arm|Install handheld shower|Install shower rail|Install shower waste|Repair waste pipe|Repair water pipe|Waterproofing|Tile removal|Tile reinstatement|Silicone sealing|Pressure test|Water testing'],
    ['Sanitaryware', 'Bath installation or replacement', 'Remove existing bath|Disconnect waste|Disconnect water|Supply bath|Install bath|Install bath taps|Install waste|Install overflow|Connect water|Connect waste|Level bath|Seal bath|Test drainage'],
    ['Sanitaryware', 'Bathroom renovation plumbing', 'Site inspection|Plumbing layout|Strip-out|Remove existing sanitaryware|Remove old pipework|New hot-water pipework|New cold-water pipework|New waste pipework|Install shower|Install bath|Install basin|Install toilet|Install washing machine point|Install floor drain|Install valves|Pressure test|Drain test|Waterproofing interface|Final connections|Commissioning'],
    ['Geysers & Hot Water', 'Geyser replacement', 'Inspection|Isolate water|Isolate electrical supply|Drain geyser|Disconnect plumbing|Remove existing geyser|Remove old valves|Supply new geyser|Supply geyser valves|Supply pressure control equipment|Supply expansion vessel|Supply drip tray|Supply discharge pipe|Install geyser|Connect hot water|Connect cold water|Connect overflow|Pressure test|Fill geyser|Check for leaks|Commission system'],
    ['Geysers & Hot Water', 'Geyser leak', 'Emergency call-out|Leak inspection|Isolate water|Isolate electrical supply|Identify leaking component|Replace valve|Replace pressure relief valve|Replace temperature pressure valve|Replace pipe fitting|Replace geyser|Test system|Clean water damage'],
    ['Geysers & Hot Water', 'Geyser pressure or valve problem', 'Inspection|Pressure test|Check pressure reducing valve|Check expansion control|Replace pressure reducing valve|Replace expansion valve|Replace safety valve|Replace isolation valve|Replace non-return valve|Adjust pressure|Test system'],
    ['Drainage & Sewer', 'Drain blockage', 'Call-out|Drain inspection|Identify blockage|Open drain or manhole|Manual clearing|Plunger|Drain snake|Mechanical drain cleaning|Chemical treatment|Water testing|Clean drain|Remove waste'],
    ['Jetting & Drain Cleaning', 'Drain jetting', 'Call-out|Drain inspection|Locate access point|Open manhole|High-pressure drain jetting|Clear blockage|Grease removal|Scale removal|Root removal|Flush drainage line|Test flow|CCTV inspection|Clean work area|Dispose of removed material'],
    ['CCTV / Camera Inspections', 'CCTV camera drain inspection', 'Call-out|Locate drain access|Open manhole|Camera inspection|Record inspection|Identify blockage|Identify cracked pipe|Identify collapsed pipe|Identify displaced joint|Identify root ingress|Measure approximate location|Mark problem location|Provide inspection report|Provide video footage'],
    ['Drainage & Sewer', 'Blocked sewer', 'Emergency call-out|Sewer inspection|Locate blockage|Open manhole|Manual clearing|Drain snake|High-pressure jetting|CCTV inspection|Remove blockage|Flush sewer|Flow test|Clean manhole|Replace damaged section'],
    ['Drainage & Sewer', 'Sewer pipe replacement', 'CCTV inspection|Locate damaged section|Mark pipe route|Excavation|Trenching|Remove existing sewer pipe|Dispose of old pipe|Supply sewer pipe|Supply bends|Supply junctions|Install new pipe|Connect to existing sewer|Pipe bedding|Test drainage|Backfill|Compact|Surface reinstatement'],
    ['Drainage & Sewer', 'Collapsed drain or sewer', 'CCTV inspection|Locate collapse|Excavation|Remove collapsed pipe|Remove soil and debris|Supply replacement pipe|Supply fittings|Install new pipe|Connect existing drainage|Test flow|Backfill|Compact|Reinstatement'],
    ['Jetting & Drain Cleaning', 'Root intrusion into drain', 'CCTV inspection|Locate root intrusion|Drain jetting|Mechanical root cutting|Remove roots|Flush drainage line|CCTV confirmation|Repair pipe|Replace damaged section|Backfill|Reinstatement'],
    ['CCTV / Camera Inspections', 'Drain investigation and clearance', 'Call-out|CCTV camera inspection|Identify blockage|High-pressure jetting|Flush drainage system|Final camera inspection|Basic report|Video recording|Recommendations'],
    ['Drainage & Sewer', 'Blocked kitchen drain', 'Inspection|Remove trap|Clean trap|Drain snake|Jetting|Grease removal|Waste pipe cleaning|Replace trap|Replace waste pipe|Flow test'],
    ['Drainage & Sewer', 'Blocked bathroom drain', 'Inspection|Remove waste cover|Clear blockage|Snake drain|Jet drain|Clean trap|Replace waste fitting|Flow test|Clean area'],
    ['Drainage & Sewer', 'Blocked shower drain', 'Remove grate|Remove hair and debris|Clean trap|Snake drain|Jet drain|Replace waste|Replace grate|Test drainage'],
    ['Stormwater', 'Blocked stormwater drain', 'Inspect stormwater system|Open drain|Remove leaves and debris|Manual clearing|Drain jetting|CCTV inspection|Root removal|Repair stormwater pipe|Replace damaged grate|Clean catch pit|Test flow'],
    ['Stormwater', 'Stormwater pipe replacement', 'Inspection|Locate pipe|Excavation|Remove existing pipe|Supply stormwater pipe|Supply bends|Supply junctions|Install pipe|Connect existing system|Test flow|Backfill|Compact|Reinstate paving or soil'],
    ['Drainage & Sewer', 'Manhole repair or replacement', 'Inspect manhole|Open manhole|Clean manhole|Remove debris|Repair benching|Repair walls|Replace manhole cover|Replace frame|Raise or lower manhole|Reconnect pipes|Seal joints|Test drainage'],
    ['Water Supply & Pipe Repairs', 'Water pressure problem', 'Site inspection|Pressure test|Check municipal supply|Check pressure reducing valve|Check isolation valves|Check filters|Check blocked pipes|Check geyser|Replace pressure reducing valve|Replace valve|Clean filter|Repair pipe|Retest pressure'],
    ['Water Supply & Pipe Repairs', 'Low water pressure', 'Pressure test|Flow test|Inspect supply pipe|Inspect valves|Inspect pressure reducing valve|Inspect filters|Inspect geyser|Clear restriction|Replace valve|Replace section of pipe|Test system'],
    ['Water Supply & Pipe Repairs', 'High water pressure', 'Pressure test|Install pressure reducing valve|Replace pressure reducing valve|Install pressure gauge|Adjust pressure|Install expansion control|Test system'],
    ['Water Supply & Pipe Repairs', 'Water hammer', 'Investigation|Pressure test|Check valves|Check pipe supports|Check pressure|Install water hammer arrestor|Secure pipework|Replace faulty valve|Install pressure reducing valve|Test system'],
    ['Sanitaryware', 'Tap replacement', 'Remove existing tap|Isolate water|Supply tap|Supply flexible connectors|Supply isolation valves|Install tap|Connect water|Test|Silicone seal'],
    ['Sanitaryware', 'Tap repair', 'Inspection|Replace washer|Replace cartridge|Replace spindle|Replace O-rings|Replace flexible hose|Replace valve|Test tap'],
    ['Sanitaryware', 'Washing machine installation', 'Inspect connection|Install washing machine valve|Install waste connection|Install trap|Supply flexible hose|Connect machine|Test inlet|Test drainage|Check leaks'],
    ['Sanitaryware', 'Dishwasher installation', 'Water connection|Isolation valve|Flexible hose|Waste connection|Dishwasher trap connection|Install unit connection|Leak test|Drain test'],
    ['Geysers & Hot Water', 'Hot water pipe repair', 'Locate leak|Isolate water|Drain system|Remove damaged pipe|Supply hot-water pipe|Insulation|Fittings|Install pipe|Pressure test|Restore supply|Check temperature|Check leaks'],
    ['Water Supply & Pipe Repairs', 'Complete house plumbing installation', 'Plumbing layout|Site establishment|Underground drainage|Sewer connections|Stormwater drainage|Underground water supply|Hot-water pipework|Cold-water pipework|Waste pipework|Vent pipes|Floor drains|Toilets|Basins|Baths|Showers|Kitchen sink|Washing machine points|Dishwasher points|Geyser installation|Valves|Testing|Commissioning'],
    ['Water Supply & Pipe Repairs', 'Plumbing alterations', 'Site inspection|Identify existing services|Isolate water|Remove existing pipe|Alter water pipe|Alter waste pipe|Add new pipe|Add new valve|Add new connection|Pressure test|Drain test|Reconnect fixtures|Reinstatement'],
    ['Water Supply & Pipe Repairs', 'Additional water point', 'Locate water supply|Cut into existing pipe|Supply pipe|Supply tee|Supply valve|Supply tap|Install pipe|Install washing machine point|Water connection|Waste connection|Trap|Testing'],
    ['Water Supply & Pipe Repairs', 'Outside tap or garden tap', 'Remove old tap|Supply tap|Supply isolation valve|Supply pipe|Fittings|Install tap|Test'],
    ['Water Supply & Pipe Repairs', 'Irrigation plumbing repair', 'Inspection|Leak detection|Locate damaged pipe|Excavation|Replace irrigation pipe|Replace fittings|Replace valve|Repair sprinkler|Replace sprinkler|Test zones|Backfill'],
    ['Leak Detection & Investigation', 'Swimming pool plumbing leak', 'Inspection|Pressure test|Leak detection|Camera inspection|Locate leak|Expose pipe|Repair pipe|Replace fittings|Pressure test|Backfill|Surface reinstatement'],
    ['Emergency Plumbing', 'Emergency plumbing call-out', 'Emergency call-out|After-hours surcharge|Initial inspection|Isolate water|Temporary repair|Leak containment|Emergency drain clearing|Emergency pipe repair|Testing|Permanent repair quotation'],
    ['Water Supply & Pipe Repairs', 'Water main isolation or valve replacement', 'Locate valve|Isolate supply|Excavate|Remove valve|Supply replacement valve|Install valve|Connect pipe|Pressure test|Backfill|Reinstate'],
    ['Excavation & Civil Works', 'Paving removal and reinstatement', 'Mark work area|Remove paving|Number and store pavers|Excavation|Pipe repair|Backfill|Compact|Sand bedding|Replace paving|Cut replacement pavers|Joint sand|Clean area'],
    ['Excavation & Civil Works', 'Concrete breaking and reinstatement', 'Mark work area|Concrete cutting|Concrete breaking|Remove concrete|Excavation|Pipe repair|Backfill|Compaction|Reinforcement|Concrete supply|Concrete reinstatement|Finishing|Curing'],
    ['Excavation & Civil Works', 'Tiling removal and reinstatement', 'Protect work area|Remove tiles|Remove adhesive|Plumbing repair|Waterproofing repair|Tile adhesive|Replacement tiles|Grouting|Silicone|Cleaning'],
    ['Excavation & Civil Works', 'Excavation and earthworks', 'Site setup|Mark excavation|Hand excavation|Machine excavation|Trenching|Soil removal|Spoil handling|Sand bedding|Pipe installation|Backfill|Compaction|Excess soil removal'],
    ['Excavation & Civil Works', 'Wall chasing and pipe installation', 'Mark pipe route|Chase wall|Remove rubble|Install pipe|Install fittings|Pressure test|Close chase|Plaster|Tile|Paint'],
    ['Water Supply & Pipe Repairs', 'Ceiling access and repair', 'Protect area|Open ceiling|Locate pipe|Repair pipe|Pressure test|Close ceiling|Replace board|Skim|Paint|Clean area'],
    ['Maintenance & Inspections', 'Drainage maintenance', 'Drain inspection|CCTV inspection|Drain cleaning|Jetting|Manhole cleaning|Root removal|Trap cleaning|Flow testing|Preventative maintenance report'],
    ['Maintenance & Inspections', 'Plumbing maintenance contract', 'Scheduled inspection|Water pressure testing|Leak inspection|Geyser inspection|Valve inspection|Toilet inspection|Tap inspection|Drain inspection|Manhole inspection|CCTV inspection|Drain jetting|Preventative repairs|Maintenance report'],
    ['Maintenance & Inspections', 'Commercial plumbing inspection', 'Site inspection|Plumbing survey|Water pressure testing|Leak detection|Drain inspection|CCTV inspection|Geyser inspection|Valve inspection|Sanitaryware inspection|Pump inspection|Backflow inspection|Maintenance report|Repair recommendations'],
    ['Jetting & Drain Cleaning', 'Commercial drain cleaning', 'Call-out|Drain inspection|Manhole inspection|CCTV inspection|High-pressure jetting|Mechanical cleaning|Root cutting|Grease removal|Flow test|Final camera inspection|Report'],
    ['Jetting & Drain Cleaning', 'Restaurant or commercial kitchen drain', 'Inspection|Grease trap inspection|Grease trap cleaning|Drain jetting|High-pressure cleaning|Waste pipe cleaning|CCTV inspection|Replace trap|Replace waste pipe|Flow testing|Cleaning report'],
    ['Jetting & Drain Cleaning', 'Grease trap cleaning', 'Call-out|Isolate area|Open grease trap|Remove grease|Pump out waste|Clean trap|High-pressure wash|Inspect inlet and outlet|Flow test|Dispose of waste'],
    ['Water Supply & Pipe Repairs', 'Backflow or reverse flow problem', 'Inspection|Identify source|Test flow|Check non-return valve|Replace non-return valve|Install backflow prevention|Clean system|Test'],
    ['Pumps & Water Tanks', 'Water tank installation', 'Site inspection|Tank supply|Tank base preparation|Tank installation|Float valve|Isolation valve|Overflow|Inlet pipe|Outlet pipe|Pump|Pressure control|Electrical connection|Testing'],
    ['Pumps & Water Tanks', 'Booster pump installation', 'Site inspection|Pump selection|Pump supply|Isolation valves|Non-return valve|Pressure controller|Pipework|Electrical connection|Commissioning|Pressure test'],
    ['Pumps & Water Tanks', 'Sump or drainage pump', 'Site inspection|Supply pump|Pump installation|Float switch|Discharge pipe|Non-return valve|Isolation valve|Electrical connection|Test pump|Test discharge'],
    ['Water Supply & Pipe Repairs', 'Burst flexible hose', 'Isolate water|Remove hose|Supply flexible hose|Install hose|Pressure test|Check fittings|Clean water'],
    ['Water Supply & Pipe Repairs', 'Valve replacement', 'Locate valve|Isolate water|Drain section|Remove valve|Supply replacement valve|Install valve|Seal threaded connection|Pressure test|Restore supply'],
    ['Water Supply & Pipe Repairs', 'Plumbing reconnection after building work', 'Inspect existing plumbing|Locate services|Reconnect water|Reconnect waste|Reconnect fixtures|Replace damaged fittings|Pressure test|Drain test|Commission'],
    ['Emergency Plumbing', 'Water damage emergency make-safe', 'Emergency call-out|Isolate water|Locate leak|Stop leak|Drain affected system|Temporary pipe repair|Remove damaged plumbing|Make safe|Final repair quotation'],
    ['Maintenance & Inspections', 'Final plumbing inspection', 'Water pressure test|Leak inspection|Hot-water inspection|Cold-water inspection|Drainage inspection|Toilet testing|Basin testing|Shower testing|Kitchen testing|Geyser inspection|Valve inspection|Final commissioning report']
];
const libraryCategoryMap = { 'Leak Detection & Investigation': 'Plumbing work', 'Water Supply & Pipe Repairs': 'Plumbing work', 'Drainage & Sewer': 'Drainage & sewer', 'Jetting & Drain Cleaning': 'Drainage & sewer', 'CCTV / Camera Inspections': 'Drainage & sewer', Sanitaryware: 'Fixtures & appliances', 'Geysers & Hot Water': 'Geysers & hot water', 'Pumps & Water Tanks': 'Fixtures & appliances', Stormwater: 'Drainage & sewer', 'Excavation & Civil Works': 'Excavation & ground work', 'Emergency Plumbing': 'Plumbing work', 'Maintenance & Inspections': 'Compliance & testing' };
masterScenarioLibrary.forEach(([libraryCategory, name, tasks], index) => { scenarios[`library-${index + 1}`] = { services: tasks.split('|').map(task => ({ category: libraryCategoryMap[libraryCategory], task, quantity: 1, rate: serviceRates[task] || 350 })), materials: [] }; });
const storedScenarioServices = JSON.parse(localStorage.getItem('pipewise-scenario-services') || '{}');
Object.entries(storedScenarioServices).forEach(([id, services]) => { if (scenarios[id] && Array.isArray(services)) scenarios[id].services = services; });
const customScenarios = JSON.parse(localStorage.getItem('pipewise-custom-scenarios') || '[]').filter(scenario => scenario && typeof scenario.id === 'string' && typeof scenario.name === 'string' && Array.isArray(scenario.services));
customScenarios.forEach(scenario => { scenarios[scenario.id] = { services: scenario.services, materials: [] }; });
Object.values(scenarios).forEach(scenario => scenario.services.forEach(({ category, task, rate }) => { if (!serviceCatalogue[category]) serviceCatalogue[category] = []; if (!serviceCatalogue[category].includes(task)) serviceCatalogue[category].push(task); if (serviceRates[task] === undefined && Number.isFinite(Number(rate))) serviceRates[task] = Number(rate); }));
serviceCatalogue['Plumbing work'] = serviceCatalogue['Plumbing work'].filter(task => task !== 'Use drain machine');
const standardPlumbingServices = {
    'Plumbing work': ['Install shower mixer', 'Repair shower mixer', 'Replace basin tap', 'Replace bath tap', 'Install kitchen sink', 'Install washing machine connection', 'Install dishwasher connection', 'Install fridge water point', 'Install water filter', 'Install pressure reducing valve', 'Install non-return valve', 'Install water hammer arrestor', 'Replace flexible connectors', 'Replace stopcock', 'Replace ball valve', 'Repair toilet cistern', 'Replace toilet flush valve', 'Replace toilet inlet valve', 'Replace toilet seat', 'Repair leaking tap', 'Repair leaking mixer', 'Install external tap', 'Install hose bib tap'],
    'Drainage & sewer': ['Clear blocked basin waste', 'Clear blocked bath waste', 'Clear blocked shower waste', 'Clear blocked kitchen drain', 'Clear stormwater drain', 'Repair sewer pipe', 'Replace sewer pipe', 'Install inspection chamber', 'Install gully trap', 'Install floor drain', 'Install grease trap', 'Repair manhole cover', 'Camera inspection of drain', 'Hydro jet drain cleaning'],
    'Geysers & hot water': ['Install geyser tray', 'Install geyser drip tray', 'Install geyser safety valve', 'Install geyser vacuum breakers', 'Install geyser expansion valve', 'Replace geyser thermostat', 'Replace geyser anode', 'Repair geyser overflow', 'Install solar geyser', 'Service solar geyser', 'Install heat pump', 'Service heat pump'],
    'Fixtures & appliances': ['Install basin', 'Install bath', 'Install shower', 'Install toilet', 'Install bidet', 'Install urinal', 'Install kitchen mixer', 'Install basin mixer', 'Install bath mixer', 'Replace shower head', 'Install garbage disposal', 'Install water tank'],
    'Compliance & testing': ['Issue plumbing COC', 'Geyser COC inspection', 'Pressure test water line', 'Drainage flow test', 'Leak detection report', 'Water quality test', 'Backflow prevention test', 'Site assessment and quotation']
};
Object.entries(standardPlumbingServices).forEach(([category, tasks]) => { if (!serviceCatalogue[category]) serviceCatalogue[category] = []; tasks.forEach(task => { if (!serviceCatalogue[category].includes(task)) serviceCatalogue[category].push(task); }); });
const storedServiceCatalogue = JSON.parse(localStorage.getItem('pipewise-service-catalogue') || '{}');
Object.entries(storedServiceCatalogue).forEach(([category, tasks]) => { if (!Array.isArray(tasks)) return; if (!serviceCatalogue[category]) serviceCatalogue[category] = []; tasks.forEach(task => { if (typeof task === 'string' && !serviceCatalogue[category].includes(task)) serviceCatalogue[category].push(task); }); });
const serviceCategories = Object.keys(serviceCatalogue);
const supplierInfo = {
    plumblink: { name: 'Plumblink', url: 'https://www.plumblink.co.za/all-products' },
    builders: { name: 'Builders', url: 'https://www.builders.co.za/Plumbing-Bathroom-and-Kitchen/c/13' },
    bathroom: { name: 'Bathroom Bizarre', url: 'https://bathroom.co.za/' }
};
const supplierOptions = Object.keys(supplierInfo);
const supplierPrices = {
    builders: {
        'HDPE drainage pipe - 110mm x 5m': 349,
        'HDPE water pipe - 25mm x 100m': 29,
        'HDPE water pipe - 32mm x 100m': 35,
        'Copper pipe - 15mm x 5.5m': 445,
        'PVC pressure pipe - 50mm x 6m': 205,
        'PVC pressure pipe - 110mm x 6m': 349,
        'Copper elbow - 15mm': 6,
        'Copper tee - 15mm': 13,
        'Geyser - 150L': 4699,
        'Toilet - Standard': 1589
    },
    bathroom: {
        'Basin mixer - 15mm': 2205.75,
        'Basin - Standard': 995,
        'Toilet - Standard': 1999,
        'Shower screen - 900 x 2000mm': 2295,
        'Vanity cabinet - 600mm': 3195,
        'Sink mixer - 15mm': 2205.75
    }
};
const supplierAvailability = {
    plumblink: new Set([
        'HDPE drainage pipe - 110mm x 5m',
        'HDPE water pipe - 25mm x 100m',
        'HDPE water pipe - 32mm x 100m',
        'Copper pipe - 15mm x 5.5m',
        'PVC pressure pipe - 50mm x 6m',
        'PVC pressure pipe - 110mm x 6m',
        'Copper elbow - 15mm',
        'Copper tee - 15mm',
        'Geyser - 150L',
        'Toilet - Standard'
    ]),
    builders: new Set(Object.keys(supplierPrices.builders)),
    bathroom: new Set(Object.keys(supplierPrices.bathroom))
};
const priceCheckKey = 'pipewise-last-price-check';
function getBestMaterialPrice(material) {
    if (!material.description) return { cost: getValue(material.cost), suppliers: [] };
    const baseCost = plumbingCatalogue[material.category]?.[material.type]?.sizes[material.size] ?? getValue(material.cost);
    const prices = [{ supplier: 'plumblink', cost: baseCost }, ...Object.entries(supplierPrices).filter(([, catalogue]) => catalogue[material.description] !== undefined).map(([supplier, catalogue]) => ({ supplier, cost: catalogue[material.description] }))].filter(({ cost }) => Number.isFinite(cost) && cost > 0);
    if (!prices.length) return { cost: 0, suppliers: [] };
    const cost = Math.min(...prices.map(price => price.cost));
    return { cost, suppliers: prices.filter(price => price.cost === cost).map(price => price.supplier) };
}
function getSupplierCost(material) { return getBestMaterialPrice(material).cost; }
function getMaterialSuppliers(material) {
    if (!material.description) return 'Select material';
    const bestPrice = getBestMaterialPrice(material);
    if (!bestPrice.suppliers.length) return 'No price match';
    return `${currency(bestPrice.cost)} - ${bestPrice.suppliers.map(supplier => supplierInfo[supplier].name).join(', ')}`;
}
function getQuantity(material) { return Math.max(1, Number(material.quantity) || 1); }
function getMaterialArea(material) {
    const w = getValue(material.width), h = getValue(material.height);
    if (!(w > 0 && h > 0)) return 0;
    return (w * h) / 1e6; // mm² → m²
}
function isAreaPriced(material) {
    const item = plumbingCatalogue[material.category]?.[material.type];
    return Boolean(item && item.unit === 'm2');
}
function getEffectiveCost(material) {
    const area = getMaterialArea(material);
    const unitCost = getSupplierCost(material);
    if (!isAreaPriced(material) || !area) return unitCost * getQuantity(material);
    return unitCost * area * getQuantity(material);
}
function getMaterialQtyLabel(material) {
    const area = getMaterialArea(material);
    return area ? area.toFixed(2) : String(getQuantity(material));
}
function getServiceQuantity(service) { return Math.max(1, Number(service.quantity) || 1); }
function getServiceRate(service) { const priceListRate = serviceRates[service.task]; return priceListRate === undefined ? Number(service.rate) || 350 : priceListRate; }
function getServiceUnit(service) { return service.unit || serviceUnits[service.task] || 'Each'; }
function importPriceList(event) {
    const file = event.target.files[0];
    if (!file || typeof XLSX === 'undefined') { showToast('Excel parser could not be loaded'); return; }
    const reader = new FileReader();
    reader.onload = () => {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Master Price List'] || workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
        let count = 0;
        rows.forEach(row => {
            const category = String(row.Category || 'Imported price list').trim();
            const task = String(row.Item || '').trim();
            const rate = Number(row['Default Price (ZAR)']);
            if (!task || !Number.isFinite(rate)) return;
            if (!serviceCatalogue[category]) serviceCatalogue[category] = [];
            if (!serviceCatalogue[category].includes(task)) serviceCatalogue[category].push(task);
            importedServiceRates[task] = rate;
            serviceRates[task] = rate;
            serviceUnits[task] = String(row.Unit || 'Each').trim();
            count += 1;
        });
        serviceCategories.splice(0, serviceCategories.length, ...Object.keys(serviceCatalogue));
        persistServiceCatalogue();
        localStorage.setItem('pipewise-service-rates', JSON.stringify(serviceRates));
        localStorage.setItem('pipewise-service-units', JSON.stringify(serviceUnits));
        $('price-list-status').textContent = `${count} Excel prices loaded from ${file.name}`;
        renderServices();
        if ($('price-list-body')) renderPriceList();
        showToast(`${count} master prices loaded`);
    };
    reader.readAsArrayBuffer(file);
}
function getServiceTasks(service) { const tasks = serviceCatalogue[service.category] || []; return service.task && !tasks.includes(service.task) ? [...tasks, service.task] : tasks; }
function categoryOptions(selected) { return `<option value="">Select category</option>${serviceCategories.map(category => `<option value="${escapeHtml(category)}" ${selected === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}`; }
function persistServiceCatalogue() { localStorage.setItem('pipewise-service-catalogue', JSON.stringify(serviceCatalogue)); }
const unitOptions = ['Each', 'Hour', 'Day', 'Metre', 'm²', 'm³', 'Job', 'Connection', 'Load', 'Hole'];
function unitSelect(selected, label) { const options = unitOptions.includes(selected) ? unitOptions : [selected, ...unitOptions]; return `<select class="price-unit" aria-label="${label}">${options.map(unit => `<option value="${escapeHtml(unit)}" ${unit === selected ? 'selected' : ''}>${escapeHtml(unit)}</option>`).join('')}</select>`; }
function renderPriceList() {
    const query = ($('price-list-search')?.value || '').toLowerCase();
    const rows = Object.entries(serviceCatalogue).flatMap(([category, tasks]) => tasks.map(task => ({ category, task, unit: serviceUnits[task] || 'Each', rate: getServiceRate({ task }) }))).filter(row => `${row.category} ${row.unit} ${row.task}`.toLowerCase().includes(query));
    $('price-list-body').innerHTML = rows.map(row => `<tr class="price-entry" data-task="${escapeHtml(row.task)}"><td><select class="price-category" aria-label="Category for ${escapeHtml(row.task)}">${categoryOptions(row.category)}</select></td><td>${unitSelect(row.unit, `Type or unit for ${escapeHtml(row.task)}`)}</td><td><input class="price-line-item" value="${escapeHtml(row.task)}" aria-label="Line item ${escapeHtml(row.task)}"></td><td><input class="price-rate" data-task="${escapeHtml(row.task)}" type="number" min="0" step="0.01" value="${row.rate}" aria-label="Rate for ${escapeHtml(row.task)}"></td><td><button class="delete-price" type="button" aria-label="Delete ${escapeHtml(row.task)}">×</button></td></tr>`).join('');
    document.querySelectorAll('.delete-price').forEach(button => button.addEventListener('click', () => deletePrice(button.closest('.price-entry'))));
    $('price-list-count').textContent = `${rows.length} prices`;
}
function deletePrice(row) {
    const task = row.dataset.task;
    if (!task || !window.confirm(`Delete "${task}" from the price list?`)) return;
    Object.values(serviceCatalogue).forEach(tasks => { const index = tasks.indexOf(task); if (index >= 0) tasks.splice(index, 1); });
    delete serviceRates[task];
    delete serviceUnits[task];
    persistServiceCatalogue();
    localStorage.setItem('pipewise-service-rates', JSON.stringify(serviceRates));
    localStorage.setItem('pipewise-service-units', JSON.stringify(serviceUnits));
    renderPriceList();
    renderServices();
    showToast('Price removed');
}
function savePriceList() {
    document.querySelectorAll('.price-entry').forEach(row => { const oldTask = row.dataset.task; const task = row.querySelector('.price-line-item').value.trim(); const category = row.querySelector('.price-category').value; if (!task || !category) return; if (oldTask && oldTask !== task) { Object.values(serviceCatalogue).forEach(tasks => { const oldIndex = tasks.indexOf(oldTask); if (oldIndex >= 0) tasks.splice(oldIndex, 1); }); delete serviceRates[oldTask]; delete serviceUnits[oldTask]; } if (!serviceCatalogue[category].includes(task)) serviceCatalogue[category].push(task); serviceRates[task] = getValue(row.querySelector('.price-rate').value); serviceUnits[task] = row.querySelector('.price-unit').value || 'Each'; });
    persistServiceCatalogue();
    localStorage.setItem('pipewise-service-rates', JSON.stringify(serviceRates));
    localStorage.setItem('pipewise-service-units', JSON.stringify(serviceUnits));
    renderServices();
    showToast('Price list saved');
}
function getLabourTotals() {
    const callout = labourItems.filter(item => item.type === 'callout').reduce((sum, item) => sum + getValue(item.quantity) * getValue(item.rate), 0);
    const labour = labourItems.filter(item => item.type !== 'callout').reduce((sum, item) => sum + getValue(item.quantity) * getValue(item.rate), 0);
    return { callout, labour, total: callout + labour };
}
function updatePriceCheckStatus() {
    const today = new Date().toISOString().slice(0, 10);
    const lastCheck = localStorage.getItem(priceCheckKey);
    $('price-check-status').textContent = lastCheck === today ? `Prices checked today · ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : 'Morning price check due';
}
function runPriceCheck() {
    localStorage.setItem(priceCheckKey, new Date().toISOString().slice(0, 10));
    materials.forEach(material => { if (material.description) material.cost = getBestMaterialPrice(material).cost; });
    updatePriceCheckStatus();
    renderMaterials();
    showToast('Current material prices updated');
}

function getNumber(id) { return Math.max(0, Number($(id).value) || 0); }
function nextQuoteNumber() { return `PW-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`; }
function calculate() {
    const { callout, labour, total: labourTotal } = getLabourTotals();
    const materialsTotal = materials.reduce((sum, material) => sum + getEffectiveCost(material) * (1 + MATERIAL_MARKUP / 100), 0);
    const servicesTotal = services.reduce((sum, service) => sum + getServiceRate(service) * getServiceQuantity(service), 0);
    const subtotal = callout + labour + materialsTotal + servicesTotal;
    const vatRate = Number($('vat-rate').value || VAT_DEFAULT);
    const vat = $('vat-enabled').checked ? subtotal * vatRate / 100 : 0;
    $('labour-total').textContent = currency(labourTotal);
    $('summary-callout').textContent = currency(callout);
    $('summary-labour').textContent = currency(labour);
    $('summary-materials').textContent = currency(materialsTotal);
    $('summary-services').textContent = currency(servicesTotal);
    $('grand-total').textContent = currency(subtotal + vat);
    $('vat-rate-label').textContent = `${vatRate}%`;
    updatePrintDetails({ callout, labour, materialsTotal, servicesTotal, subtotal, vat, total: subtotal + vat, vatRate });
    return { callout, labour, materialsTotal, servicesTotal, subtotal, vat, total: subtotal + vat, vatRate };
}
function updatePrintDetails(totals = calculateTotals()) {
    const customer = $('customer-name').value.trim() || 'New customer';
    const phone = $('customer-phone').value.trim() || 'Not provided';
    const address = $('customer-address').value.trim() || 'Not provided';
    const description = $('service-description').value.trim();
    const amendmentReason = $('amendment-reason').value.trim() || 'Reason not provided';
    const labourRows = labourItems.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.unit)}</td><td>${getValue(item.quantity)}</td><td>${currency(item.rate)}</td><td>${currency(getValue(item.quantity) * getValue(item.rate))}</td></tr>`).join('');
    const rows = materials.filter(material => material.description).map(material => `<tr><td>${escapeHtml(material.description)}</td><td>${getMaterialQtyLabel(material)}${getMaterialArea(material) ? ' m²' : ''}</td><td>${currency(getEffectiveCost(material) * (1 + MATERIAL_MARKUP / 100))}</td></tr>`).join('');
    const serviceRows = services.filter(service => service.task).map(service => `<tr><td>${escapeHtml(service.task)}</td><td>${escapeHtml(getServiceUnit(service))}</td><td>${getServiceQuantity(service)}</td><td>${currency(getServiceRate(service))}</td><td>${currency(getServiceRate(service) * getServiceQuantity(service))}</td></tr>`).join('');
    const supportingPhotos = sitePhotos.length ? `<section class="print-supporting-photos"><h3>Supporting photos</h3><div>${sitePhotos.map((photo, index) => `<figure><img src="${photo.data}" alt="Supporting photo ${index + 1}"><figcaption>${escapeHtml(photo.description || `Supporting photo ${index + 1}`)}</figcaption></figure>`).join('')}</div></section>` : '';
    $('print-details').innerHTML = `<div class="print-document-title"><span>${isAmended ? 'AMENDED QUOTATION' : 'QUOTATION'}</span><strong>${escapeHtml($('quote-number').textContent)}</strong></div><div class="print-customer"><strong>${escapeHtml(customer)}</strong><span>${escapeHtml(phone)}</span><span>${escapeHtml(address)}</span>${description ? `<span><b>Requested services:</b> ${escapeHtml(description)}</span>` : ''}</div><h3>Labour &amp; call-out</h3><table><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${labourRows}</tbody></table><h3>Materials</h3><table><thead><tr><th>Description</th><th>Qty</th><th>Selling price</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No materials added</td></tr>'}</tbody></table><h3>Services &amp; site work</h3><table><thead><tr><th>Task</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${serviceRows || '<tr><td colspan="5">No additional services</td></tr>'}</tbody></table><div class="print-totals"><span>Subtotal: ${currency(totals.subtotal)}</span><span>VAT (${totals.vatRate}%): ${currency(totals.vat)}</span><strong>Total: ${currency(totals.total)}</strong></div>${isAmended ? `<div class="print-amendment"><strong>Reason for amended quote</strong><span>${escapeHtml(amendmentReason)}</span></div>` : ''}${supportingPhotos}`;
}
function calculateTotals() {
    const { callout, labour } = getLabourTotals();
    const materialsTotal = materials.reduce((sum, material) => sum + getEffectiveCost(material) * (1 + MATERIAL_MARKUP / 100), 0);
    const servicesTotal = services.reduce((sum, service) => sum + getServiceRate(service) * getServiceQuantity(service), 0);
    const subtotal = callout + labour + materialsTotal + servicesTotal;
    const vatRate = Number($('vat-rate').value || VAT_DEFAULT);
    const vat = $('vat-enabled').checked ? subtotal * vatRate / 100 : 0;
    return { callout, labour, materialsTotal, servicesTotal, subtotal, vat, total: subtotal + vat, vatRate };
}
function renderServices() {
    $('service-list').innerHTML = services.map((service, index) => { const group = service.scenario || 'Additional services'; const previousGroup = index ? services[index - 1].scenario || 'Additional services' : ''; const heading = group === previousGroup ? '' : `<div class="service-group-label">${escapeHtml(group)}</div>`; return `${heading}<div class="material-row service-row" data-index="${index}"><select class="service-category" aria-label="Service category"><option value="">Select category</option>${serviceCategories.map(category => `<option ${service.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select><select class="service-task" aria-label="Service task"><option value="">Select task</option>${getServiceTasks(service).map(task => `<option ${service.task === task ? 'selected' : ''}>${escapeHtml(task)}</option>`).join('')}</select>${unitSelect(getServiceUnit(service), `Unit for ${service.task || 'service'}`).replace('class="price-unit"', 'class="service-unit"')}<input class="service-quantity" type="number" min="1" step="1" value="${getServiceQuantity(service)}" aria-label="Service quantity"><span class="service-rate">${currency(getServiceRate(service))}</span><span class="service-total">${currency(getServiceRate(service) * getServiceQuantity(service))}</span><button class="remove-material" type="button" aria-label="Remove service">×</button></div>`; }).join('');
    $('service-empty').style.display = services.length ? 'none' : 'block';
    document.querySelectorAll('.service-row').forEach(row => { const index = Number(row.dataset.index); row.querySelector('.service-category').addEventListener('change', event => { services[index] = { ...services[index], category: event.target.value, task: '', unit: 'Each', quantity: 1, rate: 350 }; renderServices(); }); row.querySelector('.service-task').addEventListener('change', event => { services[index].task = event.target.value; services[index].unit = serviceUnits[event.target.value] || 'Each'; services[index].rate = serviceRates[event.target.value] || 350; renderServices(); }); row.querySelector('.service-unit').addEventListener('change', event => { services[index].unit = event.target.value; }); row.querySelector('.service-quantity').addEventListener('input', event => { services[index].quantity = getServiceQuantity({ quantity: event.target.value }); renderServices(); calculate(); }); row.querySelector('.remove-material').addEventListener('click', () => { services.splice(index, 1); renderServices(); calculate(); }); });
}
function renderScenarioEditor() {
    const scenario = scenarios[$('scenario-editor-select').value];
    $('scenario-editor-list').innerHTML = scenario ? scenario.services.map((service, index) => `<div class="scenario-editor-row" data-index="${index}"><select class="scenario-editor-category" aria-label="Scenario service category"><option value="">Select category</option>${serviceCategories.map(category => `<option ${service.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select><select class="scenario-editor-task" aria-label="Scenario service task"><option value="">Select task</option>${getServiceTasks(service).map(task => `<option ${service.task === task ? 'selected' : ''}>${escapeHtml(task)}</option>`).join('')}</select>${unitSelect(getServiceUnit(service), `Unit for ${service.task || 'scenario service'}`).replace('class="price-unit"', 'class="scenario-editor-unit"')}<input class="scenario-editor-quantity" type="number" min="1" step="1" value="${getServiceQuantity(service)}" aria-label="Scenario service quantity"><span class="scenario-editor-rate">${currency(getServiceRate(service))}</span><span>${currency(getServiceRate(service) * getServiceQuantity(service))}</span><button class="remove-material" type="button" aria-label="Remove scenario service">×</button></div>`).join('') : '';
    $('scenario-editor-empty').style.display = scenario ? (scenario.services.length ? 'none' : 'block') : 'block';
    document.querySelectorAll('.scenario-editor-row').forEach(row => { const index = Number(row.dataset.index); row.querySelector('.scenario-editor-category').addEventListener('change', event => { scenario.services[index] = { ...scenario.services[index], category: event.target.value, task: '', unit: 'Each', quantity: 1, rate: 350 }; renderScenarioEditor(); }); row.querySelector('.scenario-editor-task').addEventListener('change', event => { scenario.services[index].task = event.target.value; scenario.services[index].unit = serviceUnits[event.target.value] || 'Each'; scenario.services[index].rate = serviceRates[event.target.value] || 350; renderScenarioEditor(); }); row.querySelector('.scenario-editor-unit').addEventListener('change', event => { scenario.services[index].unit = event.target.value; }); row.querySelector('.scenario-editor-quantity').addEventListener('input', event => { scenario.services[index].quantity = getServiceQuantity({ quantity: event.target.value }); renderScenarioEditor(); }); row.querySelector('.remove-material').addEventListener('click', () => { scenario.services.splice(index, 1); renderScenarioEditor(); }); });
}
function saveScenarioServices() { const id = $('scenario-editor-select').value; if (!id) { showToast('Select a scenario first'); return; } const savedServices = Object.fromEntries(Object.entries(scenarios).map(([scenarioId, scenario]) => [scenarioId, scenario.services])); customScenarios.forEach(scenario => { scenario.services = scenarios[scenario.id].services; }); localStorage.setItem('pipewise-scenario-services', JSON.stringify(savedServices)); localStorage.setItem('pipewise-custom-scenarios', JSON.stringify(customScenarios)); showToast('Scenario services saved'); }
function syncMasterScenarioOptions() { ['scenario-select', 'scenario-editor-select'].forEach(selectId => { const select = $(selectId); select.querySelectorAll('[data-master-scenario]').forEach(optionGroup => optionGroup.remove()); const categories = [...new Set(masterScenarioLibrary.map(([category]) => category))]; categories.forEach(category => { const group = document.createElement('optgroup'); group.label = category; group.dataset.masterScenario = 'true'; masterScenarioLibrary.filter(([libraryCategory]) => libraryCategory === category).forEach(([, name], index) => { const option = document.createElement('option'); option.value = `library-${masterScenarioLibrary.findIndex(([, scenarioName]) => scenarioName === name) + 1}`; option.textContent = name; group.append(option); }); select.append(group); }); }); }
function syncCustomScenarioOptions() { ['scenario-select', 'scenario-editor-select'].forEach(selectId => { const select = $(selectId); select.querySelectorAll('[data-custom-scenario]').forEach(option => option.remove()); let group = [...select.querySelectorAll('optgroup')].find(optionGroup => optionGroup.label === 'Custom scenarios'); if (!group) { group = document.createElement('optgroup'); group.label = 'Custom scenarios'; select.append(group); } customScenarios.forEach(scenario => { const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.name; option.dataset.customScenario = 'true'; group.append(option); }); }); }
function createScenario(event) { event.preventDefault(); const name = $('new-scenario-name').value.trim(); if (!name) { $('new-scenario-name').focus(); return; } const id = `custom-${Date.now()}`; const scenario = { id, name, services: [] }; customScenarios.push(scenario); scenarios[id] = { services: scenario.services, materials: [] }; localStorage.setItem('pipewise-custom-scenarios', JSON.stringify(customScenarios)); syncCustomScenarioOptions(); $('scenario-editor-select').value = id; $('scenario-dialog').close(); $('scenario-form').reset(); renderScenarioEditor(); showToast('New scenario created'); }
function renderLabourItems() {
    $('labour-list').innerHTML = labourItems.map((item, index) => `<div class="labour-row" data-index="${index}"><span>${escapeHtml(item.description)}</span><span>${escapeHtml(item.unit)}</span><input class="labour-quantity" type="number" min="0" step="1" value="${getValue(item.quantity)}" aria-label="Quantity for ${escapeHtml(item.description)}"><input class="labour-rate" type="number" min="0" step="0.01" value="${getValue(item.rate)}" aria-label="Cost per day for ${escapeHtml(item.description)}"><strong>${currency(getValue(item.quantity) * getValue(item.rate))}</strong></div>`).join('');
    document.querySelectorAll('.labour-row').forEach(row => { const index = Number(row.dataset.index); row.querySelector('.labour-quantity').addEventListener('input', event => { labourItems[index].quantity = getValue(event.target.value); renderLabourItems(); calculate(); }); row.querySelector('.labour-rate').addEventListener('input', event => { labourItems[index].rate = getValue(event.target.value); renderLabourItems(); calculate(); }); });
}
function addScenario() { const scenario = scenarios[$('scenario-select').value]; if (!scenario) { showToast('Select a job scenario first'); return; } const scenarioName = $('scenario-select').selectedOptions[0].textContent.trim(); services.push(...scenario.services.map(service => ({ ...service, scenario: scenarioName }))); materials.push(...scenario.materials.map(material => ({ ...material }))); renderMaterials(); renderServices(); calculate(); showToast('Scenario added. Remove any items you do not need.'); }
function renderMaterials() {
    $('material-list').innerHTML = materials.map((material, index) => `
    <div class="material-row" data-index="${index}">
                <select class="material-category" aria-label="Material category"><option value="">Select category</option>${catalogueCategories.map(category => `<option ${material.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select>
            <select class="material-type" aria-label="Material type"><option value="">Select type</option>${material.category && plumbingCatalogue[material.category] ? Object.keys(plumbingCatalogue[material.category]).map(type => `<option ${material.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('') : ''}</select>
            <select class="material-size" aria-label="Material size"><option value="">Select size</option>${material.category && material.type && plumbingCatalogue[material.category]?.[material.type] ? Object.keys(plumbingCatalogue[material.category][material.type].sizes).map(size => `<option ${material.size === size ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('') : ''}</select>
            <input class="material-quantity" type="number" min="1" step="1" value="${getQuantity(material)}" aria-label="Material quantity">
            <input class="material-width" type="number" min="0" step="1" value="${Number(material.width) || 0}" placeholder="W mm" aria-label="Width (mm)">
            <input class="material-height" type="number" min="0" step="1" value="${Number(material.height) || 0}" placeholder="H mm" aria-label="Height (mm)">
        <span class="material-best-price">${material.description ? currency(getSupplierCost(material)) : '—'}</span>
    <input class="material-markup" type="number" value="${MATERIAL_MARKUP}" aria-label="Material markup percentage" readonly>
    <span class="material-total">${currency(getEffectiveCost(material) * (1 + MATERIAL_MARKUP / 100))}</span>
      <button class="remove-material" type="button" aria-label="Remove material">×</button>
    </div>`).join('');
    $('material-empty').style.display = materials.length ? 'none' : 'block';
    document.querySelectorAll('#material-list .material-row').forEach(row => {
        const index = Number(row.dataset.index);
        row.querySelector('.material-category').addEventListener('change', event => { materials[index] = { category: event.target.value, type: '', size: '', description: '', cost: 0, markup: MATERIAL_MARKUP }; renderMaterials(); });
        row.querySelector('.material-type').addEventListener('change', event => { materials[index].type = event.target.value; materials[index].size = ''; materials[index].markup = MATERIAL_MARKUP; renderMaterials(); });
        row.querySelector('.material-size').addEventListener('change', event => { const item = plumbingCatalogue[materials[index].category]?.[materials[index].type]; if (!item || !event.target.value) return; materials[index].size = event.target.value; materials[index].description = `${materials[index].type} - ${event.target.value}`; materials[index].cost = item.sizes[event.target.value]; materials[index].markup = MATERIAL_MARKUP; renderMaterials(); });
        row.querySelector('.material-quantity').addEventListener('input', event => { materials[index].quantity = Math.max(1, Math.floor(getValue(event.target.value))); renderMaterials(); calculate(); });
        row.querySelector('.material-width').addEventListener('input', event => { materials[index].width = getValue(event.target.value); renderMaterials(); calculate(); });
        row.querySelector('.material-height').addEventListener('input', event => { materials[index].height = getValue(event.target.value); renderMaterials(); calculate(); });
        materials[index].markup = MATERIAL_MARKUP;
        row.querySelector('.remove-material').addEventListener('click', () => { materials.splice(index, 1); renderMaterials(); calculate(); });
    });
    calculate();
}
function getValue(value) { return Math.max(0, Number(value) || 0); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function updateSummary() { $('summary-customer').textContent = $('customer-name').value.trim() || 'New customer'; $('summary-address').textContent = $('customer-address').value.trim() || 'Add a service address'; }
function updateSitePhotoPreview() { $('site-photo-preview').innerHTML = sitePhotos.map((photo, index) => `<div class="site-photo-card"><img src="${photo.data}" alt="Site photo ${index + 1}"><label>Photo description<input class="site-photo-description" data-photo-index="${index}" type="text" value="${escapeHtml(photo.description || '')}" placeholder="e.g. Existing leak under basin"></label><button class="remove-photo" type="button" data-photo-index="${index}" aria-label="Remove site photo ${index + 1}">×</button></div>`).join(''); $('site-photo-status').textContent = sitePhotos.length ? `${sitePhotos.length} photo${sitePhotos.length === 1 ? '' : 's'} attached` : 'No photos selected'; document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => { sitePhotos.splice(Number(button.dataset.photoIndex), 1); updateSitePhotoPreview(); })); document.querySelectorAll('.site-photo-description').forEach(input => input.addEventListener('input', event => { sitePhotos[Number(event.target.dataset.photoIndex)].description = event.target.value; updatePrintDetails(); })); updatePrintDetails(); }
function compressSitePhoto(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Photo could not be read')); reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error('Photo could not be opened')); image.onload = () => { const scale = Math.min(1, 1600 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .82)); }; image.src = reader.result; }; reader.readAsDataURL(file); }); }
function markQuoteAmended() { if (loadedQuoteIndex === null || isAmended) return; isAmended = true; $('quote-status').textContent = 'AMENDED'; $('amendment-panel').hidden = false; updatePrintDetails(); }
function resetForm() { loadedQuoteIndex = null; isAmended = false; $('quote-status').textContent = 'NEW'; $('amendment-panel').hidden = true;['customer-name', 'customer-phone', 'customer-address', 'service-description', 'amendment-reason'].forEach(id => { $(id).value = ''; }); sitePhotos = []; $('site-photo').value = ''; updateSitePhotoPreview(); labourItems = defaultLabourItems(); $('vat-enabled').checked = true; materials = []; services = []; $('quote-number').textContent = nextQuoteNumber(); updateSummary(); renderLabourItems(); renderMaterials(); renderServices(); }
function saveQuote() {
    const name = $('customer-name').value.trim();
    if (!name) { $('customer-name').focus(); showToast('Add the customer name first'); return; }
    const totals = calculate();
    const quote = { id: $('quote-number').textContent, date: new Date().toISOString(), customer: { name, phone: $('customer-phone').value.trim(), address: $('customer-address').value.trim(), serviceDescription: $('service-description').value.trim(), sitePhotos }, labour: { items: labourItems.map(item => ({ ...item })) }, materials: [...materials], services: [...services], totals, amended: isAmended, amendmentReason: $('amendment-reason').value.trim() };
    if (loadedQuoteIndex === null) quotes.unshift(quote); else quotes[loadedQuoteIndex] = quote;
    localStorage.setItem('pipewise-quotes', JSON.stringify(quotes)); saveQuotesToDrive(true); $('quote-count').textContent = quotes.length; showToast(isAmended ? `Amended quote ${quote.id} saved` : `Quote ${quote.id} saved`); resetForm(); renderSavedQuotes();
}
function renderSavedQuotes() {
    $('quote-count').textContent = quotes.length;
    $('saved-quotes').innerHTML = quotes.length ? quotes.map((quote, index) => `<article class="saved-quote"><div><strong>${escapeHtml(quote.customer.name)}</strong><small>${escapeHtml(quote.id)} · ${new Date(quote.date).toLocaleDateString('en-ZA')}</small></div><div><small>Service address</small><span>${escapeHtml(quote.customer.address || 'Not provided')}</span></div><div class="saved-quote-total">${currency(quote.totals.total)}<small>${quote.materials.length} material${quote.materials.length === 1 ? '' : 's'}</small></div><div class="quote-actions"><button data-load="${index}">Open</button><button data-pdf="${index}" title="View quote as PDF" aria-label="View ${escapeHtml(quote.id)} as PDF">PDF</button><button data-delete="${index}" aria-label="Delete quote">×</button></div></article>`).join('') : '<div class="material-empty">Saved quotes will appear here.</div>';
    document.querySelectorAll('[data-load]').forEach(button => button.addEventListener('click', () => loadQuote(Number(button.dataset.load))));
    document.querySelectorAll('[data-pdf]').forEach(button => button.addEventListener('click', () => viewSavedQuotePdf(Number(button.dataset.pdf))));
    document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => { quotes.splice(Number(button.dataset.delete), 1); localStorage.setItem('pipewise-quotes', JSON.stringify(quotes)); saveQuotesToDrive(true); renderSavedQuotes(); showToast('Quote deleted'); }));
}
function loadQuote(index) { const quote = quotes[index]; loadedQuoteIndex = index; isAmended = Boolean(quote.amended); $('quote-status').textContent = isAmended ? 'AMENDED' : 'SAVED'; $('amendment-panel').hidden = !isAmended; $('customer-name').value = quote.customer.name; $('customer-phone').value = quote.customer.phone; $('customer-address').value = quote.customer.address; $('service-description').value = quote.customer.serviceDescription || ''; $('amendment-reason').value = quote.amendmentReason || ''; sitePhotos = (quote.customer.sitePhotos || (quote.customer.sitePhoto ? [quote.customer.sitePhoto] : [])).map(photo => typeof photo === 'string' ? { data: photo, description: '' } : photo); updateSitePhotoPreview(); labourItems = quote.labour.items ? quote.labour.items.map(item => ({ ...item })) : [{ description: 'Call-out fee', unit: 'Each', quantity: 1, rate: quote.labour.callout ?? 650, type: 'callout' }, { description: 'Inspection & evaluation', unit: 'Day', quantity: quote.labour.hours ?? 0, rate: quote.labour.plumberHourlyRate ?? quote.labour.hourlyRate ?? 500, type: 'labour' }, { description: 'Additional labour', unit: 'Day', quantity: quote.labour.extraWorkers ?? 0, rate: quote.labour.extraWorkerHourlyRate ?? 500, type: 'labour' }]; materials = quote.materials; services = quote.services || []; $('quote-number').textContent = quote.id; updateSummary(); renderLabourItems(); renderMaterials(); renderServices(); switchView('new-quote'); }
// ===================== GOOGLE DRIVE SYNC =====================
// Replace with your OAuth Client ID from Google Cloud Console (see README steps).
const GOOGLE_CLIENT_ID = '550031555566-mtvat3oqerd8iva15qj73gr8kf6kgump.apps.googleusercontent.com';
const DRIVE_FILE_NAME = 'pipewise-quotes.json';
let googleToken = null;
let googleEmail = null;
let driveFileId = null;
let tokenClient = null;

function updateDriveStatus(message) { const el = $('drive-status'); if (el) el.textContent = message; }

function updateDriveButtons() {
    const signedIn = Boolean(googleToken);
    $('google-signin-button').hidden = signedIn;
    $('drive-save-button').hidden = !signedIn;
    $('drive-load-button').hidden = !signedIn;
}

function initGoogleSignIn(retries = 0) {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
        if (retries < 40) { setTimeout(() => initGoogleSignIn(retries + 1), 300); return; }
        updateDriveStatus('Google sign-in library could not load — check your internet connection or ad blocker');
        return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file email',
        callback: response => {
            if (response.access_token) { googleToken = response.access_token; updateDriveButtons(); updateDriveStatus('Connected to Google Drive'); findDriveFile().then(() => loadQuotesFromDrive()); }
            else if (response.error) { updateDriveStatus('Google sign-in failed: ' + response.error); }
        }
    });
}

function signInGoogle() {
    if (GOOGLE_CLIENT_ID.startsWith('YOUR_CLIENT_ID')) { showToast('Add your Google Client ID in app.js first'); return; }
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function driveFetch(url, options = {}) {
    options.headers = { ...(options.headers || {}), Authorization: `Bearer ${googleToken}` };
    const response = await fetch(url, options);
    if (response.status === 401) { googleToken = null; updateDriveButtons(); updateDriveStatus('Google session expired — sign in again'); throw new Error('unauthorised'); }
    if (!response.ok) throw new Error(`Drive request failed (${response.status})`);
    return response;
}

async function findDriveFile() {
    try {
        const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
        const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
        const data = await response.json();
        driveFileId = data.files && data.files.length ? data.files[0].id : null;
        updateDriveStatus(driveFileId ? 'Backing up to Drive: pipewise-quotes.json' : 'No Drive backup yet — it will be created on next save');
    } catch { /* silent — status already handled in driveFetch for 401s */ }
}

async function saveQuotesToDrive(silent = false) {
    if (!googleToken) return;
    try {
        if (!driveFileId) await findDriveFile();
        const boundary = 'pipewise' + Date.now();
        const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ exported: new Date().toISOString(), quotes }, null, 2)}\r\n--${boundary}--`;
        const url = driveFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
        const response = await driveFetch(url, { method: driveFileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
        if (!driveFileId) driveFileId = (await response.json()).id;
        if (!silent) showToast('Quotes saved to Google Drive');
        updateDriveStatus(`Backed up to Drive · ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
        if (error.message !== 'unauthorised') { updateDriveStatus('Drive backup failed — will retry on next save'); if (!silent) showToast('Could not save to Google Drive'); }
    }
}

async function loadQuotesFromDrive() {
    if (!googleToken) { updateDriveStatus('Sign in to Google first'); return; }
    try {
        if (!driveFileId) await findDriveFile();
        if (!driveFileId) { showToast('No backup found in Drive yet'); return; }
        const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
        const data = JSON.parse(await response.text());
        const incoming = Array.isArray(data) ? data : data.quotes;
        if (!Array.isArray(incoming)) throw new Error('bad format');
        const existingIds = new Set(quotes.map(quote => quote.id));
        const added = incoming.filter(quote => quote && quote.id && !existingIds.has(quote.id));
        if (!added.length) { showToast('Quotes already up to date with Drive'); return; }
        quotes = incoming.filter(quote => quote && quote.id);
        localStorage.setItem('pipewise-quotes', JSON.stringify(quotes));
        renderSavedQuotes();
        showToast(`${added.length} quote${added.length === 1 ? '' : 's'} loaded from Drive`);
    } catch (error) {
        if (error.message !== 'unauthorised') showToast('Could not read backup from Drive');
    }
}
// =================== END GOOGLE DRIVE SYNC ===================

function exportQuotes() {
    if (!quotes.length) { showToast('No saved quotes to export'); return; }
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), quotes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipewise-quotes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${quotes.length} quote${quotes.length === 1 ? '' : 's'} saved to file`);
}

function importQuotes(file) {
    const reader = new FileReader();
    reader.onerror = () => showToast('File could not be read');
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const incoming = Array.isArray(data) ? data : data.quotes;
            if (!Array.isArray(incoming)) throw new Error('bad format');
            const existingIds = new Set(quotes.map(quote => quote.id));
            const added = incoming.filter(quote => quote && quote.id && !existingIds.has(quote.id));
            if (!added.length) { showToast('No new quotes found in file'); return; }
            quotes = [...added, ...quotes];
            localStorage.setItem('pipewise-quotes', JSON.stringify(quotes));
            renderSavedQuotes();
            showToast(`${added.length} quote${added.length === 1 ? '' : 's'} imported`);
        } catch { showToast('That file is not a valid quotes file'); }
    };
    reader.readAsText(file);
}

function viewSavedQuotePdf(index) { loadQuote(index); requestAnimationFrame(() => window.print()); }
function switchView(view) { document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view)); document.querySelectorAll('.view').forEach(item => item.classList.remove('active-view')); $(`${view}-view`).classList.add('active-view'); $('page-title').textContent = view === 'new-quote' ? 'Quote' : view === 'quotes' ? 'Saved quotes' : view === 'price-list' ? 'Price list' : view === 'scenarios' ? 'Scenarios' : 'Company settings'; if (view === 'price-list') renderPriceList(); if (view === 'scenarios') renderScenarioEditor(); }
function loadSettings() { $('company-name').value = settings.name || ''; $('company-phone').value = settings.phone || ''; $('company-email').value = settings.email || ''; $('prepared-by').value = settings.preparedBy || ''; $('tax-number').value = settings.taxNumber || ''; $('print-prepared-by').textContent = settings.preparedBy || 'Cheyenne'; $('print-contact').textContent = settings.phone || '076 705 8718'; $('print-email').textContent = settings.email || 'architecturalplumbingservices@gmail.com'; $('print-tax-number').textContent = settings.taxNumber || '105 976 616'; $('vat-rate').value = settings.vatRate ?? VAT_DEFAULT; $('quote-date').textContent = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
document.querySelectorAll('.supplier-tab').forEach(tab => tab.addEventListener('click', () => { selectedSupplier = tab.dataset.supplier; document.querySelectorAll('.supplier-tab').forEach(item => item.classList.toggle('active', item === tab)); $('supplier-source').innerHTML = `Prices shown from ${supplierInfo[selectedSupplier].name} reference catalogue · <a href="${supplierInfo[selectedSupplier].url}" target="_blank" rel="noopener">Open supplier ↗</a>`; renderMaterials(); }));
document.querySelectorAll('input, textarea').forEach(input => input.addEventListener('input', () => { updateSummary(); calculate(); }));
document.querySelector('#new-quote-view').addEventListener('input', event => { if (event.target.id !== 'amendment-reason') markQuoteAmended(); });
document.querySelector('#new-quote-view').addEventListener('change', event => { if (event.target.id !== 'amendment-reason') markQuoteAmended(); });
$('site-photo').addEventListener('change', async event => { const files = [...event.target.files]; if (!files.length) return; if (files.some(file => !file.type.startsWith('image/'))) { showToast('Choose image files only'); event.target.value = ''; return; } try { sitePhotos.push(...(await Promise.all(files.map(compressSitePhoto))).map(data => ({ data, description: '' }))); updateSitePhotoPreview(); } catch { showToast('One or more photos could not be added'); } finally { event.target.value = ''; } });
$('scenario-editor-select').innerHTML = $('scenario-select').innerHTML;
syncMasterScenarioOptions();
syncCustomScenarioOptions();
$('scenario-editor-select').addEventListener('change', renderScenarioEditor);
$('new-scenario').addEventListener('click', () => { $('scenario-dialog').showModal(); $('new-scenario-name').focus(); });
$('cancel-scenario').addEventListener('click', () => $('scenario-dialog').close());
$('scenario-form').addEventListener('submit', createScenario);
$('add-scenario-service').addEventListener('click', () => { const scenario = scenarios[$('scenario-editor-select').value]; if (!scenario) { showToast('Select a scenario first'); return; } scenario.services.push({ category: '', task: '', unit: 'Each', quantity: 1, rate: 350 }); renderScenarioEditor(); });
$('save-scenario').addEventListener('click', saveScenarioServices);
$('add-material').addEventListener('click', () => { materials.push({ category: '', type: '', size: '', quantity: 1, description: '', cost: 0, markup: MATERIAL_MARKUP }); renderMaterials(); document.querySelector('.material-category:last-of-type')?.focus(); });
$('add-service').addEventListener('click', () => { services.push({ category: '', task: '', quantity: 1, rate: 350, scenario: 'Additional services' }); renderServices(); document.querySelector('.service-category:last-of-type')?.focus(); });
$('add-scenario').addEventListener('click', addScenario);
function clearQuote() { resetForm(); showToast('Quote cleared'); }
$('save-quote').addEventListener('click', saveQuote); $('clear-quote').addEventListener('click', clearQuote); $('clear-quote-top').addEventListener('click', clearQuote); $('print-button').addEventListener('click', () => window.print()); $('pdf-button').addEventListener('click', () => window.print()); $('export-quotes-button').addEventListener('click', exportQuotes);
$('import-quotes-button').addEventListener('click', () => $('import-quotes-file').click());
$('import-quotes-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) importQuotes(file); event.target.value = ''; });
$('google-signin-button').addEventListener('click', signInGoogle);
$('drive-save-button').addEventListener('click', () => saveQuotesToDrive(false));
$('drive-load-button').addEventListener('click', loadQuotesFromDrive);
initGoogleSignIn();
$('new-quote-button').addEventListener('click', () => { resetForm(); switchView('new-quote'); });
$('check-prices-button').addEventListener('click', runPriceCheck);
$('price-list-file-page').addEventListener('change', importPriceList);
$('price-list-search').addEventListener('input', renderPriceList);
$('save-price-list').addEventListener('click', savePriceList);
$('add-price').addEventListener('click', () => { const row = document.createElement('tr'); row.className = 'price-entry new-price-entry'; row.dataset.task = ''; row.innerHTML = `<td><select class="price-category" aria-label="New price category">${categoryOptions('')}</select></td><td>${unitSelect('Each', 'New price type or unit')}</td><td><input class="price-line-item" placeholder="New line item" aria-label="New price line item"></td><td><input class="price-rate" type="number" min="0" step="0.01" value="0" aria-label="New price rate"></td><td></td>`; $('price-list-body').prepend(row); row.querySelector('.price-line-item').focus(); });
$('save-settings').addEventListener('click', () => { settings = { name: $('company-name').value.trim(), phone: $('company-phone').value.trim(), email: $('company-email').value.trim(), preparedBy: $('prepared-by').value.trim(), taxNumber: $('tax-number').value.trim(), vatRate: getNumber('vat-rate') }; localStorage.setItem('pipewise-settings', JSON.stringify(settings)); loadSettings(); calculate(); showToast('Company settings saved'); });
loadSettings(); resetForm(); renderSavedQuotes(); renderPriceList(); updatePriceCheckStatus();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => { });
