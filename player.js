window.onload = () => {
    const list = document.getElementById("channel-list");
    const container = document.getElementById("player-area");

    // Função para carregar streams HLS
    function loadHLS(url) {
        unloadYouTube(); // garantir que não há iframe ativo

        const video = document.getElementById("tv-player");

        if (Hls.isSupported()) {
            if (window.hls) window.hls.destroy(); // limpar instância anterior

            window.hls = new Hls({
                maxBufferLength: 10,
                liveSyncDuration: 3,
                enableWorker: true
            });

            window.hls.loadSource(url);
            window.hls.attachMedia(video);

            video.play().catch(() => {});
        } else {
            // Safari
            video.src = url;
            video.play().catch(() => {});
        }
    }

    // Função para carregar YouTube
    function loadYouTube(embedUrl) {
        container.innerHTML = `
            <iframe id="yt-frame"
                src="${embedUrl}"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen>
            </iframe>
        `;
    }

    // Função para voltar ao player normal
    function unloadYouTube() {
        container.innerHTML = `<video id="tv-player" controls autoplay></video>`;
    }

    // Criar lista de canais
    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.name = ch.name;

        div.innerHTML = `<img src="${ch.logo}" alt="${ch.name}">`;

        div.onclick = () => {
            if (ch.type === "youtube") {
                loadYouTube(ch.url);
            } else {
                loadHLS(ch.url);
            }
        };

        list.appendChild(div);
    });

    // Carregar automaticamente o primeiro canal
    if (channels.length > 0) {
        const first = channels[0];
        if (first.type === "youtube") {
            loadYouTube(first.url);
        } else {
            loadHLS(first.url);
        }
    }
};