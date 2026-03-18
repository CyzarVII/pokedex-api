// ─── Generation ranges ────────────────────────────────────────────────────────
const GENERATIONS = [
    { label: "Gen I",    start: 1,   end: 151  },
    { label: "Gen II",   start: 152, end: 251  },
    { label: "Gen III",  start: 252, end: 386  },
    { label: "Gen IV",   start: 387, end: 493  },
    { label: "Gen V",    start: 494, end: 649  },
    { label: "Gen VI",   start: 650, end: 721  },
    { label: "Gen VII",  start: 722, end: 809  },
    { label: "Gen VIII", start: 810, end: 905  },
    { label: "Gen IX",   start: 906, end: 1025 },
];

const PAGE_SIZE = 8;

// ─── State ────────────────────────────────────────────────────────────────────
let currentGenStart = 1;
let currentGenEnd   = 151;
let currentPage     = 1;
let cardCache       = {};
let typewriterTimer = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const grid          = document.getElementById("pokemon-grid");
const prevPageBtn   = document.getElementById("prev-page-btn");
const nextPageBtn   = document.getElementById("next-page-btn");
const pageIndicator = document.getElementById("page-indicator");

// ─── Startup ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    setupGenTabs();
    renderCurrentPage();

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
        }
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < getTotalPages()) {
            currentPage++;
            renderCurrentPage();
        }
    });
});

// ─── Generation tabs ─────────────────────────────────────────────────────────
function setupGenTabs() {
    document.querySelectorAll(".gen-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".gen-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            currentGenStart = parseInt(btn.dataset.start);
            currentGenEnd   = parseInt(btn.dataset.end);
            currentPage     = 1;
            renderCurrentPage();
        });
    });
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function getTotalPages() {
    return Math.ceil((currentGenEnd - currentGenStart + 1) / PAGE_SIZE);
}

async function renderCurrentPage() {
    grid.innerHTML = "";

    const start = currentGenStart + ((currentPage - 1) * PAGE_SIZE);
    const end   = Math.min(start + PAGE_SIZE - 1, currentGenEnd);

    const ids = [];
    for (let i = start; i <= end; i++) ids.push(i);

    pageIndicator.textContent = `${currentPage} / ${getTotalPages()}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === getTotalPages();

    await Promise.all(ids.map(id => fetchAndRenderCard(id)));
}

// ─── Fetch + render a single card ────────────────────────────────────────────
async function fetchAndRenderCard(id) {
    if (!cardCache[id]) {
        try {
            const res     = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const pokemon = await res.json();
            cardCache[id] = pokemon;
        } catch (e) {
            console.warn(`Failed to load Pokémon #${id}`);
            return;
        }
    }

    const pokemon = cardCache[id];
    const name    = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
    const num     = String(pokemon.id).padStart(4, "0");
    const img     = pokemon.sprites.other?.["official-artwork"]?.front_default
                    || pokemon.sprites.front_default
                    || "";
    const types   = pokemon.types.map(t => t.type.name);

    const card = document.createElement("div");
    card.className = "pokemon-card";
    card.dataset.id = id;

    card.innerHTML = `
        <img src="${sanitizeUrl(img)}" alt="${escapeHtml(name)}" loading="lazy">
        <div class="card-number">#${num}</div>
        <div class="card-name">${escapeHtml(name)}</div>
        <div class="card-types">
            ${types.map(t => `<span class="type-badge ${t}">${capitalize(t)}</span>`).join("")}
        </div>
    `;

    card.addEventListener("click", () => openDetail(id));
    grid.appendChild(card);
}

// ─── Detail view ─────────────────────────────────────────────────────────────
async function openDetail(id) {
    document.querySelectorAll(".pokemon-card").forEach(c => c.classList.remove("selected"));
    const activeCard = document.querySelector(`.pokemon-card[data-id="${id}"]`);
    if (activeCard) activeCard.classList.add("selected");

    document.getElementById("detail-placeholder").classList.add("hidden");
    const content = document.getElementById("detail-content");
    content.classList.remove("hidden");
    content.classList.add("loading");

    stopTypewriter();
    document.getElementById("detail-description").textContent = "";

    try {
        if (!cardCache[id]) {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            cardCache[id] = await res.json();
        }
        const pokemon = cardCache[id];

        const speciesRes  = await fetch(pokemon.species.url);
        const speciesData = await speciesRes.json();

        const name = capitalize(pokemon.name);
        const num  = String(pokemon.id).padStart(4, "0");

        document.getElementById("detail-number").textContent = `#${num}`;
        document.getElementById("detail-name").textContent   = name;

        const img = pokemon.sprites.other?.["official-artwork"]?.front_default
                    || pokemon.sprites.front_default || "";
        document.getElementById("detail-img").src = sanitizeUrl(img);

        const types = pokemon.types.map(t => t.type.name);
        document.getElementById("detail-type-badges").innerHTML =
            types.map(t => `<span class="type-badge ${t}">${capitalize(t)}</span>`).join("");

        document.getElementById("detail-height").textContent =
            `${Math.floor(pokemon.height / 10)}m / ${(pokemon.height * 3.937).toFixed(0)}"`;
        document.getElementById("detail-weight").textContent =
            `${(pokemon.weight / 10).toFixed(1)} kg`;

        const category = speciesData.genera?.find(g => g.language.name === "en");
        document.getElementById("detail-category").textContent =
            category ? category.genus.replace(" Pokémon", "") : "—";

        const abilities = pokemon.abilities
            .map(a => capitalize(a.ability.name.replace("-", " ")))
            .join(", ");
        document.getElementById("detail-abilities").textContent = abilities;

        const genderRate = speciesData.gender_rate;
        let genderText = "Genderless";
        if (genderRate === -1)      genderText = "Genderless";
        else if (genderRate === 0)  genderText = "♂ only";
        else if (genderRate === 8)  genderText = "♀ only";
        else                        genderText = "♂ ♀";
        document.getElementById("detail-gender").textContent = genderText;

        const flavorEntries = speciesData.flavor_text_entries.filter(e => e.language.name === "en");
        const desc = flavorEntries.length > 0
            ? flavorEntries[0].flavor_text.replace(/\f/g, " ").replace(/\n/g, " ")
            : "No description available.";

        const statsMap = {};
        pokemon.stats.forEach(s => { statsMap[s.stat.name] = s.base_stat; });
        setBar("hp",  statsMap["hp"]              || 0);
        setBar("atk", statsMap["attack"]          || 0);
        setBar("def", statsMap["defense"]         || 0);
        setBar("spa", statsMap["special-attack"]  || 0);
        setBar("spd", statsMap["special-defense"] || 0);
        setBar("spe", statsMap["speed"]           || 0);

        await loadWeaknesses(types);
        await loadEvolutionChain(speciesData.evolution_chain.url);

        content.classList.remove("loading");
        startTypewriter(desc);

    } catch (e) {
        console.error(e);
        content.classList.remove("loading");
    }
}

// ─── Stat bar helper ─────────────────────────────────────────────────────────
function setBar(key, value) {
    const MAX_STAT = 255;
    const pct = Math.min((value / MAX_STAT) * 100, 100).toFixed(1);
    document.getElementById(`bar-${key}`).style.width = `${pct}%`;
    document.getElementById(`val-${key}`).textContent = value;
}

// ─── Weaknesses ──────────────────────────────────────────────────────────────
async function loadWeaknesses(types) {
    const weaknessSet = {};

    await Promise.all(types.map(async type => {
        const res  = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
        const data = await res.json();
        const dmg  = data.damage_relations;

        dmg.double_damage_from.forEach(t => {
            weaknessSet[t.name] = (weaknessSet[t.name] || 0) + 2;
        });
        dmg.half_damage_from.forEach(t => {
            weaknessSet[t.name] = (weaknessSet[t.name] || 0) - 1;
        });
        dmg.no_damage_from.forEach(t => {
            weaknessSet[t.name] = -99;
        });
    }));

    const weaknesses = Object.entries(weaknessSet)
        .filter(([, v]) => v >= 2)
        .map(([t]) => t);

    document.getElementById("detail-weaknesses").innerHTML =
        weaknesses.length > 0
            ? weaknesses.map(t => `<span class="type-badge ${t}">${capitalize(t)}</span>`).join("")
            : "<span>None</span>";
}

// ─── Evolution chain ─────────────────────────────────────────────────────────
// ─── Evolution chain ─────────────────────────────────────────────────────────
async function loadEvolutionChain(url) {
    const chainContainer = document.getElementById("detail-evolution-chain");
    chainContainer.innerHTML = "<span class='loading-text'>Loading…</span>";

    try {
        const res  = await fetch(url);
        const data = await res.json();

        // Build stages: each index = evolution depth, value = array of species names at that depth
        const stages = [];
        function buildStages(node, depth) {
            if (!stages[depth]) stages[depth] = [];
            stages[depth].push(node.species.name);
            if (node.evolves_to && node.evolves_to.length > 0) {
                node.evolves_to.forEach(child => buildStages(child, depth + 1));
            }
        }
        buildStages(data.chain, 0);

        if (stages.length <= 1) {
            chainContainer.innerHTML = "<span class='evolution-empty'>Does not evolve</span>";
            return;
        }

        // Fetch all Pokémon across all stages in parallel
        const allNames = stages.flat();
        const pokemonMap = {};
        await Promise.all(allNames.map(async name => {
            const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
            pokemonMap[name] = await r.json();
        }));

        chainContainer.innerHTML = "";

        stages.forEach((stageNames, stageIndex) => {
            // One column per stage — may contain multiple Pokémon if branching
            const stageDiv = document.createElement("div");
            stageDiv.className = "evo-stage";

            stageNames.forEach(name => {
                const p = pokemonMap[name];
                if (!p) return;

                const img   = p.sprites.other?.["official-artwork"]?.front_default
                              || p.sprites.front_default || "";
                const num   = String(p.id).padStart(4, "0");
                const pName = capitalize(p.name);
                const types = p.types.map(t => t.type.name);

                const evoDiv = document.createElement("div");
                evoDiv.className = "evo-item";
                evoDiv.innerHTML = `
                    <div class="evo-img-circle">
                        <img src="${sanitizeUrl(img)}" alt="${escapeHtml(pName)}">
                    </div>
                    <div class="evo-name">${escapeHtml(pName)}</div>
                    <div class="evo-num">#${num}</div>
                    <div class="evo-types">
                        ${types.map(t => `<span class="type-badge ${t}">${capitalize(t)}</span>`).join("")}
                    </div>
                `;
                evoDiv.addEventListener("click", () => openDetail(p.id));
                stageDiv.appendChild(evoDiv);
            });

            chainContainer.appendChild(stageDiv);

            if (stageIndex < stages.length - 1) {
                const arrow = document.createElement("div");
                arrow.className = "evo-arrow";
                arrow.textContent = "▶";
                chainContainer.appendChild(arrow);
            }
        });

    } catch (e) {
        chainContainer.innerHTML = "<span class='evolution-empty'>—</span>";
    }
}

// ─── Typewriter ──────────────────────────────────────────────────────────────
function startTypewriter(text) {
    stopTypewriter();
    const el     = document.getElementById("detail-description");
    const cursor = document.getElementById("type-cursor");
    cursor.style.display = "inline";
    el.textContent = "";
    let i = 0;
    typewriterTimer = setInterval(() => {
        if (i < text.length) {
            el.textContent += text[i];
            i++;
        } else {
            stopTypewriter();
        }
    }, 22);
}

function stopTypewriter() {
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
    }
    const cursor = document.getElementById("type-cursor");
    if (cursor) cursor.style.display = "none";
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

function sanitizeUrl(url) {
    if (!url) return "";
    if (/^https:\/\/(raw\.githubusercontent\.com|assets\.pokemon\.com|pokeapi\.co)\//.test(url)) {
        return url;
    }
    return "";
}