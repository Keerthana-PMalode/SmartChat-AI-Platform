import {
    fileRequest
}
    from "./api.js";
const uploadBtn =
    document.getElementById(
        "submitUpload"
    );
uploadBtn.addEventListener(
    "click",
    uploadFile
);
async function uploadFile() {
    const file =
        document
            .getElementById(
                "fileInput"
            )
            .files[0];
    if (!file) {
        alert(
            "Select a file"
        );
        return;
    }
    const formData =
        new FormData();
    formData.append(
        "file",
        file
    );
    const response =
        await fileRequest(
            "/upload",
            {
                method: "POST",
                body: formData
            }
        );
    if (response.ok) {
        alert(
            "File encrypted and uploaded"
        );
    }
}