import { fileRequest } from "./api.js";

const uploadBtn = document.getElementById("submitUpload");
const refreshBtn = document.getElementById("refreshBtn");
const backBtn = document.getElementById("backBtn");

uploadBtn.addEventListener("click", uploadFile);

refreshBtn.addEventListener("click", loadFiles);

backBtn.addEventListener("click", () => {
  window.history.back();
});

export async function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];

  if (!file) {
    alert("Select a file");
    return;
  }

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Encrypting & Uploading...";

    const formData = new FormData();
    formData.append("file", file);

    const response = await fileRequest("/files/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();

      console.log("Upload successful:", result);

      alert(`File encrypted and uploaded: ${result.filename}`);

      // Clear selected file
      fileInput.value = "";

      // Refresh file list
      await loadFiles();
    } else {
      const error = await response.text();

      console.error("Upload failed:", response.status, error);

      if (response.status === 401) {
        alert("Your session has expired. Please log in again.");
        localStorage.removeItem("authToken");
        window.location.href = "login.html";
        return;
      }

      alert(`Upload failed (${response.status}): ${error}`);
    }
  } catch (error) {
    console.error("Upload request failed:", error);

    alert("Could not connect to the file service.");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Encrypt & Upload";
  }
}

export async function loadFiles() {
  const filesTable = document.getElementById("filesTable");

  filesTable.innerHTML = `
    <tr>
      <td colspan="3">Loading files...</td>
    </tr>
  `;

  try {
    const response = await fileRequest("/files");

    if (!response) {
      return;
    }

    if (response.status === 401) {
      alert("Your session has expired. Please log in again.");

      localStorage.removeItem("authToken");
      window.location.href = "login.html";

      return;
    }

    if (!response.ok) {
      const error = await response.text();

      console.error("Failed to load files:", response.status, error);

      filesTable.innerHTML = `
        <tr>
          <td colspan="3">Failed to load files.</td>
        </tr>
      `;

      return;
    }

    const files = await response.json();

    console.log("User files:", files);

    if (!files.length) {
      filesTable.innerHTML = `
        <tr>
          <td colspan="3">No files uploaded yet.</td>
        </tr>
      `;

      return;
    }

    filesTable.innerHTML = "";

    files.forEach((file) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${escapeHtml(file.original_filename)}</td>
        <td>
          <span class="status">${escapeHtml(file.status || "Unknown")}</span>
        </td>
        <td>
          <button
            class="download-btn"
            data-file-id="${file.id}">
            Download
          </button>

          <button
            class="delete-btn"
            data-file-id="${file.id}"
            data-file-name="${escapeHtml(file.original_filename)}">
            Delete
          </button>
        </td>
      `;

      filesTable.appendChild(row);
    });

    document.querySelectorAll(".download-btn").forEach((button) => {
      button.addEventListener("click", () =>
        downloadFile(button.dataset.fileId),
      );
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", () =>
        deleteFile(button.dataset.fileId, button.dataset.fileName, button),
      );
    });
  } catch (error) {
    console.error("Could not load files:", error);

    filesTable.innerHTML = `
      <tr>
        <td colspan="3">
          Could not connect to the file service.
        </td>
      </tr>
    `;
  }
}

async function downloadFile(fileId) {
  try {
    const response = await fileRequest(`/files/${fileId}/download`);

    if (response.status === 401) {
      alert("Your session has expired.");

      localStorage.removeItem("authToken");

      window.location.href = "login.html";

      return;
    }

    if (response.status === 403) {
      alert("You do not have permission to download this file.");

      return;
    }

    if (!response.ok) {
      const error = await response.text();

      console.error("Download failed:", response.status, error);

      alert(`Download failed (${response.status})`);

      return;
    }

    // Convert response into a browser-downloadable blob
    const blob = await response.blob();

    // Get filename from Content-Disposition
    const disposition = response.headers.get("Content-Disposition");

    let filename = "download";

    if (disposition) {
      const match = disposition.match(/filename="([^"]+)"/);

      if (match) {
        filename = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download request failed:", error);

    alert("Could not download the file.");
  }
}

async function deleteFile(fileId, filename, button) {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${filename}"?`,
  );

  if (!confirmed) {
    return;
  }

  // Prevent repeated clicks
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    const response = await fileRequest(`/files/${fileId}`, {
      method: "DELETE",
    });

    if (response.status === 401) {
      alert("Your session has expired.");

      localStorage.removeItem("authToken");
      window.location.href = "login.html";

      return;
    }

    if (response.status === 403) {
      alert("You do not have permission to delete this file.");

      return;
    }

    if (response.status === 404) {
      alert("File not found.");

      await loadFiles();

      return;
    }

    if (!response.ok) {
      const error = await response.text();

      console.error("Delete failed:", response.status, error);

      alert(`Delete failed (${response.status}): ${error}`);

      return;
    }

    const result = await response.json();

    console.log("File deleted:", result);

    alert(`"${filename}" deleted successfully.`);

    // Refresh the file list
    await loadFiles();
  } catch (error) {
    console.error("Delete request failed:", error);

    alert("Could not connect to the file service.");
  } finally {
    // If the file list wasn't refreshed, restore the button
    button.disabled = false;
    button.textContent = "Delete";
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}

// Load files when page opens
loadFiles();
