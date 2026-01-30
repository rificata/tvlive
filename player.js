window.onload = () => {
    const list = document.getElementById("channel-list");
    const container = document.getElementById("player-area");

    let currentHLS = null;
    let epg = {};

    // ============================
    // 1. CARREGAR EPG DO M3UPT
    // ============================
    fetch("https://m3upt.com/epg")
        .then(r => r.text())
        .then(xmlText => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, "text/xml");
            epg = parseEPG(xml);
            console.log("EPG carregado:", epg);
        })
        .catch(() => console.log("Falha ao carregar EPG"));

    // ============================
    // 2. PARSE XMLTV → JSON
    // ============================
    function parseEPG(xml) {
        const programs = {};
        const items = xml.getElementsByTagName("programme");

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

        for (let p of items) {
            const channel = p.getAttribute("channel");
            const start = p.getAttribute("start"); // ex: 20260130060000 +0000
            const stop = p.getAttribute("stop");

            const startDate = start.substring(0, 8); // YYYYMMDD

            // Filtrar só o dia de hoje
            if (startDate !== todayStr) continue;

            const titleNode = p.getElementsByTagName("title")[0];
            const title = titleNode ? titleNode.textContent : "Sem título";

            if (!programs[channel]) programs[channel] = [];
            programs[channel].push({ start, stop, title });
        }

        return programs;
    }

    // ============================
    // 3. OBTER PROGRAMA ATUAL
    // ============================
    function getCurrentProgram(epgId) {
        if (!epgId) return "Sem EPG para este canal";
        if (!epg[epgId]) return "Sem programação disponível";

        const now = new Date();

        for (const prog of epg[epgId]) {
            const start = new Date(prog.start.replace(" +0000", "Z"));
            const stop = new Date(prog.stop.replace(" +0000", "Z"));

            if (now >= start && now <= stop) {
                return prog.title;
            }
        }

        return "Sem programação neste momento";
    }

    // ============================
    // 4. MAPA XMLTV → NOMES DO TEU SITE
    // ============================
    const epgMap = {
        "RTP 1": "RTP1.pt",
        "RTP 2": "RTP2.pt",
        "RTP 3": "RTP3.pt",
        "RTP Memória": "RTPMemoria.pt",
        "RTP Açores": "RTPAcores.pt",
        "RTP Madeira": "RTPMadeira.pt",
        "RTP África": "RTPAfrica.pt",
        "RTP Internacional": "RTPInternacional.pt",

        "SIC": "SIC.pt",
        "SIC Notícias": "SICNoticias.pt",
        "SIC Radical": "SICRadical.pt",
        "SIC Mulher": "SICMulher.pt",
        "SIC K": "SICK.pt",

        "TVI": "TVI.pt",
        "TVI Ficção": "TVIFiccao.pt",
        "TVI Reality": "TVIReality.pt",
        "TVI Internacional": "TVIInternacional.pt",

        "CMTV": "CMTV.pt",
        "CNN Portugal": "CNNPortugal.pt",

        "Canal História": "Historia.pt",
        "Odisseia": "Odisseia.pt",
        "National Geographic": "NationalGeographic.pt",
        "Discovery Channel": "DiscoveryChannel.pt",

        "AXN": "AXN.pt",
        "AXN White": "AXNWhite.pt",
        "AXN Movies": "AXNMovies.pt",
        "Syfy": "Syfy.pt",

        "24Kitchen": "24Kitchen.pt",
        "Canal Panda": "CanalPanda.pt",
        "Biggs": "Biggs.pt",
        "Nickelodeon": "Nickelodeon.pt",
        "Disney Channel": "DisneyChannel.pt",

        "Sport TV 1": "SportTV1.pt",
        "Sport TV 2": "SportTV2.pt",
        "Sport TV 3": "SportTV3.pt",
        "Sport TV 4": "SportTV4.pt",
        "Sport TV 5": "SportTV5.pt",
        "Sport TV 6": "SportTV6.pt",

        "BTV": "BenficaTV.pt",
        "Eurosport": "Eurosport1.fr",
        "Eurosport 2": "Eurosport2.fr",

        "Fuel TV": "FUELTV.at",
        "MTV Portugal": "MTV.pt",
        "Trace Urban": "TraceUrban.fr",
        "TV5 Monde": "TV5MondeEurope.fr",
        "ARTE": "arte.fr",
        "Rai News": "RaiNews24.it"
    };

    // ============================
    // 5. PLAYER HLS
    // ============================
    function loadHLS(url, div, name) {
        unloadYouTube();

        const video = document.getElementById("tv-player");

        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        div.classList.add("active");

        const epgId = epgMap[name];
        document.getElementById("epg-now").innerText = epgId ? getCurrentProgram(epgId) : "Sem EPG";

        if (currentHLS) {
            currentHLS.destroy();
            currentHLS = null;
        }

        if (Hls.isSupported()) {
            currentHLS = new Hls();
            currentHLS.loadSource(url);
            currentHLS.attachMedia(video);
            video.play().catch(() => {});
        } else {
            video.src = url;
            video.play().catch(() => {});
        }
    }

    // ============================
    // 6. PLAYER YOUTUBE
    // ============================
    function loadYouTube(embedUrl, div, name) {
        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        div.classList.add("active");

        const epgId = epgMap[name];
        document.getElementById("epg-now").innerText = epgId ? getCurrentProgram(epgId) : "Sem EPG";

        container.innerHTML = `
            <iframe id="yt-frame"
                src="${embedUrl}"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen>
            </iframe>
        `;
    }

    function unloadYouTube() {
        container.innerHTML = `<video id="tv-player" controls autoplay></video>`;
    }

    // ============================
    // 7. LISTA DE CANAIS
    // ============================
    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";

        div.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}">
            <div class="channel-name">${ch.name}</div>
        `;

        div.onclick = () => {
            if (ch.type === "youtube") {
                loadYouTube(ch.url, div, ch.name);
            } else {
                loadHLS(ch.url, div, ch.name);
            }
        };

        list.appendChild(div);
    });

    // ============================
    // 8. CARREGAR PRIMEIRO CANAL
    // ============================
    if (channels.length > 0) {
        const first = channels[0];
        const firstDiv = document.querySelector(".channel");

        if (first.type === "youtube") {
            loadYouTube(first.url, firstDiv, first.name);
        } else {
            loadHLS(first.url, firstDiv, first.name);
        }
    }
};