import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const HOME_URL = "https://nielse02.github.io/madeleinebingo/";

const config = window.BINGO_CONFIG ?? {};
const hasConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  !config.SUPABASE_URL.includes("JOUW-PROJECT") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !config.SUPABASE_PUBLISHABLE_KEY.includes("JOUW-PUBLISHABLE");

const elements = {
  landingPanel: document.querySelector("#landingPanel"),
  setupPanel: document.querySelector("#setupPanel"),
  boardListPanel: document.querySelector("#boardListPanel"),
  boardPanel: document.querySelector("#boardPanel"),
  messagePanel: document.querySelector("#messagePanel"),
  messageTitle: document.querySelector("#messageTitle"),
  messageText: document.querySelector("#messageText"),
  newBoardChoice: document.querySelector("#newBoardChoice"),
  existingBoardChoice: document.querySelector("#existingBoardChoice"),
  backFromCreate: document.querySelector("#backFromCreate"),
  backFromList: document.querySelector("#backFromList"),
  boardSearch: document.querySelector("#boardSearch"),
  refreshBoards: document.querySelector("#refreshBoards"),
  boardList: document.querySelector("#boardList"),
  listError: document.querySelector("#listError"),
  createForm: document.querySelector("#createForm"),
  createButton: document.querySelector("#createButton"),
  boardTitle: document.querySelector("#boardTitle"),
  items: document.querySelector("#items"),
  itemCount: document.querySelector("#itemCount"),
  setupError: document.querySelector("#setupError"),
  boardError: document.querySelector("#boardError"),
  boardTitleDisplay: document.querySelector("#boardTitleDisplay"),
  bingoGrid: document.querySelector("#bingoGrid"),
  copyButton: document.querySelector("#copyButton"),
  resetButton: document.querySelector("#resetButton"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  bingoText: document.querySelector("#bingoText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  toast: document.querySelector("#toast")
};

let supabase = null;
let boardId = null;
let boardToken = null;
let squares = [];
let availableBoards = [];
let boardChannel = null;
let toastTimer = null;
let hadBingo = false;
let currentUserId = null;

const BINGO_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

function setView(view) {
  elements.landingPanel.hidden = view !== "landing";
  elements.setupPanel.hidden = view !== "setup";
  elements.boardListPanel.hidden = view !== "list";
  elements.boardPanel.hidden = view !== "board";
  elements.messagePanel.hidden = view !== "message";
}

function showLanding() {
  setView("landing");
  elements.setupError.textContent = "";
  elements.listError.textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setConnection(status, label) {
  elements.connectionStatus.classList.remove("online", "offline");
  if (status) elements.connectionStatus.classList.add(status);
  elements.connectionStatus.querySelector("span:last-child").textContent = label;
}

function showMessage(title, text) {
  elements.messageTitle.textContent = title;
  elements.messageText.textContent = text;
  setView("message");
}

function showToast(text) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = text;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function getItemsFromTextarea() {
  return elements.items.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateItemCount() {
  const count = getItemsFromTextarea().length;
  elements.itemCount.textContent = `${count} van 24`;
  elements.itemCount.classList.toggle("complete", count === 24);
}

function getTokenFromHash() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(rawHash).get("token")?.trim() || null;
}

function setShareUrl(token) {
  const url = new URL(HOME_URL);
  url.hash = new URLSearchParams({ token }).toString();
  window.history.replaceState({}, "", url);
}

async function ensureAnonymousSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) {
    currentUserId = sessionData.session.user.id;
    return sessionData.session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  currentUserId = data.session?.user?.id ?? null;
  return data.session;
}

async function createBoard(event) {
  event.preventDefault();
  elements.setupError.textContent = "";

  const title = elements.boardTitle.value.trim();
  const items = getItemsFromTextarea();

  if (!title) {
    elements.setupError.textContent = "Vul een titel in.";
    return;
  }

  if (items.length !== 24) {
    elements.setupError.textContent = "Vul precies 24 niet-lege regels in.";
    return;
  }

  elements.createButton.disabled = true;
  elements.createButton.textContent = "Kaart maken";

  try {
    await ensureAnonymousSession();
    const { data, error } = await supabase.rpc("create_bingo_board", {
      p_title: title,
      p_items: items
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.share_token) throw new Error("Supabase gaf geen deelcode terug.");

    boardToken = result.share_token;
    setShareUrl(boardToken);
    await openBoard(boardToken);
    showToast("Kaart gemaakt. Deel nu de link.");
  } catch (error) {
    console.error(error);
    elements.setupError.textContent = readableError(error);
  } finally {
    elements.createButton.disabled = false;
    elements.createButton.textContent = "Kaart maken";
  }
}

async function loadBoards() {
  setView("list");
  elements.listError.textContent = "";
  elements.boardList.innerHTML = '<div class="list-state">Kaarten laden...</div>';
  elements.refreshBoards.disabled = true;

  try {
    await ensureAnonymousSession();
    const { data, error } = await supabase.rpc("list_bingo_boards");
    if (error) throw error;
    availableBoards = Array.isArray(data) ? data : [];
    renderBoardList();
  } catch (error) {
    console.error(error);
    availableBoards = [];
    elements.boardList.replaceChildren();
    elements.listError.textContent = readableError(error);
  } finally {
    elements.refreshBoards.disabled = false;
  }
}

function renderBoardList() {
  const query = elements.boardSearch.value.trim().toLocaleLowerCase("nl-NL");
  const filteredBoards = availableBoards.filter((board) =>
    String(board.title || "").toLocaleLowerCase("nl-NL").includes(query)
  );

  if (filteredBoards.length === 0) {
    const state = document.createElement("div");
    state.className = "list-state";
    state.innerHTML = query
      ? "Geen kaart gevonden met deze titel."
      : "Er zijn nog geen bingokaarten. Maak de eerste kaart.";
    elements.boardList.replaceChildren(state);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const board of filteredBoards) {
    const row = document.createElement("article");
    row.className = "board-list-item";

    const copy = document.createElement("div");
    copy.className = "board-list-copy";

    const title = document.createElement("h2");
    title.textContent = board.title;

    const date = document.createElement("p");
    date.textContent = formatBoardDate(board.created_at);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "button secondary compact";
    openButton.textContent = "Open kaart";
    openButton.addEventListener("click", () => openListedBoard(board.share_token, openButton));

    copy.append(title, date);
    row.append(copy, openButton);
    fragment.appendChild(row);
  }

  elements.boardList.replaceChildren(fragment);
}

function formatBoardDate(value) {
  if (!value) return "Bestaande kaart";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bestaande kaart";
  return `Aangemaakt op ${new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date)}`;
}

async function openListedBoard(token, button) {
  button.disabled = true;
  elements.listError.textContent = "";

  try {
    setShareUrl(token);
    await openBoard(token);
  } catch (error) {
    console.error(error);
    elements.listError.textContent = readableError(error);
    button.disabled = false;
  }
}

async function openBoard(token) {
  setConnection(null, "Verbinden");
  const session = await ensureAnonymousSession();
  currentUserId = session?.user?.id ?? currentUserId;

  const { data: joinedBoardId, error: joinError } = await supabase.rpc("join_bingo_board", {
    p_share_token: token
  });
  if (joinError) throw joinError;
  if (!joinedBoardId) throw new Error("Kaart niet gevonden.");

  boardId = joinedBoardId;
  boardToken = token;

  const [{ data: board, error: boardError }, { data: boardSquares, error: squaresError }] =
    await Promise.all([
      supabase.from("bingo_boards").select("id, title").eq("id", boardId).single(),
      supabase
        .from("bingo_squares")
        .select("id, position, text, checked, is_free")
        .eq("board_id", boardId)
        .order("position", { ascending: true })
    ]);

  if (boardError) throw boardError;
  if (squaresError) throw squaresError;
  if (!boardSquares || boardSquares.length !== 25) {
    throw new Error("Deze kaart is niet compleet.");
  }

  elements.boardTitleDisplay.textContent = board.title;
  elements.resetButton.hidden = false;
  squares = boardSquares;
  renderBoard();
  setView("board");
  subscribeToBoard();
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  for (const square of squares) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "square";
    button.dataset.squareId = String(square.id);
    button.dataset.position = String(square.position);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-pressed", String(square.checked));
    button.textContent = square.text;
    button.title = square.checked ? "Klik om het vinkje weg te halen" : "Klik om af te vinken";

    if (square.checked) button.classList.add("checked");
    if (square.is_free) button.classList.add("free");

    button.addEventListener("click", () => toggleSquare(square.id));
    fragment.appendChild(button);
  }

  elements.bingoGrid.replaceChildren(fragment);
  updateProgress();
}

function updateSquareInDom(square) {
  const button = elements.bingoGrid.querySelector(`[data-square-id="${square.id}"]`);
  if (!button) return;
  button.classList.toggle("checked", square.checked);
  button.setAttribute("aria-pressed", String(square.checked));
  button.title = square.checked ? "Klik om het vinkje weg te halen" : "Klik om af te vinken";
}

async function toggleSquare(squareId) {
  const square = squares.find((item) => String(item.id) === String(squareId));
  if (!square) return;
  if (square.is_free) {
    showToast("Scheel kijken blijft afgevinkt.");
    return;
  }

  const button = elements.bingoGrid.querySelector(`[data-square-id="${squareId}"]`);
  button?.classList.add("busy");
  elements.boardError.textContent = "";

  const nextChecked = !square.checked;
  square.checked = nextChecked;
  updateSquareInDom(square);
  updateProgress();

  try {
    const { error } = await supabase.rpc("set_bingo_square_checked", {
      p_square_id: squareId,
      p_checked: nextChecked
    });
    if (error) throw error;
  } catch (error) {
    square.checked = !nextChecked;
    updateSquareInDom(square);
    updateProgress();
    elements.boardError.textContent = readableError(error);
  } finally {
    button?.classList.remove("busy");
  }
}

function updateProgress() {
  const checkedCount = squares.filter((square) => square.checked).length;
  const bingoCount = BINGO_LINES.filter((line) =>
    line.every((position) => squares.find((square) => square.position === position)?.checked)
  ).length;

  elements.progressText.textContent = `${checkedCount} van 25 afgevinkt`;
  elements.progressBar.style.width = `${(checkedCount / 25) * 100}%`;
  elements.bingoText.textContent = bingoCount > 0 ? `${bingoCount === 1 ? "Bingo" : `${bingoCount} bingo's`}` : "";

  const hasBingo = bingoCount > 0;
  if (hasBingo && !hadBingo) showToast("Bingo!");
  hadBingo = hasBingo;
}

function subscribeToBoard() {
  if (boardChannel) supabase.removeChannel(boardChannel);

  boardChannel = supabase
    .channel(`bingo-board-${boardId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "bingo_squares",
        filter: `board_id=eq.${boardId}`
      },
      (payload) => {
        const changed = payload.new;
        const square = squares.find((item) => String(item.id) === String(changed.id));
        if (!square) return;
        square.checked = changed.checked;
        updateSquareInDom(square);
        updateProgress();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setConnection("online", "Live verbonden");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("offline", "Verbinding verbroken");
      }
    });
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Deellink gekopieerd.");
  } catch {
    window.prompt("Kopieer deze link", window.location.href);
  }
}

async function resetBoard() {
  const accepted = window.confirm("Nieuwe ronde starten? Dit wist alle vinkjes voor iedereen. Scheel kijken blijft afgevinkt.");
  if (!accepted) return;

  elements.resetButton.disabled = true;
  elements.boardError.textContent = "";

  try {
    const { error } = await supabase.rpc("reset_bingo_board", { p_board_id: boardId });
    if (error) throw error;
    squares.forEach((square) => {
      square.checked = square.is_free;
      updateSquareInDom(square);
    });
    updateProgress();
    showToast("Nieuwe ronde gestart.");
  } catch (error) {
    elements.boardError.textContent = readableError(error);
  } finally {
    elements.resetButton.disabled = false;
  }
}

function readableError(error) {
  const message = String(error?.message || error || "Er ging iets mis.");

  if (message.includes("Anonymous sign-ins are disabled")) {
    return "Zet Anonymous Sign-Ins aan in Supabase Auth.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Geen verbinding met Supabase. Controleer config.js en je internetverbinding.";
  }
  if (message.includes("Kaart niet gevonden") || message.includes("Board not found")) {
    return "Deze bingokaart bestaat niet of de link is onjuist.";
  }
  if (message.includes("list_bingo_boards") || message.includes("function") && message.includes("does not exist")) {
    return "Voer de nieuwste supabase.sql uit. Daarna kunnen bestaande kaarten worden geladen.";
  }
  if (message.includes("Invalid API key") || message.includes("apikey")) {
    return "De Supabase sleutel in config.js klopt niet.";
  }
  if (message.includes("Not a board member")) {
    return "Je hebt geen toegang tot deze bingokaart.";
  }

  return message;
}

async function init() {
  updateItemCount();
  elements.items.addEventListener("input", updateItemCount);
  elements.createForm.addEventListener("submit", createBoard);
  elements.copyButton.addEventListener("click", copyShareLink);
  elements.resetButton.addEventListener("click", resetBoard);
  elements.newBoardChoice.addEventListener("click", () => setView("setup"));
  elements.existingBoardChoice.addEventListener("click", loadBoards);
  elements.backFromCreate.addEventListener("click", showLanding);
  elements.backFromList.addEventListener("click", showLanding);
  elements.refreshBoards.addEventListener("click", loadBoards);
  elements.boardSearch.addEventListener("input", renderBoardList);

  window.addEventListener("online", () => setConnection(null, "Opnieuw verbinden"));
  window.addEventListener("offline", () => setConnection("offline", "Geen internet"));

  if (!hasConfig) {
    showMessage("Website niet ingesteld", "Vul eerst je Supabase URL en publishable key in config.js in.");
    setConnection("offline", "Niet ingesteld");
    return;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  const token = getTokenFromHash();
  if (token) {
    try {
      await openBoard(token);
    } catch (error) {
      console.error(error);
      showMessage("Deze kaart kan niet worden geopend", readableError(error));
      setConnection("offline", "Niet verbonden");
    }
    return;
  }

  setView("landing");
  try {
    await ensureAnonymousSession();
    setConnection("online", "Klaar");
  } catch (error) {
    showMessage("Geen verbinding", readableError(error));
    setConnection("offline", "Niet verbonden");
  }
}

init();
