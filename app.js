import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.BINGO_CONFIG ?? {};
const hasConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  !config.SUPABASE_URL.includes("JOUW-PROJECT") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !config.SUPABASE_PUBLISHABLE_KEY.includes("JOUW-PUBLISHABLE");

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  boardPanel: document.querySelector("#boardPanel"),
  messagePanel: document.querySelector("#messagePanel"),
  messageText: document.querySelector("#messageText"),
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
let boardChannel = null;
let toastTimer = null;
let hadBingo = false;

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
  elements.setupPanel.hidden = view !== "setup";
  elements.boardPanel.hidden = view !== "board";
  elements.messagePanel.hidden = view !== "message";
}

function setConnection(status, label) {
  elements.connectionStatus.classList.remove("online", "offline");
  if (status) elements.connectionStatus.classList.add(status);
  elements.connectionStatus.querySelector("span:last-child").textContent = label;
}

function showMessage(text) {
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
  elements.itemCount.textContent = `${count} van 24 of 25`;
  elements.itemCount.style.color = count === 24 || count === 25 ? "#14532d" : "";
}

function getTokenFromHash() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(rawHash).get("token")?.trim() || null;
}

function setShareUrl(token) {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({ token }).toString();
  window.history.replaceState({}, "", url);
}

async function ensureAnonymousSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
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

  if (items.length !== 24 && items.length !== 25) {
    elements.setupError.textContent = "Vul precies 24 of 25 niet-lege regels in.";
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

async function openBoard(token) {
  setConnection(null, "Verbinden");
  await ensureAnonymousSession();

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
    showToast("Het vrije vak blijft afgevinkt.");
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
  const accepted = window.confirm("Alle vinkjes op deze gedeelde kaart wissen?");
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
    showToast("Alle vinkjes zijn gewist.");
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
  if (message.includes("Invalid API key") || message.includes("apikey")) {
    return "De Supabase sleutel in config.js klopt niet.";
  }

  return message;
}

async function init() {
  updateItemCount();
  elements.items.addEventListener("input", updateItemCount);
  elements.createForm.addEventListener("submit", createBoard);
  elements.copyButton.addEventListener("click", copyShareLink);
  elements.resetButton.addEventListener("click", resetBoard);

  window.addEventListener("online", () => setConnection(null, "Opnieuw verbinden"));
  window.addEventListener("offline", () => setConnection("offline", "Geen internet"));

  if (!hasConfig) {
    showMessage("Vul eerst je Supabase URL en publishable key in config.js in.");
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
  if (!token) {
    setView("setup");
    try {
      await ensureAnonymousSession();
      setConnection("online", "Klaar");
    } catch (error) {
      elements.setupError.textContent = readableError(error);
      setConnection("offline", "Niet verbonden");
    }
    return;
  }

  try {
    await openBoard(token);
  } catch (error) {
    console.error(error);
    showMessage(readableError(error));
    setConnection("offline", "Niet verbonden");
  }
}

init();
