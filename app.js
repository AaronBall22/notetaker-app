let folders = JSON.parse(localStorage.getItem("folders")) || [
  "Math",
  "Fitness Goals",
  "Organization",
  "Diet",
];
let currentFolder = null;
let mode = "text";
let drawing = false;
let ctx;

function loadFolders() {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = "";
  folders.forEach((folder) => {
    const li = document.createElement("li");
    li.textContent = folder;
    li.onclick = () => openFolder(folder);
    folderList.appendChild(li);
  });
}

function createFolder() {
  const folderName = prompt("Enter new folder name:");
  if (folderName && !folders.includes(folderName)) {
    folders.push(folderName);
    localStorage.setItem("folders", JSON.stringify(folders));
    loadFolders();
  } else if (folders.includes(folderName)) {
    alert("Folder already exists!");
  }
}

function deleteFolder() {
  if (!folders.length) {
    alert("No folders to delete.");
    return;
  }
  const folderName = prompt("Enter the folder name to delete:");
  if (folderName && folders.includes(folderName)) {
    folders = folders.filter((f) => f !== folderName);
    localStorage.setItem("folders", JSON.stringify(folders));

    for (let key in localStorage) {
      if (key.startsWith(folderName + "-")) {
        localStorage.removeItem(key);
      }
    }

    if (currentFolder === folderName) {
      currentFolder = null;
      document.getElementById("noteArea").innerText =
        "Select or create a note!";
    }

    loadFolders();
    alert(`Folder "${folderName}" deleted.`);
  } else {
    alert("Folder not found.");
  }
}

function openFolder(folderName) {
  currentFolder = folderName;
  showTextEditor();
  document.getElementById(
    "noteArea"
  ).innerText = `Opened folder: ${folderName}. Create a new note or select an existing one.`;
}

function createNote() {
  if (!currentFolder) {
    alert("Please select a folder first.");
    return;
  }
  const noteName = prompt("Enter note name:");
  if (noteName) {
    const noteKey = `${currentFolder}-${noteName}`;
    localStorage.setItem(noteKey, "");
    showTextEditor();
    document.getElementById("noteArea").innerText = "";
  }
}

function deleteNote() {
  if (!currentFolder) {
    alert("Select a folder and note first.");
    return;
  }
  const noteName = prompt("Enter note name to delete:");
  if (noteName) {
    const noteKey = `${currentFolder}-${noteName}`;
    localStorage.removeItem(noteKey);
    document.getElementById("noteArea").innerText = "Note deleted.";
  }
}

function setMode(newMode) {
  mode = newMode;
  if (mode === "draw") {
    showCanvas();
  } else if (mode === "text") {
    showTextEditor();
  }
}

function uploadImage() {
  if (mode !== "draw") {
    alert("You must be in Draw mode to upload an image!");
    return;
  }

  const fileInput = document.getElementById("imageUploadInput");
  fileInput.click();

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 50, 50, img.width / 2, img.height / 2);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
}

function showCanvas() {
  document.getElementById("noteArea").classList.add("hidden");
  const canvas = document.getElementById("drawCanvas");
  canvas.classList.remove("hidden");
  canvas.width = window.innerWidth - 250;
  canvas.height = window.innerHeight - 150;
  ctx = canvas.getContext("2d");
  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";
}

function showTextEditor() {
  document.getElementById("drawCanvas").classList.add("hidden");
  document.getElementById("noteArea").classList.remove("hidden");
}

window.onload = () => {
  loadFolders();
  setupDrawing();
};

function setupDrawing() {
  const canvas = document.getElementById("drawCanvas");

  canvas.addEventListener("mousedown", (e) => {
    if (mode !== "draw") return;
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (drawing && mode === "draw") {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });

  canvas.addEventListener("mouseup", () => {
    if (mode !== "draw") return;
    drawing = false;
  });

  canvas.addEventListener("mouseleave", () => {
    if (mode !== "draw") return;
    drawing = false;
  });
}
