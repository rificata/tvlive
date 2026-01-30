window.onload = () => {
    const list = document.getElementById("channel-list");
    const container = document.getElementById("player-area");

    let currentHLS = null; // para destruir instâncias antigas

    // Função para carregar streams HLS (.m3u8)
    function loadHLS(url, div) {
        unloadYouTube(); // garantir que não há iframe ativo

        const video = document.getElementById("tv-player");

        // Remover destaque anterior
        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        if (div) div.classList.add("active");

        // Destruir instância anterior
        if (currentHLS) {
            currentHLS.destroy();
            currentHLS = null;
        }

        if (Hls.isSupported()) {
            currentHLS = new Hls({
                maxBufferLength: 10,
                liveSyncDuration: 3,
                enableWorker: true
            });

            currentHLS.loadSource(url);
            currentHLS.attachMedia(video);

            video.play().catch(() => {});
        } else {
            // Safari
            video.src = url;
            video.play().catch(() => {});
        }
    }

    // Função para carregar YouTube
    function loadYouTube(embedUrl, div) {
        // Remover destaque anterior
        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        if (div) div.classList.add("active");

        container.innerHTML = `
            <iframe id="yt-frame"
                src="${embedUrl}"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen>
            </iframe>
        `;
    }

    // Voltar ao player normal
    function unloadYouTube() {
        container.innerHTML = `<video id="tv-player" controls autoplay></video>`;
    }

    // Criar lista de canais
    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.name = ch.name;

        div.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}">
            <div class="channel-name">${ch.name}</div>
        `;

        div.onclick = () => {
            if (ch.type === "youtube") {
                loadYouTube(ch.url, div);
            } else {
                loadHLS(ch.url, div);
            }
        };

        list.appendChild(div);
    });

    // Carregar automaticamente o primeiro canal
    if (channels.length > 0) {
        const first = channels[0];
        const firstDiv = document.querySelector(".channel");

        if (first.type === "youtube") {
            loadYouTube(first.url, firstDiv);
        } else {
            loadHLS(first.url, firstDiv);
        }
    }
};