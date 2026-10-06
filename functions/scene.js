/* =========================================================
 * ISLAND SCENE
 * 1920 × 1080
 *
 * Style:
 * - Warm 2D illustration
 * - Slight pixel-art feeling
 * - Wide ocean panorama
 * - Flat / low island
 * - Cozy island village
 * ========================================================= */

const SCENE_W = 1920;
const SCENE_H = 1080;

const SPRITE_SCALE = 3;

let sceneRAF = null;
let sceneTick = 0;


/* =========================================================
 * SEASON PALETTE
 * ========================================================= */

const SCENE_PALETTE = {

    spring: {
        skyTop: '#8ECBE2',
        skyBottom: '#DDF1F2',

        oceanTop: '#4EABC1',
        oceanBottom: '#8AD0D0',
        oceanLight: '#B7E5DC',
        oceanDark: '#3C91AC',

        islandGrass: '#78B95A',
        islandGrassDark: '#559648',
        islandGrassLight: '#98C96D',

        sand: '#E9D39B',
        sandLight: '#F2E2B6',

        cliff: '#86684B',
        cliffDark: '#684D39',

        tree: '#4D974E',
        treeDark: '#34753D',
        treeLight: '#73B85B',

        roof: '#A95E45',
        roofDark: '#814434',

        wood: '#A8734D',
        woodDark: '#765037',

        path: '#CFAE73',
        pathLight: '#E4CA91',

        flower: '#F49AB7'
    },

    summer: {
        skyTop: '#65BCE3',
        skyBottom: '#D7F0F2',

        oceanTop: '#339DC2',
        oceanBottom: '#78C8CF',
        oceanLight: '#A9E1D9',
        oceanDark: '#2784A7',

        islandGrass: '#61AF50',
        islandGrassDark: '#438D43',
        islandGrassLight: '#84C761',

        sand: '#E7D093',
        sandLight: '#F1DFAD',

        cliff: '#806046',
        cliffDark: '#604735',

        tree: '#398B46',
        treeDark: '#276D38',
        treeLight: '#5EAB4F',

        roof: '#B85E43',
        roofDark: '#873F31',

        wood: '#A97049',
        woodDark: '#704A34',

        path: '#CBA66C',
        pathLight: '#E1C78C',

        flower: '#F2D05D'
    },

    autumn: {
        skyTop: '#E59A5C',
        skyBottom: '#F4D5A9',

        oceanTop: '#4F93A7',
        oceanBottom: '#9BC5C1',
        oceanLight: '#C9DFD8',
        oceanDark: '#3E7C92',

        islandGrass: '#A97B3F',
        islandGrassDark: '#80602F',
        islandGrassLight: '#C39A55',

        sand: '#D8B778',
        sandLight: '#E8CC97',

        cliff: '#76543D',
        cliffDark: '#5A4030',

        tree: '#C36F32',
        treeDark: '#914A2B',
        treeLight: '#D58A3E',

        roof: '#9A4E3B',
        roofDark: '#71372D',

        wood: '#986844',
        woodDark: '#67452F',

        path: '#BD965F',
        pathLight: '#D9BA7D',

        flower: '#EFA04E'
    },

    winter: {
        skyTop: '#8FA4B4',
        skyBottom: '#D9E2E4',

        oceanTop: '#587C91',
        oceanBottom: '#A9C7CC',
        oceanLight: '#D7E8E7',
        oceanDark: '#486C82',

        islandGrass: '#C8D1C9',
        islandGrassDark: '#9BA9A1',
        islandGrassLight: '#E0E6E0',

        sand: '#DED6C4',
        sandLight: '#F0E9D9',

        cliff: '#737878',
        cliffDark: '#555B5C',

        tree: '#839C91',
        treeDark: '#627E73',
        treeLight: '#A7BBB1',

        roof: '#7D6D69',
        roofDark: '#5B4F4D',

        wood: '#887464',
        woodDark: '#625244',

        path: '#B5A68B',
        pathLight: '#D0C4AA',

        flower: '#C8DDE3'
    }
};


/* =========================================================
 * SAFE HELPERS
 * ========================================================= */

function getSceneCanvas() {
    return (
        document.getElementById('vn-result-canvas') ||
        document.getElementById('vn-scene-canvas') ||
        document.getElementById('scene')
    );
}


function getSeason() {
    if (typeof window !== 'undefined' && window.sceneSeasonOverride) {
        return window.sceneSeasonOverride;
    }

    const state = typeof S !== 'undefined' ? S : null;
    const raw = state && typeof state.season !== 'undefined' ? state.season : 'summer';
    const map = { 0: 'spring', 1: 'summer', 2: 'autumn', 3: 'winter' };

    if (typeof raw === 'number') {
        return map[raw] || 'summer';
    }

    return raw || 'summer';
}


function getWeather() {
    const state = typeof S !== 'undefined' ? S : null;
    const raw = state && typeof state.weather !== 'undefined' ? state.weather : 'clear';
    const map = {
        calm: 'clear',
        clear: 'clear',
        sun: 'clear',
        sunny: 'clear',
        fog: 'fog',
        rain: 'rain',
        storm: 'storm',
        snow: 'snow'
    };

    return map[raw] || raw || 'clear';
}


function isUnlocked(key) {
    if (typeof has === 'function') {
        return has(key);
    }

    return true;
}


function roundedRect(ctx, x, y, w, h, r) {

    r = Math.min(r, w / 2, h / 2);

    ctx.beginPath();

    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
        return;
    }

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}


/* =========================================================
 * MAIN
 * ========================================================= */

function drawScene() {

    const canvas = getSceneCanvas();

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = SCENE_W;
    canvas.height = SCENE_H;

    ctx.imageSmoothingEnabled = true;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    function render() {

        sceneTick++;

        ctx.clearRect(0, 0, SCENE_W, SCENE_H);

        const season = getSeason();
        const weather = getWeather();

        const P = SCENE_PALETTE[season] || SCENE_PALETTE.summer;

        /* ---------------------------------------------
         * BACKGROUND
         * --------------------------------------------- */

        drawSky(ctx, P, season);

        drawClouds(ctx, P, season);

        drawOcean(ctx, P, season);

        drawDistantIslands(ctx, P, season);

        /* ---------------------------------------------
         * MAIN ISLAND
         * --------------------------------------------- */

        drawIsland(ctx, P, season);

        drawIslandDetails(ctx, P, season);

        /* ---------------------------------------------
         * VILLAGE
         * --------------------------------------------- */

        drawVillage(ctx, P, season);

        /* ---------------------------------------------
         * WATER / HARBOR
         * --------------------------------------------- */

        drawBoats(ctx, P, season);

        drawIslandWaves(ctx, P, season);

        /* ---------------------------------------------
         * WEATHER
         * --------------------------------------------- */

        drawWeather(ctx, P, weather);

        /* ---------------------------------------------
         * EXISTING SPRITES
         * --------------------------------------------- */

        drawCharactersAndProps(ctx);

        sceneRAF = requestAnimationFrame(render);
    }

    if (sceneRAF) {
        cancelAnimationFrame(sceneRAF);
    }

    render();
}


/* =========================================================
 * SKY
 * ========================================================= */

function drawSky(ctx, P, season) {

    const gradient = ctx.createLinearGradient(
        0, 0,
        0, 460
    );

    gradient.addColorStop(0, P.skyTop);
    gradient.addColorStop(1, P.skyBottom);

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        SCENE_W,
        500
    );

    const sunX = 1570;
    const sunY = 125;

    const glow = ctx.createRadialGradient(
        sunX,
        sunY,
        20,
        sunX,
        sunY,
        180
    );

    glow.addColorStop(0, 'rgba(255,245,195,0.55)');
    glow.addColorStop(1, 'rgba(255,245,195,0)');

    ctx.fillStyle = glow;

    ctx.beginPath();
    ctx.arc(
        sunX,
        sunY,
        180,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = '#FFF2B0';

    ctx.beginPath();
    ctx.arc(
        sunX,
        sunY,
        46,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


/* =========================================================
 * CLOUD
 * ========================================================= */

function drawCloud(ctx, x, y, scale = 1, alpha = 0.75) {

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFFFFF';

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        28 * scale,
        Math.PI,
        0
    );

    ctx.arc(
        x + 40 * scale,
        y - 10 * scale,
        40 * scale,
        Math.PI,
        0
    );

    ctx.arc(
        x + 90 * scale,
        y,
        30 * scale,
        Math.PI,
        0
    );

    ctx.lineTo(
        x + 120 * scale,
        y + 25 * scale
    );

    ctx.lineTo(
        x - 10 * scale,
        y + 25 * scale
    );

    ctx.closePath();

    ctx.fill();
    ctx.restore();
}


function drawClouds(ctx, P, season) {

    const drift = Math.sin(sceneTick * 0.0005) * 35;

    drawCloud(
        ctx,
        170 + drift,
        145,
        1.1,
        0.78
    );

    drawCloud(
        ctx,
        760 + drift * 0.6,
        105,
        0.8,
        0.6
    );

    drawCloud(
        ctx,
        1170 + drift * 0.4,
        205,
        0.9,
        0.62
    );
}


/* =========================================================
 * OCEAN
 * ========================================================= */

function drawOcean(ctx, P, season) {

    const oceanY = 400;

    const gradient = ctx.createLinearGradient(
        0,
        oceanY,
        0,
        SCENE_H
    );

    gradient.addColorStop(0, P.oceanTop);
    gradient.addColorStop(0.55, P.oceanBottom);
    gradient.addColorStop(1, P.oceanTop);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, oceanY, SCENE_W, SCENE_H - oceanY);

    for (let i = 0; i < 18; i++) {

        const y = 450 + i * 32 + Math.sin(sceneTick * 0.001 + i) * 2;
        const alpha = 0.06 + (i % 3) * 0.02;

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = i < 5 ? 3 : 2;
        ctx.beginPath();

        for (let x = -50; x < SCENE_W + 50; x += 160) {
            const wave = Math.sin(x * 0.01 + sceneTick * 0.001 + i) * 4;
            ctx.lineTo(x, y + wave);
        }

        ctx.stroke();
    }

    for (let i = 0; i < 9; i++) {

        const y = 800 + i * 34;

        ctx.strokeStyle = `rgba(255,255,255,${0.10 + i * 0.015})`;
        ctx.lineWidth = 3;

        for (let x = -100; x < SCENE_W; x += 260) {
            const offset = Math.sin(sceneTick * 0.0015 + i + x) * 15;

            ctx.beginPath();
            ctx.moveTo(x + offset, y);
            ctx.quadraticCurveTo(x + 55 + offset, y - 7, x + 110 + offset, y);
            ctx.stroke();
        }
    }
}


/* =========================================================
 * DISTANT ISLANDS
 * ========================================================= */

function drawDistantIslands(ctx, P, season) {

    ctx.fillStyle = P.oceanDark;

    ctx.beginPath();
    ctx.moveTo(0, 585);
    ctx.quadraticCurveTo(80, 535, 180, 555);
    ctx.quadraticCurveTo(250, 565, 320, 595);
    ctx.lineTo(0, 630);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1470, 530);
    ctx.quadraticCurveTo(1550, 470, 1640, 490);
    ctx.quadraticCurveTo(1730, 500, 1800, 555);
    ctx.lineTo(1920, 610);
    ctx.lineTo(1450, 610);
    ctx.closePath();
    ctx.fill();
}


/* =========================================================
 * MAIN ISLAND
 *
 * IMPORTANT:
 * This is intentionally FLAT.
 * No mountain / hill layers.
 * ========================================================= */

function islandPath(ctx) {

    ctx.beginPath();

    ctx.moveTo(400, 735);

    ctx.bezierCurveTo(
        450,
        650,
        560,
        595,
        700,
        580
    );

    ctx.bezierCurveTo(
        820,
        550,
        970,
        555,
        1090,
        575
    );

    ctx.bezierCurveTo(
        1250,
        595,
        1400,
        635,
        1510,
        700
    );

    ctx.bezierCurveTo(
        1580,
        745,
        1610,
        820,
        1560,
        875
    );

    ctx.bezierCurveTo(
        1490,
        950,
        1350,
        980,
        1190,
        995
    );

    ctx.bezierCurveTo(
        1010,
        1015,
        820,
        1010,
        670,
        980
    );

    ctx.bezierCurveTo(
        530,
        950,
        420,
        900,
        390,
        825
    );

    ctx.bezierCurveTo(
        375,
        790,
        380,
        760,
        400,
        735
    );

    ctx.closePath();
}


function drawIsland(ctx, P, season) {

    ctx.save();
    ctx.translate(0, 22);

    islandPath(ctx);
    ctx.fillStyle = 'rgba(25,70,80,0.20)';
    ctx.fill();
    ctx.restore();

    islandPath(ctx);
    ctx.fillStyle = P.sand;
    ctx.fill();

    ctx.save();
    islandPath(ctx);
    ctx.clip();
    ctx.fillStyle = P.cliff;
    ctx.fillRect(0, 815, SCENE_W, 240);
    ctx.restore();

    ctx.beginPath();

    ctx.moveTo(435, 740);
    ctx.bezierCurveTo(510, 665, 620, 630, 760, 620);
    ctx.bezierCurveTo(900, 600, 1080, 610, 1210, 630);
    ctx.bezierCurveTo(1360, 650, 1460, 700, 1515, 755);
    ctx.bezierCurveTo(1545, 800, 1525, 850, 1460, 880);
    ctx.bezierCurveTo(1320, 940, 1140, 955, 970, 950);
    ctx.bezierCurveTo(780, 945, 620, 915, 510, 865);
    ctx.bezierCurveTo(450, 835, 420, 790, 435, 740);
    ctx.closePath();

    ctx.fillStyle = P.islandGrass;
    ctx.fill();

    ctx.globalAlpha = 0.35;

    for (let i = 0; i < 22; i++) {
        const x = 470 + ((i * 137) % 950);
        const y = 690 + ((i * 83) % 220);

        ctx.fillStyle = P.islandGrassLight;
        ctx.beginPath();
        ctx.ellipse(x, y, 35 + (i % 3) * 12, 12, -0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;

    ctx.strokeStyle = P.sandLight;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(430, 765);
    ctx.bezierCurveTo(500, 700, 600, 670, 700, 665);
    ctx.stroke();

    ctx.strokeStyle = P.sandLight;
    ctx.lineWidth = 25;
    ctx.beginPath();
    ctx.moveTo(580, 925);
    ctx.bezierCurveTo(800, 985, 1180, 985, 1430, 900);
    ctx.stroke();
}


/* =========================================================
 * ISLAND DETAILS
 * ========================================================= */

function drawIslandDetails(ctx, P, season) {

    drawPath(ctx, P);
    drawTrees(ctx, P, season);
    drawFlowers(ctx, P);
    drawFarm(ctx, P, season);
    drawRocks(ctx, P);
}


/* =========================================================
 * PATH
 * ========================================================= */

function drawPath(ctx, P) {

    ctx.strokeStyle = 'rgba(80,60,40,0.15)';
    ctx.lineWidth = 62;
    ctx.beginPath();
    ctx.moveTo(980, 640);
    ctx.bezierCurveTo(960, 690, 930, 735, 955, 785);
    ctx.bezierCurveTo(980, 835, 1050, 850, 1090, 905);
    ctx.stroke();

    ctx.strokeStyle = P.path;
    ctx.lineWidth = 52;
    ctx.beginPath();
    ctx.moveTo(980, 640);
    ctx.bezierCurveTo(960, 690, 930, 735, 955, 785);
    ctx.bezierCurveTo(980, 835, 1050, 850, 1090, 905);
    ctx.stroke();

    ctx.strokeStyle = P.pathLight;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(975, 645);
    ctx.bezierCurveTo(958, 690, 940, 730, 960, 775);
    ctx.stroke();
}


/* =========================================================
 * TREES
 * ========================================================= */

function drawTree(ctx, x, y, scale, P, season) {

    ctx.fillStyle = 'rgba(40,60,40,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 34 * scale, 35 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.woodDark;
    roundedRect(ctx, x - 7 * scale, y + 3 * scale, 14 * scale, 42 * scale, 5 * scale);
    ctx.fill();

    ctx.fillStyle = P.treeDark;
    ctx.beginPath();
    ctx.arc(x - 18 * scale, y, 27 * scale, 0, Math.PI * 2);
    ctx.arc(x + 15 * scale, y - 8 * scale, 31 * scale, 0, Math.PI * 2);
    ctx.arc(x + 2 * scale, y - 32 * scale, 30 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.tree;
    ctx.beginPath();
    ctx.arc(x - 13 * scale, y - 8 * scale, 24 * scale, 0, Math.PI * 2);
    ctx.arc(x + 17 * scale, y - 16 * scale, 24 * scale, 0, Math.PI * 2);
    ctx.arc(x + 2 * scale, y - 37 * scale, 23 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.treeLight;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(x - 7 * scale, y - 30 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}


function drawTrees(ctx, P, season) {

    const trees = [
        [560, 720, 1.05],
        [625, 675, 0.9],
        [700, 710, 0.85],
        [1240, 680, 1.0],
        [1320, 710, 0.9],
        [1400, 745, 0.8],
        [500, 835, 0.85],
        [1430, 835, 0.95],
        [730, 885, 0.75],
        [1300, 895, 0.8]
    ];

    trees.forEach(([x, y, s]) => drawTree(ctx, x, y, s, P, season));
}


/* =========================================================
 * FLOWERS
 * ========================================================= */

function drawFlowers(ctx, P) {

    const flowers = [
        [760, 700],
        [790, 720],
        [1160, 680],
        [1190, 700],
        [1340, 820],
        [1380, 805],
        [680, 820],
        [720, 840],
        [1210, 890]
    ];

    flowers.forEach(([x, y]) => {
        ctx.fillStyle = P.flower;
        ctx.beginPath();

        for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * 2 / 5;
            ctx.arc(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5, 4, 0, Math.PI * 2);
        }

        ctx.fill();

        ctx.fillStyle = '#F4C84A';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}


/* =========================================================
 * ROCKS
 * ========================================================= */

function drawRocks(ctx, P) {

    const rocks = [
        [470, 855, 18],
        [540, 890, 12],
        [1460, 850, 20],
        [1510, 810, 12],
        [650, 920, 10]
    ];

    rocks.forEach(([x, y, r]) => {
        ctx.fillStyle = 'rgba(80,70,60,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + 5, r, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8D8A78';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, -0.2, 0, Math.PI * 2);
        ctx.fill();
    });
}


/* =========================================================
 * FARM
 * ========================================================= */

function drawFarm(ctx, P, season) {

    const x = 770;
    const y = 805;
    const w = 210;
    const h = 105;

    ctx.fillStyle = P.path;
    roundedRect(ctx, x, y, w, h, 18);
    ctx.fill();

    for (let i = 0; i < 5; i++) {
        const yy = y + 20 + i * 18;

        ctx.strokeStyle = 'rgba(90,70,40,0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 15, yy);
        ctx.lineTo(x + w - 15, yy);
        ctx.stroke();

        for (let xx = x + 28; xx < x + w - 15; xx += 30) {
            ctx.fillStyle = season === 'winter' ? '#AAB6AE' : P.tree;
            ctx.beginPath();
            ctx.arc(xx, yy - 5, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}


function hasSceneBuilding(id) {
    const state = typeof S !== 'undefined' ? S : null;
    return !!(state && state.built && typeof state.built.has === 'function' && state.built.has(id));
}

function drawVillage(ctx, P, season) {

    drawLordHouse(ctx, 960, 575, 1.15, P);
    drawWell(ctx, 1040, 720, P);

    if (hasSceneBuilding('warehouse')) {
        drawWarehouse(ctx, 570, 785, 0.9, P);
    }

    if (hasSceneBuilding('reservoir')) {
        drawReservoir(ctx, 1300, 830, 1, P);
    }

    if (hasSceneBuilding('herb')) {
        drawHerbHouse(ctx, 820, 835, 0.8, P);
    }

    if (hasSceneBuilding('field2')) {
        drawField2(ctx, 1220, 865, P, season);
    }

    if (hasSceneBuilding('breakwater')) {
        drawBreakwater(ctx, 1485, 895, 1.2, P);
    }

    if (hasSceneBuilding('market')) {
        drawMarketBuilding(ctx, 1410, 765, 1, P);
    }
}

/* =========================================================
 * LORD HOUSE
 * ========================================================= */

function drawLordHouse(ctx, x, y, scale, P) {

    drawHouseBase(ctx, x, y, 150 * scale, 105 * scale, P);

    ctx.fillStyle = P.roofDark;
    ctx.beginPath();
    ctx.moveTo(x - 95 * scale, y);
    ctx.lineTo(x, y - 72 * scale);
    ctx.lineTo(x + 95 * scale, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = P.roof;
    ctx.beginPath();
    ctx.moveTo(x - 82 * scale, y - 5 * scale);
    ctx.lineTo(x, y - 62 * scale);
    ctx.lineTo(x + 82 * scale, y - 5 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = P.woodDark;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 62 * scale);
    ctx.lineTo(x, y - 105 * scale);
    ctx.stroke();

    ctx.fillStyle = P.flower;
    ctx.beginPath();
    ctx.moveTo(x, y - 103 * scale);
    ctx.lineTo(x + 30 * scale, y - 93 * scale);
    ctx.lineTo(x, y - 82 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#563C2A';
    roundedRect(ctx, x - 20 * scale, y + 25 * scale, 40 * scale, 58 * scale, 6 * scale);
    ctx.fill();

    ctx.fillStyle = '#D8E8F7';
    roundedRect(ctx, x - 60 * scale, y + 20 * scale, 22 * scale, 18 * scale, 4 * scale);
    ctx.fill();
    roundedRect(ctx, x + 38 * scale, y + 20 * scale, 22 * scale, 18 * scale, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#B77A55';
    ctx.beginPath();
    ctx.arc(x - 10 * scale, y + 53 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.arc(x + 10 * scale, y + 53 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
}

function drawWarehouse(ctx, x, y, scale, P) {
    drawHouseBase(ctx, x, y, 110 * scale, 75 * scale, P);

    ctx.fillStyle = P.roofDark;
    ctx.beginPath();
    ctx.moveTo(x - 60 * scale, y);
    ctx.lineTo(x, y - 42 * scale);
    ctx.lineTo(x + 60 * scale, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#D7BE8D';
    roundedRect(ctx, x - 34 * scale, y + 18 * scale, 68 * scale, 38 * scale, 4 * scale);
    ctx.fill();

    ctx.strokeStyle = '#7F5A3C';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 18 * scale, y + 18 * scale);
    ctx.lineTo(x - 18 * scale, y + 56 * scale);
    ctx.moveTo(x + 18 * scale, y + 18 * scale);
    ctx.lineTo(x + 18 * scale, y + 56 * scale);
    ctx.stroke();

    ctx.fillStyle = '#7F5A3C';
    ctx.fillRect(x - 8 * scale, y + 24 * scale, 16 * scale, 28 * scale);
}

function drawReservoir(ctx, x, y, scale, P) {
    ctx.fillStyle = 'rgba(80,140,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, 74 * scale, 40 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9BD4E7';
    ctx.beginPath();
    ctx.ellipse(x, y - 8 * scale, 62 * scale, 28 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5E8EA4';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x - 18 * scale, y + 2 * scale, 26 * scale, 0.5 * Math.PI, 2 * Math.PI);
    ctx.stroke();
}

function drawHerbHouse(ctx, x, y, scale, P) {
    drawHouseBase(ctx, x, y, 92 * scale, 58 * scale, P);

    ctx.fillStyle = P.roofDark;
    ctx.beginPath();
    ctx.moveTo(x - 52 * scale, y);
    ctx.lineTo(x, y - 38 * scale);
    ctx.lineTo(x + 52 * scale, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#D9C99A';
    roundedRect(ctx, x - 28 * scale, y + 12 * scale, 56 * scale, 36 * scale, 5 * scale);
    ctx.fill();

    ctx.fillStyle = '#7CB06F';
    ctx.beginPath();
    ctx.arc(x - 30 * scale, y - 10 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.arc(x + 28 * scale, y - 12 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
}

function drawField2(ctx, x, y, P, season) {
    ctx.fillStyle = P.path;
    roundedRect(ctx, x - 50, y - 10, 150, 60, 12);
    ctx.fill();

    const rowY = [y + 6, y + 22, y + 38];
    for (const yy of rowY) {
        ctx.strokeStyle = 'rgba(90,70,40,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 38, yy);
        ctx.lineTo(x + 78, yy);
        ctx.stroke();

        for (let xx = x - 30; xx < x + 70; xx += 22) {
            ctx.fillStyle = season === 'winter' ? '#DCE4DB' : P.flower;
            ctx.beginPath();
            ctx.arc(xx, yy - 4, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawBreakwater(ctx, x, y, scale, P) {
    ctx.fillStyle = '#8A8C87';
    for (let i = 0; i < 9; i++) {
        ctx.fillRect(x - 100 * scale + i * 23 * scale, y, 18 * scale, 22 * scale);
    }

    ctx.fillStyle = '#A2A7A2';
    ctx.fillRect(x - 100 * scale, y + 18 * scale, 210 * scale, 12 * scale);
}


/* =========================================================
 * NORMAL HOUSE
 * ========================================================= */

function drawHouse(ctx, x, y, scale, P, warehouse = false) {

    drawHouseBase(ctx, x, y, 125 * scale, 85 * scale, P);

    ctx.fillStyle = warehouse ? P.roofDark : P.roof;
    ctx.beginPath();
    ctx.moveTo(x - 78 * scale, y);
    ctx.lineTo(x, y - 55 * scale);
    ctx.lineTo(x + 78 * scale, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = P.woodDark;
    roundedRect(ctx, x - 13 * scale, y + 25 * scale, 26 * scale, 60 * scale, 5 * scale);
    ctx.fill();

    ctx.fillStyle = '#F9E7A8';
    roundedRect(ctx, x - 47 * scale, y + 23 * scale, 25 * scale, 22 * scale, 4 * scale);
    ctx.fill();

    roundedRect(ctx, x + 22 * scale, y + 23 * scale, 25 * scale, 22 * scale, 4 * scale);
    ctx.fill();
}


function drawHouseBase(ctx, x, y, w, h, P) {

    ctx.fillStyle = 'rgba(50,60,50,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + h, w * 0.6, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E8D4A8';
    roundedRect(ctx, x - w / 2, y, w, h, 10);
    ctx.fill();
}


/* =========================================================
 * MARKET
 * ========================================================= */

function drawMarketBuilding(ctx, x, y, scale, P) {

    drawHouseBase(ctx, x, y, 170 * scale, 90 * scale, P);

    ctx.fillStyle = P.roof;
    ctx.beginPath();
    ctx.moveTo(x - 100 * scale, y);
    ctx.lineTo(x + 100 * scale, y);
    ctx.lineTo(x + 75 * scale, y - 55 * scale);
    ctx.lineTo(x - 75 * scale, y - 55 * scale);
    ctx.closePath();
    ctx.fill();

    const colors = ['#E9B45E', '#F2E4B7', P.roof];

    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x - 85 * scale + i * 28 * scale, y + 5 * scale, 28 * scale, 25 * scale);
    }

    ctx.fillStyle = P.woodDark;
    roundedRect(ctx, x - 60 * scale, y + 35 * scale, 120 * scale, 40 * scale, 5 * scale);
    ctx.fill();
}


/* =========================================================
 * WELL
 * ========================================================= */

function drawWell(ctx, x, y, P) {

    ctx.fillStyle = P.cliffDark;
    ctx.beginPath();
    ctx.ellipse(x, y, 35, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.sand;
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 27, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = P.woodDark;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x - 25, y - 5);
    ctx.lineTo(x - 25, y - 50);
    ctx.moveTo(x + 25, y - 5);
    ctx.lineTo(x + 25, y - 50);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 35, y - 50);
    ctx.lineTo(x + 35, y - 50);
    ctx.stroke();
}


/* =========================================================
 * BOATS / HARBOR
 * ========================================================= */

function drawBoats(ctx, P, season) {

    ctx.fillStyle = P.woodDark;
    roundedRect(ctx, 1480, 850, 260, 30, 8);
    ctx.fill();

    for (let x = 1510; x < 1740; x += 45) {
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x, 870, 10, 70);
    }

    drawBoat(ctx, 1570, 900, 1, P);
    drawBoat(ctx, 1690, 955, 0.75, P);
}


function drawBoat(ctx, x, y, scale, P) {

    ctx.fillStyle = 'rgba(30,70,80,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 25 * scale, 65 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.woodDark;
    ctx.beginPath();
    ctx.moveTo(x - 65 * scale, y);
    ctx.quadraticCurveTo(x, y + 38 * scale, x + 65 * scale, y);
    ctx.lineTo(x + 48 * scale, y + 22 * scale);
    ctx.lineTo(x - 48 * scale, y + 22 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = P.woodDark;
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 70 * scale);
    ctx.stroke();

    ctx.fillStyle = '#F7E9C6';
    ctx.beginPath();
    ctx.moveTo(x + 2 * scale, y - 65 * scale);
    ctx.lineTo(x + 48 * scale, y - 15 * scale);
    ctx.lineTo(x + 2 * scale, y - 10 * scale);
    ctx.closePath();
    ctx.fill();
}


/* =========================================================
 * ISLAND WAVES
 * ========================================================= */

function drawIslandWaves(ctx, P, season) {

    const offset = Math.sin(sceneTick * 0.0015) * 8;

    const waves = [
        [450, 720],
        [420, 785],
        [470, 900],
        [600, 970],
        [830, 1000],
        [1120, 1005],
        [1360, 950],
        [1510, 850],
        [1550, 760]
    ];

    waves.forEach(([x, y], index) => {
        ctx.strokeStyle = P.oceanLight;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = index % 2 === 0 ? 7 : 5;
        ctx.beginPath();
        ctx.moveTo(x + offset, y);
        ctx.quadraticCurveTo(x + 25 + offset, y - 10, x + 55 + offset, y);
        ctx.stroke();
    });

    ctx.globalAlpha = 1;
}


/* =========================================================
 * WEATHER
 * ========================================================= */

function drawWeather(ctx, P, weather) {

    if (!weather) return;

    if (weather === 'rain' || weather === 'storm') {
        ctx.strokeStyle = 'rgba(220,240,250,0.35)';
        ctx.lineWidth = 2;

        for (let i = 0; i < 90; i++) {
            const x = (i * 97) % SCENE_W;
            const y = ((i * 53) + sceneTick * 8) % SCENE_H;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 8, y + 22);
            ctx.stroke();
        }
    }

    if (weather === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';

        for (let i = 0; i < 70; i++) {
            const x = (i * 131) % SCENE_W;
            const y = ((i * 71) + sceneTick * 1.5) % SCENE_H;
            const r = 2 + (i % 4);

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (weather === 'fog') {
        const fog = ctx.createLinearGradient(0, 350, 0, 900);
        fog.addColorStop(0, 'rgba(240,245,242,0)');
        fog.addColorStop(1, 'rgba(240,245,242,0.25)');

        ctx.fillStyle = fog;
        ctx.fillRect(0, 350, SCENE_W, 550);
    }
}


/* =========================================================
 * EXISTING SPRITES
 *
 * 기존 프로젝트의 drawSprite()를 여기서 사용.
 * ID가 이미 있다면 아래에 기존 호출을 그대로 넣으면 됨.
 * ========================================================= */

function drawCharactersAndProps(ctx) {

    if (typeof drawSprite !== 'function') {
        return;
    }

    /*
     * 예시:
     *
     * drawSprite(ctx, 'player', 930, 820, SPRITE_SCALE);
     * drawSprite(ctx, 'npc', 1080, 760, SPRITE_SCALE);
     */
}


/* =========================================================
 * OPTIONAL OLD FUNCTION COMPATIBILITY
 * ========================================================= */

function drawMiniIsland(ctx, x, y, scale, P) {

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = P.sand;
    ctx.beginPath();
    ctx.ellipse(0, 0, 100, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.islandGrass;
    ctx.beginPath();
    ctx.ellipse(0, -8, 75, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}


/* =========================================================
 * START
 * ========================================================= */

if (typeof drawScene === 'function') {
    const canvas = getSceneCanvas();
    if (canvas && canvas.getContext) {
        drawScene();
    }
}

