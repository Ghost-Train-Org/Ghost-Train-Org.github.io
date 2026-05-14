const COVER_URL = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
const HTML_URL = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";
const ZONES_URLS = [
    "https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json",
    "https://cdn.jsdelivr.net/gh/freebuisness/assets@latest/zones.json",
    "https://cdn.jsdelivr.net/gh/freebuisness/assets@master/zones.json",
    "https://cdn.jsdelivr.net/gh/freebuisness/assets/zones.json"
];
const POP_URL = "https://data.jsdelivr.com/v1/stats/packages/gh/freebuisness/html@main/files?period=year";

const gameGrid = document.getElementById("games");
const searchInput = document.getElementById("search");
const gameContainer = document.getElementById("gameContainer");
const gameContent = document.getElementById("gameContent");
const gameTitleEl = document.getElementById("game-title");

let allGames = [];
let popularityMap = {};

fetch(POP_URL)
    .then(r => r.json())
    .then(data => {
        data.forEach(file => {
            const idMatch = file.name.match(/\/(\d+)\.html$/);
            if (idMatch) popularityMap[parseInt(idMatch[1])] = file.hits?.total || 0;
        });
    })
    .catch(() => console.warn("Popularity stats unavailable"));

async function loadZones() {
    let zonesURL = ZONES_URLS[Math.floor(Math.random() * ZONES_URLS.length)];
    try {
        const shaResponse = await fetch("https://api.github.com/repos/freebuisness/assets/commits?t=" + Date.now());
        if (shaResponse.status === 200) {
            const shaJson = await shaResponse.json();
            const sha = shaJson[0]['sha'];
            if (sha) zonesURL = `https://cdn.jsdelivr.net/gh/freebuisness/assets@${sha}/zones.json`;
        }
    } catch (e) {}

    const response = await fetch(zonesURL + "?t=" + Date.now());
    const data = await response.json();
    return data;
}

const CUSTOM_GAMES = [
    {
        id: 99999,
        name: "Balatro",
        cover: "balatroT.avif",
        // Use the full external URL so openGame knows to src the iframe directly
        url: "https://cdn.jsdelivr.net/gh/sea-bean-unblocked/ghost-assets-for-games@main/balatro/index.html",
        popularity: 999999
    }
];

loadZones()
    .then(data => {
        allGames = data.map(g => ({
            ...g,
            cover: g.cover.replace("{COVER_URL}", COVER_URL).replace("{HTML_URL}", HTML_URL),
            url: g.url.replace("{HTML_URL}", HTML_URL).replace("{COVER_URL}", COVER_URL),
            popularity: popularityMap[g.id] || 0
        }));
        allGames = [...CUSTOM_GAMES, ...allGames];
        allGames.sort((a, b) => b.popularity - a.popularity);
        render(allGames);
    })
    .catch(err => {
        gameGrid.textContent = "Failed to load games: " + err;
    });

function render(games) {
    gameGrid.innerHTML = "";
    if (!games.length) {
        gameGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:100px;opacity:.3">
            <p>No games found</p>
        </div>`;
        return;
    }
    games.forEach(game => {
        const card = document.createElement("div");
        card.className = "game-card";
        card.innerHTML = `
        <div class="card-icon">
            <img data-src="${game.cover}" alt="${game.name}">
        </div>
        <h3>${game.name}</h3>
        <div class="card-info">
            <span>${game.name}.dat</span>
        </div>`;
        card.onclick = () => openGame(game);
        gameGrid.appendChild(card);
    });
    lazyLoadImages();
    enableImageHoverTracking();
}

function lazyLoadImages() {
    const images = document.querySelectorAll("img[data-src]");
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
            observer.unobserve(img);
        });
    }, { rootMargin: "100px" });
    images.forEach(img => observer.observe(img));
}

function enableImageHoverTracking() {
    document.querySelectorAll(".card-icon").forEach(icon => {
        const img = icon.querySelector("img");
        if (!img) return;
        icon.addEventListener("mousemove", e => {
            const rect = icon.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
            img.style.transform = `scale(1.18) translate(${x}px, ${y}px)`;
        });
        icon.addEventListener("mouseleave", () => {
            img.style.transform = "scale(1)";
        });
    });
}

searchInput.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    render(allGames.filter(g => g.name.toLowerCase().includes(q)));
});

// Returns true if the URL should be loaded via iframe src instead of fetch+write.
// This covers full http/https URLs and local .html files that use external scripts
// (like love.js / emscripten games) which break when fetched and document.written.
function shouldSrcLoad(url) {
    return url.startsWith("http://") || url.startsWith("https://");
}

async function openGame(game) {
    gameTitleEl.textContent = `${game.name}.dat`;
    gameContainer.style.display = "flex";
    document.body.style.overflow = "hidden";
    gameContent.innerHTML = "";
    document.title = `${game.name} - Ghost Train`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframe.allowFullscreen = true;

    if (shouldSrcLoad(game.url)) {
        // External URLs (Balatro, etc.) — navigate iframe directly.
        // No allow-same-origin: game runs in its own origin, no sandbox escape risk.
        iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals");
        gameContent.appendChild(iframe);
        iframe.src = game.url;
    } else {
        // Local gn-math zones — fetch HTML and inject via srcdoc.
        // srcdoc avoids the allow-scripts + allow-same-origin sandbox escape issue.
        iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals");
        gameContent.appendChild(iframe);

        let html = await fetch(game.url + "?t=" + Date.now()).then(r => r.text());
        const base = game.url.substring(0, game.url.lastIndexOf("/") + 1);
        if (!html.match(/<base/i)) {
            html = html.replace(/<head>/i, `<head><base href="${base}">`);
        }
        iframe.srcdoc = html;
    }
}

window.closeGame = () => {
    gameContainer.style.display = "none";
    document.body.style.overflow = "";
    gameContent.innerHTML = "";
    document.title = "Ghost Train";
};

window.toggleFullscreen = () => {
    if (!document.fullscreenElement) gameContent.requestFullscreen();
    else document.exitFullscreen();
};
