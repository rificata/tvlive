/* ============================================================
   PLAYER IPTV — COMPLETO, COM SCROLL AUTO E MOBILE-FRIENDLY
   ============================================================ */

const M3U_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u";
const EPG_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/EPG/epg-m3upt.xml.gz";

let channels = [];
let groups = {};
let epgData = {};
let currentGroup = null;
let currentIndex = 0;

/* ============================================================
   ÍCONES PARA CATEGORIAS REAIS
   ============================================================ */

function getCategoryIcon(groupName) {
    const g = (groupName || "").toLowerCase();

    if (g.includes("tv")) return "📺";
    if (g.includes("beach") || g.includes("praia")) return "🏖️";
    if (g.includes("cam") || g.includes("camera")) return "🎥";
    if (g.includes("moderação") || g.includes("moderacao")) return "🔥";
    if (g.includes("radio") || g.includes("rádio")) return "📻";
    if (g.includes("adult")) return "🔞";
    if (g.includes("24h")) return "🕒";
    if (g.includes("news") || g.includes("notícia")) return "📰";
    if (g.includes("music") || g.includes("música")) return "🎵";

    return "📡";
}

/* ============================================================
   CARREGAR M3U
   ============================================================ */

async function loadM3U() {
    const res = await fetch(M3U_URL);
    const text = await res.text();
    parseM3U(text);
}

function parseM3U(text) {
    const lines = text.split("\n");
    let temp = {};

    for (let line of lines) {
        line = line.trim();

        if (line.startsWith("#EXTINF")) {
            const name = line.match(/,(.*)$/)?.[1] || "Sem nome";
            const logo = line.match(/tvg-logo="(.*?)"/)?.[1] || "";
            const group = line.match(/group-title="(.*?)"/)?.[1] || "Outros";
            const tvgid = line.match(/tvg-id="(.*?)"/)?.[1] || "";

            temp = { name, logo, group, tvgid };
        } else if (line.startsWith("http")) {
            temp.url = line;

            if (!groups[temp.group]) groups[temp.group] = [];
            groups[temp.group].push(temp);

            channels.push(temp);
            temp = {};
        }
    }
}

/* ============================================================
   CARREGAR EPG
   ============================================================ */

async function loadEPG() {
    const res = await fetch(EPG_URL);
    const ds = new DecompressionStream("gzip");
    const decompressed = res.body.pipeThrough(ds);
    const text = await new Response(decompressed).text();

    parseEPG(text);
}

function parseEPG(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    const programmes = xml.getElementsByTagName("programme");

    for (let p of programmes) {
        const channel = p.getAttribute("channel");
        const start = p.getAttribute("start");
        const stop = p.getAttribute("stop");
        const title = p.getElementsByTagName("title")[0]?.textContent || "";
        const desc = p.getElementsByTagName("desc")[0]?.textContent || "";
        const icon = p.getElementsByTagName("icon")[0]?.getAttribute("src") || "";

        if (!epgData[channel]) epgData[channel] = [];
        epgData[channel].push({ start, stop, title, desc, icon });
    }
}

/* ============================================================
   BARRA FIXA: CATEGORIAS + CANAIS
   ============================================================ */

function buildTopBar() {
    const select = document.getElementById("categorySelect");

    Object.keys(groups).forEach(group => {
        const opt = document.createElement("option");
        const icon = getCategoryIcon(group);
        opt.value = group;
        opt.textContent = `${icon} ${group}`;
        select.appendChild(opt);
    });

    select.onchange = () => {
        currentGroup = select.value;
        currentIndex = 0;
        buildChannelScroller();
        loadChannel(groups[currentGroup][0]);
    };

    currentGroup = Object.keys(groups)[0];
    select.value = currentGroup;

    buildChannelScroller();
    loadChannel(groups[currentGroup][0]);
}

function buildChannelScroller() {
    const scroller = document.getElementById("channelScroller");
    scroller.innerHTML = "";

    const groupChannels = groups[currentGroup];

    groupChannels.forEach((ch, i) => {
        const div = document.createElement("div");
        div.className = "channelItem";

        div.innerHTML = `
            <img src="${ch.logo}">
            <span>${ch.name}</span>
        `;

        div.onclick = () => {
            currentIndex = i;
            loadChannel(ch);
            centerChannelInScroller(div);
        };

        scroller.appendChild(div);

        if (i < groupChannels.length - 1) {
            const sep = document.createElement("span");
            sep.className = "separator";
            sep.textContent = "|";
            scroller.appendChild(sep);
        }
    });
}

/* centrar canal selecionado no scroller (mais elegante) */
function centerChannelInScroller(element) {
    const scroller = document.getElementById("channelScroller");
    const rect = element.getBoundingClientRect();
    const parentRect = scroller.getBoundingClientRect();
    const offset = rect.left - parentRect.left - (parentRect.width / 2) + (rect.width / 2);
    scroller.scrollBy({ left: offset, behavior: "smooth" });
}

/* ============================================================
   PLAYER
   ============================================================ */

function loadChannel(ch) {
    const video = document.getElementById("videoPlayer");
    const logo = document.getElementById("playerLogo");
    const name = document.getElementById("playerName");

    video.pause();
    video.src = "";

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(ch.url);
        hls.attachMedia(video);
    } else {
        video.src = ch.url;
    }

    logo.src = ch.logo || "";
    name.textContent = ch.name || "";

    loadEPGForChannel(ch);
}

/* ============================================================
   EPG: PROGRAMA ATUAL + CARTÕES + SCROLL AUTO
   ============================================================ */

function loadEPGForChannel(ch) {
    const title = document.getElementById("epgTitle");
    const desc = document.getElementById("epgDesc");
    const list = document.getElementById("epgList");
    const progressBar = document.getElementById("playerProgressBar");

    title.textContent = "";
    desc.textContent = "";
    list.innerHTML = "";
    progressBar.style.width = "0%";

    let channelEPG = [];

    if (ch.tvgid && epgData[ch.tvgid]) {
        channelEPG = epgData[ch.tvgid];
    } else {
        const key = Object.keys(epgData).find(k =>
            k.toLowerCase().includes(ch.name.toLowerCase())
        );
        if (key) channelEPG = epgData[key];
    }

    if (channelEPG.length === 0) {
        title.textContent = "Sem EPG disponível";
        return;
    }

    const now = Date.now();

    const current = channelEPG.find(p => {
        const s = parseEPGDate(p.start);
        const e = parseEPGDate(p.stop);
        return now >= s && now <= e;
    });

    if (current) {
        const s = parseEPGDate(current.start);
        const e = parseEPGDate(current.stop);
        const pct = ((now - s) / (e - s)) * 100;

        title.textContent = current.title;
        desc.textContent = current.desc || "";
        progressBar.style.width = Math.min(Math.max(pct, 0), 100) + "%";
    } else {
        title.textContent = "Sem programa atual";
        desc.textContent = "";
    }

    let currentCardElement = null;

    channelEPG.forEach(p => {
        const s = parseEPGDate(p.start);
        const e = parseEPGDate(p.stop);

        const card = document.createElement("div");
        card.className = "epgCard";

        if (current && p.start === current.start && p.stop === current.stop) {
            card.classList.add("current");
            currentCardElement = card;
        }

        const thumb = p.icon
            ? `<img class="epgThumb" src="${p.icon}">`
            : `<div class="epgThumb"></div>`;

        card.innerHTML = `
            ${thumb}
            <div class="epgContent">
                <span class="epgTime">⏱️ 
                    ${new Date(s).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    -
                    ${new Date(e).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </span>

                <strong>🎬 ${p.title}</strong><br>

                <span>📝 ${p.desc || ""}</span>
            </div>
        `;

        list.appendChild(card);
    });

    /* SCROLL AUTOMÁTICO PARA O PROGRAMA ATUAL */
    if (currentCardElement) {
        setTimeout(() => {
            currentCardElement.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 200);
    }
}

/* ============================================================
   PARSE DATA
   ============================================================ */

function parseEPGDate(str) {
    return new Date(
        `${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}T${str.substring(8,10)}:${str.substring(10,12)}:${str.substring(12,14)}`
    ).getTime();
}

/* ============================================================
   ZAPPING
   ============================================================ */

document.getElementById("prevBtn").onclick = () => zap(-1);
document.getElementById("nextBtn").onclick = () => zap(1);

function zap(dir) {
    const groupChannels = groups[currentGroup];
    currentIndex = (currentIndex + dir + groupChannels.length) % groupChannels.length;
    const ch = groupChannels[currentIndex];
    loadChannel(ch);

    /* centrar também o canal atual no scroller */
    const scroller = document.getElementById("channelScroller");
    const items = scroller.getElementsByClassName("channelItem");
    if (items[currentIndex]) {
        centerChannelInScroller(items[currentIndex]);
    }
}

/* ============================================================
   INICIAR
   ============================================================ */

(async () => {
    await loadM3U();
    await loadEPG();
    buildTopBar();
})();